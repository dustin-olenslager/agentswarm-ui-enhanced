# Security Policy

## 🔐 Production Security Features

AgentSwarm UI is designed for **public deployment** with enterprise-grade security.

### Authentication System
- **JWT tokens** with HTTP-only cookies
- **Bcrypt password hashing** (12 rounds)
- **Role-based access control** (Admin/Viewer)
- **Session timeout** management
- **Secure credential generation**

### Rate Limiting
- **Login attempts**: 5 per 15 minutes per IP
- **API requests**: 60 per minute per IP
- **General requests**: 30 per minute per IP
- **WebSocket connections**: Protected

### Security Headers
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
```

### Infrastructure Security
- **Docker containerization** with non-root user
- **Nginx reverse proxy** with security hardening
- **SSL/TLS encryption** with Let's Encrypt
- **Network isolation** and firewall rules

## 🚨 Security Checklist for Production

### Before Deployment
- [ ] Generate unique JWT secret (`node scripts/generate-credentials.js`)
- [ ] Change default admin/viewer passwords
- [ ] Configure production environment variables
- [ ] Obtain SSL certificates for your domain
- [ ] Review and test Nginx configuration
- [ ] Verify Docker security settings

### During Deployment
- [ ] Use `./scripts/deploy-production.sh` script
- [ ] Verify health checks are passing
- [ ] Test authentication flow
- [ ] Confirm HTTPS redirect is working
- [ ] Validate security headers

### Post Deployment
- [ ] Monitor access logs for suspicious activity
- [ ] Set up log rotation and monitoring
- [ ] Configure backup procedures
- [ ] Schedule SSL certificate renewal
- [ ] Regular security updates

## 🔧 Security Configuration

### Environment Variables (Required)
```bash
JWT_SECRET=<64-char-base64-secret>
ADMIN_USERNAME=<your-admin-username>
ADMIN_PASSWORD_HASH=<bcrypt-hash>
VIEWER_USERNAME=<your-viewer-username>
VIEWER_PASSWORD_HASH=<bcrypt-hash>
```

### Generate Secure Credentials
```bash
# Use our credential generator
node scripts/generate-credentials.js

# Or generate JWT secret manually
openssl rand -base64 64

# Or hash passwords manually
node -e "console.log(require('bcryptjs').hashSync('yourpassword', 12))"
```

### Nginx Security Configuration
The included `nginx.conf` provides:
- SSL/TLS termination
- Security headers
- Rate limiting
- Static file optimization
- WebSocket support
- Malicious request blocking

## 📊 Security Monitoring

### Access Logs
Monitor these patterns in `/var/log/nginx/agentswarm_access.log`:
- Multiple failed login attempts from same IP
- Unusual API request patterns
- Requests to non-existent endpoints
- High-frequency requests from single source

### Health Monitoring
```bash
# Check service health
curl -f https://swarm.metajibe.com/api/health

# Monitor container logs
docker-compose -f docker-compose.production.yml logs -f

# Check SSL certificate status
openssl s_client -connect swarm.metajibe.com:443 -servername swarm.metajibe.com
```

## 🚨 Incident Response

### Suspicious Activity
1. **Check access logs** for attack patterns
2. **Block malicious IPs** at firewall level
3. **Rotate credentials** if compromise suspected
4. **Review audit logs** for unauthorized access

### Security Updates
1. **Monitor security advisories** for dependencies
2. **Test updates** in staging environment first
3. **Apply updates** during maintenance windows
4. **Verify security** after updates

## 📞 Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. **Email** security@agentswarm-ui.org
3. **Include** detailed reproduction steps
4. **Allow** reasonable time for patching

We follow responsible disclosure and will credit reporters appropriately.

## 🔒 Security Best Practices

### For Administrators
- Use strong, unique passwords
- Enable two-factor authentication where possible
- Regularly rotate credentials
- Monitor access logs
- Keep systems updated
- Backup critical data

### For Users
- Use strong passwords
- Don't share login credentials
- Log out when done
- Report suspicious activity
- Use HTTPS only

### For Developers
- Follow secure coding practices
- Validate all inputs
- Use parameterized queries
- Implement proper error handling
- Regular security testing
- Dependency vulnerability scanning

## 📋 Security Testing

### Manual Testing
```bash
# Test authentication
curl -X POST https://swarm.metajibe.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrongpassword"}'

# Test rate limiting
for i in {1..10}; do
  curl -X POST https://swarm.metajibe.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}'
done

# Test security headers
curl -I https://swarm.metajibe.com/
```

### Automated Security Scanning
- **OWASP ZAP** for web application scanning
- **Docker security scanning** with Trivy
- **SSL Labs** for certificate verification
- **Security headers check** with securityheaders.com

---

**⚠️ Remember: Security is an ongoing process, not a one-time setup.**