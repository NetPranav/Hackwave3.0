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

Full workflow: [`CONTRIBUTING.md`](CONTRIBUTING.md) · Roadmap: [`docs/roadmap/README.md`](docs/roadmap/README.md) (wherever it says **OVERxPOWERED**, read **NetPranav**; ignore its mentions of `develop`, feature branches and per-task PRs: we use the personal branches above).

---

## adarzhpathade (Adarsh): the whole dashboard

You build everything the user sees in the browser, in `dashboard/` (Next.js + Tailwind + shadcn/ui). Until the backend exists, use **mock data shaped like `contracts/`**. You never wait for the backend. When NetPranav finishes an API, he'll send you a request to switch to it.

| Phase | Your tasks | Spec |
|---|---|---|
| P0 | Next.js app in `dashboard/`, **GitHub login** (Auth.js), protected `/app` pages, deploy on Vercel · test the graph library (react-force-graph-2d vs Sigma) | [P0](docs/roadmap/P0-foundation.md) |
| P1 | Create the demo shop repo `seismo-demo-shop` (products, checkout, invoice, orders) · Demo Control page · Compare page (v1/v2 JSON diff) | [P1](docs/roadmap/P1-demo-world.md) |
| P2 | Onboarding after app install · **Obsidian-style graph** · coverage indicator | [P2](docs/roadmap/P2-see-your-apis.md) |
| P3 | **API Status** page + live updates + graph colours | [P3](docs/roadmap/P3-watch-live-traffic.md) |
| P4 | Timeline, drift detail page, notification bell, red/green graph states | [P4](docs/roadmap/P4-catch-a-rename.md) |
| P5 | Fix panel (diff, safety checklist, CI, PR link) · demo-shop tests red → green | [P5](docs/roadmap/P5-fix-it-safely.md) |
| P6 | Notification settings · review queue with AI cards · Compare & Simulate | [P6](docs/roadmap/P6-meaning-changes-ai-alerts.md) |
| P7 | Radar page + clock badges | [P7](docs/roadmap/P7-radar.md) |
| P8 | Landing page final · polish · backup video | [P8](docs/roadmap/P8-launch.md) |

Every screen is specified in [`docs/roadmap/dashboard.md`](docs/roadmap/dashboard.md).

## NetPranav: the engine and everything else

All non-dashboard work in roadmap order: P0 (monorepo, contracts, database, queue, backend, dev GitHub App, fake services, spikes) → P1 fake services → P2 GitHub App + code scanner + graph API → P3 SDK + ingest + status API → P4 detectors + severity + GitHub issues → P5 alias runtime + PR bot → P6 more detectors + AI + alerts → P7 radar → P8 deploy, publish the app, final merge into `main`.

**Write the contracts (`contracts/`) early** and send Adarsh a request each time an API is ready.
