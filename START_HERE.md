# START HERE (must read: humans and Claude sessions)

Claude Code loads this file automatically (via `CLAUDE.md`). Find out who you are, read **your** section, and do only your work.

```bash
git config seismo.handle      # → NetPranav or adarzhpathade (set by scripts/setup.sh)
```

## Who does what (decided 2026-10-11)

| GitHub | Person | Role | Owns |
|---|---|---|---|
| **NetPranav** | Lead | Engine, backend, GitHub App, everything except the dashboard; the only one who merges releases into `main` | `contracts/` (lead), `sdk-node/`, `backend/`, `github-app/`, `services/`, repo config (`.github/`, `.claude/`, `scripts/`) |
| **adarzhpathade** | Adarsh | **The whole dashboard**: landing page, GitHub login, every dashboard screen and feature, plus the demo shop repo | `dashboard/`, repo `NetPranav/seismo-demo-shop` |
| OVERxPOWERED | — | Invite pending; no tasks assigned. If they join, the lead hands over `github-app/` + `services/` and updates this file | — |

Roadmap: [`docs/roadmap/README.md`](docs/roadmap/README.md). Wherever the roadmap says **OVERxPOWERED**, read **NetPranav**.

---

## If you are **adarzhpathade** (Adarsh): the dashboard

You build everything the user sees in the browser. The backend gives you data; until it exists, use **mock data generated from `contracts/`** so you're never blocked.

**Your sub-phases (in order):**

| Phase | Your tasks | Spec |
|---|---|---|
| P0 | P0.7 Next.js + Tailwind + shadcn/ui app in `dashboard/`, **GitHub login** (Auth.js, using the GitHub App's OAuth), protected `/app` routes, deployed on Vercel · spike S6 graph library | [P0](docs/roadmap/P0-foundation.md) |
| P1 | P1.4–P1.5 create `seismo-demo-shop` (products, checkout, invoice, orders) and make each v2 change visibly break it · P1.6 Demo Control page · P1.7 Compare (v1/v2 JSON diff) | [P1](docs/roadmap/P1-demo-world.md) |
| P2 | P2.6 onboarding after app install · P2.7 **Obsidian-style graph** · P2.8 coverage indicator | [P2](docs/roadmap/P2-see-your-apis.md) |
| P3 | P3.9 **API Status** page + live updates + graph colours | [P3](docs/roadmap/P3-watch-live-traffic.md) |
| P4 | P4.7 timeline, drift detail, notification bell · P4.8 red/green graph states | [P4](docs/roadmap/P4-catch-a-rename.md) |
| P5 | P5.7 fix panel (diff, safety checklist, CI, PR link) · P5.8 demo-shop tests red → green | [P5](docs/roadmap/P5-fix-it-safely.md) |
| P6 | P6.8 notification settings · P6.9 review queue + AI cards · P6.10 Compare & Simulate | [P6](docs/roadmap/P6-meaning-changes-ai-alerts.md) |
| P7 | P7.5 radar page + clock badges | [P7](docs/roadmap/P7-radar.md) |
| P8 | P8.1 landing page final · P8.7 polish · P8.9 backup video | [P8](docs/roadmap/P8-launch.md) |

Screen-by-screen spec: [`docs/roadmap/dashboard.md`](docs/roadmap/dashboard.md). **Don't edit** `backend/`, `sdk-node/`, `github-app/`, `services/`. If you need an API that doesn't exist, write what you need in your team status ("Blockers / needs from others") and in the PR, or propose a change in `contracts/` as its own PR.

## If you are **NetPranav**: the engine and everything else

All phases' non-dashboard sub-phases, in roadmap order: P0 (monorepo, contracts, DB, queue, backend, dev GitHub App, fake services, spikes S1–S5) → P1 services → P2 app + scanner + graph API → P3 SDK + ingest + status → P4 detectors + severity + GitHub issues → P5 alias runtime + planner + PR bot → P6 detectors + AI + alerts → P7 radar → P8 deploy, publish app, release. You also **write the contracts first** so Adarsh can build against them, and you merge release PRs into `main`.

---

## How to ship any piece of work (both of you)

1. **Start:** in Claude Code run `/start-task`, or by hand:
   ```bash
   git fetch origin
   git switch -c feature/<area>-p<phase>-<sub>-<short-desc> origin/develop
   # e.g. feature/dashboard-p2-7-obsidian-graph   ·   feature/backend-p4-3-rename-detector
   ```
2. **Commit** small and often with Conventional Commits: `feat(dashboard): P2.7 force graph with path highlight`.
3. **Push your branch** (never `develop`, never `main`): `git push -u origin HEAD`.
4. **Open a PR into `develop`** (draft at first): `gh pr create --draft --base develop --fill`.
5. Keep up to date by **merging** `origin/develop` into your branch (no rebase, no force-push).
6. When done: `/handoff` (tests, push, publish status) → mark the PR **Ready for review**.
7. **The other person reviews and approves** → squash-merge into `develop`. Delete the branch.
8. At milestones the lead opens `develop → main` (release), merges it, and tags `v0.N`.

## How reviewing works (why "Merge" is greyed out)
`develop` requires **1 approval from someone other than the author** + green CI + branch up to date. You can't approve your own PR. So **NetPranav's PRs are approved by Adarsh, and Adarsh's PRs by NetPranav.**

To review on GitHub: open the PR → **Files changed** → read → **Review changes** (top right) → **Approve** → **Submit review**. Then anyone with write access clicks **Squash and merge**. If it says "This branch is out-of-date", click **Update branch** first (this clears the approval, so approve again).

From the terminal: `gh pr review <number> --approve` then `gh pr merge <number> --squash` (humans only; Claude is not allowed to merge).

Emergency only: the lead (repo admin) can tick **"Merge without waiting for requirements to be met"**. Use it rarely.
