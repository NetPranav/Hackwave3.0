# Dashboard and landing page

Owner: @adarzhpathade · Stack: Next.js (App Router) + Tailwind + shadcn/ui on Vercel, Auth.js (GitHub via the Seismo app), data from the backend API + SSE. Every screen is built first against **mock data generated from `contracts/`**, then switched to the real API.

## 1. Routes

| Route | Access | Built in |
|---|---|---|
| `/` landing | Public | P8 (draft P7) |
| `/docs/sdk` install guide | Public | P8 |
| `/login` → GitHub | Public | P0 |
| `/onboarding` (GitHub App setup URL) | Signed in | P2 |
| `/app` overview | Signed in | P3 |
| `/app/graph` | Signed in | P2 |
| `/app/status` · `/app/status/[service]` | Signed in | P3 |
| `/app/timeline` · `/app/drift/[id]` | Signed in | P4 |
| `/app/fixes` | Signed in | P5 |
| `/app/review` | Signed in | P6 |
| `/app/compare` | Signed in | P1 → P6 |
| `/app/radar` | Signed in | P7 |
| `/app/settings` (repos, SDK keys, alerts, AI, enum allow-list) | Signed in | P3 → P6 |
| `/app/demo` Demo Control | `DEMO_MODE` only | P1 |

## 2. Landing page (before login)
Purpose: explain in 10 seconds, prove it's real, get a click on **Install on GitHub** or **Sign in**.

| Section | Content |
|---|---|
| Hero | "Your API is up, your monitor is green, and your app is still silently wrong." Sub-line: "Seismo watches the APIs you depend on, catches silent changes in shape, behaviour and meaning, and opens safe fix PRs." Buttons: **Install on GitHub** · **Sign in with GitHub** · Watch the 90-second demo |
| Live mini-graph | A small animated version of the real graph: a field turns red, the path to "Checkout" pulses, then a PR badge turns it green |
| What we catch | Six cards: renamed field · changed default/limit · new error format · pagination change · rate limit · meaning change (units/enums) |
| How it works | 1 Install the GitHub App → 2 Add one line of SDK → 3 Get alerts and safe fix PRs |
| Safety promise | "We only add, never replace. Fixes are data, not code. Proven by property tests." · "Your data never leaves your servers; we see shapes, not values." |
| Evidence strip | Only labelled facts from [`../PS/evidence.md`](../PS/evidence.md), e.g. "1,970 of 3,075 web APIs didn't always flag breaking changes in minor/patch releases (ICWE 2024)" and "Pipedrive: a request for 500 items silently returns 100 (official changelog, 2025)". No invented statistics |
| Footer | GitHub repo, docs, privacy note, team |

No live customer data on the landing page. The mini-graph uses canned demo data.

## 3. Overview (`/app`)
KPI tiles: external APIs monitored · endpoints · fields mapped (coverage %) · open drifts by severity · fix PRs open · radar items upcoming. Below: service health cards (status, calls/min sparkline, last change) and the latest 5 events.

## 4. The Obsidian-style dependency graph (`/app/graph`)
**Question it answers:** *"What do we depend on, and what breaks if this changes?"*

| Element | Spec |
|---|---|
| Data | `GET /v1/graph` → `{ nodes, links }` from the backend's graphology model (code map + status + drift + radar) |
| Node types | **Service** (large circle, provider logo/initial) · **Endpoint** (medium) · **Field** (small dot) · **Code location** (square) · **Workflow** (diamond) |
| Colour | 🟢 normal · 🟡 suspected · 🔴 breaking · 🔵 fix pending · ⚪ unused field (dimmed) · clock badge = deprecation/radar date |
| Size | Endpoint ∝ calls/min · field ∝ number of code reads |
| Layout | Force-directed (d3-force through `react-force-graph-2d`, or Sigma + ForceAtlas2 per spike S6); one gravity cluster per service; positions cached in `localStorage` so the graph doesn't jump between visits |
| Look | Dark canvas, thin translucent links, glow on hover, labels shown at zoom ≥ 1.5 (Obsidian feel) |
| Interaction | Hover = tooltip with live stats; click = highlight the full upstream/downstream path and dim the rest, open side panel; search box; filters by service, workflow, severity; "show only affected" toggle |
| Live | SSE `graph.updated` / `drift.created`: the affected path pulses red; on PR merge it fades to green |
| Side panel | Node details: for a field, its baseline stats, where it's read (file:line links to GitHub), open events, alias rules applied |
| Detail view | From a drift event, a left-to-right **React Flow** chain: change → field → functions → workflows. Clearer than the force graph for explaining one incident |

## 5. API status layer (`/app/status`)
One row/card per external service:

| Column | Source |
|---|---|
| State: normal · changed · under review · fix pending | Drift events |
| Calls/min (sparkline), error %, p95 latency, 429s | SDK fingerprints (P3) |
| Provider status (operational / degraded / outage) | Statuspage `summary.json` poll |
| Deprecations / upcoming changes (dates) | `Sunset`/`Deprecation` headers + radar |
| Last seen, endpoints count, fields mapped | Ingest + code map |

The service page lists endpoints with the same columns, plus baseline-vs-now field table (presence %, type, p50, enum values).

**Relations:** every status row links to its node in the graph, and every graph node links back to its status row. The same IDs are used across status, graph, drift and radar, so the views stay connected.

## 6. Timeline (`/app/timeline`)
Vertical list of drift events and radar items: type, detector, time, severity, state; filters; deploy markers from the demo repo's pushes (context only).

## 7. Drift detail (`/app/drift/[id]`) and Fixes (`/app/fixes`)
Header (service, endpoint, field, detector, confidence, severity, state) → before/after statistics (sparklines, percentiles, presence) → **Compare** (synthetic before/after example, jsondiffpatch) → where used (file:line, usage kind) → AI explanation → fix panel: alias rule diff (react-diff-viewer-continued), checks C1–C8 with ticks, CI status, PR link, revert link.

## 8. Review queue (`/app/review`)
Cards for every non-alias change: evidence, AI explanation (model name + latency badge, or "template" when AI is off), deterministic suggested change, actions: **Mark expected** · **Snooze** · **Open suggestion PR** (needs-review, P5.10).

## 9. Compare & Simulate (`/app/compare`): the API-change assistant
- **Compare:** pick an endpoint → baseline shape vs current shape (synthetic examples generated from fingerprints; no real values) as a side-by-side diff.
- **Simulate (what-if):** pick a change (rename field, scale values, add enum value, cap limit) → see the impact path on the graph, whether existing alias rules already cover it, and the suggestion Seismo would make. Used for radar items too ("simulate this announced change").
- **Demo Control** (separate page, `DEMO_MODE` only): flips the fake providers.

## 10. Radar (`/app/radar`)
Upcoming changes by effective date: source link and quote, matched code sites, explanation, suggestion, "simulate" button (opens Compare & Simulate pre-filled).

## 11. Notifications
Bell with unread count (SSE); settings for Slack/Discord webhook, email, WhatsApp number (with a "send test" button and sandbox join instructions), severity thresholds.

## 12. Libraries
Next.js · Tailwind · shadcn/ui · Auth.js · react-force-graph-2d or @react-sigma/core + graphology · @xyflow/react (React Flow) · recharts · jsondiffpatch · react-diff-viewer-continued · TanStack Query · EventSource (SSE). Status in [libraries.md](libraries.md).
