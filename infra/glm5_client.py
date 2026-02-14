"""
GLM-5 Client Helper
====================

Simple OpenAI-compatible client for the deployed GLM-5 endpoint.
Used by the sandbox agent to make LLM calls.

Usage:
    from infra.glm5_client import create_glm5_client
    
    client = create_glm5_client("https://your-endpoint.modal.run")
    response = client.chat.completions.create(
        model="glm-5",
        messages=[{"role": "user", "content": "Hello"}]
    )
"""

import os


def get_endpoint_url() -> str:
    """
    Get the GLM-5 endpoint URL.
    
    Checks in order:
    1. GLM5_ENDPOINT env var
    2. Modal lookup (requires modal auth)
    """
    url = os.environ.get("GLM5_ENDPOINT")
    if url:
        return url
    
    raise RuntimeError(
        "GLM5_ENDPOINT environment variable not set. "
        "Deploy GLM-5 first: `modal deploy infra/deploy_glm5.py`"
    )


def create_openai_config(endpoint_url: str) -> dict[str, str]:
    """
    Create config dict for OpenAI-compatible client.
    
    Returns:
        dict with base_url, api_key, model suitable for openai.OpenAI()
    """
    return {
        "base_url": f"{endpoint_url.rstrip('/')}/v1",
        "api_key": os.environ.get("MODAL_TOKEN_ID", "not-needed"),
        "model": "glm-5",
    }
