#!/usr/bin/env bash
# Team briefing: who is working on what, open PRs, overlaps with your branch.
# Runs as a Claude Code SessionStart hook (.claude/settings.json); its stdout becomes session context.
# It must never break a session, so every step tolerates failure and slow networks.
set -u

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
export GIT_TERMINAL_PROMPT=0 GH_PROMPT_DISABLED=1

# run_with_timeout <seconds> <cmd...>: macOS has no `timeout`, so do it by hand.
run_with_timeout() {
  local secs=$1; shift
  "$@" &
  local pid=$!
  ( sleep "$secs"; kill "$pid" 2>/dev/null ) >/dev/null 2>&1 &
  local watcher=$!
  wait "$pid" 2>/dev/null
  local rc=$?
  kill "$watcher" 2>/dev/null
  wait "$watcher" 2>/dev/null
  return $rc
}

me=$(git config --get seismo.handle 2>/dev/null || true)
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")

run_with_timeout 8 git fetch --prune --quiet origin >/dev/null 2>&1
fetched=$?

if git rev-parse -q --verify refs/remotes/origin/develop >/dev/null; then base=origin/develop
elif git rev-parse -q --verify refs/remotes/origin/main >/dev/null; then base=origin/main
else base=""; fi

echo "=== TEAM BRIEFING (scripts/team-status.sh · $(date '+%Y-%m-%d %H:%M %Z')) ==="
[ "$fetched" -ne 0 ] && echo "(could not reach origin; showing last known state)"
echo "You: ${me:-UNKNOWN, run: bash scripts/setup.sh <github-handle>} · branch: $branch"

# --- Warnings about where you are -------------------------------------------
case "$branch" in
  main|develop|team-status)
    echo "⚠ You are on '$branch'. Never commit here. Start work with /start-task (creates feature/<area>-<desc> from origin/develop)." ;;
esac
if [ -n "$base" ] && [ "$branch" != "HEAD" ]; then
  counts=$(git rev-list --left-right --count "$base...HEAD" 2>/dev/null || echo "0 0")
  behind=${counts%%[[:space:]]*}; ahead=${counts##*[[:space:]]}
  echo "vs $base: $ahead ahead, $behind behind"
  [ "${behind:-0}" -gt 10 ] 2>/dev/null && echo "⚠ You are $behind commits behind $base. Run: git fetch origin && git merge $base"
fi
dirty=$(git status --porcelain 2>/dev/null | grep -vc '^??' || true)
[ "${dirty:-0}" -gt 0 ] 2>/dev/null && echo "Uncommitted changes in $dirty tracked file(s)."

# --- Teammates' published status --------------------------------------------
echo
echo "--- Published status (origin/team-status) ---"
if git rev-parse -q --verify refs/remotes/origin/team-status >/dev/null; then
  for f in $(git ls-tree --name-only refs/remotes/origin/team-status status/ 2>/dev/null); do
    h=$(basename "$f" .md)
    when=$(git log -1 --format=%cr refs/remotes/origin/team-status -- "$f" 2>/dev/null)
    tag=""; [ "$h" = "$me" ] && tag=" (you)"
    echo "## $h$tag · updated $when"
    git show "refs/remotes/origin/team-status:$f" 2>/dev/null | grep -v '^# ' | grep -v '^[[:space:]]*$' | head -n 22
    echo
  done
else
  echo "(no team-status branch yet)"
fi

# --- Active branches and the areas they touch -------------------------------
echo "--- Active branches (newest first) ---"
others=""
listed=0
while IFS='|' read -r ref who when; do
  case "$ref" in origin/HEAD|origin|origin/main|origin/develop|origin/team-status|"") continue ;; esac
  areas=""
  [ -n "$base" ] && areas=$(git diff --name-only "$base...$ref" 2>/dev/null | cut -d/ -f1 | sort -u | paste -sd, - | cut -c1-80)
  mark=""; [ "$ref" = "origin/$branch" ] && mark=" ← yours"
  echo "- ${ref#origin/} · $who · $when · areas: ${areas:-none yet}$mark"
  listed=$((listed + 1))
  [ "$ref" != "origin/$branch" ] && others="$others $ref"
done < <(git for-each-ref --sort=-committerdate --count=20 refs/remotes/origin \
           --format='%(refname:short)|%(authorname)|%(committerdate:relative)' 2>/dev/null)
[ "$listed" -eq 0 ] && echo "(no feature branches yet)"

# --- Overlap check: files you changed that others also changed --------------
if [ -n "$base" ]; then
  mine=$( { git diff --name-only "$base...HEAD"; git diff --name-only; git diff --name-only --cached; } 2>/dev/null | sort -u)
  if [ -n "$mine" ]; then
    overlap_found=0
    for ref in $others; do
      theirs=$(git diff --name-only "$base...$ref" 2>/dev/null | sort -u)
      [ -z "$theirs" ] && continue
      both=$(comm -12 <(echo "$mine") <(echo "$theirs") | head -n 8 | paste -sd, -)
      if [ -n "$both" ]; then
        [ $overlap_found -eq 0 ] && echo && echo "--- ⚠ Overlaps with your work ---"
        overlap_found=1
        echo "- ${ref#origin/} also changes: $both  → coordinate before editing these"
      fi
    done
  fi
fi

# --- Open PRs (needs GitHub CLI) ---------------------------------------------
if command -v gh >/dev/null 2>&1; then
  prs=$(run_with_timeout 8 gh pr list --state open --limit 15 \
        --json number,title,headRefName,baseRefName,author,isDraft,reviewDecision \
        --jq '.[] | "- #\(.number) \(.headRefName) → \(.baseRefName) · @\(.author.login)\(if .isDraft then " · draft" else "" end)\(if .reviewDecision then " · " + .reviewDecision else "" end) · \(.title)"' 2>/dev/null)
  echo
  echo "--- Open PRs ---"
  echo "${prs:-(none, or gh not authenticated)}"
fi

echo
echo "Rules: one task = one branch from origin/develop · stay in your areas (.team/OWNERSHIP.md) · contract changes go through contracts/ first · publish your status with /handoff · humans merge PRs, Claude never pushes to main/develop."
echo "=== END TEAM BRIEFING ==="
exit 0
