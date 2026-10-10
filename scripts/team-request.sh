#!/usr/bin/env bash
# Shared request list (REQUESTS.md on the team-status branch). Never touches your working branch.
#   bash scripts/team-request.sh <to-handle> "what you need"     add a request
#   bash scripts/team-request.sh done <id>                        mark request #id done
#   bash scripts/team-request.sh list                             show all requests
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
export GIT_TERMINAL_PROMPT=0
me=$(git config --get seismo.handle || true)
[ -n "$me" ] || { echo "Run: bash scripts/setup.sh <github-handle>" >&2; exit 1; }
cmd=${1:-list}

if [ "$cmd" = "list" ]; then
  git fetch -q origin team-status 2>/dev/null || true
  git show refs/remotes/origin/team-status:REQUESTS.md 2>/dev/null || echo "(no requests yet)"
  exit 0
fi

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
for attempt in 1 2 3; do
  git fetch -q origin team-status 2>/dev/null || true
  parent=$(git rev-parse -q --verify refs/remotes/origin/team-status || true)
  if [ -n "$parent" ] && git cat-file -e "$parent:REQUESTS.md" 2>/dev/null; then
    git show "$parent:REQUESTS.md" > "$tmp/req.md"
  else
    printf '# Requests\n\nOpen items: `- [ ]`. Done: `- [x]`. Add with `bash scripts/team-request.sh <to> "text"`.\n\n' > "$tmp/req.md"
  fi
  if [ "$cmd" = "done" ]; then
    id=${2:?usage: team-request.sh done <id>}
    grep -q "^- \[ \] #$id " "$tmp/req.md" || { echo "No open request #$id" >&2; exit 1; }
    sed -i.bak "s/^- \[ \] #$id /- [x] #$id /" "$tmp/req.md"
    msg="request #$id done by $me"
  else
    to=$cmd; text=${2:?usage: team-request.sh <to-handle> \"text\"}
    id=$(( $(grep -oE '^- \[[ x]\] #[0-9]+' "$tmp/req.md" | grep -oE '[0-9]+$' | sort -n | tail -1 || echo 0) + 1 ))
    printf -- '- [ ] #%s %s · from %s → to %s: %s\n' "$id" "$(date +%Y-%m-%d)" "$me" "$to" "$text" >> "$tmp/req.md"
    msg="request #$id from $me to $to"
  fi
  export GIT_INDEX_FILE="$tmp/index"; rm -f "$GIT_INDEX_FILE"
  if [ -n "$parent" ]; then git read-tree "$parent"; else git read-tree --empty; fi
  git update-index --add --cacheinfo "100644,$(git hash-object -w "$tmp/req.md"),REQUESTS.md"
  tree=$(git write-tree); unset GIT_INDEX_FILE
  commit=$(git commit-tree "$tree" ${parent:+-p "$parent"} -m "$msg")
  if git push -q origin "$commit:refs/heads/team-status"; then
    git update-ref refs/remotes/origin/team-status "$commit"
    echo "Saved: $msg. Now tell them (call/message) to check: bash scripts/team-request.sh list"
    exit 0
  fi
  sleep $((attempt * 2))
done
echo "Could not save the request after 3 attempts." >&2; exit 1
