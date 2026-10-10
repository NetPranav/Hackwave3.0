# Add-ons: adjacent problems for the same users

Rule for an add-on: it must solve a **real problem for the same people** (backend devs, on-call engineers, eng managers, compliance leads) and **reuse data we already collect**. No AI gimmicks.

For each add-on we state honestly whether something similar already exists (from our research in [competitors.md](competitors.md)).

## Summary

| # | Add-on | Problem it solves | Reuses | Effort (hackathon) | Already exists elsewhere? | Recommendation |
|---|---|---|---|---|---|---|
| 1 | **Changelog & deprecation radar** | Changes are announced in prose nobody's code can act on | Code map, D13 header detector | Medium | Partly (changelog trackers for docs; Bump.sh for your own specs). Matching third-party notices to *your* code: not seen in our research | ⭐ Build |
| 2 | **"Us or them?" incident triage** | On-call's first question during an incident | Drift timeline + GitHub deploys/commits | Low–Medium | Observability tools mark deploys; joining with third-party drift: not seen | ⭐ Build if time |
| 3 | **Drift network + public drift feed** | One customer sees a change before others | All drift events | Medium (simulate with 2 apps) | Not seen in our research | ⭐ Demo it (simulated) |
| 4 | **API lockfile + CI gate** | Developers want changes reviewed in git like dependencies | Baselines | Low | Yes: DriftGuard ships a GitHub Action; snapshot CLIs exist | Should (not a "novelty" claim) |
| 5 | **MCP / AI tool definition pinning** | Tool schemas and descriptions change under AI agents | Fingerprints of tool lists | Low | Yes: Invariant mcp-scan (hashing tool descriptions), Bellwether, DriftCop, FlareCanary | Could; integrate, don't claim |
| 6 | **Upgrade preview** | Moving to a new provider API version is scary | Recorded shapes, adapters, tests | High | Stripe offers upgrade guidance for its own API; generic cross-provider: not seen | Later |
| 7 | **Compliance data-flow map** | Must know which vendors receive personal data (DPDP, GDPR, SOC 2) | Code map + request-side fingerprints | Medium | API security tools (Levo, Akto, Akamai/Noname) do discovery and data classification, mostly for your own APIs | Later (strong business case) |
| 8 | **Webhook drift** | Inbound provider webhooks (payments, shipping) drift too | Same detectors on inbound requests | Low–Medium | Not seen as a focus | Could |
| 9 | **Mocks from recorded shapes** | Third-party sandboxes are flaky | Fingerprints | Medium | Yes: Keploy, Speedscale, Tusk Drift record traffic into mocks | Later; differentiate by "shape-only, privacy-safe" |
| 10 | **Rate-limit & cost forecaster** | Surprise 429s and API bills | Call counts, rate-limit headers | Low | Partly: Lunar.dev egress gateway does rate limiting/quotas | Could |

---

## 1. Changelog & deprecation radar ⭐

**Problem.** Providers *do* announce changes, as prose in changelogs, emails and blog posts. The research teammate's review shows this repeatedly (Pipedrive, Lightspeed, IRIS, Slack, Jira). Documented does not mean actionable.

