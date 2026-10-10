#!/usr/bin/env bash
# Claude Code PreToolUse hook (Edit|Write): keeps each person's Claude inside their own area.
#   adarzhpathade -> may edit only dashboard/ (and their own .team/status file)
#   everyone else -> may never edit dashboard/ (the demo shop lives in another repo)
input=$(cat)
if command -v jq >/dev/null 2>&1; then
  file=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
else
  file=$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
fi
[ -z "$file" ] && exit 0
root=$(cd "${CLAUDE_PROJECT_DIR:-.}" && pwd)
rel=${file#"$root"/}
case "$rel" in /*) exit 0 ;; esac            # outside this repo: not our business
me=$(git -C "$root" config --get seismo.handle 2>/dev/null)

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

if [ "$me" = "adarzhpathade" ]; then
  case "$rel" in
    dashboard/*|.team/status/*) exit 0 ;;
    *) deny "Team rule: adarzhpathade's Claude only edits dashboard/. For anything else, add a request with: bash scripts/team-request.sh NetPranav \\\"what you need\\\" (see START_HERE.md)." ;;
  esac
else
  case "$rel" in
    dashboard/*) deny "Team rule: only adarzhpathade works on dashboard/ (and the demo shop). Add a request instead: bash scripts/team-request.sh adarzhpathade \\\"what you need\\\"." ;;
  esac
fi
exit 0
