# AgentSwarm UI 🐝✨

> **The UI-First Multi-Agent Coding Platform**
> 
> AgentSwarm UI transforms autonomous coding with beautiful, real-time dashboards and intuitive web interfaces. Watch your agent swarm work in action.

<div align="center">

![Terminal Dashboard](docs/screenshots/terminal-dashboard.png)
*Real-time terminal dashboard showing agent activity*

![Web Dashboard](docs/screenshots/web-dashboard.png)
*Modern web dashboard for remote monitoring*

</div>

## 🎯 Why AgentSwarm UI?

While other agent frameworks focus on the backend, **AgentSwarm UI puts visualization first**:

- 🖥️ **Rich Terminal Dashboard** - Beautiful real-time TUI with agent activity, costs, and throughput
- 🌐 **Modern Web Dashboard** - React-based web interface for remote monitoring
- 📊 **Real-time Visualization** - Watch your swarm work with live updates
- 📈 **Performance Metrics** - Track costs, success rates, and throughput
- 🔧 **Developer Experience** - Clean setup, intuitive controls, comprehensive logging

## 🚀 Quick Start

### Terminal Dashboard (Instant)

```bash
# Clone and setup
git clone https://github.com/your-org/agentswarm-ui.git
cd agentswarm-ui
pip install -r requirements.txt

# Set your API key
export OPENAI_API_KEY="your-key-here"
# or export ANTHROPIC_API_KEY="your-key-here"

# Launch with dashboard
python main.py --dashboard "Build a simple web server"
```

### Web Dashboard (Full Experience)

```bash
# Install dependencies
pnpm install

# Start the web dashboard
cd agent-swarm-visualizer/dashboard
pnpm dev

# In another terminal, run your swarm
python main.py "Build a React todo app"
```

## 🎨 Dashboard Features

### Terminal Dashboard (`dashboard.py`)
- **Live Agent Status** - See which agents are working on what
- **Task Progress** - Visual progress bars and completion status
- **Cost Tracking** - Real-time token usage and cost monitoring
- **Git Activity** - Live view of commits and merge operations
- **Error Monitoring** - Immediate visibility into issues

### Web Dashboard (`agent-swarm-visualizer/`)
- **Planner Tree View** - Hierarchical view of task breakdown
- **Timeline Visualization** - See the sequence of agent actions
- **Commit History** - Visual git commit timeline
- **Performance Analytics** - Charts and metrics
- **Remote Monitoring** - Access from anywhere

## 🏗️ Architecture

AgentSwarm UI orchestrates hundreds of autonomous coding agents:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Dashboard │    │Terminal Dashboard│    │     Planner     │
│   (React/Next)  │    │   (Rich TUI)     │    │  (Task Decomp)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Orchestrator   │
                    │  (Coordination) │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Worker Pool   │    │   Merge Queue   │    │   Reconciler    │
│  (Modal/Local)  │    │ (Conflict Res.) │    │ (Self-Healing)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Installation

### Prerequisites
- Python 3.8+ (`rich` for terminal UI)
- Node.js 18+ (`pnpm` for web dashboard)
- Git (for repository operations)
- API keys: OpenAI, Anthropic, or compatible

### Full Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/agentswarm-ui.git
cd agentswarm-ui

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Install Node.js dependencies
pnpm install

# 4. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 5. Test installation
python main.py --help
```

### Configuration

Create `.env` file:

```env
# LLM Provider (choose one)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Optional: Modal.com for cloud workers
MODAL_TOKEN_ID=your-modal-token
MODAL_TOKEN_SECRET=your-modal-secret

# Dashboard settings
DASHBOARD_HOST=localhost
DASHBOARD_PORT=3000
```

## 🎮 Usage Examples

### Basic Usage
```bash
# Simple task with terminal dashboard
python main.py --dashboard "Create a Python web scraper"

# Complex project
python main.py --dashboard "Build a full-stack blog with authentication"
```

### Advanced Usage
```bash
# Custom configuration
python main.py --config config/advanced.json --dashboard

