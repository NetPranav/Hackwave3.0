# Problem

## 1. The problem in one paragraph

Modern apps are assembled from APIs they don't control: payments, identity, shipping, maps, messaging, LLMs. Providers change those APIs, sometimes with notice buried in a changelog and sometimes without. The dangerous changes are not outages, because uptime monitors catch outages. The dangerous ones are **silent**: the API still returns `200 OK` with valid JSON, but a field was renamed, a limit shrank, pagination changed, or a value now means something else. Nothing crashes. Dashboards stay green. The app quietly shows wrong names, wrong totals and missing orders, and **the team finds out from a customer**.

## 2. Who has this problem

| Persona | Situation | What they feel today |
|---|---|---|
| **Backend developer** in a payment-, commerce- or integration-heavy product | Owns integrations with 10+ external APIs | Learns about changes from bug reports, then hunts through logs late at night |
| **On-call engineer** | Gets paged when something is "wrong but not down" | First question every time: *"did our deploy break it, or did they change something?"* |
| **Engineering manager / CTO** | Accountable for reliability and customer trust | Has no inventory of which external APIs the product depends on, or what each one touches |
| **Security / compliance lead** (secondary) | Must know which vendors receive personal data | No live data-flow map; maintained by hand in spreadsheets |

How many integrations is "integration-heavy"? Pandium's data on the 1,000 fastest-growing SaaS companies puts the **median at 15 integrations per company** (Secondary, via [Chief Martec](https://chiefmartec.com/2020/05/proof-platform-saas-apps-median-15-integrations/), 2020 data), and the average public SaaS company has about 350 (Secondary, via [SaaStr](https://www.saastr.com/the-top-saas-companies-have-an-average-of-350-integrations)). These count integrations a product *offers*, not APIs it *consumes*, so treat them as a rough scale indicator only.

## 3. The kinds of change (taxonomy)

This taxonomy comes from the research teammate's evidence review (*The Internet After the API: documented evidence*, root folder). Each type needs a different detector.

| Type | What changes | Loud or silent | Documented example | Who catches it today |
|---|---|---|---|---|
| **A. Availability** | Service errors or goes down | Loud | Google Cloud Service Control, 12 Jun 2025; Cloudflare, 18 Nov 2025 | Uptime monitors. **Out of our scope**; used only as contrast |
| **B. Structural** | Field renamed, removed or retyped; error body format changes | Usually loud, sometimes silent | Shopify REST `page` → cursor pagination (2019–2020); Grafana Loki error body text → JSON (reverted as breaking) | Spec diff tools, contract tests, schema-drift pollers |
| **C. Behavioural** | Same shape; limits, defaults, pagination or rate limits change | **Silent** | Pipedrive max page size 500 → 100 with no error (effective 15 Jan 2025); Lightspeed 10,000 → 1,000 (Feb 2020); IRIS HR default change causes page overlap (announced Nov 2025); Slack history limits for new non-Marketplace apps (29 May 2025) | Almost nobody |
| **D. Semantic** | Same shape and type, different meaning | **Silent** | Jira text `=` became phrase search (changelog 6 Oct 2026); "same" GPT model behaved differently March vs June 2023 (Chen, Zaharia, Zou) | Nobody, until a customer notices |
| **E. Removal** | Endpoint removed or access cut | Loud, but a consumer can turn it silent | Jira `/rest/api/3/search` removal: a user issue on Atlassian's MCP server reports it returned `issues: []` for every query (Unverified, user report) | Error monitors, if the consumer surfaces the error |

**Our core value is in C and D**, with B handled well and E's "loud turned silent" case covered. A is someone else's job.

### Worked examples for the demo (illustrative, not real incidents)

| Change | Example | What the user sees |
|---|---|---|
| Renamed field | `name` → `display_name` | Blank customer name on invoice |
| Changed default or limit | Page size 50 → 20 | Orders "missing" from the list |
| New error format | `{"error": "..."}` → `{"errors": [...]}` | Error message shows `undefined` |
| Pagination change | page numbers → cursor tokens | Same first page shown forever |
| Rate limit | New 429s after 100 calls/min | Intermittent failures under load |
| Meaning change | Amount in rupees → amount in paise | ₹49,900 shown instead of ₹499 |

