#!/usr/bin/env bash
# Lead only (needs repo admin). Safe to re-run. Sets up the simple branch model:
#   main = default + protected (lead merges PRs) · one personal branch per person · team-status shared
# Usage: bash scripts/admin/bootstrap-github.sh [owner/repo]
set -euo pipefail
repo=${1:-NetPranav/Hackwave3.0}
cd "$(git rev-parse --show-toplevel)"

echo "1/5 Repository settings (default branch = main, merge methods)…"
gh api -X PATCH "repos/$repo" \
  -F allow_squash_merge=true -F allow_merge_commit=true -F allow_rebase_merge=false \
  -F allow_update_branch=true -F delete_branch_on_merge=false \
  -f default_branch=main >/dev/null

upsert_ruleset() {
  local name=$1 body=$2 id
  id=$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$name\") | .id")
  if [ -n "$id" ]; then
    gh api -X PUT "repos/$repo/rulesets/$id" --input - <<<"$body" >/dev/null; echo "  updated: $name"
  else
    gh api -X POST "repos/$repo/rulesets" --input - <<<"$body" >/dev/null; echo "  created: $name"
  fi
}
delete_ruleset() {
  local id
  id=$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$1\") | .id")
  if [ -n "$id" ]; then gh api -X DELETE "repos/$repo/rulesets/$id" >/dev/null; echo "  deleted: $1"; fi
}

ci_check='{"context": "ci-ok", "integration_id": 15368}'   # 15368 = GitHub Actions
admin_pr_only='{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request"}'

echo "2/5 Rulesets…"
delete_ruleset develop-protection

# main: nobody pushes directly; only the repo admin (NetPranav) merges, through a PR, with CI green.
upsert_ruleset main-protection "$(cat <<JSON
{
  "name": "main-protection", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "bypass_actors": [ $admin_pr_only ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "update", "parameters": { "update_allows_fetch_and_merge": false } },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false, "require_last_push_approval": false,
        "required_review_thread_resolution": false, "allowed_merge_methods": ["merge"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false, "required_status_checks": [ $ci_check ] } }
  ]
}
JSON
)"

# personal branches + team-status: normal pushes allowed, nobody can delete them or rewrite history.
upsert_ruleset team-status-guard "$(cat <<JSON
{
  "name": "team-status-guard", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/team-status", "refs/heads/netpranav", "refs/heads/adarzhpathade", "refs/heads/overxpowered"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [ { "type": "deletion" }, { "type": "non_fast_forward" } ]
}
JSON
)"

echo "3/5 Deleting the old develop branch (if it exists)…"
gh api -X DELETE "repos/$repo/git/refs/heads/develop" >/dev/null 2>&1 && echo "  deleted develop" || echo "  (no develop branch)"

echo "4/5 Closing PR #1 (its change is included in PR #2)…"
gh pr close 1 -R "$repo" -c "Superseded: included in #2 (simplified branch model)." >/dev/null 2>&1 || true

echo "5/5 Done. Rulesets now on $repo:"
gh ruleset list -R "$repo"
