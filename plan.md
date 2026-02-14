Harness Architecture
agentswarm/
├── package.json                    # Root monorepo
├── tsconfig.json
├── turbo.json                      # Turborepo for monorepo builds
│
├── packages/
│   ├── core/                       # Shared types, protocols, utilities
│   │   ├── src/
│   │   │   ├── types.ts            # Handoff, Task, AgentStatus, WorkerConfig
│   │   │   ├── protocol.ts         # Message schemas (orchestrator ↔ sandbox)
│   │   │   ├── git.ts              # Git operations (branch, merge, conflict resolution)
│   │   │   └── logger.ts           # Structured logging with agent ID + timestamps
│   │   └── package.json
│   │
│   ├── orchestrator/               # LOCAL — runs on your machine
│   │   ├── src/
│   │   │   ├── index.ts            # Entry point — starts the harness
│   │   │   ├── planner.ts          # Root planner agent (LLM-powered)
│   │   │   ├── subplanner.ts       # Recursive subplanner spawning
│   │   │   ├── worker-pool.ts      # Manages Modal sandbox lifecycle
│   │   │   ├── task-queue.ts       # Task assignment + handoff collection
│   │   │   ├── merge-queue.ts      # Git merge queue (branch → main)
│   │   │   ├── reconciler.ts       # Periodic "green branch" sweep
│   │   │   ├── monitor.ts          # Behavioral monitoring (stuck detection, etc.)
│   │   │   └── config.ts           # Runtime config (concurrency, models, timeouts)
│   │   └── package.json
│   │
│   ├── sandbox/                    # REMOTE — runs inside Modal sandboxes
│   │   ├── src/
│   │   │   ├── server.ts           # HTTP server inside sandbox (receives tasks)
│   │   │   ├── agent.ts            # Thin coding agent wrapper (calls GLM-5)
│   │   │   ├── tools.ts            # File edit, bash, grep, git tools for the agent
│   │   │   ├── handoff.ts          # Produces handoff report when task complete
│   │   │   └── health.ts           # Health check + progress reporting
│   │   └── package.json
│   │
│   └── dashboard/                  # OPTIONAL — local web UI
│       ├── src/
│       │   ├── App.tsx             # React dashboard
│       │   ├── AgentGrid.tsx       # Live agent status grid
│       │   ├── CommitFeed.tsx      # Real-time commit stream
│       │   ├── MetricsPanel.tsx    # Commits/hr, cost, merge rate
│       │   └── LogViewer.tsx       # Agent conversation replay
│       └── package.json
│
├── infra/                          # Modal infrastructure
│   ├── sandbox_image.py            # Modal Image definition (Node, Git, tools)
│   ├── deploy_glm5.py              # GLM-5 deployment on 8x B200
│   ├── spawn_sandbox.py            # Sandbox creation + lifecycle helpers
│   └── requirements.txt
│
├── prompts/                        # All agent prompts (version controlled)
│   ├── root-planner.md             # Root planner system prompt
│   ├── subplanner.md               # Subplanner system prompt
│   ├── worker.md                   # Worker agent system prompt
│   └── reconciler.md               # Green-branch reconciler prompt
│
└── target-repo/                    # The project agents will BUILD
    ├── .git/
    ├── SPEC.md                     # Project specification (the "instructions")
    ├── FEATURES.json               # Feature list with pass/fail status
    └── ...                         # Agent-generated code goes here

---

## Current Status — What Has Been Completed

### Phase 1: Foundation — STATUS: ~85% COMPLETE

