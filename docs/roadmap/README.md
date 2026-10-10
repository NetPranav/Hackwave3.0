# Seismo engine roadmap

The build plan for the whole system, from an empty repo to a published GitHub App and a live demo. It replaces the 10-day plan in [`../PS/roadmap-demo.md`](../PS/roadmap-demo.md) §1. The **why** lives in [`../PS/`](../PS/README.md); this folder is the **what, in which order, by whom**.

> **Rule for every phase: when a phase is done, one feature works end to end and can be demoed.** Phases are vertical slices (data → engine → UI), not layers. We never have "a backend with no screen" or "a screen with no data" for more than a day.

---

## 1. Decisions this roadmap is built on (2026-10-11)

| Topic | Decision | Notes |
|---|---|---|
| Timeline | **14 days: Day 1 = Sun 11 Oct → Day 14 = Sat 24 Oct 2026.** Scope freeze end of Day 11 (Wed 21 Oct) | Shift dates if the official deadline differs |
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

## 2. Phase map

| Phase | Name | Demo moment when it's done | Days |
|---|---|---|---|
| [P0](P0-foundation.md) | Foundation & spikes | `npm run dev` starts everything; every app deploys to staging; all unknowns tested | 1–2 |
| [P1](P1-demo-world.md) | Demo world | Flip a fake API to v2 and the demo shop visibly breaks; side-by-side v1/v2 diff | 2–4 |
| [P2](P2-see-your-apis.md) | See your APIs | Install the GitHub App on the demo repo → Obsidian-style graph of every API, field, function and workflow | 3–6 |
| [P3](P3-watch-live-traffic.md) | Watch live traffic | SDK in the shop → live API status page; kill our backend and the shop doesn't notice | 4–7 |
| [P4](P4-catch-a-rename.md) | Catch a rename | Rename `name`→`display_name` → red path on the graph in < 60 s, GitHub issue + dashboard alert | 6–8 |
| [P5](P5-fix-it-safely.md) | Fix it safely | Seismo opens an alias-only PR, proves it can't change old responses, CI green, merge → shop fixed | 7–10 |
| [P6](P6-meaning-changes-ai-alerts.md) | Catch meaning changes + AI + alerts | Rupees→paise and a new status value caught; AI explanation on WhatsApp, Slack, email; no auto-PR on money | 8–11 |
| [P7](P7-radar.md) | Changelog & deprecation radar | A provider announcement is matched to our code before the change lands | 9–11 |
| [P8](P8-launch.md) | Launch | Landing page live, GitHub App public, production deploy, rehearsed demo + backup video | 11–14 |

Cross-cutting specs (read by whoever builds that part):
- [github-app.md](github-app.md): permissions, environments, publishing, install flow, webhooks
- [dashboard.md](dashboard.md): landing page, every screen, the Obsidian-style graph, the API status layer
- [ai-layer.md](ai-layer.md): NIM setup, tasks, prompts, guardrails, demo use of AI
- [setup-and-deploy.md](setup-and-deploy.md): monorepo, one-command setup, environments, CI/CD, secrets
- [libraries.md](libraries.md): every library we plan to use and whether it's verified

## 3. Who does what (three parallel tracks)

> **Update 2026-10-11:** OVERxPOWERED has no tasks for now; **every task in the OVERxPOWERED column belongs to @NetPranav**. @adarzhpathade owns the whole dashboard (login included) and the demo shop. Per-person task list: [`../../START_HERE.md`](../../START_HERE.md).

| Day | Date | @NetPranav (backend · SDK · AI) | @OVERxPOWERED (GitHub App · services · alerts) | @adarzhpathade (dashboard · landing · demo shop) |
|---|---|---|---|---|
| 1 | Sun 11 | P0: monorepo, contracts pkg, Neon + drizzle, API skeleton; **spikes**: NIM, body capture | P0: dev GitHub App via manifest + smee; services skeleton; **spikes**: Probot, Twilio, host sleep | P0: Next.js dashboard + Auth.js GitHub login on Vercel; **spike**: graph lib with 500 nodes |
| 2 | Mon 12 | P0 finish: deploy pipeline, pg-boss queue; contracts v1 drafted | P1: users/payments/shipping/orders services with v1/v2 toggles | P1: `seismo-demo-shop` scaffold (products, checkout, invoice, orders) |
| 3 | Tue 13 | P2: installations, code-map ingest, graph API | P2: install flow, repo scanner (ts-morph) | P1: shop wired to services; Demo Control + Compare (jsondiffpatch) |
| 4 | Wed 14 | P3: SDK capture + fingerprints + batching | P2: field-usage + workflows, re-scan on push | P2: onboarding flow + graph v1 from graph API |
| 5 | Thu 15 | P3: ingest, baselines, windows, status metrics | P3: SDK in demo shop; privacy + fail-open tests | P2: graph interactions (highlight, side panel, filters) |
| 6 | Fri 16 | P3: Statuspage poller, deprecation headers; P4: detector framework | P4: GitHub issue/check notifications | P3: API Status page + live updates (SSE) |
| 7 | Sat 17 | P4: rename/missing/type/error/rate-limit/headers detectors, probes, severity | P5: PR bot (adapters PR, alias PR), CI tracking | P4: timeline, drift detail, red path on graph, bell |
| 8 | Sun 18 | P5: alias planner, conflict checks, adapter renderer, property tests | P5: PR body, check-run reporting, cleanup PR | P5: fix panel (diff), validation red→green, PR status |
| 9 | Mon 19 | P6: unit/enum/truncation/pagination detectors | P6: alert dispatcher (Slack/Discord, Resend, WhatsApp) | P5/P6: review queue, AI explanation cards |
| 10 | Tue 20 | P6: AI layer (NIM client, explainer, semantic judge, cache) | P7: radar sources (RSS/HTML/OpenAPI) + matching | P6: notification settings, Compare & Simulate page |
| 11 | Wed 21 | P7: changelog parser (AI JSON) + radar items · **scope freeze** | P7: radar → suggestions; prod GitHub App registered | P7: radar page + clock badges · landing page draft |
| 12 | Thu 22 | P8: prod deploy, demo reset, soak test | P8: publish app (public), install-from-scratch test | P8: landing page final, polish, empty states |
| 13 | Fri 23 | P8: rehearsal #1–2, fixes only | P8: rehearsal, webhook reliability | P8: rehearsal, record **backup video** |
| 14 | Sat 24 | Merge personal branches into `main`, tag `v1.0` · **demo** | Demo | Demo |

Branch model (simplified 2026-10-11): everyone works only on their own personal branch and ends sessions with `/handoff`; cross-team asks go through `scripts/team-request.sh`; personal branches are merged into `main` at the end (see [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md)). Put the sub-phase ID in commit messages: `feat(backend): P4.3 rename detector`.

## 4. Dependencies between phases

```
P0 ──► P1 ──► P2 ──► P4 ──► P5 ──► P8
        │      ▲      ▲      │
        └────► P3 ────┘      ▼
                             P6 ──► P7 ──► P8
```
- P2 and P3 can run in parallel once P1's fake services and contracts exist.
- P4 needs both the code map (P2) and live traffic (P3).
- The frontend never waits: every screen is built first against **mock data generated from the zod contracts**, then switched to the real API.

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
