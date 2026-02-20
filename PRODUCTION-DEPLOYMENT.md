# AgentSwarm UI Enhanced - Production Deployment Guide

## 🚀 Quick Deployment

This is the complete production deployment guide for **AgentSwarm UI Enhanced** at `swarm.metajibe.com`.

## ✅ Deployment Status

### GitHub Repository Setup
- ✅ **Repository**: https://github.com/dustin-olenslager/agentswarm-ui-enhanced
- ✅ **CI/CD Pipeline**: GitHub Actions configured with comprehensive testing
- ✅ **Auto-sync**: Upstream synchronization configured
- ✅ **Security Scanning**: Trivy vulnerability scanner integrated

### VPS Deployment Ready
- 📋 **VPS**: 37.27.200.128
- 📋 **Domain**: swarm.metajibe.com
- 📋 **SSL**: Let's Encrypt automatic setup
- 📋 **Services**: Systemd services configured

### Authentication System
- ✅ **Framework**: Supabase Auth integration complete
- ✅ **Components**: Login/logout system implemented
- ✅ **Security**: JWT tokens, rate limiting, CSRF protection

## 🏃‍♂️ Immediate Deployment Steps

### Step 1: Execute VPS Deployment

SSH into your VPS and run the deployment script:

```bash
# Connect to VPS as root
ssh root@37.27.200.128

# Download and run deployment script
wget https://raw.githubusercontent.com/dustin-olenslager/agentswarm-ui-enhanced/main/deploy-to-vps.sh
chmod +x deploy-to-vps.sh
./deploy-to-vps.sh
```

This script will:
- Set up Python 3.11 and Node.js 18
- Install all dependencies
- Configure Nginx with SSL
- Create systemd services
- Configure firewall
- Set up monitoring and backup scripts

### Step 2: Configure Supabase Authentication

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Follow the detailed setup guide: [supabase-setup.md](./supabase-setup.md)
3. Update environment variables on the VPS:

```bash
# Edit environment file
nano /opt/agentswarm/.env

# Add Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
ADMIN_EMAIL=dustin.olenslager@gmail.com
```

4. Restart services:
```bash
systemctl restart agentswarm-main agentswarm-dashboard
```

### Step 3: Verify Deployment

```bash
# Check deployment status
/usr/local/bin/agentswarm-status

# Test endpoints
curl -k https://swarm.metajibe.com/health
curl -k https://swarm.metajibe.com/api/health
```

## 🏗️ Architecture Overview

```
Internet → Nginx (SSL Termination) → Application Services
                                  ├── Web Dashboard (Port 3000)
                                  └── Terminal Dashboard/API (Port 8000)
```

### Services
- **agentswarm-main**: Python backend (main.py) on port 8000
- **agentswarm-dashboard**: Next.js web interface on port 3000
- **nginx**: Reverse proxy with SSL termination
- **certbot**: Automatic SSL certificate renewal

### Routing
- `/` → Web Dashboard (Next.js)
- `/api/` → Python Backend API
- `/terminal/` → Terminal Dashboard
- `/auth/` → Authentication endpoints

## 🔐 Security Features

### SSL/TLS
- Let's Encrypt certificates with auto-renewal
- TLS 1.2+ only
- Strong cipher suites
- HSTS headers

### Application Security
- JWT-based authentication
- Rate limiting on auth endpoints
- CSRF protection
- Security headers (XSS, Content-Type, etc.)
- Firewall configured (UFW)

### Access Control
- Admin-only access via Supabase
- Session management
- Secure cookie handling
- API key protection

## 📊 Dashboard Interfaces

### Web Dashboard (Primary)
- **URL**: https://swarm.metajibe.com
- **Technology**: Next.js 14 with TypeScript
- **Features**: 
  - Real-time agent monitoring
  - Interactive task management
  - Performance analytics
  - User authentication
  - Responsive design

### Terminal Dashboard
- **URL**: https://swarm.metajibe.com/terminal
- **Technology**: Python with rich terminal UI
- **Features**:
  - Command-line interface
  - Live agent status
  - Log streaming
  - System diagnostics

## 🛠️ Management Commands

### Status Monitoring
```bash
# Overall system status
/usr/local/bin/agentswarm-status

# Service logs
journalctl -u agentswarm-main -f
journalctl -u agentswarm-dashboard -f
journalctl -u nginx -f
```

