🌟 Inspiration  
AI has already transformed how we build software — code generation, debugging, and planning can now be assisted by large language models. But development workflows themselves remain mostly sequential. One agent writes code, another reviews it, CI runs tests, and progress happens step by step.

AgentSwarm was born from the belief that the next leap in software engineering is **massive parallelism**. If dozens or hundreds of agents could work on a codebase simultaneously, we could compress weeks of development into hours.

Traditional agent architectures are linear: one agent, one task, one commit. That is slow and brittle. AgentSwarm explores a new paradigm — autonomous coding swarms that decompose projects into hundreds of tasks and execute them concurrently. Instead of AI assisting developers one task at a time, AgentSwarm turns development into a distributed system of reasoning agents working together in parallel.

🧠 What it does  
AgentSwarm is a massively parallel autonomous coding orchestrator that manages fleets of ephemeral coding agents.

Given a project specification, AgentSwarm:

- Uses an LLM Planner to decompose the project into hundreds of granular coding tasks.  
- Dispatches tasks to sandboxed environments running in parallel on Modal.  
- Runs code generation, testing, linting, and Git operations concurrently.  
- Merges results using a robust merge queue that detects conflicts and manages commits safely.  
- Self-heals using a Reconciler agent that detects broken builds and automatically spawns fix tasks.  
- Visualizes the entire process in real time with a rich terminal dashboard.

The result is a swarm of coding agents capable of implementing features across a codebase simultaneously, dramatically accelerating development cycles.

One framework, infinite development velocity: AgentSwarm can build web apps, APIs, tooling, data pipelines, or research prototypes — any project that can be described in specs.

🛠️ How we built it  
We built AgentSwarm as a modular distributed system designed to coordinate planning, execution, validation, and reconciliation across hundreds of agents.

🤖 AI & Agent Logic  
We implemented a multi-agent architecture consisting of:

- **Planner Agent** – breaks down specs into granular tasks.  
- **Worker Agents** – generate code, run tests, and submit diffs.  
- **Reconciler Agent** – monitors build health and dispatches fixes.  
- **Future Manager Agents** – planned hierarchical controllers for dynamic task generation.

Agents use structured prompts, validation loops, and test-driven workflows to ensure correctness. Context retrieval is handled using a file-tree-based indexing system so agents receive only relevant files without exploding token costs.

⚙️ Infrastructure  
We used Modal to spin up ephemeral sandbox environments where agents execute safely in parallel. Each container runs isolated code generation and testing pipelines.

State between the orchestrator and sandboxes is passed through strict JSON protocols containing diffs, logs, and metadata. This enables reproducible execution and scaling across hundreds of agents.

🧩 Data & Git Layer  
Git acts as the single source of truth.

We built a custom merge queue with:

- Optimistic locking  
- Conflict detection  
- Automated rebase strategies  
- CI-triggered validation  

If a commit breaks the build, the Reconciler automatically creates a high-priority fix task.

💻 Interface  
We built a real-time terminal dashboard using Rich that visualizes:

- Active agents  
- Task progress  
- Build health  
- Cost metrics  
- Throughput  

This provides a “god-mode” view of the swarm’s activity. A React-based web dashboard is planned next.

🧩 Challenges we ran into  
- **Concurrency Hell** – Coordinating hundreds of agents committing to the same repo required a custom merge queue and conflict resolution logic.  
- **Context Management** – Supplying enough context without excessive token usage required smart retrieval systems.  
- **Ephemeral State** – Passing state across hundreds of short-lived containers required strict JSON handoff protocols.  
- **Deterministic Builds** – Ensuring parallel changes didn’t break integration pipelines required extensive validation.

🏆 Accomplishments that we're proud of  
- **The Reconciler** – A self-healing system that automatically detects failing builds and spawns fix agents.  
- **Zero-State Architecture** – Workers are ephemeral, and state is persisted only in Git, making the system resilient and fault-tolerant.  
- **The Dashboard** – A high-frequency terminal UI that provides real-time visibility into swarm activity.  
- **Massive Parallelism** – Demonstrated concurrent implementation of large feature sets across a codebase.

📚 What we learned  
- **Parallelism requires strong orchestration.** Validation layers matter more than raw generation.  
- **Specs are critical.** Output quality depends heavily on SPEC.md and structured task definitions.  
- **Infrastructure dominates effort.** Most work went into harness design, sandboxing, and Git workflows.  
- **Swarm intelligence works.** Even imperfect agents can produce strong results when coordinated effectively.

🚀 What's next for AgentSwarm  

⏩ Short-Term  
- Smarter merge queue with improved conflict handling  
- Expanded test validation pipelines  
- Better planning heuristics  

🔮 AI/Agent Features  
- Mediator agents for resolving complex Git conflicts  
- Hierarchical manager agents for dynamic task generation  
- Adaptive planning based on repo history  
- Cost-aware agent scheduling  

🧱 Platform Upgrades  
- React-based web dashboard for remote monitoring  
- Plugin system for CI/CD and tool integrations  
- API for enterprise workflows  
- Multi-repo and monorepo support  

🌍 Community Focus  
- Open-source core orchestration engine  
- Starter templates for autonomous coding projects  
- Documentation and tutorials  
- Community-built agent packs and workflow presets  

Built With  
modal  
python  
git  
rich  
llm planners  
multi-agent orchestration frameworks  

Try it out  
GitHub Repo: <link>  
Demo Video: <link>  
Run locally: Clone repo → add API keys → run orchestrator → watch the swarm build your project.