| Step | Description | Status | Details |
|------|-------------|--------|---------|
| 1.1 | Modal CLI setup | ✅ DONE | `requirements.txt` has `modal>=1.3.0`, `aiohttp>=3.9.0` |
| 1.2 | Scaffold monorepo | ✅ DONE | Root `package.json`, `tsconfig.base.json`, `turbo.json`, `pnpm-workspace.yaml` all present and configured. Turborepo with `build`/`typecheck`/`clean` tasks. pnpm workspaces pointing to `packages/*`. |
| 1.3 | `packages/core` — types, protocol, logger | ✅ DONE | **types.ts**: `Task`, `Handoff`, `SandboxStatus`, `HarnessConfig`, `LogEntry`, `MetricsSnapshot` — all fully typed. **protocol.ts**: `TaskAssignment`, `TaskResult`, `ProgressUpdate`, `HealthResponse` message schemas. **logger.ts**: Structured JSON logger with agent ID, role, task ID, level. **index.ts**: barrel export. `package.json` with ESM, composite TS config. **NOTE**: `git.ts` from the architecture diagram is NOT implemented — only types/protocol/logger exist. |
| 1.4 | `infra/sandbox_image.py` — Modal Image | ✅ DONE | Debian slim + Python 3.12, Node.js 22 via NodeSource, git, curl, wget, ripgrep, jq, tree, build-essential, pnpm 9. `create_agent_image()` for base, `create_agent_image_with_sandbox_package()` for extended image with compiled sandbox code. Test function `test_image()` verifies all tools present. |
| 1.5 | `infra/deploy_glm5.py` — GLM-5 on 8x B200 | ✅ DONE | SGLang v0.5.8 image, `zai-org/GLM-5-FP8` model, 8x B200 GPUs, HuggingFace cache volume, OpenAI-compatible `/v1/chat/completions` endpoint. Supports dummy weights for testing. Streaming test entrypoint. `glm5_client.py` helper for endpoint URL resolution and OpenAI config generation. |
| 1.6 | `packages/sandbox` — HTTP server + agent + tools | ✅ DONE | **server.ts**: Full HTTP server on configurable PORT with `POST /task`, `GET /health`, `GET /` endpoints, CORS, JSON parsing. **agent.ts**: Complete LLM-powered agent loop — system prompt + user message → iterative tool calling → handoff generation. Supports configurable max iterations (default 50), tracks tokens/tool calls. **tools.ts**: 8 tools defined in OpenAI function-calling format: `read_file`, `write_file`, `edit_file`, `bash_exec`, `grep_search`, `list_files`, `git_diff`, `git_commit`. All with full implementations including error handling, output truncation (10KB), ripgrep with grep fallback. **handoff.ts**: `buildHandoff()` function with git diff stat parsing for lines added/removed/files changed. **health.ts**: `HealthTracker` class tracking uptime, memory usage, current task, healthy/unhealthy status. **index.ts**: barrel export. `package.json` with `@agentswarm/core` workspace dependency. |
| 1.7 | `infra/spawn_sandbox.py` — sandbox lifecycle | ✅ DONE | `SandboxManager` class with full lifecycle: `create_sandbox()` (create Modal sandbox, start agent server, wait for tunnel URL, health poll), `send_task()` (clone repo, checkout branch, POST task assignment, collect handoff), `check_health()`, `terminate_sandbox()`, `terminate_all()`, `run_task()` (high-level create→send→collect→terminate). Error handling returns proper failure handoff on exceptions. |
| 1.8 | E2E test script | ✅ DONE | `scripts/test_sandbox.py` with 4 layered tests: (1) image build + tool verification, (2) basic sandbox ops (exec, file I/O, git, Node.js), (3) agent HTTP server endpoint testing, (4) full agent loop with GLM-5 (sends a "create greet.ts" task). CLI with `image`/`basic`/`server`/`full`/`all` subcommands. |

#### Phase 1 Remaining Gaps:
- **`core/git.ts`** — Listed in architecture but NOT implemented. Should contain git operations (branch, merge, conflict resolution) shared across packages.
- **End-to-end validation not confirmed** — The test script exists but we haven't confirmed it runs successfully against a live Modal deployment.
- **`prompts/worker.md`** — ✅ DONE. Clean, structured prompt with identity, tools, workflow, hard constraints, code quality standards, handoff format.

---

### Phase 2: Multi-Agent Core — STATUS: NOT STARTED (0%)

| Step | Description | Status | Details |
|------|-------------|--------|---------|
| 2.1 | `packages/orchestrator/planner.ts` — root planner agent | ❌ NOT STARTED | No `packages/orchestrator/` directory exists at all. The root planner needs to: read repo state + FEATURES.json, decompose work into parallel tasks, create Task objects, feed handoffs back into planning loop. |
| 2.2 | `packages/orchestrator/task-queue.ts` — task dispatch + handoff collection | ❌ NOT STARTED | Needs: priority queue for pending tasks, assignment tracking, handoff collection, task state machine (pending→assigned→running→complete/failed). |
| 2.3 | `packages/orchestrator/worker-pool.ts` — spawn/destroy N sandboxes | ❌ NOT STARTED | Needs: pool of N concurrent `SandboxManager` instances, auto-scaling, health monitoring, worker recycling, integration with `infra/spawn_sandbox.py`. |
| 2.4 | `packages/orchestrator/merge-queue.ts` — branch-per-worker merge | ❌ NOT STARTED | Needs: merge strategy implementation (fast-forward/rebase/merge-commit per `HarnessConfig`), conflict detection, conflict-resolution worker spawning, merge ordering. |
| 2.5 | Handoff protocol (worker → orchestrator → planner) | ❌ NOT STARTED | Protocol types exist in `core/protocol.ts` but no orchestrator-side handling. Needs: handoff collection, planner message formatting, state updates. |
| 2.6 | `packages/orchestrator/monitor.ts` — stuck detection | ❌ NOT STARTED | Needs: health polling loop, stuck worker detection (no progress for N seconds), empty diff alerts, timeout enforcement, worker restart logic. |
| 2.7 | `prompts/root-planner.md` and `prompts/worker.md` | 🔶 PARTIAL | `prompts/worker.md` ✅ exists and is complete. `prompts/root-planner.md` ❌ does NOT exist. |
| 2.8 | Multi-agent integration test | ❌ NOT STARTED | "Planner decomposes 'build a calculator app' into 5 tasks, 5 workers execute in parallel, all merge to main." |

