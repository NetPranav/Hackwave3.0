# MEMORY.md: project memory

A living log of decisions, open questions and facts for this project. Newest entries at the top of each section. Dates are absolute (YYYY-MM-DD).

## Snapshot (2026-10-11)

- **Event:** HackWave 3.0 (CDGI), PS 3 "The Internet After the API", 14-day build (2026-10-11 → 2026-10-24).
- **Product (working name):** Seismo, "Dependabot for the APIs you depend on".
- **Stage:** research and design done (`docs/PS/`), team workflow + CI + Claude coordination live, **build roadmap written (`docs/roadmap/`, 14 days, Day 1 = 2026-10-11, demo 2026-10-24)**, no product code yet.
- **Core bet:** real-traffic, shape-only fingerprints + semantic/behavioural detectors + code-aware severity + safe alias PRs (data rules, proven additive). Add-ons: changelog/deprecation radar + Compare & Simulate. No drift network in the 14-day plan.

## Decisions

| Date | Decision | Why | Where documented |
|---|---|---|---|
| 2026-10-11 | **Unit fixes are transforms, not aliases**: a `scale` rule (÷ factor) is applied by a separate `applyTransforms` and only proposed in a `needs-review` PR that a human asks for. `applyAliases` stays add-only (G2). Also built: restart safety (events/keys in Postgres, baseline freeze), P7 radar (verbatim-quote rule for AI), setup-PR codemod, safety check run + C7/C8, demo reset limited to `DEMO_REPO` | Keep the add-only guarantee honest; unit fixes need a human | `COMPLETION.md` §4 |
| 2026-10-11 | **Demo shop created by NetPranav's Claude** (lead's explicit request): `NetPranav/seismo-demo-shop`, Next.js 16, SDK vendored as a tarball (0.1.1), `withAliases` in every client, CI green. Adarsh keeps the dashboard pieces of A1 (Demo Control, Compare UI) and the fix panel | Shop was blocking every live proof | `COMPLETION.md` §5 |
| 2026-10-11 | **AI explainer uses Nemotron 3 Super**, not Ultra: on the hosted API Ultra ignored `response_format` and looped to `max_tokens`; Super answers in ~3–10 s. Outputs pass zod **and** a fact check (no URLs, no dates absent from the data, must name the field) or fall back to templates. Alerts wait ≤ 8 s for AI text | Live tests | `backend/src/ai/`, `.env.example` |
| 2026-10-11 | **P6 built**: D5/D6/D7/D8/D9/D10, review suggestions from a fixed template catalog (never AI), alert dispatcher (WhatsApp, Slack, Discord, email, GitHub issue per event), Compare & Simulate, settings API, webhook drift | Roadmap P6 | `COMPLETION.md` §4 |
| 2026-10-11 | **Spikes S1-S3 answered.** S1 NIM: base `https://integrate.api.nvidia.com/v1`; `response_format: json_schema` works (Ultra `nvidia/nemotron-3-ultra-550b-a55b` ~3.8 s, Super `nvidia/nemotron-3-super-120b-a12b` ~1.9 s), `guided_json`/`nvext` is rejected, `nemotron-nano-3-30b-a3b` is not available to our key → use Super as the fast model. S2: `@mswjs/interceptors` reads a cloned body for fetch + axios without consuming it. S3: Probot 14.3.2 runs on Node 26 (custom routes via `addHandler`, no `getRouter`) | Pass criteria in `docs/roadmap/P0-foundation.md` | `scripts/spikes/` |
| 2026-10-11 | **Build progress:** P0 (monorepo, contracts, backend skeleton, Postgres + drizzle + pg-boss, CI via Turbo, auth tokens), P1 (fake services to spec), P2 (ts-morph scanner, graph, Probot app), P3 (SDK with privacy + fail-open tests, ingest, baselines, status), P4 (detectors D1-D4, D11-D14, D16, D17, severity, drift engine), P5 (applyAliases G1-G4 property tests, planner C1-C6, PR bot) implemented and tested locally. Fingerprint percentiles need >= 5 distinct values and are rounded to 3 significant figures (found by the privacy test). Field names like `__proto__` are dropped by the SDK | Lead asked to start the implementation | code in `contracts/ sdk-node/ backend/ github-app/ services/` |
| 2026-10-11 | **Two phase tracks:** NetPranav = P0–P8, Adarsh = A0–A8 (A*n* consumes P*n*); OVERxPOWERED's work moved to NetPranav; shop tasks (SDK install, config files) moved to Adarsh; 10 gaps fixed; scope freeze for Musts moved to Day 12; claude area guard also blocks edits off the personal branch | Lead asked for per-person phases and a full-coverage check | `docs/roadmap/README.md`, `VERIFY.md`, `START_HERE.md` |
| 2026-10-11 | **Branch model simplified:** `main` = default, pull latest from it; one personal branch per person (`netpranav`, `adarzhpathade`, `overxpowered`), push only there; cross-team asks via `scripts/team-request.sh` (REQUESTS.md on `team-status`); each person finishes their own phases, then the lead merges branches into `main`. `develop`, feature branches, per-task PRs and `/start-task` dropped. Claude area guard hook: Adarsh's Claude only edits `dashboard/`; NetPranav's never edits `dashboard/` or the demo shop | Lead found the PR flow too heavy | `CONTRIBUTING.md`, `START_HERE.md` |
| 2026-10-11 | **Roles changed:** adarzhpathade (Adarsh) owns the whole dashboard incl. login + demo shop; NetPranav owns everything else incl. former OVERxPOWERED areas; OVERxPOWERED (invite pending) has no tasks | Lead's decision | `START_HERE.md` |
| 2026-10-11 | **Roadmap: 14 days (2026-10-11 → 2026-10-24), vertical-slice phases P0–P8**, scope freeze end of day 11 | Each phase completes a demoable feature | `docs/roadmap/README.md` |
| 2026-10-11 | **All TypeScript** (Fastify + pg-boss backend, Node SDK, Probot app, Fastify fake services, Next.js) | One language; zod contracts shared by all three devs. Supersedes the FastAPI decision | `docs/roadmap/setup-and-deploy.md` |
| 2026-10-11 | **Deployed cloud** (Vercel + non-sleeping Node host + Neon) with Docker Compose as offline backup | Webhooks and the landing page need public URLs | `docs/roadmap/setup-and-deploy.md` |
| 2026-10-11 | **Demo shop in a separate repo `NetPranav/seismo-demo-shop`** (owner adarzhpathade) | Real "install the app on a repo" flow; resolves Q7 | `docs/roadmap/P1-demo-world.md` |
| 2026-10-11 | **Login: GitHub only**, through the GitHub App's OAuth (Auth.js) | Same identity as installations | `docs/roadmap/github-app.md` |
| 2026-10-11 | **AI: NVIDIA NIM, Nemotron** (Ultra `nvidia/nemotron-3-ultra-550b-a55b` for quality, a faster Nemotron for classification; final by spike S1). OpenAI-compatible client, model by env | Team choice. Supersedes the Claude-model suggestion | `docs/roadmap/ai-layer.md` |
| 2026-10-11 | **AI never writes code.** AI only explains (dashboard + alerts) and judges ambiguous cases, as zod-validated JSON; templates are the fallback | Team rule: "can't break even if it wanted to" | `docs/roadmap/ai-layer.md` |
| 2026-10-11 | **Fixes are data rules** in the customer's `seismo/aliases.json`, applied by `applyAliases` (`@seismo/sdk/runtime`): add `target` from `source` only when `target` is missing; old field wins; guarantees G1–G4 proven by fast-check; conflict checks C1–C8. Only aliases get automatic PRs; transforms/behaviour changes are review-only | Supersedes "adapter file per API" and "firstPresent(new, old)" | `docs/roadmap/P5-fix-it-safely.md` |
| 2026-10-11 | **Alerts:** dashboard, GitHub (issue/check/comment), WhatsApp (Twilio sandbox), Slack/Discord, email (Resend). No SMS | Team choice | `docs/roadmap/P6-meaning-changes-ai-alerts.md` |
| 2026-10-11 | **Add-ons in plan:** changelog & deprecation radar; Compare & Simulate. **Drift network dropped** from the 14-day plan | Team choice; resolves Q3 | `docs/roadmap/README.md` |
| 2026-10-11 | **Reuse libraries first** (catalog with verification status) | Team rule | `docs/roadmap/libraries.md` |
| 2026-10-11 | Team: NetPranav = lead + architecture/logic (backend, SDK), OVERxPOWERED = architecture/logic (GitHub App, fake services), adarzhpathade = frontend (shop, dashboard) | Split agreed by the lead; backend split between the two logic devs is changeable in `.team/OWNERSHIP.md` | `.team/OWNERSHIP.md`, `.github/CODEOWNERS` |
| 2026-10-11 | ~~Branch model with develop + feature branches~~ **Superseded** (see above). Old: `main` (no direct pushes by anyone; only the lead merges release PRs, merge commits, tags) ← `develop` (default branch; squash-merged PRs; 1 approval + CI `ci-ok` + up to date) ← `<type>/<area>-<desc>` branches; `hotfix/*` from main | Keep main demo-ready; nobody breaks develop | `CONTRIBUTING.md` |
| 2026-10-11 | Enforcement: GitHub rulesets (server-side) + `.githooks/pre-push` (local) + Claude `permissions.deny` (no push to main/develop, no force push, no `gh pr merge`) | Defence in depth; rulesets are the real guard | `.claude/settings.json`, `CONTRIBUTING.md` §2 |
| 2026-10-11 | Claude-to-Claude coordination via git: SessionStart hook runs `scripts/team-status.sh`; per-person status published to a separate `team-status` branch; skills `/start-task`, `/handoff`, `/team-sync`; draft PRs from the first commit | Three separate machines can't share a live session; git is the shared bus; status off code branches avoids merge conflicts | `.team/README.md` |
| 2026-10-11 | Contracts first: cross-owner interfaces live in `contracts/` and change via their own PR | Lets frontend and backend build in parallel against mocks | `contracts/README.md` |
| 2026-10-11 | Feature branches stay current by merging `origin/develop` (no rebase, no force push) | Squash merge keeps develop clean anyway; avoids force-push risk | `CONTRIBUTING.md` §3 |
| 2026-10-11 | Working name "Seismo" (placeholder) | Docs need a name; check availability before public use | `docs/PS/README.md` |
| 2026-10-11 | Positioning: "Dependabot for the APIs you depend on" | Developers instantly understand PR-based dependency bots | `docs/PS/solution.md` |
| 2026-10-11 | Do **not** claim novelty for structural third-party drift, API lockfiles or MCP tool pinning | Research found 8+ polling drift tools (FlareCanary, DriftGuard, DriftMonitor, APIShift…), DriftGuard GitHub Action, Invariant mcp-scan, Bellwether, DriftCop | `docs/PS/competitors.md` |
| 2026-10-11 | Differentiate on G1–G5: real-traffic shape-only profiling, semantic/behavioural detectors, code-aware severity, fix PRs with ladder, drift network | Not seen together in any tool during research | `docs/PS/market-gap.md` |
| 2026-10-11 | Primary capture = in-process SDK (read-only, fail-open, sampled); probes secondary; no proxy in MVP | Proxy sits in the request path and is a hard security sell | `docs/PS/architecture.md` §2, `docs/PS/advantages-disadvantages.md` §3.1 |
| 2026-10-11 | ~~Fixes ship as PRs to one adapter file per API~~ **Superseded** by data rules in `seismo/aliases.json` (above) | Reviewable, reversible, safe even when a rename guess is wrong | `docs/PS/solution.md` §4 |
| 2026-10-11 | Fix ladder: alias → transform → behaviour; transforms never auto-applied; money/branching/persistence always reviewed | Safe handling when uncertain is a judging criterion | `docs/PS/solution.md` §4.2 |
| 2026-10-11 | Fingerprints never carry a record's values; numbers only as magnitude + batch percentiles (no min/max); salt stays customer-side; enum allow-list is the only plain-value exception | Privacy is the main adoption blocker for payment-heavy customers | `docs/PS/architecture.md` §3.3 |
| 2026-10-11 | LLM only explains/classifies/extracts; detection is deterministic | Avoid "AI wrapper" perception; explainable to judges | `docs/PS/architecture.md` §9 |
| 2026-10-11 | ~~Hackathon add-ons: radar + simulated drift network~~ **Superseded**: radar + Compare & Simulate, no drift network | Evidence-backed proactive story + memorable moat demo | `docs/PS/add-ons.md` |
| 2026-10-11 | ~~Demo stack: FastAPI fake services~~ **Superseded** by all-TypeScript (above) | Fast to build; one SDK language | `docs/PS/architecture.md` §11 |
| 2026-10-11 | Pricing hypothesis: Free / Team $49 / Business $299 / Enterprise; per monitored API | Anchored to competitor prices and Pandium's median of 15 integrations | `docs/PS/business-model.md` §4 |

