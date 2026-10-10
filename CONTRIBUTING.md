# Contributing: team workflow (simple version)

## Branches

| Branch | Who | What |
|---|---|---|
| **`main`** | Default branch. Nobody pushes to it directly | The latest **merged** work. **Pull from `main` to get everyone's finished work** |
| **`netpranav`** | @NetPranav only | Lead's work: engine, backend, SDK, GitHub App, fake services, everything except the dashboard |
| **`adarzhpathade`** | @adarzhpathade (Adarsh) only | The whole dashboard (`dashboard/`), login included. The demo shop is in its own repo |
| **`overxpowered`** | @OVERxPOWERED only | Reserved; no tasks yet |
| `team-status` | Scripts only | Shared status notes + `REQUESTS.md`. Never edit by hand |

**Golden rules**
1. Work, commit and push **only on your own branch**. Never push to anyone else's branch or to `main`.
2. Stay in your own folders (see [`START_HERE.md`](START_HERE.md)). Claude enforces this automatically.
3. Need something changed in someone else's area? **Add a request** (below), then call or message them.
4. Each person finishes their own phases first. At the end, the lead merges the branches into `main`.

## Daily flow
```bash
git switch <your-branch>            # netpranav / adarzhpathade
git pull                            # get your own latest from GitHub
# ... work ...
git add -A && git commit -m "feat(dashboard): A2.2 graph highlight"
git push                            # pushes to YOUR branch only
```
In Claude Code, `/handoff` does the commit + push + status note for you.

Optional, if you want the team's finished work while still working:
```bash
git fetch origin && git merge origin/main
```
Never merge another person's branch into yours; their work reaches you through `main`.

## Requests between people (the only cross-team channel)
```bash
bash scripts/team-request.sh adarzhpathade "Graph API is ready: GET /v1/graph (contracts/graph.ts). Please switch from mock data."
bash scripts/team-request.sh NetPranav "Need GET /v1/status to include p95 latency per endpoint."
bash scripts/team-request.sh list          # see all requests
bash scripts/team-request.sh done 3        # mark request #3 done
```
Requests live in `REQUESTS.md` on the shared `team-status` branch, so they never mix with code. Every Claude session shows **your open requests** at startup. After adding one, **call or message the person**: they pull, do it on their own branch, push, and mark it done.

## Merging into `main` (lead only)
When a person's work is ready (normally at the end; earlier for milestones):
1. Open a PR from their branch into `main`: `gh pr create --base main --head adarzhpathade --title "feat(dashboard): dashboard v1"`.
2. CI must be green. The lead merges on GitHub (**merge commit**, not squash).
3. Everyone then runs `git fetch origin && git merge origin/main` on their own branch to pick it up.

## Commit messages
`type(area): summary`, e.g. `feat(backend): rename detector`, `fix(dashboard): graph flicker`. Types: feat, fix, docs, refactor, test, chore, perf, ci, build, release. PR titles into `main` must follow this (CI checks it).

## One-time setup on each computer
```bash
git clone https://github.com/NetPranav/Hackwave3.0.git && cd Hackwave3.0
bash scripts/setup.sh <your-github-handle>     # switches you to your branch, installs git hooks
claude                                         # answer YES when asked to trust the project's hooks
```

## What's enforced automatically
- `main` is protected on GitHub: changes only through a PR merged by the lead, with CI green.
- The local git hook blocks pushing to `main` or to someone else's branch.
- Claude can't push to `main`, force-push, or merge PRs, and can only edit its owner's folders (`scripts/guard-area.sh`).
- A leaked key in this **public** repo must be rotated immediately; tell the lead.
