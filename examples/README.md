# AgentSwarm UI Examples

This directory contains example projects to help you get started with AgentSwarm UI.

## 🚀 Quick Examples

### Terminal Dashboard Examples

```bash
# Simple web server
python main.py --dashboard "Build a Python FastAPI server with health check endpoint"

# React application
python main.py --dashboard "Create a React todo app with local storage"

# Data analysis
python main.py --dashboard "Build a data visualization dashboard using matplotlib and pandas"

# API integration
python main.py --dashboard "Create a weather app that fetches data from OpenWeatherMap API"
```

### Web Dashboard Examples

```bash
# Start web dashboard first
cd agent-swarm-visualizer/dashboard
pnpm dev

# In another terminal, run complex projects
python main.py "Build a full-stack e-commerce site with user authentication"
python main.py "Create a real-time chat application using WebSocket"
python main.py "Build a machine learning model deployment API"
```

## 📁 Example Projects

### 1. Todo App (`todo-app/`)
A full-stack todo application demonstrating:
- React frontend with TypeScript
- FastAPI backend
- SQLite database
- CRUD operations
- Real-time updates

**Run:**
```bash
python main.py --template todo-app --dashboard
```

### 2. Weather Dashboard (`weather-dashboard/`)
A weather visualization dashboard featuring:
- Weather API integration
- Interactive charts
- Location-based forecasts
- Responsive design

**Run:**
```bash
python main.py --template weather-dashboard --dashboard
```

### 3. Blog Platform (`blog-platform/`)
A complete blogging platform with:
- User authentication
- Rich text editor
- Comment system
- Admin panel

**Run:**
```bash
python main.py --template blog-platform --dashboard
```

### 4. Data Analytics (`data-analytics/`)
A data analysis toolkit including:
- CSV/JSON data processing
- Statistical analysis
- Interactive visualizations
- Export capabilities

**Run:**
```bash
python main.py --template data-analytics --dashboard
```

## 🎯 Use Case Examples

### Rapid Prototyping
```bash
# MVP in minutes
python main.py --dashboard "Build an MVP for a food delivery app with restaurant listings and order tracking"

# Feature exploration
python main.py --dashboard "Add payment integration and user reviews to the food delivery app"
```

### Educational Projects
```bash
# Learning web development
python main.py --dashboard "Create a portfolio website with project showcase and contact form"

# Understanding APIs
python main.py --dashboard "Build a cryptocurrency price tracker using CoinGecko API"
```

### Business Applications
```bash
# Internal tools
python main.py --dashboard "Create an employee directory with search and department filtering"

# Customer solutions
python main.py --dashboard "Build a customer support ticket system with priority levels"
```

## 📊 Dashboard Views

### Terminal Dashboard Features Showcase

1. **Agent Activity Monitor**
   - Shows active/idle agents
   - Task assignments
   - Progress indicators

2. **Cost Tracking**
   - Token usage per agent
   - Running cost estimates
   - Budget alerts

3. **Git Operations**
   - Commit timeline
   - Merge conflicts
   - Branch activity

4. **Error Monitoring**
   - Real-time error detection
   - Failed task recovery
   - Debug information

### Web Dashboard Features

1. **Project Overview**
   - High-level project status
   - Key metrics and KPIs
   - Recent activity feed

2. **Task Breakdown**
   - Hierarchical task view
   - Dependencies visualization
   - Completion tracking

3. **Performance Analytics**
   - Historical performance data
   - Success/failure rates
   - Time-to-completion metrics

4. **Resource Management**
   - Agent utilization
   - Memory/CPU usage
   - Cost analysis

## 🛠️ Custom Templates

### Creating Your Own Template

1. **Create template directory:**
   ```bash
   mkdir examples/my-template
   cd examples/my-template
   ```

2. **Add template files:**
   ```
   my-template/
   ├── SPEC.md          # Project specification
   ├── FEATURES.json    # Feature breakdown
   ├── README.md        # Template documentation
   └── config.json      # Template configuration
   ```

3. **Use your template:**
   ```bash
   python main.py --template my-template --dashboard "My custom project"
   ```

### Template Configuration

```json
{
  "name": "My Template",
  "description": "Description of what this template does",
  "category": "web-development",
  "difficulty": "intermediate",
  "estimated_time": "30-60 minutes",
  "technologies": ["React", "Node.js", "SQLite"],
  "features": [
    "User authentication",
    "Real-time updates",
    "Responsive design"
  ],
  "dashboard_config": {
    "show_costs": true,
    "show_git_activity": true,
    "refresh_rate": 1000
  }
}
```

## 📸 Screenshot Gallery

### Terminal Dashboard Screenshots

| Overview | Task Progress | Error Handling |
|:---:|:---:|:---:|
| ![Overview](screenshots/terminal-overview.png) | ![Progress](screenshots/terminal-progress.png) | ![Errors](screenshots/terminal-errors.png) |

### Web Dashboard Screenshots

| Project Dashboard | Task Breakdown | Analytics |
|:---:|:---:|:---:|
| ![Dashboard](screenshots/web-dashboard.png) | ![Breakdown](screenshots/web-breakdown.png) | ![Analytics](screenshots/web-analytics.png) |

## 🎥 Video Tutorials

1. **Getting Started** - Basic setup and first project
2. **Dashboard Features** - Tour of terminal and web dashboards
3. **Advanced Usage** - Custom templates and complex projects
4. **Troubleshooting** - Common issues and solutions

## 📝 Best Practices

### Writing Good Project Specifications

```markdown
# Good Specification Example

## Project: Todo App with Real-time Sync

### Core Features
1. Add/edit/delete todos
2. Mark todos as complete
3. Real-time sync across devices
4. Responsive design

### Technical Requirements
- Frontend: React with TypeScript
- Backend: FastAPI
- Database: SQLite
- Real-time: WebSocket

### Success Criteria
- All CRUD operations work
- UI is responsive on mobile/desktop
- Real-time updates work correctly
- Code is well-documented
```

### Dashboard Best Practices

1. **Use meaningful project names**
2. **Monitor costs regularly**
3. **Watch for stuck agents**
4. **Review error logs**
5. **Save successful configurations**

## 🤝 Contributing Examples

Have a great example project? We'd love to include it!

1. Fork the repository
2. Create your example in `examples/your-example/`
3. Add documentation and screenshots
4. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

## 💡 Tips & Tricks

- **Start simple** - Begin with basic projects and add complexity
- **Use templates** - Leverage existing templates as starting points
- **Monitor dashboards** - Keep an eye on progress and costs
- **Save configs** - Keep successful configurations for reuse
- **Share results** - Show off your creations in the community!

Need help? Join our [Discord community](https://discord.gg/agentswarm-ui) or check the [documentation](../README.md).