**What it does.**
- Watches changelogs, OpenAPI specs and status pages of the APIs found in your repo (RSS where available, otherwise scheduled fetch + diff).
- An LLM turns each new entry into a structured change: `{service, endpoints, fields, change_type, effective_date}`.
- Joins that with the code map: *"Pipedrive caps `limit` at 100 from 15 Jan. You call `GET /files?limit=500` in `sync.ts:42` and `reports.ts:88`. Suggested PR: paginate until empty."*
- Also reads `Sunset` ([RFC 8594](https://www.rfc-editor.org/rfc/rfc8594)) and `Deprecation` ([RFC 9745](https://www.rfc-editor.org/rfc/rfc9745), Standards Track since March 2025) headers from live traffic, plus `Link rel="deprecation"`.
- Graph shows a clock badge with the date on affected endpoints.

**Why it matters.** It turns a reactive tool into a proactive one: you get the PR **before** the change lands.

**Demo.** A fake "changelog page" for the orders service announces the limit cap; within seconds the dashboard shows the matched code and a proposed PR, before flipping the switch.

## 2. "Us or them?" incident triage ⭐

**Problem.** Every incident starts with *"did our deploy break it, or did the provider change something?"* Teams waste the first hour finding out.

**What it does.** One timeline with: your deploys and merged PRs (from the GitHub App), third-party drift events (from detectors), and error-rate changes (from the SDK's status codes).
*"Checkout errors started 14:02. Your last deploy was 11:30. Payments `amount` changed units at 13:58 → most likely upstream."*

**Why only we can do it.** It needs both GitHub history and third-party traffic data. Tools that have one rarely have the other.

## 3. Drift network + public drift feed ⭐ (the moat)

**Problem.** Providers often roll out changes gradually, so some customers see a change before others. Today each team discovers it alone.

**What it does.**
- When customer A's SDK sees `api.razorpay.com GET /payments/{id}` change shape, every other customer calling the same endpoint gets an early warning **before their own traffic hits it**.
- Only the **public API's shape change** is shared (field paths, types, detector result). Never customer data, never values. Opt-in, anonymous.
- **Public drift feed:** one page per popular API ("Changes observed in the Stripe API this month"). Free, indexable, bookmarkable. Marketing engine and community resource.
- Over time, the network produces the first real data on **how often APIs drift and how long it takes teams to notice**: the gap the cost-evidence review says nobody has measured (see [market-gap.md](market-gap.md)).

**Hackathon demo.** Two copies of the demo shop (App A and App B) on the same fake payments API. Flip payments v2 for App A's traffic only; App B shows "⚠ Early warning: 1 other team saw this change 40 s ago" before it gets any v2 traffic.

**Risk.** Privacy perception. Mitigation: opt-in, only public endpoints, clear published data schema, k-anonymity (only share after ≥ 3 customers observe it, in production).

## 4. API lockfile + CI gate

**What.** `seismo.lock` committed to the repo records the observed contract of every external API (shape fingerprints, no data). A CI check runs probes and fails if live behaviour differs. Accepting a change = committing the lockfile update, so the history lives in git.

**Honest status.** Snapshot-and-diff with CI exit codes exists (DriftGuard's GitHub Action, open-source snapshot CLIs). Our version is distinct only in that the lockfile is **generated from real traffic + code map**, not hand-pointed URLs. Present it as a convenience, not an innovation.

## 5. MCP / AI tool definition pinning

**What.** AI agents call tools through MCP servers. Tool schemas and descriptions can change after approval ("rug pull", demonstrated by Invariant Labs in April 2025). Pin tool definitions; alert on change; map which agent workflows use which tools.

**Honest status.** Covered by Invariant's mcp-scan (hashes tool descriptions to detect changes), Bellwether and DriftCop (snapshot/diff MCP schemas), and FlareCanary (claims MCP schema monitoring). Only build if the official PS explicitly requires MCP; even then, integrate the idea with our drift engine rather than claim novelty. (Snyk's reported acquisition of Invariant is Unverified.)

## 6. Upgrade preview

**What.** Before moving to a provider's new API version (e.g. a new dated Stripe version), replay recorded request shapes against the new version in sandbox, diff responses with our detectors, generate adapter changes and a PR. A week-long migration becomes a reviewable PR.

**Context.** Stripe pins each account to an API version and lets developers test a newer one per request with a header (Secondary). That makes version-by-version previews technically feasible for providers that support it.

## 7. Compliance data-flow map

**What.** Extend fingerprints to **requests** we send: detect personal-data field classes (email, phone, PAN, Aadhaar-like patterns, address) per vendor. The graph becomes an auditor-readable map: *"These 6 vendors receive customer phone numbers."*

**Why it pays.** Security and compliance budgets are larger than dev-tools budgets. India's DPDP Rules were notified in November 2025, with main obligations phasing in around **May 2027**; practitioner guides recommend starting with **data-flow mapping** (Secondary; verify against the Gazette/MeitY text). GDPR records of processing and SOC 2 vendor management ask similar questions.

**Honest status.** API security platforms (Levo, Akto, Akamai after acquiring Noname for ~$450M in 2024) discover APIs and classify sensitive data, mostly for APIs you expose. Outbound-vendor focus + code links is our angle.

## 8. Webhook drift

Same detectors on **inbound** webhook payloads (payment captured, shipment updated). Webhooks are third-party data entering your system; they drift just like responses. Cheap: wrap the webhook route handler with the SDK.

## 9. Mocks from recorded shapes

Generate a local mock server from stored fingerprints (types, formats, ranges, enums; fake values). Keploy, Speedscale and Tusk Drift already turn recorded traffic into mocks/tests. Our angle: privacy-safe (built from shapes, never stored real payloads) and always current with the latest accepted baseline.

## 10. Rate-limit & cost forecaster

From call counts and `x-ratelimit-*` headers: *"At current growth you hit Maps' quota Thursday"*, *"429s up 3× since Slack's change."* Lunar.dev already manages egress rate limits and quotas as a gateway; ours is a forecast without sitting in the request path.

---

## Recommendation for the hackathon

1. **Core** (must): detection + code-aware severity + fix PRs + graph.
2. **Add-on A:** Changelog & deprecation radar (proactive story, evidence-backed).
3. **Add-on B:** Drift network, simulated with two apps (memorable demo moment, moat story).
4. If ahead: "Us or them" on the timeline.

Everything else goes on the roadmap slide.
