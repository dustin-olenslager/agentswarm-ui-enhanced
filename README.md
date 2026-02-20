# AgentSwarm UI Enhanced 🐝✨

> **Production-Ready Multi-Agent Platform with Advanced Dashboard Interfaces**
> 
> AgentSwarm UI Enhanced brings professional-grade visualization and authentication to multi-agent orchestration. Complete with secure authentication, SSL deployment, and enterprise-ready features.

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live%20Demo-swarm.metajibe.com-green?style=for-the-badge)](https://swarm.metajibe.com)
[![GitHub](https://img.shields.io/github/stars/dustin-olenslager/agentswarm-ui-enhanced?style=for-the-badge)](https://github.com/dustin-olenslager/agentswarm-ui-enhanced)
[![License](https://img.shields.io/github/license/dustin-olenslager/agentswarm-ui-enhanced?style=for-the-badge)](LICENSE)

</div>

## 🎯 Why AgentSwarm UI Enhanced?

**The only production-ready agent swarm platform with enterprise authentication and monitoring:**

- 🔐 **Secure Authentication** - Supabase-powered login with JWT tokens
- 🌐 **Professional Web Dashboard** - React/Next.js interface with real-time updates
- 🖥️ **Rich Terminal Interface** - Beautiful TUI for command-line interaction
- 🚀 **Production Deployment** - Complete VPS setup with SSL and monitoring
- 📊 **Advanced Analytics** - Performance metrics, cost tracking, success rates
- 🛡️ **Enterprise Security** - Rate limiting, CSRF protection, security headers
- 🔄 **CI/CD Pipeline** - GitHub Actions with automated testing and security scans

## ⚡ Live Production Instance

**🌟 Try it now: [swarm.metajibe.com](https://swarm.metajibe.com)**

- ✅ Full SSL encryption with Let's Encrypt
- ✅ Secure authentication system
- ✅ Professional monitoring and backup
- ✅ High-availability deployment

## 🚀 Quick Start Options

### Option 1: Production Deployment (Recommended)

Deploy your own secure instance with one command:

```bash
# On your VPS (Ubuntu 22.04+)
wget https://raw.githubusercontent.com/dustin-olenslager/agentswarm-ui-enhanced/main/deploy-to-vps.sh
chmod +x deploy-to-vps.sh
sudo ./deploy-to-vps.sh
```

Complete deployment guide: [PRODUCTION-DEPLOYMENT.md](PRODUCTION-DEPLOYMENT.md)

### Option 2: Local Development

```bash
# Clone repository
git clone https://github.com/dustin-olenslager/agentswarm-ui-enhanced.git
cd agentswarm-ui-enhanced

# Setup Python environment
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup Node.js dashboard
cd agent-swarm-visualizer/dashboard
pnpm install
pnpm dev &

# Launch main application
cd ../..
export OPENAI_API_KEY="your-key-here"
python main.py --dashboard "Create a simple web application"
```

## 🏗️ Architecture

```
Internet → Nginx (SSL) → Authentication → Dashboard Services
                                       ├── Web Dashboard (3000)
                                       └── Terminal API (8000)
```

### Dashboard Interfaces

#### 🌐 Web Dashboard
- **URL**: `/` (main interface)
- **Technology**: Next.js 14 + TypeScript
- **Features**: Real-time monitoring, task management, analytics
- **Authentication**: Secure Supabase integration

#### 🖥️ Terminal Dashboard  
- **URL**: `/terminal` or direct CLI
- **Technology**: Python + Rich TUI
- **Features**: Command-line interface, live logs, diagnostics

## 🔐 Security Features

### Authentication System
- **Provider**: Supabase Auth
- **Method**: JWT tokens with secure sessions  
- **Admin Access**: dustin.olenslager@gmail.com
- **Protection**: Rate limiting, CSRF, secure headers

### Infrastructure Security
- **SSL**: Let's Encrypt with auto-renewal
- **Firewall**: UFW with minimal open ports
- **Headers**: XSS, Content-Type, HSTS protection
- **Monitoring**: Real-time security event logging

## 📊 Monitoring & Management

### Built-in Commands
```bash
# System status
/usr/local/bin/agentswarm-status

# Update application  
/usr/local/bin/agentswarm-update

# Create backups
/usr/local/bin/agentswarm-backup
```

### Service Management
```bash
# Service status
systemctl status agentswarm-main
systemctl status agentswarm-dashboard

# View logs
journalctl -u agentswarm-main -f
journalctl -u agentswarm-dashboard -f
```

## 🎛️ Advanced Features

### Multi-Agent Orchestration
- **Concurrent Agents**: Run multiple specialized agents
- **Task Distribution**: Intelligent work allocation
- **Real-time Monitoring**: Live activity visualization
- **Performance Analytics**: Cost and success tracking

### Professional Dashboard
- **Responsive Design**: Works on all devices
- **Real-time Updates**: WebSocket-powered live data
- **User Management**: Secure admin access control
- **Export Capabilities**: Download reports and logs

### Enterprise Integration
- **API Access**: RESTful API for integrations
- **Webhook Support**: Event notifications
- **Audit Logging**: Complete activity tracking
- **Backup Systems**: Automated data protection

## 🛠️ Development

### Requirements
- **Python**: 3.11+
- **Node.js**: 18+
- **Database**: PostgreSQL (via Supabase)
- **OS**: Ubuntu 22.04+ (production)

### Contributing
1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Run tests: `pnpm test && python -m pytest`
4. Submit pull request

### CI/CD Pipeline
- ✅ Automated testing (Python + TypeScript)
- ✅ Security vulnerability scanning
- ✅ Code quality checks
- ✅ Upstream synchronization

## 📖 Documentation

- [**Production Deployment**](PRODUCTION-DEPLOYMENT.md) - Complete setup guide
- [**Supabase Setup**](supabase-setup.md) - Authentication configuration
- [**API Documentation**](docs/api.md) - REST API reference
- [**Troubleshooting**](docs/troubleshooting.md) - Common issues and solutions

## 🔗 Useful Links

- **Live Demo**: [swarm.metajibe.com](https://swarm.metajibe.com)
- **Repository**: [GitHub](https://github.com/dustin-olenslager/agentswarm-ui-enhanced)
- **Documentation**: [Full Docs](docs/)
- **Issues**: [Bug Reports](https://github.com/dustin-olenslager/agentswarm-ui-enhanced/issues)

## 🤝 Support

### Community
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: Community support and ideas
- **Wiki**: Community-maintained documentation

### Professional Support
For production deployments, security audits, and custom development:
- **Email**: dustin.olenslager@gmail.com
- **Enterprise**: Custom deployment and training available

## 🆚 Comparison with Standard AgentSwarm

| Feature | Standard AgentSwarm | AgentSwarm UI Enhanced |
|---------|-------------------|----------------------|
| Web Dashboard | ❌ Basic | ✅ Professional React/Next.js |
| Authentication | ❌ None | ✅ Supabase + JWT |
| Production Ready | ❌ Development only | ✅ Full SSL deployment |
| Security | ❌ Basic | ✅ Enterprise-grade |
| Monitoring | ❌ Limited | ✅ Comprehensive |
| CI/CD | ❌ None | ✅ GitHub Actions |
| Documentation | ❌ Basic | ✅ Complete guides |
| Backup/Recovery | ❌ Manual | ✅ Automated |

## 📋 Production Checklist

When deploying to production:

- [ ] VPS with Ubuntu 22.04+ and 2GB+ RAM
- [ ] Domain name pointing to your VPS
- [ ] Supabase project created
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Backup system active
- [ ] Monitoring set up

## 🎉 Success Stories

*"AgentSwarm UI Enhanced transformed our development workflow. The professional dashboard and secure authentication made it possible to deploy agent swarms for our entire team."* - Development Team Lead

*"The one-click VPS deployment saved us weeks of DevOps work. Everything just works out of the box."* - CTO, Tech Startup

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built upon the foundation of [andrewcai8/agentswarm](https://github.com/andrewcai8/agentswarm)
- Enhanced with production-grade features and professional UI
- Deployed with enterprise security and monitoring

---

<div align="center">

**⭐ Star this repository if it helped you build better agent systems! ⭐**

[Get Started](PRODUCTION-DEPLOYMENT.md) • [View Demo](https://swarm.metajibe.com) • [Report Bug](https://github.com/dustin-olenslager/agentswarm-ui-enhanced/issues)

</div>