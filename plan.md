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

### Phase 1: Foundation — STATUS: ~90% COMPLETE

| Step | Description | Status | Details |
|------|-------------|--------|---------|
| 1.1 | Modal CLI setup | ✅ DONE | `requirements.txt` has `modal>=1.3.0`, `aiohttp>=3.9.0` |
| 1.2 | Scaffold monorepo | ✅ DONE | Root `package.json`, `tsconfig.base.json`, `turbo.json`, `pnpm-workspace.yaml` all present and configured. Turborepo with `build`/`typecheck`/`clean` tasks. pnpm workspaces pointing to `packages/*`. |
| 1.3 | `packages/core` — types, protocol, logger, git | ✅ DONE | **types.ts**: `Task`, `Handoff`, `SandboxStatus`, `HarnessConfig`, `LogEntry`, `MetricsSnapshot` — all fully typed. **protocol.ts**: `TaskAssignment`, `TaskResult`, `ProgressUpdate`, `HealthResponse` message schemas. **logger.ts**: Structured JSON logger with agent ID, role, task ID, level. **git.ts**: 10 async git functions (createBranch, checkoutBranch, mergeBranch, rebaseBranch, getConflicts, getCurrentBranch, getDiffStat, getRecentCommits, getFileTree, hasUncommittedChanges) + 4 types (MergeResult, RebaseResult, DiffStat, CommitInfo). **index.ts**: barrel export for all modules. |
| 1.4 | `infra/sandbox_image.py` — Modal Image | ✅ DONE | Debian slim + Python 3.12, Node.js 22 via NodeSource, git, curl, wget, ripgrep, jq, tree, build-essential, pnpm 9. `create_agent_image()` for base, `create_agent_image_with_sandbox_package()` for extended image with compiled sandbox code. Test function `test_image()` verifies all tools present. |
| 1.5 | `infra/deploy_glm5.py` — GLM-5 on 8x B200 | ✅ DONE | SGLang v0.5.8 image, `zai-org/GLM-5-FP8` model, 8x B200 GPUs, HuggingFace cache volume, OpenAI-compatible `/v1/chat/completions` endpoint. Supports dummy weights for testing. Streaming test entrypoint. `glm5_client.py` helper for endpoint URL resolution and OpenAI config generation. |
| 1.6 | `packages/sandbox` — HTTP server + agent + tools | ✅ DONE | **server.ts**: Full HTTP server on configurable PORT with `POST /task`, `GET /health`, `GET /` endpoints, CORS, JSON parsing. **agent.ts**: Complete LLM-powered agent loop — system prompt + user message → iterative tool calling → handoff generation. Supports configurable max iterations (default 50), tracks tokens/tool calls. **tools.ts**: 8 tools defined in OpenAI function-calling format: `read_file`, `write_file`, `edit_file`, `bash_exec`, `grep_search`, `list_files`, `git_diff`, `git_commit`. All with full implementations including error handling, output truncation (10KB), ripgrep with grep fallback. **handoff.ts**: `buildHandoff()` function with git diff stat parsing for lines added/removed/files changed. **health.ts**: `HealthTracker` class tracking uptime, memory usage, current task, healthy/unhealthy status. **index.ts**: barrel export. `package.json` with `@agentswarm/core` workspace dependency. |
| 1.7 | `infra/spawn_sandbox.py` — sandbox lifecycle | ✅ DONE | `SandboxManager` class with full lifecycle: `create_sandbox()` (create Modal sandbox, start agent server, wait for tunnel URL, health poll), `send_task()` (clone repo, checkout branch, POST task assignment, collect handoff), `check_health()`, `terminate_sandbox()`, `terminate_all()`, `run_task()` (high-level create→send→collect→terminate). Error handling returns proper failure handoff on exceptions. |
| 1.8 | E2E test script | ✅ DONE | `scripts/test_sandbox.py` with 4 layered tests: (1) image build + tool verification, (2) basic sandbox ops (exec, file I/O, git, Node.js), (3) agent HTTP server endpoint testing, (4) full agent loop with GLM-5 (sends a "create greet.ts" task). CLI with `image`/`basic`/`server`/`full`/`all` subcommands. |

#### Phase 1 Remaining Gaps:
- **End-to-end validation not confirmed** — The test script exists but we haven't confirmed it runs successfully against a live Modal deployment.
- **`prompts/worker.md`** — ✅ DONE. Clean, structured prompt with identity, tools, workflow, hard constraints, code quality standards, handoff format.

---