## Open questions

| # | Question | Owner | Status |
|---|---|---|---|
| Q1 | Official PS 3 requirements | Team | **Resolved 2026-10-11:** `Hackwave Problem_Statements.pdf` added. MCP servers, SDKs and webhooks appear in the problem framing only; the demo requirement is several simulated services + undocumented changes → detection, impact, adaptation, validation. Roadmap adds D17 endpoint-gone and webhook drift (Should); MCP is Later. No judging weights given |
| Q2 | Final product name (check domain, GitHub org, trademark) | Product | Open |
| Q3 | Which add-on is primary if time runs short? | Team | **Resolved 2026-10-11:** radar + Compare & Simulate; no drift network |
| Q4 | SDK language for MVP | Backend | **Resolved 2026-10-11:** Node/TypeScript only |
| Q5 | Survey results: our own number on how teams find out about API changes | Product | Not started |
| Q6 | Verify competitor features/prices on their own sites before the deck (all currently vendor claims via a competitor's article) | Product | Open |
| Q7 | Where does the demo shop live? | Lead + OVERxPOWERED | **Resolved 2026-10-11:** separate repo `NetPranav/seismo-demo-shop` |
| Q8 | The repo is **public**: the evidence PDFs and docs are visible to anyone, including other teams. Keep public (rulesets are free on public repos) or go private (rulesets on private repos need GitHub Pro/Team; the Student Pack includes Pro)? | Lead | Open |
| Q9 | P0 spikes S1–S6: NIM base URL/models/structured output/rate limit; body capture with @mswjs/interceptors; Probot maintenance; Twilio WhatsApp sandbox; non-sleeping Node host; graph library | NetPranav, OVERxPOWERED, adarzhpathade | Open; answer by end of day 2 (2026-10-12) |
| Q10 | npm scope for publishing the SDK (`@<scope>/seismo-sdk`) | Lead | Open; P0.10 |
| Q11 | Final deadline confirmation: is the demo on 2026-10-24? | Lead | Open |

## Key facts to remember (labelled)

- 1,970 of 3,075 web APIs did not always flag breaking changes in minor/patch releases; only 517 consistently used major versions (Confirmed, ICWE 2024).
- Pipedrive silently caps `limit` at 100 (from 500) since 2025-01-15; Lightspeed did the same at 1,000 in 2020-02 (Confirmed, changelogs).
- Jira Cloud changed text `=` to phrase search on 2026-10-06 (Confirmed, changelog; announced, not an incident).
- `Deprecation` header: RFC 9745, Standards Track, March 2025. `Sunset` header: RFC 8594, 2019 (Confirmed).
- No reliable measurement of the cost or time-to-detect of silent API drift exists (Confirmed absence, per the research teammate's cost review). Say "unmeasured", never invent a number.
- No public API incident exists for a units change (rupees → paise); it's an illustration. Mars Climate Orbiter and Knight Capital are analogies only.
- Acquisitions: Akita → Postman (2023-07), Optic → Atlassian (2024-04), Noname → Akamai (~$450M, closed 2024-06-25), Moesif → WSO2 (2025-05). Snyk → Invariant is Unverified.
- India DPDP Rules notified Nov 2025; main obligations ~May 2027 (Secondary; verify).

## People (roles)

- **@NetPranav:** lead, architecture/logic (backend, SDK), owns `main` and repo config.
- **@OVERxPOWERED:** architecture/logic (GitHub App, fake services).
- **@adarzhpathade:** frontend (demo shop, dashboard).
- **Research:** the two evidence PDFs in the root were written by a teammate (handle appears in the PDFs).

## Changelog of this file

- 2026-10-11: Added roadmap decisions (14 days, all TS, NIM, AI-never-writes-code, aliases.json data rules, alerts, radar, no drift network); superseded old rows; Q9–Q11.
- 2026-10-11: Added team roles, branch model, enforcement and Claude coordination decisions; Q7–Q8.
- 2026-10-11: Created with initial decisions, open questions and facts after the docs folder was written.
