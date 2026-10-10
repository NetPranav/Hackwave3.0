# START HERE (must read: humans and Claude sessions)

Claude Code loads this file automatically. First find out who you are:

```bash
git config seismo.handle      # → NetPranav or adarzhpathade (set by scripts/setup.sh)
```

Then read **your** section below and do only that work, **on your own branch**.

| GitHub | Person | Your branch | You may edit | You must NOT edit |
|---|---|---|---|---|
| **NetPranav** | Lead | `netpranav` | Everything except `dashboard/`: `contracts/`, `sdk-node/`, `backend/`, `github-app/`, `services/`, docs, repo config | `dashboard/` and the demo shop repo |
| **adarzhpathade** | Adarsh | `adarzhpathade` | `dashboard/` only (landing page, GitHub login, every dashboard screen), plus the separate demo shop repo `seismo-demo-shop` | Everything outside `dashboard/` in this repo |
| OVERxPOWERED | — | `overxpowered` | No tasks yet (invite pending) | — |

**Claude rules (enforced by a hook in `.claude/settings.json`; it blocks edits outside your area):**
- **Adarsh's Claude works only on the dashboard** (`dashboard/`) and the demo shop repo. Nothing else.
- **NetPranav's Claude never works on the dashboard or the demo shop.**
- If you need something outside your area: don't edit it. Run `bash scripts/team-request.sh <their-handle> "what you need"`, push nothing else, and tell your human to call that person.
- Work, commit and push only on your own branch. Never push to `main` or another person's branch. Never merge PRs.
- At session start, check the TEAM BRIEFING for **open requests addressed to you** and do those first.

Full workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md) · Roadmap: [`docs/roadmap/README.md`](docs/roadmap/README.md) (NetPranav's phases are **P0–P8**, Adarsh's are **A0–A8**; ignore any mention of `develop`, feature branches and per-task PRs: we use the personal branches above).

---

## Moving to your personal branch (do this once, especially if you started on another branch)

You work **only on your own branch** (`netpranav` / `adarzhpathade`), never on `main`, never on another person's branch, never on old branches like `chore/*`, `docs/*` or `develop`.

```bash
git fetch origin
git switch adarzhpathade                # or: git switch netpranav
git merge origin/main                   # get the newest rules (once PR #3 is merged)
# Work you already did on an old branch (e.g. chore/dashboard-design-system): bring it over, then stop using that branch
git merge origin/chore/dashboard-design-system     # Adarsh only; resolve conflicts keeping dashboard/ content
git push origin adarzhpathade
```
If your old branch has changes outside `dashboard/`, drop them (the area guard blocks them anyway). Claude: if `git branch --show-current` is not your personal branch, **stop and tell your human to run the commands above** before editing anything.

---

## adarzhpathade (Adarsh): the whole dashboard (phases A0–A8)

You build everything the user sees in the browser, in `dashboard/` (Next.js + Tailwind + shadcn/ui), plus the demo shop repo. Until the backend exists, use **mock data shaped like `contracts/`**. You never wait for the backend. When NetPranav finishes an API he'll send you a request to switch to it. Your task files are `docs/roadmap/A0…A8`; the day-by-day plan is in [`docs/roadmap/README.md`](docs/roadmap/README.md) §3.

| Phase | File | You build |
|---|---|---|
| A0 | [A0](docs/roadmap/A0-dashboard-foundation.md) | App shell, GitHub login, mock layer, graph-library spike |
| A1 | [A1](docs/roadmap/A1-demo-shop.md) | Demo shop repo `seismo-demo-shop`, Demo Control, Compare v1 |
| A2 | [A2](docs/roadmap/A2-onboarding-and-graph.md) | Onboarding, Obsidian-style graph, coverage |
| A3 | [A3](docs/roadmap/A3-status-page.md) | Install SDK in shop, API Status page, overview, SDK keys |
| A4 | [A4](docs/roadmap/A4-timeline-and-drift.md) | Timeline, drift page, bell, red-path graph |
| A5 | [A5](docs/roadmap/A5-fix-panel.md) | Fix panel, shop tests red → green |
| A6 | [A6](docs/roadmap/A6-review-and-settings.md) | Review queue, notification settings, Compare & Simulate |
| A7 | [A7](docs/roadmap/A7-radar-ui.md) | Radar page, clock badges, landing draft |
| A8 | [A8](docs/roadmap/A8-landing-and-launch.md) | Landing final, polish, backup video |

Every screen is specified in [`docs/roadmap/dashboard.md`](docs/roadmap/dashboard.md).

## NetPranav: the engine and everything else (phases P0–P8)

Files `docs/roadmap/P0…P8`: P0 foundation (contracts + mocks first!) → P1 fake services → P2 GitHub App + scanner + graph API → P3 SDK + ingest + status → P4 detectors → P5 alias runtime + PR bot → P6 meaning detectors + AI + alerts → P7 radar → P8 deploy, publish app, final merge into `main`. Whether the whole plan fits the 14 days is analysed in [`docs/roadmap/VERIFY.md`](docs/roadmap/VERIFY.md).

**Write the contracts (`contracts/`) first** and send Adarsh a request each time an API is ready.
