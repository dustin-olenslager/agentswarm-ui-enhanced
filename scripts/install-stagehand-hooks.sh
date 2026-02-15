#!/usr/bin/env bash
# Install Stagehand git hooks for post-merge recording.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_DIR="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOK_DIR" ]; then
  echo "ERROR: $REPO_ROOT is not a git repo with a .git/hooks directory"
  exit 1
fi

timestamp() {
  date +"%Y%m%d%H%M%S"
}

backup_existing_hook_if_needed() {
  local hook_path="$1"
  if [ -f "$hook_path" ] && ! grep -q "AGENTSWARM_STAGEHAND_HOOK" "$hook_path"; then
    local backup_path="${hook_path}.pre-stagehand.$(timestamp)"
    cp "$hook_path" "$backup_path"
    echo "Backed up existing hook to $backup_path"
  fi
}

install_post_merge_hook() {
  local hook_path="$HOOK_DIR/post-merge"
  backup_existing_hook_if_needed "$hook_path"

  cat >"$hook_path" <<'EOF'
#!/usr/bin/env bash
# AGENTSWARM_STAGEHAND_HOOK post-merge
set -euo pipefail

if [ "${STAGEHAND_POST_MERGE_ENABLED:-1}" = "0" ]; then
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[stagehand-hook] pnpm not found; skipping Stagehand recording."
  exit 0
fi

(
  cd "$REPO_ROOT"
  pnpm --silent stagehand:record:hook
) >>"$REPO_ROOT/.git/stagehand-post-merge.log" 2>&1 &

echo "[stagehand-hook] Started Stagehand recording in background."
echo "[stagehand-hook] Log file: .git/stagehand-post-merge.log"
EOF

  chmod +x "$hook_path"
}

install_post_rewrite_hook() {
  local hook_path="$HOOK_DIR/post-rewrite"
  backup_existing_hook_if_needed "$hook_path"

  cat >"$hook_path" <<'EOF'
#!/usr/bin/env bash
# AGENTSWARM_STAGEHAND_HOOK post-rewrite
set -euo pipefail

# Trigger only for rebase rewrites.
if [ "${1:-}" != "rebase" ]; then
  exit 0
fi

if [ "${STAGEHAND_POST_MERGE_ENABLED:-1}" = "0" ]; then
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[stagehand-hook] pnpm not found; skipping Stagehand recording."
  exit 0
fi

(
  cd "$REPO_ROOT"
  pnpm --silent stagehand:record:hook
) >>"$REPO_ROOT/.git/stagehand-post-merge.log" 2>&1 &

echo "[stagehand-hook] Started Stagehand recording in background (post-rewrite rebase)."
echo "[stagehand-hook] Log file: .git/stagehand-post-merge.log"
EOF

  chmod +x "$hook_path"
}

install_post_merge_hook
install_post_rewrite_hook

echo "Installed Stagehand hooks:"
echo "  - .git/hooks/post-merge"
echo "  - .git/hooks/post-rewrite"
echo ""
echo "Next step:"
echo "  pnpm stagehand:record"
