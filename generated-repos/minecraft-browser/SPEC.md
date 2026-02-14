# Minecraft Browser Clone Spec

## Document Ownership
- Type: User input to swarm.
- Created by: User before run.
- Updated by: User is primary editor; agents may propose edits but must not change intent, success criteria ranking, or non-negotiables without explicit user approval.

## Product Statement
Build a browser game that recreates the core Minecraft survival-sandbox loop using voxel blocks, first-person controls, and chunked terrain rendering. The target user is a player or developer who wants a playable Minecraft-like experience with no native install. The primary use case is launching the game locally in a modern desktop browser and building/breaking blocks in a persistent world.

## Success Criteria (Ranked)
1. Player can move, look around, place blocks, and break blocks at 60 FPS or better on a mid-range laptop at 1080p in local dev mode.
2. World renders procedurally in chunks around the player with deterministic terrain generation and visible culling behavior.
3. World state persists between sessions in the browser so modified blocks remain changed after reload.

### Hard Limits
- Time budget: 40 engineering hours for first playable vertical slice.
- Resource budget: 2 CPU cores, 4 GB RAM, and 2 GB disk for local dev environment.
- External services: no paid APIs and no mandatory backend for the first slice.
- Runtime mode: must run fully offline after dependencies are installed.

## Acceptance Tests (Runnable, Objective)
- `npm ci` completes with zero install errors on Node 22 LTS.
- `npm run typecheck` exits 0 with no TypeScript errors.
- `npm run test` exits 0 and includes at least terrain generation determinism test, block mutation test, and save/load test.
- `npm run build` exits 0 and outputs production bundle to `dist/`.
- `npm run dev` starts local server, and manual flow passes: player spawns, can move with `WASD`, can break a targeted block, can place a block in range, reload page, and sees previous block edits restored.
- `npm run test:e2e` exits 0 and validates that placing one block and reloading preserves the block in the same coordinates.

## Non-Negotiables
- No unfinished stubs, placeholders, or pseudocode in core paths.
- Every endpoint or command surface has validation and explicit error handling.
- Every major component has at least one minimal test.
- No silent failures; errors are surfaced in logs and UI.
- No hidden background assumptions; all required setup is documented.

## Architecture Constraints
### Topology
- Repo structure: single app repository.
- Primary boundaries: rendering engine / world simulation / input + player controller / persistence + settings / UI overlay.

### Contracts
- Event schema source of truth: `src/contracts/events.ts`.
- API contract source of truth: `src/contracts/api.ts`.
- Storage schema source of truth: `src/contracts/storage.ts`.

### File/Folder Expectations
- `src/engine/`: Three.js scene lifecycle, render loop, camera, lighting, and mesh updates.
- `src/world/`: chunk model, terrain generation, block mutation, meshing, and culling logic.
- `src/player/`: player state, movement, collision, gravity, and interaction raycast.
- `src/persistence/`: local storage adapter, serialization, migration, and save scheduling.
- `src/ui/`: HUD, debug overlay, menus, and user-facing error messages.
- `src/test/`: unit and integration tests.

## Dependency Philosophy
### Allowed
- `typescript`, `vite`, `vitest`, and `playwright` for build and testing.
- `three` for rendering.
- Small utility libraries only when they reduce complexity and are documented in `DECISIONS.md`.

### Banned
- Game engines that replace core voxel implementation for first slice (for example BabylonJS scene systems or Unity WebGL exports).
- State management frameworks not required for current complexity.
- Heavy physics engines for the first slice.

### Scaffold-Only (Must Be Replaced)
- Temporary mock texture assets and placeholder block atlases are allowed until art pass starts.

## Scope Model
### Must Have (3-7)
- First-person movement with mouse look and keyboard controls.
- Block targeting raycast with break and place actions.
- Procedural chunk generation with deterministic seed.
- Mesh generation with basic face culling for opaque blocks.
- Local world persistence for modified blocks.
- HUD with crosshair, current block type, and basic performance stats.

### Nice to Have (3-7)
- Hotbar with multiple block types.
- Basic day-night lighting cycle.
- Mobile touch control prototype.
- Cloud save sync via optional backend.
- Multiplayer prototype for two players.

### Out of Scope
- Full parity with modern Minecraft features.
- Redstone, mobs, crafting trees, and survival progression in first slice.
- Server-authoritative multiplayer in first slice.
- Mod/plugin ecosystem.

## Throughput / Scope Ranges
- Initial task fan-out target: 25-50 worker tasks in first hour.
- Change size target: 10-18 PR-sized changes, avoid one giant PR.
- Parallelism target: 1-3 active branches per subsystem.
- Runtime target window: playable demo in 1-2 weeks.

## Reliability Requirements (Long-Run Defense)
- Must survive process restarts without losing critical state.
- Must tolerate partial failures and continue degraded operation.
- Event ingestion and mutation endpoints are idempotent.
- Backpressure and rate limits prevent UI/API overload.
- Behavior under resource ceilings is explicit and testable.

## Required Living Artifacts
The repo must include and keep these files current:
- `README.md`: exact local setup and run commands from clean machine.
- `SPEC.md`: rewritten to current intent; do not append stale plans.
- `DECISIONS.md`: short architecture decisions with rationale and status.
- `RUNBOOK.md`: operational guide for running, monitoring, and recovery.

## Definition of Done
- All acceptance tests pass.
- Must-have scope is complete.
- Non-negotiables are satisfied.
- Required living artifacts are up-to-date and consistent with implementation.
