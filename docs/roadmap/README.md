# Seismo engine roadmap

> **v1 plan, done and merged (tag `before-merge`).** The current plan is [**v2: integration**](v2/README.md). IDs below are now written v1-P…/v1-A….

The build plan for the whole system, from an empty repo to a published GitHub App and a live demo. It replaces the 10-day plan in [`../PS/roadmap-demo.md`](../PS/roadmap-demo.md) §1. The **why** lives in [`../PS/`](../PS/README.md); this folder is the **what, in which order, by whom**.

> **Rule for every phase: when a phase is done, one feature works end to end and can be demoed.** Phases are vertical slices (data → engine → UI), not layers. We never have "a backend with no screen" or "a screen with no data" for more than a day.

---

## 1. Decisions this roadmap is built on (2026-10-11)

| Topic | Decision | Notes |
|---|---|---|
| Timeline | **14 days: Day 1 = Sun 11 Oct → Day 14 = Sat 24 Oct 2026.** Scope freeze end of Day 12 (Thu 22 Oct) for Musts, see [VERIFY.md](VERIFY.md) | Shift dates if the official deadline differs |
| Language | **All TypeScript** (Node backend, SDK, GitHub App, fake services, Next.js dashboard) | Contracts written once in zod, shared by everyone. Replaces the earlier FastAPI plan |
| Hosting | **Deployed cloud** + local Docker Compose as offline backup | Dashboard and landing on Vercel; API, worker, fake services and GitHub App on a Node host (chosen in P0 spike); Postgres on Neon |
| Demo target | **Separate repo `seismo-demo-shop`** that the GitHub App is installed on | Judges see the real flow: install → graph → drift → PR |
| Login | **GitHub only** (the GitHub App's own OAuth) | Same identity as installations |
| AI provider | **NVIDIA NIM, Nemotron family** (Ultra for quality, a faster model for classification; final pick by a P0 benchmark) | OpenAI-compatible client; model set by env var. See [ai-layer.md](ai-layer.md) |
| AI and code | **AI never writes code.** It returns validated JSON only; deterministic code renders changes | See the safety spec in [P5](P5-fix-it-safely.md) |
| Fix scope | **Only the API layer, only additive aliases get automatic PRs.** Everything else is an explanation + suggested change for a human | User's "can't break even if it wanted to" rule |
| Alerts | **Dashboard · GitHub (issue/check) · WhatsApp (Twilio sandbox) · Slack/Discord · Email (Resend).** No SMS | AI writes the text; templates are the fallback |
| Add-ons | **Changelog & deprecation radar** + **Compare & Simulate** (API-change assistant). **No drift network** | |
| Reuse | **Use existing libraries wherever they fit**; build only the glue and the novel parts | Catalog: [libraries.md](libraries.md) |
| Name | **Seismo** (placeholder). `github.com/apps/seismo` returned 404 on 2026-10-11, so the slug looks free (private apps are invisible; confirm when registering) | |

## 1b. Alignment with the official problem statement
Source: `Hackwave Problem_Statements.pdf` (root), PS 3 "The Internet After the API".

| Official PS 3 text | Where the roadmap covers it |
|---|---|
| Pipeline: external service → observed behaviour → contract/behavioural model → change detection → impact analysis → adapter or migration → validation → updated system | P3 (observe + baseline) → P4/P6 (detect) → P2 + P4 (impact) → P5 (adapter) / P6 (proposed migration) → P5.6–P5.8 (validation) |
| Example: `GET /users → name` becomes `display_name`; find the workflows that depend on `name` and decide whether mapping preserves meaning | P4 rename detector + code map impact; P5 conflict checks C3/C4 + AI semantic judge |
| Detect behavioural changes, not only schemas: altered defaults, different error responses, changed pagination, rate limits, valid JSON with changed meaning | D9 truncation/defaults, D11 error shape, D10 pagination, D12 rate limits, D5/D6/D7 meaning (P4, P6) |
| Dependencies that **disappear** | D14 empty success + **D17 endpoint gone** (404/410 jump), P4 |
| Problem framing mentions **webhooks** and **MCP servers** | **Webhook drift** (same detectors on inbound webhooks): P6 *Should*. **MCP tool-schema drift**: *Later*; mentioned in the pitch, with existing tools (mcp-scan, Bellwether) credited |
| Demo: an app depending on several simulated external services; introduce undocumented changes; show detection, impact analysis, adaptation, and validation that the workflows work again | P1 demo world (4 fake providers + demo shop) → P8 demo script |
| Strong solution: accurate detection, dependency mapping, semantics-aware fixes, regression validation, safe handling when repair is uncertain | P4/P6 · P2 · P5 · P5.8 · P5 conflict checks + P6 review queue |

## 2. Two tracks: P-phases are NetPranav's, A-phases are Adarsh's

Each person has their own numbered phases and works only in their own area. **A*n* consumes what P*n* produces** (same stage of the product), always on mock data first, so nobody waits.

| Stage | NetPranav (branch `netpranav`) | Adarsh (branch `adarzhpathade`) | Demo moment when both are done | Days |
|---|---|---|---|---|
| 0 Foundation | [**P0**](P0-foundation.md) monorepo, contracts + mocks, database, backend, dev GitHub App, fake-service skeleton, auth, spikes S1–S5 | [**A0**](A0-dashboard-foundation.md) Next.js, GitHub login, app shell, mock layer, spike S6 | `npm run dev` runs everything; login works on staging | 1–2 |
| 1 Demo world | [**P1**](P1-demo-world.md) four fake APIs with v1/v2 toggles, admin API, traffic generator | [**A1**](A1-demo-shop.md) demo shop repo, breakage screens, Demo Control, Compare v1 | Flip an API to v2 and the shop visibly breaks | 2–4 |
| 2 See your APIs | [**P2**](P2-see-your-apis.md) GitHub App install flow, code scanner, graph API | [**A2**](A2-onboarding-and-graph.md) onboarding, Obsidian-style graph, coverage | Install the app on the shop, get the graph in < 60 s | 3–6 |
| 3 Watch traffic | [**P3**](P3-watch-live-traffic.md) SDK, fingerprints, ingest, baselines, status API, privacy + fail-open tests | [**A3**](A3-status-page.md) install SDK in shop, status page, overview, SDK keys | Live API status; backend down, shop fine | 4–7 |
| 4 Catch a rename | [**P4**](P4-catch-a-rename.md) detectors D1–D4, D11–D17, severity, GitHub issues, notifications | [**A4**](A4-timeline-and-drift.md) timeline, drift page, bell, red-path graph | Rename → red path + issue + bell in < 60 s | 6–9 |
| 5 Fix safely | [**P5**](P5-fix-it-safely.md) `applyAliases` + property tests, planner, conflict checks, PR bot | [**A5**](A5-fix-panel.md) fix panel, shop tests red → green | Alias PR → merge → green | 8–11 |
| 6 Meaning + AI + alerts | [**P6**](P6-meaning-changes-ai-alerts.md) unit/enum/truncation detectors, NIM layer, review API, alert dispatcher, settings + compare APIs | [**A6**](A6-review-and-settings.md) review queue, notification settings, Compare & Simulate | Paise caught, WhatsApp buzzes, no auto-PR | 9–12 |
| 7 Radar | [**P7**](P7-radar.md) changelog/OpenAPI fetchers, AI parser, matcher | [**A7**](A7-radar-ui.md) radar page, clock badges, landing draft | Announcement matched to code before the change | 10–12 |
| 8 Launch | [**P8**](P8-launch.md) production deploy, public GitHub App, demo reset, reliability, final merge | [**A8**](A8-landing-and-launch.md) landing final, polish, backup video | Fresh account install-to-PR on production | 12–14 |

**Rules of the two tracks**
- The P-track number says what NetPranav builds; the A-track number says what Adarsh builds. A task ID tells you the owner: `P4.3` is NetPranav's, `A4.2` is Adarsh's.
- When a P task finishes something an A task needs, NetPranav runs `bash scripts/team-request.sh adarzhpathade "P4 ready: GET /v1/drift-events, switch A4 from mocks"` and calls Adarsh. Adarsh does the reverse for the shop (for example "shop deployed at …").
- The demo shop repo is Adarsh's. NetPranav's tests and traffic generator may **run** it but never edit it.
- Coverage of the whole product, per-day load and gaps found: [`VERIFY.md`](VERIFY.md).

Cross-cutting specs (read by whoever builds that part):
- [github-app.md](github-app.md): permissions, environments, publishing, install flow, webhooks
- [dashboard.md](dashboard.md): landing page, every screen, the Obsidian-style graph, the API status layer
- [ai-layer.md](ai-layer.md): NIM setup, tasks, prompts, guardrails, demo use of AI
- [setup-and-deploy.md](setup-and-deploy.md): monorepo, one-command setup, environments, CI/CD, secrets
- [libraries.md](libraries.md): every library we plan to use and whether it's verified

## 3. Day by day

OVERxPOWERED has no tasks; everything formerly in its column is in the P-track. Commit messages carry the ID: `feat(backend): P4.3 rename detector`, `feat(dashboard): A2.2 graph highlight`.

| Day | Date | NetPranav (P) | Adarsh (A) | Requests to send |
|---|---|---|---|---|
| 1 | Sun 11 | **P0.0 contract skeletons + mock generator first**, P0.1, P0.2, P0.3, S1, S2 | A0.1 login (own OAuth app), A0.2 graph spike, A0.3 shell | P→A: contracts v0 pushed |
| 2 | Mon 12 | P0.4, P0.5, P0.6, P0.8, P0.11, S3–S5, P1.1 | A0.4 mocks, A0.5 CI, A1.1 start the shop | P→A: dev GitHub App credentials |
| 3 | Tue 13 | P0.10, P1.2, P1.3, P2.1, P2.2 | A1.1, A1.2 | P→A: services URL, admin token |
| 4 | Wed 14 | P1.8, P2.3, P2.4, P3.1 | A1.3, A1.4, A1.5, A2.1 | A→P: shop URL + `seismo.config.json` |
| 5 | Thu 15 | P2.5, P2.8, P3.2, P3.3 | A2.2 graph | P→A: graph API live |
| 6 | Fri 16 | P3.4, P3.5, P3.6 | A2.3, A2.4 | P→A: SDK published, install it (P3.7) |
| 7 | Sat 17 | P3.7, P3.8, P4.1, P4.2 | A3.1–A3.5 | A→P: SDK in shop sending |
| 8 | Sun 18 | P4.3, P4.4, P4.5 | A4.1, A4.2 | P→A: drift-events API |
| 9 | Mon 19 | P4.6, P4.9, P5.1, P5.2 | A4.3, A4.4 | P→A: notifications + SSE |
| 10 | Tue 20 | P5.3, P5.4, P5.5, P5.6 | A5.1, A5.2, A5.3 | P→A: setup PR open, fixes API |
| 11 | Wed 21 | P5.9, P6.1, P6.2, P6.3, P6.5 | A5.4, A6.2 | **Scope freeze for Musts is now Day 12**, see [`VERIFY.md`](VERIFY.md) §3 |
| 12 | Thu 22 | P6.6, P6.7, P6.10, P6.13, P6.11, P7 Musts, P8.2 start | A6.1, A6.3, A7.1, A7.2, A7.3 | P→A: review, settings, compare, radar APIs |
| 13 | Fri 23 | P8.2, P8.3, P8.5, P8.6, P8.4 | A8.1, A8.2, A8.4 | P→A: production URLs, public app slug |
| 14 | Sat 24 | P8.8 rehearsals, P8.10 merge, tag `v1.0` · **demo** | A8.3, A8.5 backup video, A8.6 · **demo** | |

Branch model: everyone works only on their own personal branch and ends sessions with `/handoff`; cross-team asks go through `scripts/team-request.sh`; personal branches are merged into `main` at the end (see [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)).

## 4. Dependencies

```
P-track:  P0 ─► P1 ─► P2 ─► P4 ─► P5 ─► P6 ─► P7 ─► P8
                 └──► P3 ──┘
A-track:  A0 ─► A1 ─► A2 ─► A3 ─► A4 ─► A5 ─► A6 ─► A7 ─► A8
Cross:    P0.0 ► A0.4 (mocks)    P0.11 ► A0.1 (auth)     A1.1 ► P2 (scan target), P1.8 (traffic)
          P2.5 ► A2.2            P3.7 ► A3.1 ► P3.8      P4.5 ► A4.2
          P5.3/5.5 ► A5.2        P6.x APIs ► A6          P7 ► A7        P8.3 ► A8.1
```
- P2 and P3 can run in parallel once the P1 fake services exist; P4 needs both the code map (P2) and live traffic (P3).
- A-phases never wait for a P-phase: they start on mocks from `contracts/` and switch to the real API when NetPranav sends the request.

## 5. Contracts (all in `contracts/`, zod → TypeScript types + JSON Schema + OpenAPI)

| Contract | Written in | Producer → consumer |
|---|---|---|
| `fake-services` (endpoints, v1/v2 payloads, admin API) | P1 | services → demo shop, dashboard |
| `codemap` (call sites, field reads, usage kinds, workflows) | P2 | GitHub App → backend |
| `graph` (nodes, edges, status) + `installations` | P2 | backend → dashboard |
| `fingerprint` (shape-only, batch sketches) | P3 | SDK → backend |
| `status` (service/endpoint health, provider status) | P3 | backend → dashboard |
| `drift-event`, `notification` | P4 | backend → dashboard, GitHub App, alerts |
| `alias-spec`, `fix-request`, `validation-result` | P5 | backend → GitHub App (PR bot) → dashboard |
| `ai-explanation`, `review-item` | P6 | backend → dashboard, alerts |
| `radar-item` | P7 | backend → dashboard |

## 6. Global Definition of Done (every sub-phase)
- Committed and pushed to the owner's personal branch with green CI.
- Works on **staging** (deployed), not only on a laptop.
- Has at least one automated test (unit or e2e) for its main path.
- Contract changes merged before the code that uses them.
- Team status published (`/handoff`).

## 7. Cut lines (if we fall behind)
In order, cut: P7 radar (keep only `Sunset`/`Deprecation` header badges) → Discord/email channels (keep dashboard + GitHub + WhatsApp + Slack) → pagination detector → Compare & Simulate "what-if" (keep plain v1/v2 diff) → landing-page animations. **Never cut:** P2 graph, P4 rename detection, P5 safe alias PR, P6 unit change + review queue, backup video.
