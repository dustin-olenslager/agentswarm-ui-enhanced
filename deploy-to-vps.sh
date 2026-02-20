#!/bin/bash

# AgentSwarm UI Enhanced - VPS Deployment Script
# Run this script on your VPS (37.27.200.128) as root

set -e

# Configuration
DOMAIN="swarm.metajibe.com"
APP_USER="agentswarm"
APP_DIR="/opt/agentswarm"
REPO_URL="https://github.com/dustin-olenslager/agentswarm-ui-enhanced.git"
PYTHON_VERSION="3.11"
NODE_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root"
fi

log "Starting AgentSwarm UI Enhanced deployment..."

# Update system
log "Updating system packages..."
apt update && apt upgrade -y

# Install required packages
log "Installing required system packages..."
apt install -y \
    curl \
    wget \
    git \
    build-essential \
    nginx \
    certbot \
    python3-certbot-nginx \
    supervisor \
    ufw \
    htop \
    tree \
    jq \
    unzip

# Create application user
log "Creating application user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
    usermod -aG sudo "$APP_USER"
fi

# Install Python 3.11
log "Installing Python $PYTHON_VERSION..."
apt install -y software-properties-common
add-apt-repository ppa:deadsnakes/ppa -y
apt update
apt install -y python$PYTHON_VERSION python$PYTHON_VERSION-venv python$PYTHON_VERSION-pip python$PYTHON_VERSION-dev

# Install Node.js 18
log "Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install pnpm
log "Installing pnpm..."
npm install -g pnpm

# Create application directory
log "Creating application directory..."
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# Clone repository
log "Cloning repository..."
cd "$APP_DIR"
if [ -d ".git" ]; then
    sudo -u "$APP_USER" git pull
else
    sudo -u "$APP_USER" git clone "$REPO_URL" .
fi

# Set up Python environment
log "Setting up Python virtual environment..."
sudo -u "$APP_USER" python$PYTHON_VERSION -m venv venv
sudo -u "$APP_USER" bash -c "source venv/bin/activate && pip install --upgrade pip"
sudo -u "$APP_USER" bash -c "source venv/bin/activate && pip install -r requirements.txt"

# Install Node.js dependencies
log "Installing Node.js dependencies..."
sudo -u "$APP_USER" pnpm install

# Install dashboard dependencies
log "Installing dashboard dependencies..."
cd "$APP_DIR/agent-swarm-visualizer/dashboard"
sudo -u "$APP_USER" pnpm install

# Build dashboard
log "Building dashboard..."
sudo -u "$APP_USER" pnpm build

# Create environment file
log "Creating environment configuration..."
cd "$APP_DIR"
if [ ! -f ".env" ]; then
    sudo -u "$APP_USER" cp .env.example .env
    
    # Generate random secrets
    JWT_SECRET=$(openssl rand -hex 32)
    API_KEY=$(openssl rand -hex 32)
    
    # Update environment file
    sudo -u "$APP_USER" bash -c "cat >> .env << EOF

# Production Configuration
NODE_ENV=production
DEBUG=false
PORT=8000
DASHBOARD_PORT=3000

# Security
JWT_SECRET=$JWT_SECRET
API_KEY=$API_KEY

# Domain
DOMAIN=$DOMAIN
BASE_URL=https://$DOMAIN

# Database (if needed)
# DATABASE_URL=postgresql://user:pass@localhost:5432/agentswarm

# Supabase (configure with your actual values)
# NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# SUPABASE_JWT_SECRET=your_supabase_jwt_secret
EOF"
fi