### Phase 2: Multi-Agent Core — STATUS: ✅ COMPLETE (100%)

| Step | Description | Status | Details |
|------|-------------|--------|---------|
| 2.1 | `packages/orchestrator/` scaffold | ✅ DONE | `package.json` (ESM, `@agentswarm/core` workspace dep, `node:test` runner), `tsconfig.json` (composite, ES2022, NodeNext), barrel `src/index.ts` exporting all 7 modules. |
| 2.2 | `packages/orchestrator/config.ts` | ✅ DONE | `OrchestratorConfig` extending `HarnessConfig`, `loadConfig()` from env vars with defaults, `getConfig()` cached singleton. Required: `LLM_ENDPOINT`, `GIT_REPO_URL`. Supports all 3 merge strategies (fast-forward/rebase/merge-commit). 67 lines. |
| 2.3 | `packages/orchestrator/task-queue.ts` | ✅ DONE | `PriorityQueue` (min-heap) + `TaskQueue` (state machine: pending→assigned→running→complete/failed/cancelled). Callbacks for status transitions, `VALID_TRANSITIONS` map. 374 lines. |
| 2.4 | `packages/orchestrator/worker-pool.ts` | ✅ DONE | `WorkerPool` managing N Modal sandboxes. Spawns via Python `child_process`, sends tasks via direct HTTP POST to sandbox `/task`, health checks via GET `/health`, terminates via Python. 299 lines. |
| 2.5 | `packages/orchestrator/merge-queue.ts` | ✅ DONE | `MergeQueue` with 3 strategies (fast-forward/rebase/merge-commit), conflict detection (skip+log, no auto-resolve), uses core git functions. 173 lines. |
| 2.6 | `packages/orchestrator/monitor.ts` | ✅ DONE | `Monitor` class with periodic health polling, stuck detection (no progress > threshold), timeout enforcement, empty diff alerts, `MetricsSnapshot` generation, callback-based events. 205 lines. |
| 2.7 | `packages/orchestrator/llm-client.ts` | ✅ DONE | `LLMClient` class: thin HTTP wrapper for OpenAI-compatible `/v1/chat/completions` endpoint. 88 lines. |
| 2.8 | `packages/orchestrator/planner.ts` | ✅ DONE | `Planner` class: reads repo state (file tree, commits, FEATURES.json from `./target-repo`), calls GLM-5 via LLMClient, parses JSON task array from response (handles markdown code blocks), dispatches tasks to workers, collects handoffs, merges branches, loops. 384 lines. |
| 2.9 | `prompts/root-planner.md` | ✅ DONE | System prompt for root planner agent — identity, repo context injection, task JSON schema, constraints, decomposition guidelines. 142 lines. |
| 2.10 | Unit tests (46 tests, 3 files) | ✅ DONE | **task-queue.test.ts**: 22 tests (PriorityQueue: 8, TaskQueue: 14). **config.test.ts**: 10 tests (env loading, defaults, validation, missing required vars, merge strategies). **monitor.test.ts**: 14 tests (stuck/timeout detection, metrics, callbacks). All 46 pass. |

#### Phase 2 Key Design Decisions:
- **Direct HTTP** to sandboxes for task/health (hot path = pure TS)
- **Python subprocess** only for sandbox create/terminate
- **Direct HTTP** to GLM-5 `/v1/chat/completions` (no Python in LLM path)
- **Conflict detection only** (skip+log, defer auto-resolution to Phase 3)
- **Local `./target-repo`** for planner repo state
- **`node:test`** runner — zero test dependencies
- **Callback arrays** for events (no EventEmitter pattern)

#### Phase 2 Code Stats:
- ~2,116 lines of implementation across 8 source files (planner.ts refactored to 330 lines after shared.ts extraction in Phase 3)
- ~142 lines of prompt (root-planner.md)
- ~46 unit tests across 3 test files
- All 3 packages typecheck and build clean

---

### Phase 3: Full Scale + Run — STATUS: IN PROGRESS (~20%)

