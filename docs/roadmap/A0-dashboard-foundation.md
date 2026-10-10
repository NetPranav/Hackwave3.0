# A0 · Dashboard foundation (Days 1–2) · Adarsh's track

**Done when:** `dashboard/` runs on Vercel staging with GitHub login, a protected `/app` shell with navigation for every route in [dashboard.md](dashboard.md) §1 (empty pages are fine), and a mock-data layer shaped like `contracts/`.
**Owner:** adarzhpathade · **Branch:** `adarzhpathade` · **Consumes:** [P0](P0-foundation.md) (contract skeletons P0.0, auth P0.11) · **Mock first, real API later.**

| ID | Task | Output |
|---|---|---|
| A0.1 | Next.js (App Router) + Tailwind + shadcn/ui + design system already in `dashboard/` · Auth.js GitHub provider · protected `/app` · session cookie the backend can verify (P0.11). **Until the Seismo GitHub App exists, use your own GitHub OAuth App for staging**, then swap the client ID/secret when NetPranav sends them. GitHub only accepts registered callback URLs and Vercel previews change host, so log in only on the stable staging/production domains | Login works on staging |
| A0.2 | **Spike S6 (graph library):** `react-force-graph-2d` vs `@react-sigma/core` + graphology with 500 nodes / 1,000 edges, custom node drawing, click-highlight. Write the result in `MEMORY.md` | 60 fps pan/zoom; decision recorded |
| A0.3 | App shell: sidebar with all routes, top bar with bell placeholder, dark/light, layout primitives | Every route in §1 reachable |
| A0.4 | Mock layer: a typed API client with a `USE_MOCKS` switch; mock data generated from `@seismo/contracts` (P0.2) including an SSE mock | Every later screen is built on mocks first |
| A0.5 | CI for `dashboard/` (lint, typecheck, build) green on the personal branch | `ci-ok` covers it |

**Definition of Done:** login on staging · all routes render with mocks · S6 decided · no dependency on the backend being up.
