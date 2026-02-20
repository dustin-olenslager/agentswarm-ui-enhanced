# Contributing to AgentSwarm UI

We welcome contributions to AgentSwarm UI! This guide will help you get started.

## 🎯 Areas We Need Help

### 🎨 UI/UX Improvements
- **Dashboard Enhancements** - New visualizations, better layouts
- **Web Interface** - React components, responsive design
- **Screenshots/Demos** - Visual documentation
- **User Experience** - Onboarding, error messages, help text

### 🔧 Core Features
- **Agent Coordination** - Orchestration improvements
- **Performance** - Speed and reliability optimizations
- **Integration** - New LLM providers, cloud platforms
- **Testing** - Unit tests, integration tests, UI tests

### 📚 Documentation
- **Tutorials** - Step-by-step guides
- **API Documentation** - Code documentation
- **Examples** - Real-world use cases
- **Troubleshooting** - Common issues and solutions

## 🚀 Quick Start

### 1. Fork & Clone
```bash
git clone https://github.com/your-username/agentswarm-ui.git
cd agentswarm-ui
git remote add upstream https://github.com/original-org/agentswarm-ui.git
```

### 2. Development Environment
```bash
# Python environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements-dev.txt

# Node.js environment
pnpm install

# Pre-commit hooks
pre-commit install
```

### 3. Run Tests
```bash
# Python tests
pytest

# TypeScript tests
pnpm test

# Dashboard tests
cd agent-swarm-visualizer/dashboard
pnpm test
```

## 🏗️ Development Workflow

### Branch Strategy
- `main` - Stable releases
- `ui-dev` - UI development
- `feature/your-feature` - Individual features

### Making Changes

1. **Create a branch**
   ```bash
   git checkout -b feature/amazing-dashboard-feature
   ```

2. **Make your changes**
   - Follow code style guidelines
   - Add tests for new functionality
   - Update documentation

3. **Test thoroughly**
   ```bash
   # Run all tests
   pytest && pnpm test
   
   # Test the dashboard
   python main.py --dashboard "test project"
   ```

4. **Submit a pull request**
   - Use the PR template
   - Include screenshots for UI changes
   - Link related issues

### Code Style

#### Python
- **Black** for formatting
- **isort** for import sorting  
- **flake8** for linting
- **Type hints** for all functions

```python
from typing import List, Optional
import rich.console

def format_agent_status(agents: List[Agent]) -> str:
    """Format agent status for dashboard display."""
    return "formatted status"
```

#### TypeScript/React
- **Prettier** for formatting
- **ESLint** for linting
- **Functional components** with hooks
- **TypeScript strict mode**

```typescript
interface AgentStatus {
  id: string;
  status: 'active' | 'idle' | 'error';
  task?: string;
}

export const AgentCard: React.FC<{ agent: AgentStatus }> = ({ agent }) => {
  return <div className="agent-card">{agent.id}</div>;
};
```

## 🎨 UI Contribution Guidelines

### Dashboard Components
When contributing to the dashboard:

1. **Follow the design system**
   - Use consistent colors and spacing
   - Match existing component patterns
   - Ensure responsive design

2. **Add screenshots**
   - Before/after for changes
   - Different screen sizes
   - Dark/light mode if applicable

3. **Test thoroughly**
   - Multiple browsers
   - Different data scenarios
   - Error states

### Adding New Visualizations

Template for new dashboard components:

```python
# dashboard.py addition
class NewVisualization:
    def __init__(self, console: Console):
        self.console = console
    
    def render(self, data: Dict[str, Any]) -> Panel:
        """Render the new visualization."""
        content = self._format_content(data)
        return Panel(content, title="New Visualization")
    
    def _format_content(self, data: Dict[str, Any]) -> str:
        # Implementation here
        pass
```

```tsx
// React component
interface NewVisualizationProps {
  data: VisualizationData;
}

export const NewVisualization: React.FC<NewVisualizationProps> = ({ data }) => {
  return (
    <div className="new-visualization">
      <h3>New Visualization</h3>
      {/* Component implementation */}
    </div>
  );
};
```

## 📸 Screenshot Guidelines

When adding screenshots:

1. **High quality** - Retina/high DPI preferred
2. **Consistent size** - 1200px wide for documentation
3. **Clean examples** - Remove personal info, use generic data
4. **Multiple contexts** - Show different states/scenarios

### Screenshot locations:
- `docs/screenshots/` - Main documentation images
- `examples/screenshots/` - Example project outputs
- `README.md` - Hero images and key features

## 🧪 Testing

### Test Categories

#### Unit Tests
```bash
# Python
pytest tests/unit/

# TypeScript
pnpm test:unit
```

#### Integration Tests
```bash
# Full pipeline
pytest tests/integration/

# Dashboard integration
pnpm test:integration
```

#### UI Tests
```bash
# Web dashboard
cd agent-swarm-visualizer/dashboard
pnpm test:e2e
```

### Writing Tests

#### Python Example
```python
import pytest
from unittest.mock import Mock
from agentswarm.dashboard import Dashboard

def test_dashboard_render():
    console = Mock()
    dashboard = Dashboard(console)
    
    result = dashboard.render_status({"agents": []})
    
    assert result is not None
    console.print.assert_called()
```

#### React Example
```tsx
import { render, screen } from '@testing-library/react';
import { AgentCard } from './AgentCard';

test('renders agent card with status', () => {
  const agent = { id: 'test-agent', status: 'active' as const };
  
  render(<AgentCard agent={agent} />);
  
  expect(screen.getByText('test-agent')).toBeInTheDocument();
  expect(screen.getByText('active')).toBeInTheDocument();
});
```

## 📚 Documentation

### Documentation Structure
```
docs/
├── getting-started.md    # Quick start guide
├── dashboard/           # Dashboard documentation
├── api/                 # API reference
├── deployment/          # Deployment guides
├── examples/            # Usage examples
└── screenshots/         # Images for docs
```

### Writing Documentation

- **Clear headings** - Use descriptive titles
- **Code examples** - Always include working examples
- **Screenshots** - Visual aids for UI features
- **Links** - Cross-reference related sections

## 🎉 Recognition

Contributors are recognized in:
- **README.md** - Major contributors section
- **CHANGELOG.md** - Credit for each release
- **GitHub Releases** - Highlight significant contributions
- **Discord** - Contributor role and recognition

## 📞 Getting Help

- **Discord** - [Join our community](https://discord.gg/agentswarm-ui)
- **GitHub Issues** - Ask questions with the `question` label
- **GitHub Discussions** - Community Q&A
- **Email** - maintainers@agentswarm-ui.org

## 📋 Pull Request Template

When submitting a PR, please include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] UI/UX improvement
- [ ] Documentation update
- [ ] Performance improvement

## Screenshots (if applicable)
Before/after screenshots for UI changes

## Testing
- [ ] Tests pass locally
- [ ] New tests added
- [ ] Dashboard tested manually

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Screenshots added (for UI changes)
```

Thank you for contributing to AgentSwarm UI! 🚀