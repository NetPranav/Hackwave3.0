#!/usr/bin/env bash
# Publishes your status file (.team/status/<handle>.md) to the shared `team-status` branch.
# Uses git plumbing with a temporary index, so it never touches your working tree or current branch.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
export GIT_TERMINAL_PROMPT=0

handle=$(git config --get seismo.handle || true)
if [ -z "$handle" ]; then
  echo "No handle configured. Run: bash scripts/setup.sh <github-handle>" >&2
  exit 1
fi
src=".team/status/$handle.md"
if [ ! -f "$src" ]; then
  echo "Missing $src. Create it from .team/STATUS_TEMPLATE.md first." >&2
  exit 1
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

for attempt in 1 2 3; do
  git fetch -q origin team-status 2>/dev/null || true
  parent=$(git rev-parse -q --verify refs/remotes/origin/team-status || true)

  export GIT_INDEX_FILE="$tmp/index"
  rm -f "$GIT_INDEX_FILE"
  if [ -n "$parent" ]; then git read-tree "$parent"; else git read-tree --empty; fi
  blob=$(git hash-object -w "$src")
  git update-index --add --cacheinfo "100644,$blob,status/$handle.md"
  tree=$(git write-tree)
  unset GIT_INDEX_FILE

  if [ -n "$parent" ] && [ "$tree" = "$(git rev-parse "$parent^{tree}")" ]; then
    echo "Status unchanged; nothing to publish."
    exit 0
  fi

  commit=$(git commit-tree "$tree" ${parent:+-p "$parent"} -m "status($handle): $(date -u +%Y-%m-%dT%H:%MZ)")
  if git push -q origin "$commit:refs/heads/team-status"; then
    git update-ref refs/remotes/origin/team-status "$commit"
    echo "Published $src → origin/team-status:status/$handle.md"
    exit 0
  fi
  echo "Push rejected (attempt $attempt; someone published at the same time). Retrying…" >&2
  sleep $((attempt * 2))
done

echo "Could not publish status after 3 attempts." >&2
exit 1
