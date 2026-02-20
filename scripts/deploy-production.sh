#!/bin/bash
# AgentSwarm UI - Production Deployment Script
# For secure deployment at swarm.metajibe.com

set -e

echo "🚀 AgentSwarm UI Production Deployment"
echo "====================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo -e "${RED}❌ This script should not be run as root${NC}"
   exit 1
fi

# Verify we're on the production server
if [[ "${HOSTNAME}" != *"metajibe"* ]] && [[ "${HOSTNAME}" != "production-server" ]]; then
    echo -e "${YELLOW}⚠️  Warning: Not on recognized production server${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${BLUE}🔒 Security Checks${NC}"

# Check if production.env exists and is configured
if [[ ! -f "production.env" ]]; then
    echo -e "${RED}❌ production.env file not found${NC}"
    echo "Please create production.env from the template and configure it properly."
    exit 1
fi

# Check for default passwords
if grep -q "your-super-secret-jwt-key-change-this-in-production" production.env; then
    echo -e "${RED}❌ Default JWT secret detected in production.env${NC}"
    echo "Please change the JWT_SECRET in production.env before deploying."
    exit 1
fi

if grep -q "admin123\|viewer123" production.env; then
    echo -e "${RED}❌ Default passwords detected in production.env${NC}"
    echo "Please change the default password hashes in production.env before deploying."
    echo "Use bcrypt to hash your passwords: node -e \"console.log(require('bcryptjs').hashSync('yourpassword', 10))\""
    exit 1
fi

# Check SSL certificates
if [[ ! -f "/etc/letsencrypt/live/swarm.metajibe.com/fullchain.pem" ]]; then
    echo -e "${YELLOW}⚠️  SSL certificate not found${NC}"
    echo "Setting up Let's Encrypt SSL certificate..."
    
    # Install certbot if not present
    if ! command -v certbot &> /dev/null; then
        echo "Installing certbot..."
        sudo apt update
        sudo apt install -y certbot nginx
    fi
    
    # Get SSL certificate
    sudo certbot certonly --nginx -d swarm.metajibe.com
    
    if [[ $? -ne 0 ]]; then
        echo -e "${RED}❌ Failed to obtain SSL certificate${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Security checks passed${NC}"

echo -e "${BLUE}🔧 Deployment Steps${NC}"

# Build and deploy
echo "Building Docker images..."
docker-compose -f docker-compose.production.yml build

echo "Stopping existing services..."
docker-compose -f docker-compose.production.yml down

echo "Starting new services..."
docker-compose -f docker-compose.production.yml up -d

# Wait for health check
echo "Waiting for services to be healthy..."
sleep 30

# Verify deployment
echo -e "${BLUE}🧪 Deployment Verification${NC}"

# Check if containers are running
if ! docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
    echo -e "${RED}❌ Containers are not running${NC}"
    docker-compose -f docker-compose.production.yml logs
    exit 1
fi

# Check health endpoint
if curl -f -s http://localhost:3000/api/health > /dev/null; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed${NC}"
    exit 1
fi

# Check HTTPS endpoint
if curl -f -s https://swarm.metajibe.com/api/health > /dev/null; then
    echo -e "${GREEN}✓ HTTPS endpoint accessible${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS endpoint not accessible (may be DNS/proxy issue)${NC}"
fi

echo -e "${GREEN}🎉 Deployment Successful!${NC}"
echo
echo -e "${BLUE}📊 Service Status:${NC}"
docker-compose -f docker-compose.production.yml ps

echo
echo -e "${BLUE}🔗 Access Information:${NC}"
echo "Dashboard: https://swarm.metajibe.com"
echo "Health Check: https://swarm.metajibe.com/api/health"

echo
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Test login functionality"
echo "2. Verify all security headers"
echo "3. Monitor logs: docker-compose -f docker-compose.production.yml logs -f"
echo "4. Set up monitoring and backups"

echo
echo -e "${YELLOW}⚠️  Security Reminders:${NC}"
echo "• Change default credentials immediately"
echo "• Monitor access logs regularly"
echo "• Keep SSL certificates updated"
echo "• Review security headers periodically"

echo -e "${GREEN}🚀 AgentSwarm UI is now live at https://swarm.metajibe.com${NC}"