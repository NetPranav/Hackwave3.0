# Build plan, demo script and judge prep

> **Superseded in part (2026-10-11).** The build plan (§1) and repo layout (§2) are replaced by [`../roadmap/`](../roadmap/README.md): 14 days, all TypeScript, separate demo repo `seismo-demo-shop`, NVIDIA NIM for AI, no drift network. The current demo script is in [`../roadmap/P8-launch.md`](../roadmap/P8-launch.md). The judge Q&A (§4) still applies, except that code scanning uses ts-morph and fixes are data rules in `seismo/aliases.json`.

## 1. Ten-day build plan

Freeze rule: **no new features after day 7.** Days 8–10 are polish, demo safety and the pitch.

| Day | Backend (detection) | Integrations (GitHub) | Frontend | Product / pitch |
|---|---|---|---|---|
| 1 | Fake services (users, payments, shipping, orders) with v1/v2 toggles + admin API; Docker Compose | Register GitHub App; webhook receiver via `smee.io`; OAuth login skeleton | Demo shop: login, products, checkout, invoice, orders pages (server-side calls) | Send survey; book 5–10 dev interviews |
| 2 | Node SDK: wrap `fetch`/`axios`, fingerprints, batching, fail-open; ingest API | Repo scan: tree-sitter JS/TS; list external calls with file:line | Dashboard shell (Next.js + Tailwind), service cards | Interviews; collect quotes |
| 3 | Baselines + windows; seed/traffic generator script | Field-read extraction + usage kinds; `seismo.workflows.yml` | Graph v1 (react-force-graph) from code map | Deck outline |
| 4 | Detectors D1–D5 (missing, new, rename, type, unit) + unit tests | Code map API for dashboard | Timeline + drift detail page | Survey analysis |
| 5 | Detectors D7, D9, D11–D14; confirmation probes | Severity engine (confidence × impact × exposure) | Graph colouring + live updates (WebSocket/polling) | Draft demo script |
| 6 | LLM explanations + enum classification (JSON schema, cached) | "Introduce adapters" PR; rung 1 fallback PR | Review queue + PR status panel | **Scope freeze** |
| 7 | Shape replay tests generator | Rung 2 transform PR in review mode; CI status on dashboard | Impact chain (React Flow), validation panel, status banner, demo panel | Add-on choice locked |
| 8 | Add-on: changelog radar **or** drift network (simulated) | Cleanup PR (manual trigger) | Add-on UI | Full rehearsal #1 |
| 9 | 10-minute soak test (no false positives); bug fixes | Fallback: pre-opened PRs if webhooks fail | Visual polish; dark mode; empty states | Rehearsal #2; Q&A drill |
| 10 | Freeze | Freeze | Freeze | **Record backup video**; final deck; rehearsal #3 |

## 2. Repository layout (planned)

```
/
├── AGENTS.md  MEMORY.md  CLAUDE.md  CONTRIBUTING.md
├── .github/                   ← CI, CODEOWNERS, PR/issue templates
├── .claude/                   ← shared Claude Code settings + skills (/start-task, /handoff, /team-sync)
├── .team/                     ← ownership, status template (live status lives on the team-status branch)
├── contracts/                 ← interfaces between owners (contract-first)
├── scripts/                   ← setup, team briefing, status publishing, link check
├── docs/PS/                   ← this folder (design docs for the problem statement)
├── services/                  ← fake third-party APIs (FastAPI): users, payments, shipping, orders
├── shop/                      ← demo shop app (Next.js) using the SDK + adapters
├── sdk-node/                  ← @seismo/sdk
├── backend/                   ← ingest, baselines, detectors, severity, probes, LLM (FastAPI)
├── github-app/                ← Probot app: scan, code map, PR bot
├── dashboard/                 ← Next.js dashboard (graph, timeline, review)
├── tests/                     ← detector unit tests, privacy test, workflow tests (Playwright)
└── docker-compose.yml
```

## 3. Demo script (3 minutes)

Layout: **split screen.** Left: the shop. Right: the dashboard. Top: status banner.