### Updates
```bash
# Update application
/usr/local/bin/agentswarm-update

# Manual update
cd /opt/agentswarm
git pull
systemctl restart agentswarm-main agentswarm-dashboard
```

### Backups
```bash
# Create backup
/usr/local/bin/agentswarm-backup

# View backups
ls -la /backup/agentswarm/
```

## 🧪 Testing & Verification

### Health Checks
- https://swarm.metajibe.com/health (Web dashboard)
- https://swarm.metajibe.com/api/health (API backend)

### Authentication Flow
1. Visit https://swarm.metajibe.com
2. Should redirect to login page
3. Login with dustin.olenslager@gmail.com
4. Should redirect to authenticated dashboard

### API Testing
```bash
# Test API endpoints
curl -X GET https://swarm.metajibe.com/api/health
curl -X POST https://swarm.metajibe.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dustin.olenslager@gmail.com","password":"your-password"}'
```

## 📈 Performance & Monitoring

### System Resources
- **CPU**: Monitor with `htop`
- **Memory**: 2GB+ recommended
- **Disk**: 10GB+ recommended
- **Network**: Monitor with `iotop`

### Application Metrics
- Response times via Nginx access logs
- Error rates via application logs
- User sessions via Supabase dashboard
- System health via monitoring endpoints

### Alerts
- SSL certificate expiration (auto-renewed)
- Service failures (systemd notifications)
- Resource exhaustion
- Authentication failures

## 🔄 CI/CD Pipeline

### GitHub Actions
- **Trigger**: Push to main branch
- **Tests**: Python, TypeScript, dashboard build
- **Security**: Vulnerability scanning
- **Deploy**: Manual trigger for production

### Automated Upstream Sync
- Monitors upstream changes
- Creates PRs for review
- Maintains fork compatibility

## 🚨 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check service status
systemctl status agentswarm-main
systemctl status agentswarm-dashboard

# Check logs
journalctl -u agentswarm-main --since "1 hour ago"
```

#### SSL Certificate Issues
```bash
# Renew certificate
certbot renew --nginx
systemctl restart nginx
```

#### Authentication Problems
```bash
# Check environment variables
cat /opt/agentswarm/.env | grep SUPABASE

# Verify Supabase connectivity
curl -X GET "https://your-project-id.supabase.co/rest/v1/" \
  -H "apikey: your-anon-key"
```

#### Performance Issues
```bash
# Check system resources
htop
df -h
free -m

# Check process status
ps aux | grep agentswarm
```

## 📋 Production Checklist

- [ ] VPS deployment script executed successfully
- [ ] Supabase project created and configured
- [ ] Environment variables updated
- [ ] Services running and healthy
- [ ] SSL certificate installed and valid
- [ ] Domain pointing to VPS
- [ ] Authentication flow working end-to-end
- [ ] Both dashboard interfaces accessible
- [ ] API endpoints responding
- [ ] Firewall configured and active
- [ ] Backup scripts configured
- [ ] Monitoring set up
- [ ] Log rotation configured
- [ ] Auto-renewal for SSL set up

## 🎯 Post-Deployment Tasks

1. **User Testing**: Verify all functionality works as expected
2. **Performance Tuning**: Optimize based on real usage patterns
3. **Security Audit**: Review logs and access patterns
4. **Documentation**: Update any environment-specific details
5. **Monitoring Setup**: Configure alerting for production issues
6. **Backup Testing**: Verify backup and restore procedures

## 📞 Support

### Immediate Issues
- Check service logs first
- Verify configuration files
- Test individual components

### Resources
- **Repository**: https://github.com/dustin-olenslager/agentswarm-ui-enhanced
- **Documentation**: All guides included in repository
- **Logs**: Available via journalctl and application logs

## 🎉 Success Metrics

Upon successful deployment, you should have:

- ✅ **Live application** at https://swarm.metajibe.com
- ✅ **Secure authentication** for admin access
- ✅ **Professional-grade deployment** ready for production use
- ✅ **GitHub repository** ready for community engagement
- ✅ **Automated CI/CD pipeline** for ongoing development
- ✅ **Complete monitoring and backup** systems

**🚀 Your AgentSwarm UI Enhanced is now production-ready!**