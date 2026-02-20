#!/bin/bash
# AgentSwarm UI - Upstream Sync Setup
# Sets up automatic synchronization with the original AgentSwarm repository

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
UPSTREAM_REPO="https://github.com/andrewcai8/agentswarm.git"
UPSTREAM_REMOTE="upstream"

echo -e "${BLUE}🔄 Setting up upstream synchronization for AgentSwarm UI${NC}"
echo -e "${BLUE}====================================================${NC}"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Add upstream remote if it doesn't exist
echo -e "${YELLOW}📡 Setting up upstream remote...${NC}"
if git remote get-url $UPSTREAM_REMOTE &>/dev/null; then
    echo -e "${GREEN}✓ Upstream remote already exists${NC}"
    git remote set-url $UPSTREAM_REMOTE $UPSTREAM_REPO
    echo -e "${GREEN}✓ Updated upstream URL${NC}"
else
    git remote add $UPSTREAM_REMOTE $UPSTREAM_REPO
    echo -e "${GREEN}✓ Added upstream remote${NC}"
fi

# Fetch from upstream
echo -e "${YELLOW}🔄 Fetching from upstream...${NC}"
git fetch $UPSTREAM_REMOTE

# Show current status
echo -e "${YELLOW}📊 Repository status:${NC}"
echo "Current branch: $(git branch --show-current)"
echo "Origin: $(git remote get-url origin)"
echo "Upstream: $(git remote get-url $UPSTREAM_REMOTE)"

# Check if we're behind upstream
BEHIND_COUNT=$(git rev-list HEAD..upstream/main --count 2>/dev/null || echo "0")
if [ "$BEHIND_COUNT" -gt "0" ]; then
    echo -e "${YELLOW}⚠️  Your fork is $BEHIND_COUNT commits behind upstream${NC}"
    echo -e "${BLUE}💡 Run './scripts/sync-upstream.sh' to sync changes${NC}"
else
    echo -e "${GREEN}✅ Your fork is up to date with upstream${NC}"
fi

# Create sync script
echo -e "${YELLOW}📝 Creating sync script...${NC}"
cat > scripts/sync-upstream.sh << 'EOF'
#!/bin/bash
# AgentSwarm UI - Sync with Upstream
# Syncs changes from the original AgentSwarm repository

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 Syncing with upstream AgentSwarm...${NC}"

# Fetch upstream changes
echo -e "${YELLOW}📡 Fetching upstream changes...${NC}"
git fetch upstream

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Switch to main if not already there
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}🔄 Switching to main branch...${NC}"
    git checkout main
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ You have uncommitted changes. Please commit or stash them first.${NC}"
    exit 1
fi

# Merge upstream changes
echo -e "${YELLOW}🔄 Merging upstream changes...${NC}"
if git merge upstream/main --no-edit; then
    echo -e "${GREEN}✅ Successfully merged upstream changes${NC}"
    
    # Push to origin
    echo -e "${YELLOW}📤 Pushing changes to origin...${NC}"
    git push origin main
    echo -e "${GREEN}✅ Pushed to origin${NC}"
    
    # Show summary
    echo -e "${BLUE}📊 Sync complete!${NC}"
    echo "Latest commits:"
    git log --oneline -5
else
    echo -e "${RED}❌ Merge conflicts detected${NC}"
    echo -e "${YELLOW}💡 Please resolve conflicts manually and then:${NC}"
    echo "  git add ."
    echo "  git commit"
    echo "  git push origin main"
    exit 1
fi

# Switch back to original branch if needed
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "" ]; then
    echo -e "${YELLOW}🔄 Switching back to $CURRENT_BRANCH...${NC}"
    git checkout "$CURRENT_BRANCH"
fi

echo -e "${GREEN}🎉 Upstream sync complete!${NC}"
EOF

chmod +x scripts/sync-upstream.sh
echo -e "${GREEN}✓ Created sync script at scripts/sync-upstream.sh${NC}"

# Create GitHub workflow for automated sync checking
echo -e "${YELLOW}🤖 Setting up automated sync monitoring...${NC}"
mkdir -p .github/workflows

# Check if upstream sync workflow exists in CI
if ! grep -q "upstream-sync" .github/workflows/ci.yml 2>/dev/null; then
    echo -e "${YELLOW}💡 Consider adding upstream sync monitoring to your CI pipeline${NC}"
fi

# Create local git hooks for sync reminders
echo -e "${YELLOW}🪝 Setting up git hooks...${NC}"
mkdir -p .git/hooks

cat > .git/hooks/post-checkout << 'EOF'
#!/bin/bash
# Remind about upstream sync after checkout

if [ "$3" == "1" ]; then  # Branch checkout (not file checkout)
    BEHIND_COUNT=$(git rev-list HEAD..upstream/main --count 2>/dev/null || echo "0")
    if [ "$BEHIND_COUNT" -gt "0" ]; then
        echo -e "\033[1;33m💡 Your fork is $BEHIND_COUNT commits behind upstream\033[0m"
        echo -e "\033[0;34mRun './scripts/sync-upstream.sh' to sync\033[0m"
    fi
fi
EOF

chmod +x .git/hooks/post-checkout
echo -e "${GREEN}✓ Created git hooks${NC}"

echo -e "${BLUE}🎉 Upstream sync setup complete!${NC}"
echo -e "${GREEN}Commands available:${NC}"
echo -e "  ${YELLOW}./scripts/sync-upstream.sh${NC}     - Sync with upstream"
echo -e "  ${YELLOW}git fetch upstream${NC}            - Fetch upstream changes"
echo -e "  ${YELLOW}git log upstream/main${NC}         - View upstream commits"

echo -e "${BLUE}📚 Next steps:${NC}"
echo "1. Run './scripts/sync-upstream.sh' to sync any current changes"
echo "2. Set up automated sync in your CI/CD pipeline"
echo "3. Regularly check for upstream updates"
echo "4. Contribute improvements back to upstream when possible"