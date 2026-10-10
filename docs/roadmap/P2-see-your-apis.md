# P2 · See your APIs: GitHub App + code map + graph (Days 3–6)

**Done when:** installing the Seismo GitHub App on `seismo-demo-shop` produces, within 60 seconds and with no SDK installed, an Obsidian-style graph of every external API the code calls → endpoints → fields read → functions → user workflows.

**Depends on:** P0, P1 (demo repo exists) · **Contracts:** `codemap`, `graph`, `installations` · **Owners:** OVERxPOWERED (app + scanner), NetPranav (graph API), adarzhpathade (onboarding + graph UI)

## How the code map is built

1. GitHub sends `installation` / `installation_repositories` → the app enqueues a **scan job** per repo (pg-boss; webhook answered in < 10 s).
2. The scanner downloads the default branch as a tarball (Octokit `repos.downloadTarballArchive`), unpacks to a temp dir.
3. **ts-morph** walks every `.ts/.tsx/.js/.jsx` file:
   - **Call sites:** `fetch(...)`, `axios.*(...)`, `ky`, `got`, and project API-client wrappers (configured in `seismo.config.json`, e.g. `lib/api/*`). The URL is resolved from string literals, template literals and `process.env.X_BASE_URL` constants → `service host` + `method` + `path template`.
   - **Field reads:** follow the response variable (`const data = await res.json()`, `const { data } = await axios.get(...)`) through property access, optional chaining, destructuring, and one level of function calls.
   - **Usage kind** per read: `display` (JSX/string), `arithmetic` (operators, `Number()`), `branching` (`if`, `switch`, ternary, `===`), `persistence` (passed to a DB call), `outbound` (sent to another API); `money` when arithmetic/persistence on names like `amount|price|total|fee|tax`.
   - Unresolvable cases are recorded as `inferred: false, unresolved: true`. (LLM-assisted extraction is not in the MVP; see [ai-layer.md](ai-layer.md).)
4. **Workflows** come from `seismo.workflows.yml` in the repo (e.g. `checkout: [app/checkout/**, lib/payments/**]`), with Next.js route folders as the default.
5. Result posted to the backend as a `codemap` (contract) and stored; a **re-scan** runs on every `push` to the default branch.

## Sub-phases

| ID | Task | Owner | Output |
|---|---|---|---|
| P2.1 | `contracts/codemap`, `contracts/graph`, `contracts/installations` | OVERxPOWERED + NetPranav | Merged first |
| P2.2 | App permissions/events (see [github-app.md](github-app.md)); installation + repo storage; setup URL → dashboard onboarding | OVERxPOWERED | Install flow works with the dev app |
| P2.3 | Scan job: tarball download, ts-morph call-site + field-read extraction, usage kinds | OVERxPOWERED | Unit tests on fixture repos (≥ 10 patterns) |
| P2.4 | Workflows from `seismo.workflows.yml` + route-folder default; re-scan on push | OVERxPOWERED | Graph updates after a push |
| P2.5 | Backend: store code map; build the graph with **graphology** (nodes: service, endpoint, field, code location, workflow); `GET /v1/graph`, `GET /v1/graph/impact?field=…` (BFS to workflows) | NetPranav | Graph API on staging |
| P2.6 | Dashboard onboarding: "Install on GitHub" → GitHub → setup URL → "Scanning…" progress → graph | adarzhpathade | Smooth first-run flow |
| P2.7 | Graph view v1 (Obsidian style): force layout, node types/colours, click-to-highlight path, side panel, search, filters (see [dashboard.md](dashboard.md) §4) | adarzhpathade | Works on mock data first, then real API |
| P2.8 | Coverage indicator: "N field reads mapped, M unresolved" | NetPranav + adarzhpathade | Honest about static-analysis limits |

## Libraries
Probot/@octokit/app · ts-morph · tar · graphology (+ graphology-traversal) · react-force-graph-2d (or Sigma, per spike S6) · js-yaml. Status in [libraries.md](libraries.md).

## Definition of Done
- [ ] Fresh install on `seismo-demo-shop` → graph visible in < 60 s
- [ ] Every provider call in the demo shop appears with correct endpoint templates and fields
- [ ] `amount` in checkout shows usage `arithmetic + money`; `name` on invoice shows `display`
- [ ] Clicking a field highlights its path to workflows
- [ ] Push to the demo repo re-scans and updates the graph
- [ ] Scanner tests pass on fixtures; unresolved calls are reported, not hidden

## Cut line
Must: fetch + axios, direct field reads, destructuring, workflows file, graph with highlight · Should: one-level call following, re-scan on push, coverage indicator · Later: Python repos, LLM-assisted extraction
