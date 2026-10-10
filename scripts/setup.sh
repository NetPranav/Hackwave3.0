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

mybranch=$(printf '%s' "$handle" | tr '[:upper:]' '[:lower:]')
if git rev-parse -q --verify "refs/remotes/origin/$mybranch" >/dev/null; then
  git switch "$mybranch" 2>/dev/null || git switch -c "$mybranch" --track "origin/$mybranch"
else
  echo "warning: origin/$mybranch doesn't exist yet; ask the lead to create it" >&2
fi

cat <<EOF

Setup done for $handle.
  • git hooks installed (.githooks: you can push only your own branch)
  • your status file: $status  (publish with: bash scripts/team-publish-status.sh)
  • current branch: $(git rev-parse --abbrev-ref HEAD)

Next:
  1. gh auth status            # GitHub CLI must be logged in
  2. claude                    # the team briefing loads automatically
  3. Read START_HERE.md (your tasks) · finish a session with /handoff
EOF
