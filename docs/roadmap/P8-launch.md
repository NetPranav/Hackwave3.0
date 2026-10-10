# P8 · Launch: landing page, public GitHub App, production, demo hardening (Days 11–14)

**Done when:** a judge with a fresh GitHub account can open the landing page, sign in with GitHub, install the public Seismo app on a fork of the demo shop, and see the graph, a drift, an alias PR and a WhatsApp alert, in under 5 minutes, on production. A backup video of the full demo exists. Both personal branches are merged into `main` and tagged `v1.0`.

**Depends on:** P0–P7 (P7 may be partial) · **Owners:** all

## Sub-phases

| ID | Task | Owner | Output |
|---|---|---|---|
| P8.1 | Landing page final (content in [dashboard.md](dashboard.md) §2), SEO meta, OG image, docs page "Install the SDK in 2 minutes" | adarzhpathade | Live on the production domain |
| P8.2 | Production environment: Vercel prod (dashboard + landing), prod Node host (API, worker, services, app), Neon prod branch, prod secrets, migrations on deploy | NetPranav | `main` deploys to prod |
| P8.3 | **Production GitHub App `Seismo`**: public, prod webhook URL, setup URL, callback URL, logo + description; install from `github.com/apps/<slug>` | OVERxPOWERED | See [github-app.md](github-app.md) §4 |
| P8.4 | Install-from-scratch test with a teammate's second GitHub account; fix every friction point | OVERxPOWERED + adarzhpathade | Checklist passed |
| P8.5 | Demo reset script: services to v1, demo repo reset (close/revert Seismo PRs, clear `aliases.json`), DB demo data reset, AI cache warm | NetPranav | `npm run demo:reset` < 30 s |
| P8.6 | Reliability: webhook retries, idempotent jobs, health checks, uptime ping, Sentry (free) on API + dashboard | NetPranav + OVERxPOWERED | No silent failures |
| P8.7 | UI polish: loading/empty/error states, dark mode, responsive down to laptop projector resolution | adarzhpathade | — |
| P8.8 | Rehearsals (×3) of the demo script ([`../PS/roadmap-demo.md`](../PS/roadmap-demo.md) §3, updated below); judge Q&A drill | All | Timings recorded |
| P8.9 | **Backup video** of the full flow on production | adarzhpathade | MP4 + uploaded copy |
| P8.10 | Merge `netpranav` and `adarzhpathade` into `main` via PRs (merge commits), tag `v1.0`; README badges and links | NetPranav | Release |

## Demo script (3 minutes, updated for the new scope)
1. **Hook:** shop invoice shows ₹49,900 for a ₹499 order while every monitor is green.
2. **Install:** the GitHub App on the demo repo → graph builds live.
3. **Rename:** flip users → red path → alias PR with safety checks → merge → green. Say: *"It can only add a name, never change one; that's proven by property tests."*
4. **Meaning change:** flip payments to paise → "×100 unit change" → review card with AI explanation → WhatsApp buzzes on stage. *"Money is never auto-fixed."*
5. **Uncertain change:** shipping enum → AI judgement with confidence → human decides.
6. **Radar:** a provider announcement → matched to our code before it happens.
7. **Close:** *"Dependabot for the APIs you depend on."*

## Day-of checklist
- [ ] Rejoin the Twilio WhatsApp sandbox from the presenter's phone (24-hour window and ~3-day expiry)
- [ ] `npm run demo:reset`, then run traffic for 2 minutes so baselines are ready
- [ ] Hosts warm (no cold starts): hit every health endpoint 10 minutes before
- [ ] AI cache warm for the three scenarios; NIM key valid
- [ ] Backup video open in a second tab; phone hotspot ready
- [ ] GitHub notifications on the demo repo visible in a browser tab

## Definition of Done
- [ ] Fresh-account install-to-PR in < 5 minutes on production
- [ ] Three clean rehearsals in a row
- [ ] Backup video recorded
- [ ] `v1.0` tagged on `main`
