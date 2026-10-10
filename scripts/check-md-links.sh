#!/usr/bin/env bash
# Fails if a tracked Markdown file links to a relative path that doesn't exist. Used by CI.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

check_file() {
  local f=$1 dir link
  dir=$(dirname "$f")
  grep -oE '\]\([^)]+\)' "$f" | sed -E 's/^\]\(//; s/\)$//; s/[#?].*$//; s/ .*$//' | while IFS= read -r link; do
    case "$link" in
      ''|http://*|https://*|mailto:*|/*|'<'*) continue ;;
    esac
    [ -e "$dir/$link" ] || echo "$f -> $link"
  done
}

broken=""
while IFS= read -r f; do
  out=$(check_file "$f")
  [ -n "$out" ] && broken+="$out"$'\n'
done < <(git ls-files '*.md'; git ls-files --others --exclude-standard '*.md')

if [ -n "$broken" ]; then
  echo "Broken relative links:"
  echo "$broken"
  exit 1
fi
echo "All relative Markdown links resolve."