Note: **no public incident exists for the rupees → paise case**. It is an illustration. The nearest real units case is Mars Climate Orbiter (1999), which is an analogy and not an API. See [evidence.md](evidence.md).

## 4. Why existing defences miss it

| Defence | Why it misses silent drift | Evidence |
|---|---|---|
| **Uptime and error monitors** | They look for errors and latency. A wrong `200 OK` looks healthy | Uptrends measures API *availability*, and synthetic checks do not test correctness (Vendor data, Uptrends *State of API Reliability 2025*, cited in the cost evidence PDF) |
| **SLAs** | Remedies count only server errors | The AWS S3 SLA counts only `InternalError` and `ServiceUnavailable`; the remedy is a 10% / 25% / 100% credit of one month's charges (Confirmed, Amazon S3 SLA) |
| **Version numbers** | Providers don't reliably bump major versions for breaking changes | Of 3,075 OpenAPI-described web APIs, 1,970 did not always warn clients of breaking changes in minor or patch releases; only 517 consistently used major versions (Confirmed, Serbout & Pautasso, ICWE 2024) |
| **Changelogs** | Written as prose for humans; nothing in the consumer's code can act on them | Pipedrive, Lightspeed, IRIS and Jira all announced their changes in changelogs (Confirmed) |
| **Deprecation headers** | Standards exist but almost no client reads them | `Sunset` header, [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594) (2019, Informational); `Deprecation` header, [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745) (Mar 2025, Standards Track) |
| **Contract tests (Pact)** | Need the provider's cooperation; third-party providers won't run your contracts | Consumer-driven contracts are designed for teams that control both sides ([Fowler, Tolerant Reader](https://martinfowler.com/bliki/TolerantReader.html)) |
| **Spec diff tools (oasdiff, Optic)** | Need two spec files; can't see whether the live API matches the spec, and can't see meaning | [oasdiff](https://github.com/oasdiff/oasdiff) compares specs only |
| **Schema-drift pollers (2026 wave)** | Catch structural changes on a schedule; mostly blind to values, behaviour and your code | See [competitors.md](competitors.md) |
| **Data quality teams** | Find problems late, usually after business users do | 74% of surveyed data professionals said business stakeholders find data issues first "all or most of the time"; average resolution 15 hours (Vendor-commissioned, Wakefield for Monte Carlo, 200 respondents, 2023) |

## 5. How teams solve it today

Manually:
1. Read provider changelogs (if they remember to).
2. Write contract tests or snapshot tests for a few critical endpoints.
3. Set up uptime monitors.
4. Fix the code **after** something breaks, usually after a customer complaint.

The gap: **detection, impact analysis and the fix are all manual, and detection is triggered by customers.**

## 6. What the judges look for

From `PS3_Overview.md` §7 (a paraphrase; the official PS PDF is not in this folder yet, see [`../MEMORY.md`](../../MEMORY.md)):

1. Accurate change detection, **including behavioural changes**
2. Dependency mapping
3. Semantics-aware compatibility fixes
4. Regression validation
5. Safe handling when automatic repair is uncertain

The PS also says not to rely only on documented schemas, so behavioural and meaning changes must be caught from observed behaviour.

## 7. Scope for the hackathon

| In scope | Out of scope |
|---|---|
| JSON over HTTP (REST) | GraphQL, gRPC, SOAP (roadmap) |
| Outbound calls from a backend to third-party APIs | Inbound traffic to the customer's own API (other tools do this) |
| 6–8 change types done well | Every possible change type |
| One SDK language (Node.js for the demo app) and one code-scan language | Polyglot support |
| Fake services we control (v1/v2 switches) | Live third-party production APIs in the demo |

## 8. Problem statement we will say on stage

> "Third-party APIs change behaviour and meaning without failing. Monitors watch for errors, SLAs pay for errors, and version numbers don't reliably flag breaking changes. So silent breakage is found by customers, not tools. We detect it from real traffic, show exactly which code it breaks, and ship a safe fix."
