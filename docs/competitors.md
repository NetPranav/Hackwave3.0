# Competitors and adjacent tools

Research date: 10 Oct 2026. Most details come from vendor pages, directories and one comparison article **written by a competitor (FlareCanary)**, so treat features and prices as **vendor claims** unless marked otherwise. Check the vendor's own site before quoting anything on stage.

## 0. The key finding

**Structural drift monitoring of third-party APIs is already a crowded, cheap category in 2026.** Several small SaaS tools poll third-party endpoints on a schedule, learn a baseline shape and alert on removed fields or type changes, at roughly **$12–$149/month** entry prices (vendor-stated, via a competitor's comparison). So:

- We must **not** pitch "we detect third-party API schema changes" as new.
- Our space is the **combination** that we did not see in any single tool during research (see §4): real traffic instead of polling only, **semantic and behavioural** detectors, **code-aware** impact and severity, **auto-fix PRs** with a review ladder, privacy-preserving shape-only telemetry, and a cross-customer **drift network**.

## 1. Categories

### 1.1 Third-party API drift monitors (closest direct competitors)

| Tool | Approach | Third-party? | Notable | Price (vendor-stated) |
|---|---|---|---|---|
| **FlareCanary** | Polls endpoints; compares to learned baseline or OpenAPI spec; severity levels; claims MCP schema monitoring | Yes | Wrote the comparison article we used (biased) | Free (5 endpoints, daily); $19; $49 /mo |
| **DriftMonitor** | Scheduled checks against a known-good baseline; breaking vs warning; alerts | Yes | Alpha; structural focus (example: number → string); no code impact or auto-fix mentioned ([site](https://www.driftmonitor.app/)) | Not published |
| **DriftGuard** | `learn` / `check` CLI, GitHub Action, hosted; baseline from live responses | Yes | Ships as a GitHub Action (CI gate) | Free up to 3 endpoints |
| **API Drift Alert** | Polling with severity-based routing | Yes | No free tier | $149 / $349 / $749 /mo |
| **APIShift** | Polling, severity levels | Yes | Claims 5K+ APIs monitored (vendor claim) | Free (5 APIs, hourly); $29; $99 |
| **Rumbliq** | Uptime/SSL/DNS/cron + simple JSON diff | Yes | No severity or multi-sample baselines (per comparison) | Free; $12; $29; $69 |
| **DiffMon** | Monitors HTML and JSON; classifies schema/value/mixed changes | Yes | One of few that mention *value* changes | Free; $14; $49 |
| **API Detective** | Compares live responses of 200–500 public APIs to their docs | Pre-indexed public APIs | Pre-launch (per comparison) | Free tier; paid TBD |
| **Apify "Third-party API Contract Drift Monitor"** | Checks GET endpoints against an OpenAPI 3 doc | Yes | Pay per check | $10 per 1,000 checks |
| Open-source snapshot CLIs (e.g. `api-schema-drift-watch`) | Snapshot JSON shapes, flag drift, CI exit codes | Yes | Zero-dependency, DIY | Free |

**What they share:** polling (not real traffic), structural focus, no knowledge of your code, alerts rather than fixes.
**Their real advantage over us:** zero install in the app (just a URL), cheap, already live.

### 1.2 Spec diff and API design tools

| Tool | What it does | Gap vs our problem |
|---|---|---|
| **oasdiff** (open source) | Compares two OpenAPI specs; 100+ breaking-change checks with ERR/WARN levels; CI, Docker, GitHub Action ([nordicapis](https://nordicapis.com/using-oasdiff-to-detect-breaking-changes-in-apis/)) | Needs both specs; can't see whether the live API matches; blind to meaning |
| **Optic** → **Atlassian** (acquired Apr 2024, folded into Compass) ([Atlassian](https://www.atlassian.com/blog/announcements/optic-acquisition)) | OpenAPI diff, linting, change review in CI | Provider-side; status of open-source pieces is mixed |
| **Bump.sh** | API docs with changelogs from uploaded specs | Provider must push specs; $50–$250/mo (vendor-stated) |
| **Specmatic** | Contract testing from specs; backward-compatibility check runs old-spec tests against new-spec stub | Design-time/CI; for APIs you own |

### 1.3 Contract testing

| Tool | What it does | Gap |
|---|---|---|
| **Pact** (open source) / **PactFlow** (SmartBear) | Consumer-driven and bi-directional contract testing; entry ~US$99 (directory listing, unverified) | Needs the provider to participate; third-party vendors won't |
| **PactFlow Drift** | AI-generated test suites from OpenAPI, run in CI (per comparison article) | CI-only; not continuous against vendors |

### 1.4 Traffic-based observability for **your own** APIs

| Tool | What it does | Gap |
|---|---|---|
| **Postman Insights** (from **Akita**, acquired Jul 2023) | Agent watches traffic, discovers endpoints, per-endpoint errors; open beta announced at POST/CON 2025; Enterprise plans ([Postman docs](https://learning.postman.com/docs/insights/get-started/overview)) | First-party (inbound) APIs |
| **Treblle** | SDK-based API observability, docs, analytics | Own APIs only; free 1 API/250K requests; paid from ~$25–$77/mo (sources conflict) |
| **APIToolkit / Monoscope** | Telemetry via SDK/OpenTelemetry; anomaly detection incl. new fields and changed behaviour; weekly reports | Monitors your instrumented services; no evidence it watches vendors' APIs |
| **Moesif** → **WSO2** (acquired May 2025) | API analytics and monetisation | Provider-side analytics |
| **Datadog** (APM inferred dependencies, API Catalog) | Infers outbound third-party dependencies from traces and measures their performance; API Catalog inventories your own endpoints ([Datadog docs](https://docs.datadoghq.com/tracing/guide/inferred-service-opt-in/)) | Performance/errors, not payload semantics; big-vendor pricing; **the biggest incumbent threat** |

### 1.5 Record/replay and mocks

| Tool | What it does | Overlap |
|---|---|---|
| **Keploy** (open source, Apache 2.0) | eBPF capture → tests + dependency mocks, including external API calls | Captures outbound calls; testing, not drift monitoring |
| **Speedscale** | Kubernetes traffic capture (eBPF/sidecar), replay, mocks of third parties, PII redaction | Same as above |
| **Tusk Drift** (YC W24) | SDK records inbound/outbound traffic, replays against new code; PII redaction | Same; "drift" here means regression testing |

### 1.6 Egress gateways

| Tool | What it does | Overlap |
|---|---|---|
| **Lunar.dev** | Egress API gateway/proxy for third-party APIs: policies, caching, rate limits, quotas, retries, observability; now also MCP and AI gateway ([docs](https://docs.lunar.dev/)) | Sees all third-party traffic, so it **could** add drift detection. Sits in the request path (we don't) |

### 1.7 API security (discovery, inventory, sensitive data)

| Tool | Notes |
|---|---|
| **Levo.ai** | eBPF sensors build API inventory from traffic; claims no PII leaves the environment; expanding to AI agents/MCP; enterprise pricing ($2,500+/mo per comparison article) |
| **Akamai (Noname)** | Akamai acquired Noname for ~$450M (closed 25 Jun 2024), below Noname's $1B 2021 valuation ([Nasdaq](https://www.nasdaq.com/press-release/akamai-completes-acquisition-api-security-company-noname-2024-06-25)) |
| **Salt, Akto, Traceable** | API discovery and security; consolidation wave reported (Secondary) |

Relevance: they already do **inventory and sensitive-data classification**, which competes with our compliance add-on, but they focus on APIs you expose and on attacks, not on vendor drift.

### 1.8 Data contracts and data observability (closest *analogy*)

| Tool | Why it matters to us |
|---|---|
| **Gable.ai** (founded 2023, Chad Sanderson) | Static code analysis + data contracts in CI; flags code changes that alter data; **PR impact map listing affected services/models/jobs** ([Gable](https://www.gable.ai/how-gable-works)). This is the closest analog to our code-aware impact, but for internal data pipelines, not third-party APIs |
| **Monte Carlo** | Data observability; its commissioned survey is where "74% find out from business stakeholders" comes from |
| **whylogs / WhyLabs** | Statistical profiles so raw data stays in the customer environment; our fingerprint design borrows this idea |

### 1.9 AI/MCP tool scanners

| Tool | What it does |
|---|---|
| **Invariant mcp-scan** (Apr 2025) | Scans MCP configs; **tool pinning by hashing tool descriptions** to detect rug pulls ([Invariant blog](https://invariantlabs.ai/blog/introducing-mcp-scan)). Reported acquisition by Snyk is Unverified |
| **Bellwether**, **DriftCop** (open source) | Snapshot/diff MCP tool schemas; DriftCop signs baselines with Sigstore |

## 2. Feature matrix

✅ = yes (per public material) · ⚠️ = partial · ❌ = no / not found · ? = unclear. **Verify before showing**; this is our reading of vendor pages, not tested. The Seismo column is the **planned design**, not a shipped product.

| Capability | Third-party pollers (FlareCanary etc.) | oasdiff / Optic | Pact / PactFlow | Postman Insights / Treblle | Datadog APM | Keploy / Speedscale / Tusk | Lunar.dev | Gable.ai | **Seismo (planned)** |
|---|---|---|---|---|---|---|---|---|---|
| Watches third-party APIs you consume | ✅ | ❌ | ⚠️ | ❌ | ⚠️ (perf) | ⚠️ (records) | ✅ | ❌ | ✅ |
| Uses real production traffic | ❌ | ❌ | ❌ | ✅ (own APIs) | ✅ | ✅ | ✅ | ❌ | ✅ |
| No spec needed | ✅ | ❌ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Structural drift | ✅ | ✅ | ✅ | ⚠️ | ❌ | ⚠️ | ? | ✅ (internal) | ✅ |
| Behavioural drift (truncation, pagination, limits) | ❌ | ❌ | ❌ | ❌ | ⚠️ (errors/latency) | ❌ | ⚠️ (rate limits) | ❌ | ✅ |
| Semantic / value drift (units, enum meaning) | ⚠️ (DiffMon "value") | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Knows which of *your* code uses each field | ❌ | ❌ | ⚠️ (contracts) | ❌ | ❌ | ❌ | ❌ | ✅ (internal data) | ✅ |
| Opens fix PRs | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Shape-only, privacy-preserving telemetry | n/a | n/a | n/a | ? | ❌ | ⚠️ (redaction) | ❌ | n/a | ✅ |
| Reads Sunset/Deprecation headers + changelogs → code | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ? | ❌ | ✅ (add-on, hackathon) |
| Cross-customer early warning | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Simulated in demo; roadmap |
| Not in the request path | ✅ | ✅ | ✅ | ⚠️ (agent) | ✅ | ✅ | ❌ (proxy) | ✅ | ✅ |
| Zero code install | ✅ | ✅ | ❌ | ⚠️ | ❌ | ✅ (eBPF) | ⚠️ | ✅ | ❌ (1-line SDK; GitHub-only mode works without it) |

## 3. Positioning statement

> For backend teams whose product depends on third-party APIs, **Seismo** is a dependency guard that catches silent changes in shape, behaviour and meaning from real traffic, shows exactly which code they break, and opens a safe fix PR. Unlike schema-drift pollers, it understands values and your code; unlike observability platforms, it understands API contracts; unlike contract testing, it needs nothing from the provider.

## 4. "Isn't this just X?": answers for judges

| Question | Answer |
|---|---|
| "Isn't this FlareCanary / DriftGuard?" | Those poll a URL and diff its shape. We use real traffic, catch value and behaviour changes (×100 units, silent truncation, new enum meaning), know which code uses each field so we only alert when it matters, and ship a fix PR. Polling is one of our inputs (probes), not the product. |
| "Isn't this Pact?" | Pact needs the provider to run your contracts. Stripe won't. We need nothing from the provider. |
| "Isn't this oasdiff/Optic?" | They compare two specs. Third parties often don't publish accurate specs, and specs can't express "amount is now in paise". |
| "Datadog already shows third-party dependencies." | It shows latency and errors for them. A wrong `200 OK` looks healthy to it. |
| "Lunar.dev sees all your third-party traffic." | It's a gateway in your request path; we stay out of it. It manages traffic (limits, retries); we manage contracts and code. Could be a partner/integration. |
| "Keploy/Speedscale record traffic." | For testing your code, with recorded payloads. We monitor the provider's behaviour over time, store only shapes, and fix your code. |
| "Gable does code-aware impact." | For internal data pipelines. We do it for third-party APIs, joined with live traffic. Same insight, different (and larger) surface. |
| "What stops Datadog/Postman from adding this?" | Nothing stops them from adding polling or schema diffs. Harder to copy: the code ↔ field map + fix PRs (needs a GitHub-native workflow), shape-only privacy for regulated customers, and the drift network's data, which grows with every customer. |

## 5. Market signals from acquisitions (Confirmed unless noted)

| Year | Deal | Signal |
|---|---|---|
| Jul 2023 | Postman acquires **Akita** (traffic-based API discovery/monitoring) | API platforms buy observability |
| Apr 2024 | Atlassian acquires **Optic** (API diff/change review) | Dev platforms buy API change management |
| Jun 2024 | Akamai acquires **Noname** (~$450M) | API security/discovery is valuable but consolidating |
| May 2025 | WSO2 acquires **Moesif** (API analytics) | API management vendors buy analytics |
| Jun 2025 | Snyk reportedly acquires **Invariant Labs** | **Unverified**; do not state as fact |

Interpretation: the likely exit paths are API platforms (Postman, Kong, WSO2), developer platforms (Atlassian, GitHub), observability (Datadog, New Relic) and security (Akamai, Snyk). It also means the space is watched by large players.