| Step | Description | Status | Details |
|------|-------------|--------|---------|
| 3.1 | `packages/orchestrator/subplanner.ts` — recursive subplanners | ✅ DONE | `Subplanner` class with recursive decomposition, `shouldDecompose()` heuristic, `SubplannerConfig`, `aggregateHandoffs()`, `createFailureHandoff()`. Dispatch lock mutex for serialized worker acquisition. Worker timeout on polling. 460 lines. |
| 3.2 | `packages/orchestrator/reconciler.ts` — periodic green branch | ❌ NOT STARTED | |
| 3.3 | `target-repo/SPEC.md` — Minecraft clone specification | ❌ NOT STARTED | |
| 3.4 | `target-repo/FEATURES.json` — 200+ features pass/fail | ❌ NOT STARTED | |
| 3.5 | `prompts/subplanner.md` and `prompts/reconciler.md` | 🟡 PARTIAL | `prompts/subplanner.md` ✅ DONE (172 lines — identity, decomposition workflow, subtask JSON schema, scope containment, hard constraints, examples, anti-patterns). `prompts/reconciler.md` ❌ NOT STARTED. |
| 3.6 | Freshness mechanisms — scratchpad, auto-summarization | ❌ NOT STARTED | |
| 3.7 | `packages/dashboard` — live web UI | ❌ NOT STARTED | |
| 3.8 | Scale to 50-100 concurrent workers | ❌ NOT STARTED | |
| 3.9 | Run against Minecraft spec for 12-20 hours | ❌ NOT STARTED | |
| 3.10 | Monitor + tune prompts | ❌ NOT STARTED | |

#### Phase 3 Completed Work Details:

**New files created:**
- `packages/orchestrator/src/subplanner.ts` (460 lines) — Full recursive subplanner with dispatch lock mutex, worker timeout, depth-limited recursion.
- `packages/orchestrator/src/shared.ts` (71 lines) — Extracted shared utilities (`RepoState`, `RawTaskInput`, `readRepoState()`, `parseLLMTaskArray()`) used by both `planner.ts` and `subplanner.ts`.
- `packages/orchestrator/src/__tests__/subplanner.test.ts` (345 lines) — 32 unit tests for subplanner functions.
- `prompts/subplanner.md` (172 lines) — Subplanner system prompt.

**Modified files:**
- `packages/orchestrator/src/planner.ts` — Refactored to import from `shared.ts`, added dispatch lock mutex and worker timeout (330 lines, was 385).
- `packages/orchestrator/src/index.ts` — Added barrel exports for `subplanner` and `shared` modules.
- `packages/core/src/types.ts` — Added `apiKey?: string` to `HarnessConfig.llm`.
- `packages/orchestrator/src/config.ts` — Added `apiKey` env var support.

**Known follow-ups identified by Oracle review:**
- Unbounded concurrency fan-out in subtask dispatch (Medium) — all subtasks launch concurrently; at depth-3 recursion could fan to ~1000 LLM calls. Consider adding concurrency limiter.
- `shouldDecompose` heuristic is simplistic (Minor) — scope size is a poor proxy for complexity.

---

## Summary

| Phase | Progress | Key Blockers |
|-------|----------|--------------|
| **Phase 1: Foundation** | ~90% | E2E test not validated on live Modal infra |
| **Phase 2: Multi-Agent Core** | ✅ 100% | Complete — all modules built, tested, building clean |
| **Phase 3: Full Scale + Run** | ~20% | Subplanner + prompt done. Remaining: reconciler, dashboard, target repo, Minecraft spec, scaling |

#### Overall Code Stats (as of Phase 3.1 completion):
- **Implementation**: ~2,977 lines across 10 source files (8 from Phase 2 + shared.ts + subplanner.ts)
- **Prompts**: ~314 lines (root-planner.md 142 + subplanner.md 172)
- **Tests**: 78 tests across 4 test files (46 Phase 2 + 32 subplanner)
- **All 3 packages**: typecheck ✅, build ✅, tests ✅

## Recommended Next Steps (Priority Order)

1. **Validate Phase 1 E2E** — Run `scripts/test_sandbox.py basic` and `server` tests against Modal to confirm the sandbox pipeline works end-to-end.
2. **Build Phase 3 foundations** — Start with `target-repo/SPEC.md` (Minecraft clone spec) and `target-repo/FEATURES.json` (200+ features) since the planner reads these at runtime.
3. ~~**Implement `subplanner.ts`**~~ — ✅ DONE. Recursive subplanner with dispatch lock, worker timeout, shared.ts extraction.
4. **Implement `reconciler.ts`** — Periodic green branch sweep to keep main stable.
5. **Write `prompts/reconciler.md`** — System prompt for the reconciler agent role. (~~`subplanner.md`~~ ✅ DONE.)
6. **Build `packages/dashboard`** — Live web UI for monitoring the swarm.
7. **Scale testing** — Ramp to 50-100 concurrent workers and run against Minecraft spec.
8. **Address subplanner follow-ups** — Add concurrency limiter for subtask fan-out, improve `shouldDecompose` heuristic.

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
