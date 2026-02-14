"""
GLM-5 Inference Server on Modal
================================

Deploys GLM-5 (zai-org/GLM-5-FP8) on 8x B200 GPUs using SGLang.
Exposes an OpenAI-compatible API at /v1/chat/completions.

Usage:
    # Deploy to Modal
    modal deploy infra/deploy_glm5.py
    
    # Test locally (dummy weights, no GPU needed for syntax check)
    APP_USE_DUMMY_WEIGHTS=1 modal run infra/deploy_glm5.py

    # Test with real model
    modal run infra/deploy_glm5.py --content "Write a hello world in TypeScript"
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import time
from pathlib import Path

import modal
import modal.experimental

# =============================================================================
# CONFIGURATION
# =============================================================================

REPO_ID = "zai-org/GLM-5-FP8"
GPU_TYPE = "B200"
GPU_COUNT = 8
SGLANG_PORT = 8000
MINUTES = 60

# Scaling
REGION = "us"
MIN_CONTAINERS = 0  # Set to 1 for production to avoid cold starts ($50/hr always-on cost)
TARGET_INPUTS = 50  # Concurrent requests per replica

# =============================================================================
# IMAGE DEFINITION
# =============================================================================

# Base: SGLang v0.5.8 official image
image = (
    modal.Image.from_registry("lmsysorg/sglang:v0.5.8")
    .entrypoint([])
    .pip_install("transformers>=4.46.0", "aiohttp")
)

# HuggingFace cache volume (persist model weights across deploys)
hf_cache_vol = modal.Volume.from_name("hf-cache-glm5", create_if_missing=True)

# Environment
USE_DUMMY_WEIGHTS = os.environ.get("APP_USE_DUMMY_WEIGHTS", "0") == "1"

image = image.env({
    "HF_HOME": "/root/.cache/huggingface",
    "SGLANG_ALLOW_OVERWRITE_LONGER_CONTEXT_LEN": "1",
    "APP_USE_DUMMY_WEIGHTS": str(int(USE_DUMMY_WEIGHTS)),
})

# Download model weights at image build time (skip if dummy)
if not USE_DUMMY_WEIGHTS:
    def _download_model():
        from huggingface_hub import snapshot_download
        snapshot_download(repo_id=REPO_ID)
    
    image = image.run_function(
        _download_model,
        volumes={"/root/.cache/huggingface": hf_cache_vol},
    )

# =============================================================================
# SGLANG SERVER MANAGEMENT
# =============================================================================

def _build_server_command() -> str:
    """Build the SGLang launch command."""
    cmd_parts = [
        "python", "-m", "sglang.launch_server",
        "--host", "0.0.0.0",
        "--port", str(SGLANG_PORT),
        "--model-path", REPO_ID,
        "--served-model-name", "glm-5",
        "--tp", str(GPU_COUNT),
        "--trust-remote-code",
        "--mem-fraction-static", "0.85",
        "--chunked-prefill-size", "32768",
    ]
    
    if USE_DUMMY_WEIGHTS:
        cmd_parts.extend(["--load-format", "dummy"])
    
    return " ".join(cmd_parts)


def _start_server() -> subprocess.Popen:
    """Start SGLang server as a subprocess."""
    cmd = _build_server_command()
    print(f"Starting SGLang: {cmd}")
    env = os.environ.copy()
    if not USE_DUMMY_WEIGHTS:
        env["HF_HUB_OFFLINE"] = "1"  # Use cached weights
    return subprocess.Popen(cmd, shell=True, env=env, start_new_session=True)


def _wait_for_server(timeout: int = 600) -> None:
    """Wait for SGLang server to be ready."""
    import urllib.request
    url = f"http://localhost:{SGLANG_PORT}/health"
    deadline = time.time() + timeout
    
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                if resp.status == 200:
                    print("SGLang server ready!")
                    return
        except Exception:
            pass
        time.sleep(5)
        print(f"Waiting for SGLang... ({int(deadline - time.time())}s remaining)")
    
    raise TimeoutError(f"SGLang server failed to start within {timeout}s")


# =============================================================================
# MODAL APP
# =============================================================================

app = modal.App("glm5-inference", image=image)


@app.cls(
    gpu=f"{GPU_TYPE}:{GPU_COUNT}",
    timeout=30 * MINUTES,
    scaledown_window=20 * MINUTES,
    volumes={"/root/.cache/huggingface": hf_cache_vol},
    region=REGION,
    min_containers=MIN_CONTAINERS,
)
@modal.experimental.http_server(
    port=SGLANG_PORT,
    startup_timeout=10 * MINUTES,
)
@modal.concurrent(target_inputs=TARGET_INPUTS)
class GLM5:
    """GLM-5 inference server with OpenAI-compatible API."""

    @modal.enter()
    def start(self):
        """Start SGLang server on container startup."""
        self.proc = _start_server()
        _wait_for_server()
        print("GLM-5 server started successfully")

    @modal.exit()
    def stop(self):
        """Clean shutdown."""
        if hasattr(self, "proc") and self.proc:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()


# =============================================================================
# UTILITY: Get endpoint URL
# =============================================================================

@app.function()
def get_endpoint_url() -> str:
    """Return the inference endpoint URL."""
    urls = GLM5._experimental_get_flash_urls()
    return urls[0] if urls else "No endpoint available"


# =============================================================================
# TEST ENTRYPOINT
# =============================================================================

@app.local_entrypoint()
def test(content: str | None = None):
    """
    Test the deployed GLM-5 endpoint.
    
    Usage:
        modal run infra/deploy_glm5.py
        modal run infra/deploy_glm5.py --content "Write hello world in TypeScript"
    """
    import aiohttp
    
    url = GLM5._experimental_get_flash_urls()[0]
    print(f"Endpoint URL: {url}")
    
    if content is None:
        content = "Write a TypeScript function that reverses a string. Include the type signature."
    
    messages = [
        {"role": "system", "content": "You are a helpful coding assistant. Write clean, typed code."},
        {"role": "user", "content": content},
    ]
    
    async def _test():
        async with aiohttp.ClientSession(base_url=url) as session:
            payload = {
                "model": "glm-5",
                "messages": messages,
                "stream": True,
                "max_tokens": 2048,
                "temperature": 0.7,
            }
            
            async with session.post(
                "/v1/chat/completions",
                json=payload,
                headers={"Accept": "text/event-stream"},
            ) as resp:
                resp.raise_for_status()
                full = ""
                async for raw in resp.content:
                    line = raw.decode("utf-8", errors="ignore").strip()
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        evt = json.loads(data)
                        chunk = (evt.get("choices") or [{}])[0].get("delta", {}).get("content", "")
                        if chunk:
                            print(chunk, end="", flush=True)
                            full += chunk
                    except json.JSONDecodeError:
                        continue
                print()
                return full
    
    result = asyncio.run(_test())
    print(f"\n--- Generated {len(result)} characters ---")
