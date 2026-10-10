# A3 · Status page, overview and SDK install in the shop (Days 4–7)

**Done when:** the API Status page shows live calls, errors, latency and provider status for every external API within 10 s of shop traffic.
**Owner:** adarzhpathade · **Consumes:** [P3](P3-watch-live-traffic.md) (`status` contract, `GET /v1/status`, `/v1/overview`, SSE `status.updated`, project/SDK-key API) · **Spec:** [dashboard.md](dashboard.md) §3 and §5.

| ID | Task | Output |
|---|---|---|
| A3.1 | **Install the SDK in the shop** (on NetPranav's request from P3.7): `seismo.init(...)` in server code, SDK key in the shop's env, enum allow-list (`status`, `currency`) in `seismo.config.json` | Shop sends fingerprints on staging |
| A3.2 | API Status page: one row per service, endpoint detail page with baseline-vs-now field table, sparklines, provider status, deprecation dates | See §5 |
| A3.3 | Live updates through SSE (fallback: poll every 2 s) and status colours on graph nodes | Graph colours follow status |
| A3.4 | Overview `/app` with KPI tiles and service cards | See §3 |
| A3.5 | Settings → SDK keys & enum allow-list (create/revoke key, copy install snippet) | Uses the project/keys API |

**DoD:** shop traffic visible in < 10 s · killing the backend leaves the shop working (checked together with P3.8) · overview numbers match the API.
