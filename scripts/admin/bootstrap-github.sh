#!/usr/bin/env bash
# Lead only (needs repo admin). Safe to re-run: pushes the base branches, sets merge settings,
# makes develop the default branch, and creates/updates the branch rulesets.
# Usage: bash scripts/admin/bootstrap-github.sh [owner/repo]
set -euo pipefail
repo=${1:-NetPranav/Hackwave3.0}
cd "$(git rev-parse --show-toplevel)"

echo "1/4 Pushing main, develop, team-status…"
git push origin main develop team-status

echo "2/4 Repository settings (merge methods, default branch = develop)…"
gh api -X PATCH "repos/$repo" \
  -F allow_squash_merge=true -F allow_merge_commit=true -F allow_rebase_merge=false \
  -F allow_update_branch=true -F delete_branch_on_merge=false \
  -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY \
  -f default_branch=develop >/dev/null

upsert_ruleset() {
  local name=$1 body=$2 id
  id=$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$name\") | .id")
  if [ -n "$id" ]; then
    gh api -X PUT "repos/$repo/rulesets/$id" --input - <<<"$body" >/dev/null
    echo "  updated: $name"
  else
    gh api -X POST "repos/$repo/rulesets" --input - <<<"$body" >/dev/null
    echo "  created: $name"
  fi
}

ci_check='{"context": "ci-ok", "integration_id": 15368}'   # 15368 = GitHub Actions
admin_always='{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always"}'
admin_pr_only='{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request"}'

echo "3/4 Rulesets…"
# main: only the repo admin (NetPranav) can update it; merge commits only; CI must pass.
upsert_ruleset main-protection "$(cat <<JSON
{
  "name": "main-protection", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "bypass_actors": [ $admin_always ],
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

# develop: PR + 1 approval + green, up-to-date CI; admin may bypass only through a PR (emergencies).
upsert_ruleset develop-protection "$(cat <<JSON
{
  "name": "develop-protection", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/develop"], "exclude": [] } },
  "bypass_actors": [ $admin_pr_only ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 1, "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false, "require_last_push_approval": false,
        "required_review_thread_resolution": true, "allowed_merge_methods": ["squash", "merge"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true, "required_status_checks": [ $ci_check ] } }
  ]
}
JSON
)"

# team-status: anyone can publish, nobody can delete it or rewrite its history.
upsert_ruleset team-status-guard "$(cat <<JSON
{
  "name": "team-status-guard", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/team-status"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [ { "type": "deletion" }, { "type": "non_fast_forward" } ]
}
JSON
)"

echo "4/4 Done. Rulesets now on $repo:"
gh ruleset list -R "$repo"
