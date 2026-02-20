# Deployment Guide

This guide covers different ways to deploy AgentSwarm UI in production environments.

## 🏠 Local Deployment

### Development Mode
```bash
# Terminal dashboard
python main.py --dashboard "your project"

# Web dashboard (separate terminal)
cd agent-swarm-visualizer/dashboard
pnpm dev
```

### Production Mode
```bash
# Build web dashboard
cd agent-swarm-visualizer/dashboard
pnpm build
pnpm start

# Run orchestrator with production config
python main.py --config config/production.json
```

## ☁️ Cloud Deployment

### Vercel (Web Dashboard)

1. **Fork the repository** and connect to Vercel
2. **Set build settings:**
   ```
   Build Command: cd agent-swarm-visualizer/dashboard && pnpm build
   Output Directory: agent-swarm-visualizer/dashboard/.next
   Install Command: pnpm install
   ```
3. **Environment variables:**
   ```
   NEXT_PUBLIC_API_URL=https://your-orchestrator-api.com
   ```

### Railway (Full Stack)

```yaml
# railway.toml
[build]
  builder = "nixpacks"
  buildCommand = "pip install -r requirements.txt && cd agent-swarm-visualizer/dashboard && pnpm install && pnpm build"

[deploy]
  startCommand = "python main.py --config config/production.json"

[environments.production.variables]
  OPENAI_API_KEY = "${{OPENAI_API_KEY}}"
  DASHBOARD_HOST = "0.0.0.0"
  DASHBOARD_PORT = "${{PORT}}"
```

### Modal.com (Serverless Workers)

```python
# modal_deployment.py
import modal

app = modal.App("agentswarm-ui")

@app.function(
    image=modal.Image.debian_slim().pip_install(
        "openai", "anthropic", "rich"
    ),
    secrets=[modal.Secret.from_name("agentswarm-secrets")]
)
def run_orchestrator(project_spec: str):
    from main import main
    return main(project_spec, dashboard=False)

@app.local_entrypoint()
def deploy():
    # Deploy the orchestrator
    result = run_orchestrator.remote("Build a simple web app")
    print(result)
```

Deploy:
```bash
modal deploy modal_deployment.py
```

### Docker

```dockerfile
# Dockerfile
FROM python:3.11-slim

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy files
COPY requirements.txt .
COPY package.json pnpm-lock.yaml ./
COPY . .

# Install dependencies
RUN pip install -r requirements.txt
RUN pnpm install

# Build web dashboard
RUN cd agent-swarm-visualizer/dashboard && pnpm build

# Expose ports
EXPOSE 3000 8000

# Start command
CMD ["python", "main.py", "--config", "config/production.json"]
```

Build and run:
```bash
docker build -t agentswarm-ui .
docker run -p 3000:3000 -p 8000:8000 --env-file .env agentswarm-ui
```

### Kubernetes

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentswarm-ui
spec:
  replicas: 2
  selector:
    matchLabels:
      app: agentswarm-ui
  template:
    metadata:
      labels:
        app: agentswarm-ui
    spec:
      containers:
      - name: agentswarm-ui
        image: agentswarm-ui:latest
        ports:
        - containerPort: 3000
        - containerPort: 8000
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: agentswarm-secrets
              key: openai-api-key
        - name: DASHBOARD_HOST
          value: "0.0.0.0"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"

---
apiVersion: v1
kind: Service
metadata:
  name: agentswarm-ui-service
spec:
  selector:
    app: agentswarm-ui
  ports:
  - name: web
    port: 3000
    targetPort: 3000
  - name: api
    port: 8000
    targetPort: 8000
  type: LoadBalancer
```

Deploy:
```bash
kubectl apply -f k8s-deployment.yaml
```

## 🔧 Configuration

### Production Configuration

```json
// config/production.json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "max_tokens": 4000,
    "temperature": 0.1
  },
  "orchestrator": {
    "max_parallel_agents": 20,
    "timeout": 600,
    "retry_attempts": 3
  },
  "dashboard": {
    "enabled": true,
    "host": "0.0.0.0",
    "port": 3000,
    "refresh_rate": 2000
  },
  "logging": {
    "level": "INFO",
    "file": "./logs/production.log",
    "max_size": "100MB",
    "backup_count": 5
  },
  "security": {
    "sandbox_enabled": true,
    "network_isolation": true,
    "resource_limits": {
      "memory": "2GB",
      "cpu": "2 cores",
      "disk": "10GB"
    }
  }
}
```

### Environment Variables

```bash
# Production environment
export NODE_ENV=production
export OPENAI_API_KEY="your-key"
export DASHBOARD_HOST="0.0.0.0"
export DASHBOARD_PORT="3000"
export LOG_LEVEL="INFO"
export SANDBOX_ENABLED="true"
```

## 🔐 Security

### API Key Management

**Never commit API keys!** Use:

1. **Environment variables**
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

2. **Secret management services**
   - AWS Secrets Manager
   - Azure Key Vault
   - Google Secret Manager
   - HashiCorp Vault

3. **CI/CD secrets**
   - GitHub Secrets
   - GitLab Variables
   - CircleCI Environment Variables

### Network Security

```nginx
# nginx.conf for reverse proxy
server {
    listen 443 ssl;
    server_name agentswarm-ui.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
        # Additional API security headers
        proxy_set_header X-API-Key $http_x_api_key;
    }
}
```

## 📊 Monitoring

### Health Checks

```python
# health_check.py
import httpx
import sys

def check_dashboard_health():
    try:
        response = httpx.get("http://localhost:3000/health")
        return response.status_code == 200
    except:
        return False

def check_orchestrator_health():
    try:
        response = httpx.get("http://localhost:8000/health")
        return response.status_code == 200
    except:
        return False

if __name__ == "__main__":
    dashboard_ok = check_dashboard_health()
    orchestrator_ok = check_orchestrator_health()
    
    if dashboard_ok and orchestrator_ok:
        print("✅ All systems healthy")
        sys.exit(0)
    else:
        print("❌ System unhealthy")
        sys.exit(1)
```

### Logging

```python
# logging_config.py
import logging
import logging.handlers

def setup_production_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # File handler with rotation
    file_handler = logging.handlers.RotatingFileHandler(
        'logs/agentswarm.log',
        maxBytes=100*1024*1024,  # 100MB
        backupCount=5
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(
        '%(levelname)s: %(message)s'
    ))
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
```

## 🚨 Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check what's using ports
   lsof -i :3000
   lsof -i :8000
   
   # Kill processes if needed
   kill -9 $(lsof -t -i:3000)
   ```

2. **Memory issues**
   ```bash
   # Monitor memory usage
   htop
   
   # Increase Node.js memory limit
   NODE_OPTIONS="--max-old-space-size=4096" pnpm start
   ```

3. **Database connections**
   ```bash
   # Check database connectivity
   python -c "import sqlite3; print('SQLite OK')"
   ```

### Performance Tuning

```json
{
  "performance": {
    "worker_pool_size": 10,
    "batch_size": 5,
    "timeout": 300,
    "memory_limit": "4GB",
    "cpu_limit": "4 cores"
  }
}
```

## 📈 Scaling

### Horizontal Scaling

1. **Load balancer** (nginx/HAProxy)
2. **Multiple orchestrator instances**
3. **Shared state management** (Redis/Database)
4. **Worker distribution** (Modal/Kubernetes)

### Vertical Scaling

1. **Increase resources** (memory/CPU)
2. **Optimize batch sizes**
3. **Tune worker pool**
4. **Cache frequently used data**

For more deployment options and advanced configurations, see the [advanced deployment guide](advanced-deployment.md).