| Time | Beat | What happens on screen | Say |
|---|---|---|---|
| 0:00 | Hook | Shop invoice showing ₹49,900 for a ₹499 order, monitor green | "API up. Monitor green. Customer just got charged 100× on their invoice. Nothing crashed." |
| 0:15 | Setup | Install GitHub App on the shop repo → graph builds live | "In two minutes, with no production access, we know every API this app calls, every field it reads and every workflow that depends on it." |
| 0:40 | **Rename** | Flip users → `display_name`. Graph: users → name → invoice/checkout go amber → red. Banner: "Change detected → 2 workflows affected". PR opens: adapter fallback. CI green. Merge. Shop name returns | "A rename. We add a fallback, never replace, so even a wrong guess can't break anything. Tests red → green." |
| 1:20 | **Meaning change** | Flip payments → paise. Show that a schema check passes (same field, same type). Dashboard: "values jumped ~100× (p5, p50, p95 all ×100) → likely unit change". Money field → review PR with explanation. Approve | "A schema checker sees nothing. Same field, same type. We see the whole distribution shift by exactly 100×, and because it's money, we ask a human." |
| 1:55 | **Uncertain change** | Flip shipping → `partially_shipped`. Review card: "New status value. Closest to `shipped` (0.54) or `pending` (0.46). Used in an `if` that triggers refunds. Not auto-fixing." | "This is the trust moment. When we're not sure, we don't guess. We tell you exactly why." |
| 2:20 | **Add-on** | Option A: changelog radar matches an orders announcement to `limit=500` in code, PR before the flip. Option B: App B gets an early warning because App A saw the change first | "We don't just react. We warn you before it hits." |
| 2:45 | Close | Banner all green; graph green | "Dependabot for the APIs you depend on. Real traffic, no customer record ever leaves your servers, fixes as PRs, humans in the loop." |

### Backup plan
- Recorded video of the full script (day 10), played muted with live narration if anything fails.
- Pre-opened PRs on a branch in case GitHub webhooks are blocked by venue Wi-Fi.
- Cached LLM explanations for the three scenarios.
- Hotspot + offline Docker Compose (everything except GitHub runs locally).

## 4. Judge Q&A prep

| Likely question | Answer |
|---|---|
| "How is this different from FlareCanary / schema-drift monitors?" | They poll a URL and diff its structure. We watch real traffic, catch value and behaviour changes, know which code uses each field, and ship a fix PR. See [competitors.md](competitors.md) §4. |
| "Isn't sending production data to you a security risk?" | No value tied to a record or identifier leaves your server. The SDK sends types, formats, lengths and batch-level percentiles; any hashes use a salt that stays on your side, so we can't reverse them. It's open source, read-only and fail-open. |
| "What if your detection is wrong?" | Renames become fallbacks, which can't break anything. Money, branching and persistence fields always go to review. Every fix is a revertible PR. |
| "How fast do you detect?" | Depends on traffic. In the demo, < 30 s to amber and < 60 s to red with a confirmation probe. Low-traffic endpoints rely on scheduled probes. |
| "How do you know which code is affected?" | GitHub App parses the repo (tree-sitter), tracks field reads and how they're used, and maps them to workflows. Coverage is shown; dynamic cases are marked inferred. |
| "Why would anyone pay?" | Free map + radar for daily value; paid tiers for live detection, PRs and the drift network. Priced per monitored API, so it scales with dependency count. |
| "How big is the problem? Any numbers?" | Its cost is unmeasured, and we say so; silent errors aren't logged as incidents. What is measured: 1,970 of 3,075 APIs didn't always flag breaking changes (ICWE 2024); providers like Pipedrive document silent truncation; our own survey found [N of M]. |
| "Where's the LLM? Is this an AI wrapper?" | Detection is deterministic code. The LLM only explains changes and classifies ambiguous enum values, and it never sees raw data. |
| "Does it work for GraphQL/gRPC?" | MVP is JSON/REST. Fingerprints generalise; GraphQL is on the roadmap. |
| "What about MCP / AI agents?" | Tool-definition pinning exists (Invariant mcp-scan, Bellwether). Our engine can watch MCP tool schemas the same way; we'd integrate rather than reinvent. |
| "Couldn't Datadog build this?" | They could add schema checks. The code ↔ field map, fix PRs and the cross-customer network are harder; we'd also integrate with them. |

## 5. Post-hackathon roadmap

| Horizon | Items |
|---|---|
| 0–3 months | Python SDK; GraphQL fingerprints; GitHub Marketplace beta; public drift feed (20 APIs); design partners |
| 3–6 months | Changelog radar for top 50 APIs; Slack app; webhook drift; runtime call-site join |
| 6–12 months | Drift network GA (k-anonymity); compliance data-flow export (DPDP/GDPR/SOC 2); upgrade preview; eBPF capture for Enterprise; OpenTelemetry integration |
