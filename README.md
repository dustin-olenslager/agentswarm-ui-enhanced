# AgentSwarm

## Inspiration

We wanted to challenge the limits of autonomous coding. Traditional agent architectures are linear—one agent, one task, one commit. This is slow. We asked: **What if we could have 100 agents working in parallel?** Could we compress a week's worth of development into a single hour? AgentSwarm is our attempt to build a massively parallel autonomous coding system that can swarm a codebase, implementing hundreds of features concurrently.

## What it does

AgentSwarm is a **concurrent orchestrator** that manages a fleet of ephemeral coding agents. It:

1. **Decomposes** a project into hundreds of granular tasks using an LLM Planner.
2. **Dispatches** these tasks to ephemeral, sandboxed environments running on **Modal**.
3. **Executes** code generation, testing, and Git operations in parallel.
4. **Merges** the results back into the main branch using a robust merge queue that handles conflicts.
5. **Heals** itself: A "Reconciler" agent monitors the build health and automatically dispatches fix tasks for broken builds or failing tests.
6. **Visualizes** the entire process in real-time with a rich terminal dashboard.

## Challenges we ran into

- **Concurrency Hell**: Coordinating 100 agents hitting the same Git repo simultaneously is hard. We had to implement a custom merge queue with optimistic locking and conflict detection.
- **Context Management**: Providing enough context to agents without blowing up token costs required a smart file-tree-based retrieval system.
- **Ephemeral State**: Managing state across hundreds of short-lived containers required a strict JSON handoff protocol to pass results and diffs between the orchestrator and the sandboxes.

## Accomplishments that we're proud of

- **The Reconciler**: Our self-healing mechanism that automatically detects when a commit breaks the build and spawns a high-priority "fix" task to resolve it.
- **The Dashboard**: A beautiful, high-frequency terminal UI (built with `rich`) that gives us a god-mode view of the swarm's activity, costs, and throughput.
- **Zero-State Architecture**: The entire system is stateless. Workers are ephemeral, and state is persisted only in Git. This makes the system incredibly resilient to failure.

## What we learned

- **Quantity has a Quality all its own**: Even if individual agents have a customized failure rate, a swarm can make massive progress if the validation and orchestration layer is robust.
- **Specs are King**: The quality of the output is heavily dependent on the quality of the initial specification (`SPEC.md` and `FEATURES.json`).
- **Infra is Hard**: 80% of the work was building the harness (git ops, sandboxing, queuing), not prompting the LLM.

## What's next for AgentSwarm

- **Intelligent Conflict Resolution**: Spawning "Mediator" agents to manually resolve complex Git merge conflicts.
- **Hierarchical Management**: Introducing "Manager" agents that can break down features dynamically, rather than relying on a static initial plan.
- **Web Dashboard**: Porting our terminal UI to a React-based web app for remote monitoring.

## Stagehand Merge Recording

You can run Stagehand recording manually or automatically after merges.

1. Set environment variables:
   - `MODEL_API_KEY` (or `OPENAI_API_KEY`)
   - `BROWSERBASE_API_KEY`
   - `BROWSERBASE_PROJECT_ID`
   - Optional: `STAGEHAND_RECORD_URL` (default `http://127.0.0.1:5173`)
   - Optional: `STAGEHAND_ENV=LOCAL` to run against a local browser instead of Browserbase
   - Note: In `BROWSERBASE` mode, `STAGEHAND_RECORD_URL` must be publicly reachable (not `localhost`).
   - Optional (LOCAL mode): `STAGEHAND_LOCAL_BROWSER_PATH` to force a browser executable path.
   - Optional (LOCAL mode, macOS): `STAGEHAND_LOCAL_BROWSER=arc` or `STAGEHAND_LOCAL_BROWSER=brave`.
2. Run a manual recording:
   - `pnpm stagehand:record`
3. Install git hooks to run recording after merges/rebases:
   - `pnpm stagehand:hooks:install`
   - Optional: set `STAGEHAND_POST_MERGE_ENABLED=0` to disable auto-run temporarily

Outputs are written to `stagehand-runs/run-*/` with:
- `metadata.json` (session URLs and run details)
- `final.png` (end-of-run screenshot)

### Local Browser Examples (macOS)

- Arc:
  - `export STAGEHAND_ENV=LOCAL`
  - `export STAGEHAND_LOCAL_BROWSER_PATH="/Applications/Arc.app/Contents/MacOS/Arc"`
- Brave:
  - `export STAGEHAND_ENV=LOCAL`
  - `export STAGEHAND_LOCAL_BROWSER_PATH="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"`
