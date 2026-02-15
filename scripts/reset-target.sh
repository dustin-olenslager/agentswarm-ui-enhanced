#!/usr/bin/env bash
# reset-target.sh — Reset the target repo for a fresh orchestrator run.
#
# What it does:
#   1. Resets target-repo to its initial scaffold commit (first commit on main)
#   2. Deletes ALL local worker/* branches
#   3. Deletes ALL remote worker/* branches on origin
#   4. Clears orchestrator state files
#
# Usage:
#   ./scripts/reset-target.sh                  # uses ./target-repo
#   ./scripts/reset-target.sh /path/to/repo    # custom repo path

set -euo pipefail

REPO_DIR="${1:-./target-repo}"

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "ERROR: $REPO_DIR is not a git repository"
  exit 1
fi

echo "=== Resetting target repo: $REPO_DIR ==="

cd "$REPO_DIR"

# 1. Find the initial commit on main (the very first commit)
INITIAL_COMMIT=$(git rev-list --max-parents=0 HEAD | tail -1)
echo "Initial scaffold commit: $INITIAL_COMMIT"

# 2. Hard-reset main to initial commit
git checkout main 2>/dev/null || git checkout -b main
git reset --hard "$INITIAL_COMMIT"
echo "Reset main to initial commit."

# 3. Delete all local worker/* branches
LOCAL_WORKER_BRANCHES=$(git branch --list 'worker/*' | sed 's/^[* ]*//' || true)
if [ -n "$LOCAL_WORKER_BRANCHES" ]; then
  echo "$LOCAL_WORKER_BRANCHES" | xargs git branch -D
  echo "Deleted local worker branches."
else
  echo "No local worker branches to delete."
fi

# 4. Delete all remote worker/* branches
REMOTE_WORKER_BRANCHES=$(git branch -r --list 'origin/worker/*' | sed 's/^[* ]*//' | sed 's|origin/||' || true)
if [ -n "$REMOTE_WORKER_BRANCHES" ]; then
  echo "$REMOTE_WORKER_BRANCHES" | xargs -I {} git push origin --delete {} 2>/dev/null || true
  echo "Deleted remote worker branches."
else
  echo "No remote worker branches to delete."
fi

# 5. Prune stale remote tracking refs
git remote prune origin 2>/dev/null || true

# 6. Clean up orchestrator state files
cd - > /dev/null
if [ -d "./state" ]; then
  rm -rf ./state/*
  echo "Cleared state/ directory."
fi

echo ""
echo "=== Reset complete ==="
echo "Target repo is at: $(git -C "$REPO_DIR" log --oneline -1)"
echo "Ready for a fresh orchestrator run."
