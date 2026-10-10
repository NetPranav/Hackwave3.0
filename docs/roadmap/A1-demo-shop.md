# A1 · Demo shop, Demo Control, Compare (Days 2–4)

**Done when:** flipping any fake API to v2 in Demo Control makes the shop visibly wrong, and Compare shows the v1/v2 diff.
**Owner:** adarzhpathade · **Consumes:** [P1](P1-demo-world.md) (`fake-services` contract, services, admin API, `/admin/sample`) · **Details:** provider table and scenarios in [P1](P1-demo-world.md).

| ID | Task | Output |
|---|---|---|
| A1.1 | Create repo **`NetPranav/seismo-demo-shop`** (Next.js): products, product detail, checkout, invoice, order history; every provider call server-side through one `lib/api/*` client per provider. Also add `seismo.config.json` (which files are API clients) and `seismo.workflows.yml` (checkout, invoice, orders…) which the scanner (P2.3/P2.4) reads | Deployed on Vercel |
| A1.2 | Make breakage visible: blank customer name, ₹49,900 instead of ₹499, missing orders, "Unknown status" badge, broken error toasts | Each v2 toggle visibly breaks one screen |
| A1.3 | Dashboard **Demo Control** (`DEMO_MODE=true` only): toggles, rollout slider, reset; calls the services admin API from a server route so `DEMO_ADMIN_TOKEN` never reaches the browser | Toggles work on staging |
| A1.4 | Dashboard **Compare v1**: pick provider endpoint → v1 and v2 sample from `/admin/sample` → `jsondiffpatch` side-by-side | First piece of Compare & Simulate |
| A1.5 | Shop CI (lint, typecheck, Vitest) and Vercel deploy | Own CI green |

**DoD:** every toggle breaks exactly one screen · Reset restores v1 · 50% rollout shows mixed results · Compare works for every scenario.
**Hand-offs:** when the shop is deployed, send NetPranav a request with its URL so he can start the traffic generator (P1.8) and the scanner tests (P2).
