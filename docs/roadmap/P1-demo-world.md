# P1 · Demo world (Days 2–4)

**Done when:** from the dashboard's Demo Control, flipping any fake API to v2 makes the demo shop visibly wrong, and a side-by-side diff shows v1 vs v2 responses.

**Depends on:** P0 · **Contracts:** `fake-services` · **Owners:** OVERxPOWERED (services), adarzhpathade (shop, Demo Control, Compare)

## The fake third-party APIs (`services/`, one Fastify app, four "providers")

Each provider has its own base path and host name in staging (e.g. `users.api.seismo-demo…`), so Seismo sees them as separate external services.

| Provider | Endpoints | v2 scenarios (each an independent toggle) | Detector it exercises |
|---|---|---|---|
| **users** | `GET /users/{id}`, `GET /users` | `name` → `display_name` · error body `{error}` → `{errors:[]}` | rename (D3), error shape (D11) |
| **payments** | `GET /payments/{id}`, `POST /payments`; sends `payment.captured` webhooks to the shop (for webhook drift, P6.12) | `amount` rupees → paise (×100) · `amount` string → number | unit (D5), type (D4) |
| **shipping** | `GET /shipments/{id}` | new status `partially_shipped` · `Sunset` + `Deprecation` headers | enum (D7), deprecation (D13) |
| **orders** | `GET /orders?limit=&page=` | `limit` silently capped 500 → 100 · page → cursor | truncation (D9), pagination (D10) |
| *(optional)* **weather** | `GET /forecast` | °C → K (offset, not a ratio) | value drift (D6) → review |

Admin API (demo only, protected by `DEMO_ADMIN_TOKEN`): `GET /admin/scenarios`, `POST /admin/scenarios/{id}` `{enabled}`, `POST /admin/reset`, and `POST /admin/rollout/{id}` `{percent}` to simulate gradual rollouts (mixed v1/v2 traffic).

Each provider also publishes, for P7: `GET /openapi.json` (changes with toggles) and `GET /changelog` (HTML + RSS) where announcements can be posted ahead of a flip.

## Sub-phases

| ID | Task | Owner | Output |
|---|---|---|---|
| P1.1 | `contracts/fake-services`: every endpoint's v1 and v2 payloads as zod schemas + realistic seed data (Indian names, ₹ prices) | OVERxPOWERED | Contract merged first |
| P1.2 | Implement the four providers + scenario engine + admin API + rollout percentage | OVERxPOWERED | Deployed to staging |
| P1.3 | Per-provider `openapi.json` and `/changelog` (HTML + RSS) | OVERxPOWERED | Used by P7 |
| P1.4 | Create repo **`NetPranav/seismo-demo-shop`** (Next.js): products, product detail, checkout, invoice, order history; all provider calls server-side through one `lib/api/*` client per provider | adarzhpathade | Deployed on Vercel |
| P1.5 | Make breakage visible: blank customer name, ₹49,900 instead of ₹499, missing orders, "Unknown status" badge, broken error toasts | adarzhpathade | Each v2 toggle visibly breaks one screen |
| P1.6 | Dashboard **Demo Control** panel (only when `DEMO_MODE=true`): toggles, rollout slider, reset | adarzhpathade | Calls services admin API |
| P1.7 | Dashboard **Compare** view v1: pick provider endpoint → fetch v1 and v2 sample → `jsondiffpatch` side-by-side diff | adarzhpathade | First piece of "Compare & Simulate" |
| P1.8 | Traffic generator: a script hitting the shop's pages at a set rate (so baselines fill without clicking) | NetPranav | `npm run demo:traffic -- --rps 5` |

## Libraries
Fastify · @faker-js/faker (seed data) · feed (RSS output) · jsondiffpatch (visual diff) · Next.js · shadcn/ui. Status in [libraries.md](libraries.md).

## Definition of Done
- [ ] All toggles flip from Demo Control on staging and the shop breaks exactly as listed
- [ ] Reset restores v1 everywhere in one click
- [ ] Rollout at 50% produces mixed responses
- [ ] Compare view shows the v1/v2 diff for every scenario
- [ ] `openapi.json` reflects toggles; `/changelog` accepts a posted announcement

## Cut line
Must: users, payments, shipping, orders scenarios except page→cursor; Demo Control; Compare · Should: rollout %, page→cursor, changelog endpoints (needed by P7) · Later: weather provider
