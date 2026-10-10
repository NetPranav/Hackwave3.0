#!/usr/bin/env bash
# One-time setup on each computer.
# Usage: bash scripts/setup.sh <your-github-handle>
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

handle=${1:-}
if [ -z "$handle" ] && command -v gh >/dev/null 2>&1; then
  handle=$(gh api user --jq .login 2>/dev/null || true)
fi
if [ -z "$handle" ]; then
  echo "Usage: bash scripts/setup.sh <your-github-handle>" >&2
  exit 1
fi
if ! grep -q "| $handle |" .team/OWNERSHIP.md; then
  echo "warning: '$handle' is not listed in .team/OWNERSHIP.md (check spelling; handles are case-sensitive)" >&2
fi

git config seismo.handle "$handle"
git config core.hooksPath .githooks
chmod +x .githooks/* scripts/*.sh 2>/dev/null || true

git fetch -q origin || echo "warning: could not fetch origin" >&2

mkdir -p .team/status
status=".team/status/$handle.md"
if [ ! -f "$status" ]; then
  if ! git show "origin/team-status:status/$handle.md" > "$status" 2>/dev/null; then
    sed "s/<handle>/$handle/" .team/STATUS_TEMPLATE.md > "$status"
  fi
fi

current=$(git rev-parse --abbrev-ref HEAD)
if [ "$current" = "main" ] && git rev-parse -q --verify refs/remotes/origin/develop >/dev/null; then
  git switch develop 2>/dev/null || git switch -c develop --track origin/develop
fi

cat <<EOF

Setup done for $handle.
  • git hooks installed (.githooks: blocks direct pushes to main/develop, checks branch names)
  • your status file: $status  (publish with: bash scripts/team-publish-status.sh)
  • current branch: $(git rev-parse --abbrev-ref HEAD)

Next:
  1. gh auth status            # GitHub CLI must be logged in
  2. claude                    # the team briefing loads automatically
  3. /start-task               # inside Claude Code, to begin your first task
EOF
