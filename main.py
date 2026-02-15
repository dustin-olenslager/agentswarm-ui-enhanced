#!/usr/bin/env python3
"""
AgentSwarm CLI — run the orchestrator with human-readable logs.

Usage:
    python main.py
    python main.py "Build a playable MVP of Minecraft"
    python main.py --dashboard          # also launch the Rich TUI
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from typing import Any

DIM = "\033[2m"
RESET = "\033[0m"
BOLD = "\033[1m"
RED = "\033[31m"
YELLOW = "\033[33m"
GREEN = "\033[32m"
CYAN = "\033[36m"
MAGENTA = "\033[35m"
BLUE = "\033[34m"
WHITE = "\033[37m"

LEVEL_STYLE: dict[str, str] = {
    "debug": DIM,
    "info": GREEN,
    "warn": YELLOW,
    "error": RED,
}

AGENT_STYLE: dict[str, str] = {
    "planner": CYAN,
    "orchestrator": MAGENTA,
    "monitor": BLUE,
    "worker-pool": MAGENTA,
    "reconciler": YELLOW,
    "merge-queue": BLUE,
    "llm-client": DIM,
    "main": WHITE,
    "shared": DIM,
}


def format_ts(epoch_ms: int) -> str:
    return datetime.fromtimestamp(epoch_ms / 1000).strftime("%H:%M:%S")


def format_data(data: dict[str, Any]) -> str:
    if not data:
        return ""
    parts: list[str] = []
    for k, v in data.items():
        if isinstance(v, float):
            v = f"{v:.2f}"
        elif isinstance(v, str) and len(v) > 120:
            v = v[:120] + "…"
        parts.append(f"{k}={v}")
    return " ".join(parts)


def format_line(entry: dict[str, Any]) -> str:
    ts = format_ts(entry.get("timestamp", 0))
    level: str = entry.get("level", "info")
    agent: str = entry.get("agentId", "?")
    msg: str = entry.get("message", "")
    data: dict[str, Any] = entry.get("data", {})

    lstyle = LEVEL_STYLE.get(level, "")
    astyle = AGENT_STYLE.get(agent, WHITE)

    parts = [
        f"{DIM}{ts}{RESET}",
        f"{lstyle}{level.upper():5s}{RESET}",
        f"{astyle}{agent:14s}{RESET}",
        f"{BOLD}{msg}{RESET}",
    ]

    data_str = format_data(data)
    if data_str:
        parts.append(f"{DIM}{data_str}{RESET}")

    return " ".join(parts)


def format_metrics_bar(data: dict[str, Any]) -> str:
    active = data.get("activeWorkers", 0)
    pending = data.get("pendingTasks", 0)
    completed = data.get("completedTasks", 0)
    failed = data.get("failedTasks", 0)
    cph = data.get("commitsPerHour", 0)
    tokens = data.get("totalTokensUsed", 0)

    return (
        f"  {BOLD}workers={CYAN}{active}{RESET}"
        f"  {BOLD}pending={YELLOW}{pending}{RESET}"
        f"  {BOLD}done={GREEN}{completed}{RESET}"
        f"  {BOLD}failed={RED}{failed}{RESET}"
        f"  {BOLD}commits/hr={CYAN}{cph:.0f}{RESET}"
        f"  {BOLD}tokens={DIM}{tokens:,}{RESET}"
    )


def run(request: str, with_dashboard: bool = False, reset: bool = False) -> int:
    project_root = os.path.dirname(os.path.abspath(__file__))
    node_cmd = ["node", "packages/orchestrator/dist/main.js", request]

    print(f"{BOLD}{CYAN}▶ AgentSwarm{RESET}")
    print(f"  {DIM}Request:{RESET} {request[:120]}")
    print(f"  {DIM}CWD:{RESET}     {project_root}")
    print()

    if reset:
        reset_script = os.path.join(project_root, "scripts", "reset-target.sh")
        print(f"{YELLOW}⟳ Resetting target repo…{RESET}")
        result = subprocess.run(["bash", reset_script], cwd=project_root)
        if result.returncode != 0:
            print(f"{RED}✗ Reset failed (exit code {result.returncode}){RESET}")
            return result.returncode
        print(f"{GREEN}✓ Target repo reset to initial commit{RESET}")
        print()

    proc = subprocess.Popen(
        node_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=project_root,
    )
    assert proc.stdout is not None

    dashboard_proc: subprocess.Popen[bytes] | None = None
    if with_dashboard:
        dashboard_proc = subprocess.Popen(
            [sys.executable, os.path.join(project_root, "dashboard.py"), "--stdin"],
            stdin=subprocess.PIPE,
            cwd=project_root,
        )

    def shutdown(signum: int | None = None, frame: Any = None) -> None:
        print(f"\n{YELLOW}⏹ Shutting down…{RESET}")
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        if dashboard_proc:
            dashboard_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    last_metrics: dict[str, Any] | None = None
    start_time = time.time()

    for raw_line in iter(proc.stdout.readline, b""):
        line = raw_line.decode("utf-8", errors="replace").rstrip()
        if not line:
            continue

        if dashboard_proc and dashboard_proc.stdin:
            try:
                dashboard_proc.stdin.write(raw_line)
                dashboard_proc.stdin.flush()
            except BrokenPipeError:
                dashboard_proc = None

        try:
            entry: dict[str, Any] = json.loads(line)
        except json.JSONDecodeError:
            print(f"{DIM}{line}{RESET}")
            continue

        msg: str = entry.get("message", "")
        data: dict[str, Any] = entry.get("data", {})

        if msg == "Metrics":
            last_metrics = data
            elapsed = int(time.time() - start_time)
            m, s = divmod(elapsed, 60)
            h, m = divmod(m, 60)
            time_str = f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
            sys.stdout.write(f"\r{DIM}[{time_str}]{RESET}{format_metrics_bar(data)}    ")
            sys.stdout.flush()
            continue

        if last_metrics and entry.get("agentId") != "monitor":
            print()

        print(format_line(entry))

    proc.wait()
    exit_code = proc.returncode

    if dashboard_proc and dashboard_proc.stdin:
        dashboard_proc.stdin.close()
        dashboard_proc.wait()

    print()
    if exit_code == 0:
        print(f"{GREEN}{BOLD}✓ Orchestrator finished{RESET}")
    else:
        print(f"{RED}{BOLD}✗ Orchestrator exited with code {exit_code}{RESET}")

    if last_metrics:
        print(format_metrics_bar(last_metrics))

    print()
    return exit_code


def main() -> None:
    ap = argparse.ArgumentParser(description="AgentSwarm CLI")
    ap.add_argument("request", help="Build request, e.g. 'Build Minecraft according to SPEC.md'")
    ap.add_argument("--dashboard", action="store_true",
                    help="Also launch the Rich TUI dashboard")
    ap.add_argument("--reset", action="store_true",
                    help="Reset target repo to initial commit before running")
    args = ap.parse_args()

    sys.exit(run(args.request, args.dashboard, args.reset))


if __name__ == "__main__":
    main()