#### Phase 2 — What Needs to Be Built (in dependency order):

1. **`packages/orchestrator/` scaffold** — `package.json`, `tsconfig.json`, barrel `index.ts`
2. **`packages/orchestrator/config.ts`** — Runtime config loading/defaults (concurrency, models, timeouts, merge strategy)
3. **`packages/orchestrator/task-queue.ts`** — Priority task queue with state machine
4. **`packages/orchestrator/worker-pool.ts`** — Pool managing N `SandboxManager` instances, calls into `infra/spawn_sandbox.py`
5. **`packages/orchestrator/merge-queue.ts`** — Git merge orchestration (requires `core/git.ts` or inline git ops)
6. **`packages/orchestrator/monitor.ts`** — Health polling, stuck detection, timeout enforcement
7. **`packages/orchestrator/planner.ts`** — LLM-powered root planner (reads repo, creates tasks, processes handoffs)
8. **`packages/orchestrator/index.ts`** — Entry point: initializes config, starts planner loop, manages lifecycle
9. **`prompts/root-planner.md`** — System prompt for the root planner agent
10. **`core/git.ts`** — Shared git operations (branch create, merge, conflict detection) — used by merge-queue

---

### Phase 3: Full Scale + Run — STATUS: NOT STARTED (0%)

| Step | Description | Status |
|------|-------------|--------|
| 3.1 | `packages/orchestrator/subplanner.ts` — recursive subplanners | ❌ NOT STARTED |
| 3.2 | `packages/orchestrator/reconciler.ts` — periodic green branch | ❌ NOT STARTED |
| 3.3 | `target-repo/SPEC.md` — Minecraft clone specification | ❌ NOT STARTED |
| 3.4 | `target-repo/FEATURES.json` — 200+ features pass/fail | ❌ NOT STARTED |
| 3.5 | `prompts/subplanner.md` and `prompts/reconciler.md` | ❌ NOT STARTED |
| 3.6 | Freshness mechanisms — scratchpad, auto-summarization | ❌ NOT STARTED |
| 3.7 | `packages/dashboard` — live web UI | ❌ NOT STARTED |
| 3.8 | Scale to 50-100 concurrent workers | ❌ NOT STARTED |
| 3.9 | Run against Minecraft spec for 12-20 hours | ❌ NOT STARTED |
| 3.10 | Monitor + tune prompts | ❌ NOT STARTED |

---

## Summary

| Phase | Progress | Key Blockers |
|-------|----------|--------------|
| **Phase 1: Foundation** | ~85% | `core/git.ts` missing, E2E test not validated on live infra |
| **Phase 2: Multi-Agent Core** | 0% | Entire `packages/orchestrator/` package needs to be built. This is the critical path. |
| **Phase 3: Full Scale + Run** | 0% | Blocked by Phase 2. Subplanners, reconciler, dashboard, target repo all unbuilt. |

## Recommended Next Steps (Priority Order)

1. **Validate Phase 1 E2E** — Run `scripts/test_sandbox.py basic` and `server` tests against Modal to confirm the sandbox pipeline works end-to-end before building orchestration on top of it.
2. **Build `packages/orchestrator/` (Phase 2)** — This is the highest-impact work. Start with config + task-queue + worker-pool, then planner + merge-queue.
3. **Write `prompts/root-planner.md`** — The planner prompt is critical for decomposition quality.
4. **Implement `core/git.ts`** — Shared git operations needed by merge-queue and reconciler.
5. **Integration test** — Validate the full planner→workers→merge loop with a simple task decomposition.

---

Key Protocol: How a Task Flows Through the System
1. PLANNER reads repo state + FEATURES.json
   ↓
2. PLANNER creates Task {
     id: "task-042",
     description: "Implement block breaking with raycasting",
     scope: ["src/engine/raycaster.ts", "src/world/blocks.ts"],
     acceptance: "Player can click blocks to break them. Unit test passes.",
     branch: "worker/task-042"
   }
   ↓
3. ORCHESTRATOR assigns task to next available sandbox
   ↓
4. WORKER-POOL spawns Modal sandbox with repo clone on branch "worker/task-042"
   ↓
5. SANDBOX AGENT receives task via HTTP POST
   → Reads task description
   → Reads relevant files in scope
   → Writes code, runs tests
   → Commits to branch
   → Produces Handoff {
       taskId: "task-042",
       status: "complete",
       summary: "Implemented raycasting...",
       diff: "<git diff>",
       concerns: ["Raycaster assumes fixed block size"],
       suggestions: ["Add variable block sizes in future"]
     }
   ↓
6. ORCHESTRATOR collects handoff, terminates sandbox
   ↓
7. MERGE-QUEUE merges branch to main (fast-forward or rebase)
   → If conflict: spawn conflict-resolution worker
   ↓
8. PLANNER receives handoff as follow-up message
   → Updates understanding of repo state
   → Creates next batch of tasks
   ↓
   (loop continues)
