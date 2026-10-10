# Contributing: team workflow

Three developers, three computers, three Claude Code sessions, one repo. These rules keep `main` always demo-ready and stop us from breaking each other's work.

## 1. Team and ownership

| GitHub | Role | Owns (primary reviewer) |
|---|---|---|
| **@NetPranav** | Lead · architecture/logic | `backend/`, `sdk-node/`, repo config (`.github/`, `.claude/`, `scripts/`), **the only person who merges into `main`** (release PRs) |
| **@OVERxPOWERED** | Architecture/logic | `github-app/`, `services/` (fake third-party APIs) |
| **@adarzhpathade** | Frontend | `dashboard/` (landing + dashboard), demo repo `NetPranav/seismo-demo-shop` |
| Everyone | — | `contracts/`, `docs/`, `tests/` (shared; changes need a PR everyone can see) |

The source of truth is [`.team/OWNERSHIP.md`](.team/OWNERSHIP.md), and [`.github/CODEOWNERS`](.github/CODEOWNERS) auto-requests the right reviewer.

**Working outside your area** is allowed, but announce it in your team status first and tag the owner on the PR.

## 2. Branch model

```
main ──●─────────────────────●──────────────●──▶   demo-ready releases (tags v0.x); only @NetPranav merges into it
        \                   ↗ release PR    ↗
develop  ●──●──●──●──●──●──●──●──●──●──●──●──▶   integration branch (default); protected; PRs only
             \  ↗   \     ↗   \      ↗
              ●●     ●●●●      ●●●●●              feature/*, fix/*, docs/* … one branch per task, short-lived
team-status  (separate branch, no code: each person's live status file, read by every Claude session)
```

| Branch | Who writes | How | Protection (GitHub rulesets) |
|---|---|---|---|
| `main` | @NetPranav only | Merge the **release PR** `develop → main` on GitHub (merge commit), then tag it. Nobody pushes to `main` directly, not even the lead | Only the repo admin can merge, and only through a PR; no direct pushes; no deletion; no force push; CI must pass |
| `develop` | Everyone, via PR | **Squash-merge** feature PRs | PR required · 1 approval · CI (`ci-ok`) green · branch up to date · conversations resolved · no force push · no deletion |
| `feature/*` etc. | The branch author | Normal commits | None; your own branch |
| `hotfix/*` | Lead (or with lead) | From `main`, PR into `main`, then back-merge `main → develop` | — |
| `team-status` | Everyone, via `scripts/team-publish-status.sh` | One file per person; never hand-edited elsewhere | No deletion; no force push |

### Branch names
`<type>/<area>-<short-description>`, lowercase, hyphens.

- **Types:** `feature` · `fix` · `chore` · `docs` · `refactor` · `test` · `hotfix` · `release`
- **Areas:** `backend` · `sdk` · `github-app` · `services` · `alerts` · `dashboard` · `contracts` · `docs` · `infra`
- Examples: `feature/backend-unit-change-detector`, `feature/dashboard-dependency-graph`, `fix/sdk-fail-open-timeout`, `docs/contracts-fingerprint-schema`

CI and the local pre-push hook reject other names.

## 3. Daily flow

With Claude Code, use the skills `/start-task` → work → `/handoff`. They run the steps below for you.

```bash
# start a task
git fetch origin
git switch -c feature/backend-unit-change-detector origin/develop
#   … edit .team/status/<you>.md, then:
bash scripts/team-publish-status.sh
git commit --allow-empty -m "chore(backend): start unit-change detector"
git push -u origin HEAD
gh pr create --draft --base develop --fill        # visible to the team from minute one

# keep your branch current: merge, don't rebase (no force pushes needed)
git fetch origin && git merge origin/develop

# finish
git push
gh pr ready                                         # when tests pass and you want review
```

- **Small PRs, merged often.** Aim for < 400 changed lines and at least one merge per person per day. Long-lived branches are how teams break each other.
- **Draft PR immediately.** It's how the others (and their Claude sessions) see what you're touching.
- **Review within 4 hours** while we're building. Reviewer checks: CI green, scope matches title, nothing touches someone else's area without a heads-up, no secrets.
- **Delete your branch after merge** (GitHub shows a button).

## 4. Commits and PR titles: Conventional Commits

`type(scope): summary`, e.g. `feat(backend): add silent-truncation detector`, `fix(dashboard): graph flicker on live update`, `docs(contracts): fingerprint v1`.

Types: `feat` `fix` `docs` `refactor` `test` `chore` `perf` `ci` `build` `release`. The PR title becomes the squash commit on `develop`, so CI checks it.

## 5. Contracts first (how we don't break each other)

Anything that crosses an ownership boundary is defined in [`contracts/`](contracts/README.md) **before** it's implemented: SDK → ingest fingerprint format, backend → dashboard API, GitHub App → backend code-map format, fake services' endpoints.

1. Open a `docs/contracts-…` or `feature/contracts-…` PR changing the contract only. All three of us are code owners of `contracts/`.
2. After it merges, each side implements against it. The frontend can build against mock data generated from the contract while the backend is still being written.
3. Breaking a contract = new version (`v2`), never a silent change. (Yes, that's our own product's lesson.)

## 6. Releases to `main` (lead only)

1. @NetPranav opens PR `develop → main`, titled `release: v0.N <name>` (e.g. `release: v0.3 detectors + graph`).
2. CI green, demo smoke test passes (`docs/PS/roadmap-demo.md` script).
3. Merge with a **merge commit** (not squash; keeps `main` and `develop` in sync), then tag: `git tag v0.N && git push origin v0.N`.

Hotfix: `git switch -c hotfix/<desc> origin/main` → PR into `main` → after merge, PR `main → develop` to bring the fix back.

## 7. Claude Code rules (all three machines)

These are enforced by [`.claude/settings.json`](.claude/settings.json) (committed, so all three sessions share them) and explained in [`AGENTS.md`](AGENTS.md):

- On every session start, a hook runs `scripts/team-status.sh` and gives Claude a **team briefing**: everyone's published status, active branches, open PRs, file overlaps with your branch, and whether you're behind `develop`.
- Claude **cannot** push to `main`/`develop`, force-push, or merge PRs (`gh pr merge`). Humans merge.
- Those Claude deny rules are pattern-based convenience: they catch the common commands, not every spelling. The **real guard is GitHub's rulesets** (server-side), backed up by the local `.githooks/pre-push` hook.
- `/start-task`, `/handoff`, `/team-sync` skills live in `.claude/skills/`.
- Personal Claude settings go in `.claude/settings.local.json` (git-ignored).

## 8. One-time setup on each computer

```bash
git clone https://github.com/NetPranav/Hackwave3.0.git
cd Hackwave3.0
bash scripts/setup.sh <your-github-handle>    # sets identity, installs git hooks, creates your status file
claude                                         # the team briefing appears automatically
```

Requirements: git, GitHub CLI (`gh auth login`), bash (Windows: Git Bash), Node 20+, Python 3.12+.

## 9. When something goes wrong

| Situation | Do this |
|---|---|
| Merge conflict in a file you own | Resolve it, run tests, push |
| Conflict in someone else's file | Stop. Ask them (or their status says what they're doing). Don't guess |
| `develop` is broken | Whoever notices posts in the team chat; the PR author reverts first (`git revert`), fixes later |
| You committed to `develop`/`main` locally by mistake | `git switch -c feature/<area>-<desc>` (keeps your commits), then reset local `develop`: `git switch develop && git reset --hard origin/develop` |
| Secret committed | Tell the lead immediately; rotate the key; it's public in a public repo |