# Create systemd service for main application
log "Creating systemd service for main application..."
cat > /etc/systemd/system/agentswarm-main.service << EOF
[Unit]
Description=AgentSwarm Main Application
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=PATH=$APP_DIR/venv/bin
ExecStart=$APP_DIR/venv/bin/python main.py --port 8000
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for dashboard
log "Creating systemd service for dashboard..."
cat > /etc/systemd/system/agentswarm-dashboard.service << EOF
[Unit]
Description=AgentSwarm Dashboard
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/agent-swarm-visualizer/dashboard
ExecStart=/usr/bin/pnpm start
Environment=NODE_ENV=production
Environment=PORT=3000
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Configure Nginx
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/agentswarm << EOF
# Main application (API/Terminal Dashboard)
server {
    listen 80;
    server_name $DOMAIN;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;
    
    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubdomains" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=1r/s;
    
    # Main application root
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # API routes to main application
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Terminal dashboard routes
    location /terminal {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Authentication endpoints
    location /auth {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static files
    location /static/ {
        root $APP_DIR;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check
    location /health {
        access_log off;
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host \$host;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/agentswarm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Configure firewall
log "Configuring firewall..."
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'

# Enable and start services
log "Enabling and starting services..."
systemctl daemon-reload
systemctl enable agentswarm-main agentswarm-dashboard nginx
systemctl start nginx

# Get SSL certificate
log "Obtaining SSL certificate..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" --redirect

# Start application services
log "Starting application services..."
systemctl start agentswarm-main agentswarm-dashboard

# Create deployment status script
log "Creating deployment status script..."
cat > /usr/local/bin/agentswarm-status << 'EOF'
#!/bin/bash

echo "=== AgentSwarm UI Enhanced Status ==="
echo
echo "Services:"
systemctl status agentswarm-main --no-pager -l
echo
systemctl status agentswarm-dashboard --no-pager -l
echo
systemctl status nginx --no-pager -l
echo
echo "Ports:"
ss -tulpn | grep -E ':(3000|8000|80|443)'
echo
echo "SSL Certificate:"
certbot certificates
echo
echo "Disk Usage:"
df -h /opt/agentswarm
echo
echo "Memory Usage:"
free -h
echo
echo "Recent Logs (last 10 lines):"
echo "--- Main App ---"
journalctl -u agentswarm-main --no-pager -n 10
echo "--- Dashboard ---"
journalctl -u agentswarm-dashboard --no-pager -n 10
echo "--- Nginx ---"
journalctl -u nginx --no-pager -n 5
EOF

chmod +x /usr/local/bin/agentswarm-status

# Create update script
log "Creating update script..."
cat > /usr/local/bin/agentswarm-update << EOF
#!/bin/bash

set -e

log() {
    echo -e "\033[0;32m[\$(date +'%Y-%m-%d %H:%M:%S')] \$1\033[0m"
}

log "Updating AgentSwarm UI Enhanced..."

# Stop services
systemctl stop agentswarm-main agentswarm-dashboard

# Update code
cd $APP_DIR
sudo -u $APP_USER git pull

# Update Python dependencies
sudo -u $APP_USER bash -c "source venv/bin/activate && pip install -r requirements.txt"

# Update Node.js dependencies
sudo -u $APP_USER pnpm install

# Update dashboard
cd $APP_DIR/agent-swarm-visualizer/dashboard
sudo -u $APP_USER pnpm install
sudo -u $APP_USER pnpm build

# Restart services
systemctl start agentswarm-main agentswarm-dashboard

log "Update completed successfully!"

# Show status
/usr/local/bin/agentswarm-status
EOF

chmod +x /usr/local/bin/agentswarm-update

# Create backup script
cat > /usr/local/bin/agentswarm-backup << EOF
#!/bin/bash

BACKUP_DIR="/backup/agentswarm"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p "\$BACKUP_DIR"

# Backup application directory
tar -czf "\$BACKUP_DIR/agentswarm_\$DATE.tar.gz" -C /opt agentswarm

# Backup nginx config
cp /etc/nginx/sites-available/agentswarm "\$BACKUP_DIR/nginx_config_\$DATE"

# Backup systemd services
cp /etc/systemd/system/agentswarm-*.service "\$BACKUP_DIR/"

# Keep only last 7 backups
find "\$BACKUP_DIR" -name "agentswarm_*.tar.gz" -type f -mtime +7 -delete

echo "Backup completed: \$BACKUP_DIR/agentswarm_\$DATE.tar.gz"
EOF

chmod +x /usr/local/bin/agentswarm-backup

# Set up automatic updates (optional)
log "Setting up automatic SSL renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

# Final status check
log "Deployment completed! Running status check..."
sleep 5
/usr/local/bin/agentswarm-status

log "=== Deployment Summary ==="
log "✅ Repository: $REPO_URL"
log "✅ Domain: https://$DOMAIN"
log "✅ Main App: https://$DOMAIN/api/"
log "✅ Terminal Dashboard: https://$DOMAIN/terminal"
log "✅ Web Dashboard: https://$DOMAIN"
log "✅ SSL Certificate: Enabled"
log "✅ Firewall: Configured"
log "✅ Services: Running"
log ""
log "Management Commands:"
log "  - Status: /usr/local/bin/agentswarm-status"
log "  - Update: /usr/local/bin/agentswarm-update"
log "  - Backup: /usr/local/bin/agentswarm-backup"
log ""
log "Log Files:"
log "  - Main App: journalctl -u agentswarm-main -f"
log "  - Dashboard: journalctl -u agentswarm-dashboard -f"
log "  - Nginx: journalctl -u nginx -f"
log ""
log "Configuration:"
log "  - App Config: $APP_DIR/.env"
log "  - Nginx Config: /etc/nginx/sites-available/agentswarm"
log ""
log "🚀 AgentSwarm UI Enhanced is now live at https://$DOMAIN"

warn "IMPORTANT: Configure Supabase authentication by updating $APP_DIR/.env"
warn "Add your Supabase URL, anon key, and JWT secret to complete authentication setup."
EOF