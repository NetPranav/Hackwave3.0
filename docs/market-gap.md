# Market and gap analysis

## 1. Market size (honestly labelled)

Paid market reports disagree because each defines "the market" differently. Use ranges, name the source type, and never present one number as fact.

| Market | Estimate | Source type | Label |
|---|---|---|---|
| API monitoring platforms | ~$1.8B (2025) → ~$6.2–6.4B (2034), ~14–15% CAGR | Paid market reports, seen via summaries (Market Intelo; a startup-idea site) | Secondary; definitions differ |
| API observability and testing software | ~$3.1B (2025) → ~$6.3B (2031), ~12.7% CAGR | Seen via a secondary summary | Secondary; weak source |
| API management (gateways, portals, analytics) | 2025 estimates range from **~$5B to ~$12.7B**; forecast CAGRs **~12% to ~32%** depending on the firm | Business Research Co., SNS Insider, KBV, Custom Market Insights, Kings Research, Technavio | Secondary; scope varies widely |

**Slide wording:** *"API monitoring alone is estimated around $1.8B in 2025 and growing ~14% a year (paid market reports; definitions vary). We are a new slice of it: contract and semantic monitoring for APIs you consume."*

### Bottom-up sizing (assumptions, for planning only)

A top-down number is easy to quote and hard to defend. A bottom-up model shows judges you understand the business. Every input below is an **assumption to validate**:

```
Target companies (integration-heavy SaaS/fintech/commerce, 20–500 engineers)   N   = to research (e.g. via LinkedIn/Crunchbase filters)
External APIs per company                                                       k   ≈ 15  (rough proxy: Pandium median of integrations offered; Secondary)
Price per monitored API per month                                               p   ≈ $3–10 (Assumption, anchored to competitor pricing)
Annual revenue per customer                                                     ARPA = k × p × 12 ≈ $540–1,800 + platform fee
Illustrative: 2,000 paying customers × $1,800  ≈ $3.6M ARR                      (arithmetic, not a forecast)
```
The point of the slide: revenue scales with the number of APIs a customer depends on, which tends to grow over time.

## 2. Why now

| Trend | Evidence | Label |
|---|---|---|
| Products are built from APIs | ~82% of organisations report some API-first adoption (Postman State of the API 2025) | Secondary (write-ups of the report) |
| AI is accelerating integration count | 89% of developers use generative AI daily; only 24% design APIs with AI agents in mind (same report) | Secondary |
| AI dependencies drift silently | "Same" model name behaved differently March vs June 2023 (Chen, Zaharia, Zou) | Peer-reviewed; benchmark only |
| Agents call tools via MCP; tool definitions can change under them | Invariant Labs demonstrated tool poisoning/rug pulls (Apr 2025) | Confirmed demo, not a production incident |
| Providers still don't signal breaking changes reliably | 1,970 of 3,075 APIs didn't always flag breaking changes in minor/patch releases (ICWE 2024) | Confirmed |
| Deprecation is becoming machine-readable | `Deprecation` header RFC 9745 (Standards Track, Mar 2025); `Sunset` RFC 8594 (2019) | Confirmed |
| Data-flow mapping becomes mandatory work in India | DPDP Rules notified Nov 2025; main duties phase in ~May 2027; guides recommend starting with data-flow mapping | Secondary; verify dates |
| Basic drift monitoring got cheap and crowded (2026) | 8+ small polling tools at $12–$149/mo entry | Vendor claims via a competitor's article |

The last row matters: **the basic category exists and customers are already buying it**, which validates demand, and it pushes us to differentiate on what those tools can't do.

## 3. The gaps (what we did not find in any single tool)

All five are phrased as "not seen in our research", **not** "nobody does it". Re-check before claiming.

| # | Gap | Who comes closest | Why it's hard |
|---|---|---|---|
| G1 | **Passive, privacy-preserving profiling of outbound third-party responses from real traffic** (shape + statistics only; raw values stay on the customer's server) | whylogs (for ML data); Keploy/Speedscale/Tusk (record outbound traffic, with redaction) | Needs SDK work per language and careful privacy design |
| G2 | **Behavioural and semantic detectors** for consumed APIs: unit changes (×100), new enum meaning, silent truncation, pagination overlap, empty-success | DiffMon mentions "value changes"; others are structural | Needs value statistics, not just shapes; needs care to avoid false alarms |
| G3 | **Code-aware severity**: a change matters only if your code reads the field; how it reads it (display vs money vs branching) sets the severity | Gable.ai, for internal data pipelines | Needs a code map (GitHub integration + static analysis) joined with runtime data |
| G4 | **Auto-fix PRs with a review ladder** (fallback / transform / behaviour) for third-party drift | Dependabot does PRs for library versions, not API behaviour | Needs adapters, validation and a trust model |
| G5 | **Cross-customer drift network**: one customer's observation warns the rest; produces the first dataset on drift frequency and time-to-detect | Not seen | Needs many customers (a cold-start problem) and strict privacy |

Plus one **research gap** we can point at: the cost-evidence review found **no measurement of mean time to detect a silent API change**, nor of failed transactions or engineering hours caused by API drift. A product that sees drift across many customers would be the first to measure it (see [evidence.md](evidence.md) §6).

## 4. Why the gaps exist

1. **Wrong vantage point.** Spec tools see specs; pollers see one synthetic request; observability tools see errors and latency; only the consumer's runtime sees real responses *and* the code that uses them.
2. **Wrong owner.** Providers own the change; consumers own the damage; neither owns the contract in between.
3. **Silent errors aren't incidents.** Nobody files a postmortem for "invoice showed ₹49,900 for three days", so nobody measures it, so nobody builds for it.
4. **Privacy fear.** Sending production payloads to a vendor is a hard sell, especially in payments. Shape-only telemetry removes the objection.

## 5. Threats to the gap

| Threat | Likelihood | Our response |
|---|---|---|
| Datadog / New Relic add payload-shape monitoring to APM | Medium | Code ↔ field map, fix PRs and network data are not a checkbox feature; position as complementary |
| Postman Insights extends to outbound calls | Medium | Postman is provider/design-centric; we're consumer-centric and GitHub-native |
| Lunar.dev adds drift detection at the gateway | Medium | We're out of the request path and code-aware; possible integration partner |
| A polling tool adds code awareness | Medium | Move fast on semantic detectors and the network effect |
| Providers improve change signalling (RFC 9745 adoption) | Low–Medium, slow | Good for us: we read those headers and turn them into PRs |
