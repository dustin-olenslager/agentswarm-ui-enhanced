#!/bin/bash
# AgentSwarm UI - Installation Script
# Automated setup for the UI-first multi-agent coding platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${PURPLE}"
cat << 'EOF'
    ╔═══════════════════════════════════════════════════╗
    ║              🐝 AgentSwarm UI 🐝                  ║
    ║                                                   ║
    ║      The UI-First Multi-Agent Coding Platform    ║
    ╚═══════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${BLUE}🚀 Starting AgentSwarm UI installation...${NC}"
echo

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get OS
get_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

OS=$(get_os)
echo -e "${BLUE}🖥️  Detected OS: $OS${NC}"

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check Python
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo -e "${GREEN}✓ Python $PYTHON_VERSION found${NC}"
    PYTHON_CMD="python3"
elif command_exists python; then
    PYTHON_VERSION=$(python --version | cut -d' ' -f2)
    echo -e "${GREEN}✓ Python $PYTHON_VERSION found${NC}"
    PYTHON_CMD="python"
else
    echo -e "${RED}❌ Python not found. Please install Python 3.8+ and try again.${NC}"
    exit 1
fi

# Check pip
if command_exists pip3; then
    echo -e "${GREEN}✓ pip3 found${NC}"
    PIP_CMD="pip3"
elif command_exists pip; then
    echo -e "${GREEN}✓ pip found${NC}"
    PIP_CMD="pip"
else
    echo -e "${RED}❌ pip not found. Please install pip and try again.${NC}"
    exit 1
fi

# Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js $NODE_VERSION found${NC}"
else
    echo -e "${YELLOW}⚠️  Node.js not found. Installing Node.js...${NC}"
    
    if [ "$OS" == "macos" ]; then
        if command_exists brew; then
            brew install node
        else
            echo -e "${RED}❌ Homebrew not found. Please install Node.js manually from https://nodejs.org${NC}"
            exit 1
        fi
    elif [ "$OS" == "linux" ]; then
        # Try to install Node.js on Ubuntu/Debian
        if command_exists apt-get; then
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            echo -e "${RED}❌ Please install Node.js manually from https://nodejs.org${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Please install Node.js manually from https://nodejs.org${NC}"
        exit 1
    fi
fi

# Check pnpm
if command_exists pnpm; then
    echo -e "${GREEN}✓ pnpm found${NC}"
else
    echo -e "${YELLOW}⚠️  pnpm not found. Installing pnpm...${NC}"
    npm install -g pnpm
fi

# Check git
if command_exists git; then
    echo -e "${GREEN}✓ Git found${NC}"
else
    echo -e "${RED}❌ Git not found. Please install Git and try again.${NC}"
    exit 1
fi

echo

# Install Python dependencies
echo -e "${YELLOW}📦 Installing Python dependencies...${NC}"
$PIP_CMD install --upgrade pip
$PIP_CMD install -r requirements.txt
echo -e "${GREEN}✓ Python dependencies installed${NC}"

# Install Node.js dependencies
echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
pnpm install
echo -e "${GREEN}✓ Node.js dependencies installed${NC}"

# Build web dashboard
echo -e "${YELLOW}🏗️  Building web dashboard...${NC}"
cd agent-swarm-visualizer/dashboard
pnpm install
pnpm build
cd ../..
echo -e "${GREEN}✓ Web dashboard built${NC}"

# Setup environment
echo -e "${YELLOW}🔧 Setting up environment...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file from template${NC}"
    echo -e "${YELLOW}💡 Please edit .env file with your API keys${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi

# Create logs directory
mkdir -p logs
echo -e "${GREEN}✓ Created logs directory${NC}"

# Setup upstream tracking
echo -e "${YELLOW}🔄 Setting up upstream tracking...${NC}"
if [ -f scripts/setup-upstream-sync.sh ]; then
    ./scripts/setup-upstream-sync.sh
else
    echo -e "${YELLOW}⚠️  Upstream sync script not found, skipping...${NC}"
fi

# Test installation
echo -e "${YELLOW}🧪 Testing installation...${NC}"

# Test Python imports
if $PYTHON_CMD -c "import rich; print('Rich import successful')" 2>/dev/null; then
    echo -e "${GREEN}✓ Python dependencies working${NC}"
else
    echo -e "${RED}❌ Python dependencies test failed${NC}"
    exit 1
fi

# Test CLI
if $PYTHON_CMD main.py --help >/dev/null 2>&1; then
    echo -e "${GREEN}✓ CLI working${NC}"
else
    echo -e "${RED}❌ CLI test failed${NC}"
    exit 1
fi

echo

# Installation complete
echo -e "${GREEN}"
cat << 'EOF'
    ╔════════════════════════════════════════════════════╗
    ║               🎉 Installation Complete! 🎉         ║
    ╚════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${BLUE}📚 Quick Start:${NC}"
echo
echo -e "${CYAN}1. Configure your API keys:${NC}"
echo "   nano .env"
echo
echo -e "${CYAN}2. Start with terminal dashboard:${NC}"
echo "   python main.py --dashboard \"Build a simple web server\""
echo
echo -e "${CYAN}3. Or start the web dashboard:${NC}"
echo "   cd agent-swarm-visualizer/dashboard"
echo "   pnpm dev"
echo "   # In another terminal:"
echo "   python main.py \"Build a React todo app\""
echo

echo -e "${BLUE}📖 Documentation:${NC}"
echo "• README.md - Main documentation"
echo "• docs/ - Detailed guides"
echo "• examples/ - Example projects"
echo "• CONTRIBUTING.md - How to contribute"
echo

echo -e "${BLUE}🔗 Useful Commands:${NC}"
echo "• python main.py --help          - Show CLI help"
echo "• python dashboard.py --demo     - Demo the terminal dashboard"
echo "• ./scripts/sync-upstream.sh     - Sync with upstream changes"
echo

echo -e "${BLUE}🆘 Need Help?${NC}"
echo "• GitHub Issues: https://github.com/your-org/agentswarm-ui/issues"
echo "• Discord: https://discord.gg/agentswarm-ui"
echo "• Documentation: https://agentswarm-ui.dev/docs"
echo

echo -e "${BLUE}🚀 Happy Swarming! 🐝${NC}"