# Web dashboard + custom specs
python main.py --spec-file my-project/SPEC.md --web-dashboard
```

### Project Templates
```bash
# Use built-in templates
python main.py --template web-app --dashboard "E-commerce site"
python main.py --template api-server --dashboard "REST API for blog"
```

## 📊 Dashboard Gallery

<div align="center">

### Terminal Dashboard Views

| Activity Overview | Task Progress | Error Monitoring |
|:---:|:---:|:---:|
| ![Activity](docs/screenshots/activity.png) | ![Progress](docs/screenshots/progress.png) | ![Errors](docs/screenshots/errors.png) |

### Web Dashboard Views

| Planner Tree | Timeline | Analytics |
|:---:|:---:|:---:|
| ![Tree](docs/screenshots/planner-tree.png) | ![Timeline](docs/screenshots/timeline.png) | ![Analytics](docs/screenshots/analytics.png) |

</div>

## 🔧 Development

### Project Structure
```
agentswarm-ui/
├── main.py                 # CLI entry point
├── dashboard.py            # Terminal dashboard (Rich TUI)
├── agent-swarm-visualizer/ # Web dashboard (Next.js)
│   ├── dashboard/          # Main web app
│   ├── shared/             # Shared types/schemas
│   └── dummy-swarm/        # Development data
├── packages/               # Core packages
│   ├── orchestrator/       # Swarm coordination
│   ├── sandbox/            # Worker execution
│   └── core/               # Shared utilities
├── prompts/                # Agent prompts
├── examples/               # Example projects
└── docs/                   # Documentation
```

### Contributing

1. **Fork the repository**
2. **Create feature branch** (`git checkout -b feature/amazing-feature`)
3. **Add your changes** with tests
4. **Update documentation** including screenshots
5. **Submit pull request**

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

### Development Setup
```bash
# Development environment
git clone https://github.com/your-org/agentswarm-ui.git
cd agentswarm-ui
git checkout -b ui-dev

# Install dev dependencies
pip install -r requirements-dev.txt
pnpm install

# Run tests
pytest
pnpm test

# Start development servers
python main.py --dashboard --dev
cd agent-swarm-visualizer/dashboard && pnpm dev
```

## 🚀 Deployment

### Local Deployment
```bash
# Production build
pnpm build

# Start production dashboard
cd agent-swarm-visualizer/dashboard
pnpm start

# Run orchestrator
python main.py --config config/production.json
```

### Cloud Deployment
- **Vercel** - Deploy web dashboard
- **Modal.com** - Scale worker execution
- **Railway** - Host orchestrator
- **AWS/GCP** - Custom infrastructure

See [docs/deployment.md](docs/deployment.md) for detailed guides.

## 📈 Performance & Scaling

### Benchmarks
- **100+ Parallel Agents** - Concurrent task execution
- **Sub-second UI Updates** - Real-time dashboard refresh
- **Cost Optimization** - Smart token usage and caching
- **Auto-scaling** - Modal.com integration for unlimited workers

### Monitoring
- **Real-time Metrics** - Cost, success rate, throughput
- **Error Tracking** - Automatic error detection and recovery
- **Performance Analytics** - Historical data and trends

## 🤝 Community

- **Discord** - [Join our community](https://discord.gg/agentswarm-ui)
- **GitHub Discussions** - Ask questions, share projects
- **Twitter** - [@AgentSwarmUI](https://twitter.com/agentswarmui)
- **YouTube** - [Dashboard Tutorials](https://youtube.com/@agentswarmui)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Original AgentSwarm** - Built on [andrewcai8/agentswarm](https://github.com/andrewcai8/agentswarm)
- **Rich Library** - Terminal UI framework by [Textualize](https://github.com/Textualize/rich)
- **Next.js** - Web dashboard framework
- **Modal.com** - Serverless compute platform

---

<div align="center">
<b>Ready to watch your AI swarm in action?</b><br>
<code>git clone https://github.com/your-org/agentswarm-ui.git && cd agentswarm-ui && python main.py --dashboard</code>
</div>