# A2 · Onboarding and the Obsidian-style graph (Days 3–6)

**Done when:** after installing the app, the user lands on onboarding, sees scan progress, then the graph; clicking a field highlights its path to workflows.
**Owner:** adarzhpathade · **Consumes:** [P2](P2-see-your-apis.md) (`graph`, `installations` contracts, `GET /v1/graph`, `/v1/graph/impact`, `/v1/installations`, SSE `graph.updated`) · **Spec:** [dashboard.md](dashboard.md) §4 and [github-app.md](github-app.md) §5.

| ID | Task | Output |
|---|---|---|
| A2.1 | `/onboarding?installation_id=…`: "Install on GitHub" → GitHub → setup URL → "Scanning…" progress → graph | Smooth first-run flow |
| A2.2 | Graph view v1: force layout, node types/colours, click-to-highlight path, side panel, search, filters, positions cached in `localStorage` (library from A0.2) | Works on mocks first, then the real API |
| A2.3 | Coverage indicator "N field reads mapped, M unresolved" from the graph API (P2.8) | Honest about static-analysis limits |
| A2.4 | Settings → Repos: list installed repos, rescan button, link to GitHub App settings | Uses `/v1/installations` |

**DoD:** install → graph in < 60 s on staging · clicking `amount` highlights the checkout workflow · unresolved reads are shown, not hidden.
