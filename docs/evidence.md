# Evidence: what we can say, what we can't

This file condenses the two research PDFs in the root folder and adds web research from 10 Oct 2026. Rule: **every claim on a slide carries its label.** Judges forgive "this is unmeasured"; they don't forgive a made-up number.

- *The Internet After the API: documented evidence* → cases A1–E3 below
- *Cost of API dependency failures: evidence review* → statistics S1–S6, A1–A7, E1–E7, D1–D7 below

Labels: **Confirmed**, **Vendor claim**, **Secondary**, **Unverified**, **Interpretation**, **Assumption** (defined in [README.md](README.md)).

---

## 1. The honest headline

1. **The problem is documented.** Providers publicly announce changes to page sizes, rate limits, pagination, defaults and meaning. Peer-reviewed work shows clients are fragile and that version numbers don't reliably signal breaking changes.
2. **Its cost is not measured.** No peer-reviewed study, regulator filing or provider postmortem quantifies the cost of a consumer being hurt by a changed field meaning, unit, default or status value. This gap is itself a finding: silent errors are, by definition, not logged as incidents.
3. **Public postmortems of silent business damage are rare**, which is why the problem persists unmeasured.

Pitch framing (from the research PDF): *"Providers do document these changes, but only as prose in changelogs. Documented does not mean consumers are told in a form their code can act on."*

---

## 2. Strongest facts for slides

| # | Suggested wording | Label / source |
|---|---|---|
| F1 | "1,970 of 3,075 web APIs did not always flag breaking changes in minor or patch releases; only 517 consistently used major versions" | Confirmed, peer-reviewed. Serbout & Pautasso, ICWE 2024 |
| F2 | "Pipedrive: from 15 Jan 2025, a request for 500 items silently returns at most 100. No error." | Confirmed, Pipedrive changelog |
| F3 | "Lightspeed X-Series: requests above 1,000 return the first 1,000 records and are not rejected (Feb 2020)" | Confirmed, Lightspeed changelog |
| F4 | "IRIS HR: a default page-size change makes `$skip=250` return records 251–1,250, overlapping the next page" | Confirmed (provider's own illustration, not an incident), IRIS announcement Nov 2025 |
| F5 | "Jira Cloud, 6 Oct 2026: `textField = \"urgent\"` now matches any text containing the phrase. Same syntax, broader results." | Confirmed, Jira Cloud changelog. Announced semantic change, not an incident |
| F6 | "AWS S3 SLA: 10%, 25% or 100% credit of one month's charges, the sole remedy, counted only for server errors" | Confirmed, Amazon S3 SLA (updated 28 Nov 2023) |
| F7 | "Cloudflare, 18 Nov 2025: customers on the older proxy saw no HTTP errors, but every request got a bot score of zero" | Confirmed, Cloudflare postmortem. Provider bug, not a contract change |
| F8 | "74% of surveyed data teams said business stakeholders usually find data issues first" | Vendor-commissioned. Wakefield for Monte Carlo, 200 respondents, 2023 |
| F9 | "Same model name, different behaviour: GPT-4 prime identification 84% (Mar 2023) vs 51% (Jun 2023) on a benchmark" | Peer-reviewed (Chen, Zaharia, Zou; HDSR 2024). Critiques of the method exist; say "behaviour drift measured", never "customers lost money" |
| F10 | "About 25% of 48 Android apps crashed under at least one API response mutation; field removal crashed 10" | Confirmed, Espinha, Zaidman, Gross, TU Delft 2014. Old, simulated mutations: evidence of client fragility only |
| F11 | "`Deprecation` HTTP header became an IETF Standards Track RFC in March 2025 (RFC 9745); `Sunset` header RFC 8594 dates from 2019" | Confirmed, RFC Editor |

### Context numbers (related, not API-specific; label them as such)

| # | Wording | Label |
|---|---|---|
| C1 | "57% said their most recent major outage cost over $100,000" | Self-reported, Uptime Institute 2025 survey. IT outages, not API drift |
| C2 | "Over 90% of mid-size and large firms put one hour of downtime above $300,000" | Self-estimated, ITIC 2024 |
| C3 | "Average API uptime fell from 99.66% to 99.46% (about 34 → 55 min of downtime a week), Q1 2024 → Q1 2025" | Vendor data, Uptrends, 2B+ checks. Availability only |
| C4 | "Third-party providers account for about two-thirds of publicly reported outages" | Uptime Institute, 9 years of public outage tracking. Biased toward big providers |
| C5 | "Postman 2019: 22.2% of API work time goes to debugging and manual testing; ~28% saw API breakages monthly, 15.7% weekly" | Vendor survey, 10,000+ respondents, 2019. Almost half said breakage isn't frequent enough to matter; use this honestly |
| C6 | "Postman State of the API 2025: ~82% API-first; 89% use generative AI daily; only 24% design APIs with AI agents in mind" | Secondary (write-ups of the report; figures vary slightly between write-ups) |

### Analogies (always labelled "analogy, not an API")

| # | Wording | Label |
|---|---|---|
| N1 | "Mars Climate Orbiter, 1999: one side sent pound-force seconds, the other expected newton-seconds. Factor 4.45. Nothing errored. ~$125M mission lost." | NASA board report (Confirmed for the cause); cost is Secondary |
| N2 | "Knight Capital, 2012: one flag meant two things on different servers. Over $460M lost in about 45 minutes." | Confirmed, SEC 2013. Internal deployment, not a third-party API |

---

## 3. Documented cases (from the evidence PDF)

| ID | Case | Date | Type | Failure | Use it for |
|---|---|---|---|---|---|
| A1 | Google Cloud Service Control outage | 12 Jun 2025 | Availability | Loud (503s) | Contrast only |
| A2 | Cloudflare bot feature file | 18 Nov 2025 | Availability (borderline) | Loud, but silent wrong bot scores on old proxy | F7 |
| B1 | Shopify REST `page` → cursor | 2019–2020 | Structural | Loud once removed | Pagination change |
| B2 | Grafana Loki error body text → JSON | — | Structural | Reverted as breaking | Error format change is recognised as breaking |
| C1 | Pipedrive page size 500 → 100 | 15 Jan 2025 | Behavioural | **Silent** | ⭐ Truncation detector demo |
| C2 | Lightspeed 10,000 → 1,000 | Feb 2020 | Behavioural | **Silent** | ⭐ Same failure five years earlier |
| C3 | IRIS HR default page size | Nov 2025 | Behavioural | Silent overlap | Pagination-overlap detector |
| C4 | Slack history/replies limits | 29 May 2025 | Behavioural | Mixed (429 + 15-item pages) | Same code behaves differently by install date |
| C5 | Docker Hub pull limits | 2 Nov 2020 | Behavioural | Loud (429) | Rate-limit detector |
| C6 | AWS SDK default S3 checksums vs R2 | Jan–Feb 2025 | Behavioural | Loud | A routine SDK bump changed the wire request |
| D1 | GPT behaviour drift | 2023 | Semantic | **Silent** | ⭐ AI dependencies drift too |
| D2 | Jira text `=` → phrase search | 6 Oct 2026 | Semantic | **Silent** (announced) | ⭐ Fresh, first-party meaning change |
| D3 | Mars Climate Orbiter | 1999 | Semantic (not an API) | Silent | Analogy |
| E1 | Jira `/search` removal | announced 31 Oct 2024 | Removal (+pagination) | Loud, then silent in one consumer | ⭐ Removal + pagination + MCP in one product |
| E2 | Twitter/X free API, v1.1 | 2023 | Removal | Loud | Access terms change abruptly |
| E3 | Spotify Web API endpoints | 27 Nov 2024 | Removal | Loud (404) | Removal with no notice period |

**Provider policy documents** (supporting, not incidents): Circle lists "change what an existing value means" as breaking and tells integrators not to trigger irreversible actions on an unfamiliar status. Moov classes adding a new status value as breaking because integrations "fall through a catch-all error". Circle and 8x8 class adding enum values as backward-compatible. **Providers disagree on what is breaking**, which is an argument for consumer-side checks.

**The three strongest cases for the pitch** (the research PDF's recommendation):
1. Pipedrive (C1) + Lightspeed (C2): two official changelogs, five years apart, same silent truncation.
2. Jira `/search` removal (E1) + Jira text-query change (D2): structure, pagination, removal, MCP and meaning in one vendor.
3. GPT drift (D1): peer-reviewed silent drift behind an unchanged interface.

---

## 4. Do NOT say

| Do not say | Why |
|---|---|
| "API failures cost businesses $X an hour/year" (ITIC, New Relic, Splunk, Gartner, Uptime figures) | Those surveys measure IT downtime in general, not API failures |
| "$5,600 a minute" or any single per-minute figure | Gartner number seen only second-hand; method untraceable |
| "$300B / $85B lost to bad code" as an API cost | Stripe 2018 salary extrapolation about all code maintenance |
| Gartner's $12.9M or IBM's $3.1T as the cost of API drift | Unverified definitions; not about APIs |
| "The AWS outage cost $500–650M" as fact | One insurer's model; another said $38–581M. Infrastructure outage, not drift |
| "31% of revenue is lost to bad data" | The survey says revenue "subjected to" issues, not lost |
| "Developers spend a third of their time on API integrations" | Stripe/Sonar cover all maintenance; Nylas says "up to five hours a week", a ceiling |
| "Silent semantic API drift costs businesses $X" | No reliable data exists; say it is unmeasured |
| "Breaking changes are rampant and hurt most clients" | 2022 Maven replication: 83.4% of upgrades follow semver, 7.9% of clients affected. Evidence is mixed |
| Knight Capital or Mars Climate Orbiter as API incidents | Analogies only |
| "GPT-4 got worse, costing customers" | Benchmark accuracy only; critiques exist |
| Vendor figures like $5,800 per integration, 4 hours per breaking change, $30k–$100k/yr per integration | Unsourced marketing numbers |
| **"41% of APIs see undocumented schema changes within 30 days"** | Circulates in 2026 vendor blogs attributed to KushoAI; we could not find the original report (Unverified) |
| **"Drift issues take 15–20 developer hours to diagnose"** | Stated in a DriftGuard blog with no source (Unverified) |
| "We are the first to detect third-party API drift" | False. Several 2026 tools poll third-party APIs against baselines (see [competitors.md](competitors.md)) |
| "Snyk acquired Invariant Labs" as fact | Seen only on one secondary site (Unverified) |

---

## 5. Our own numbers: collect them during the hackathon

The research PDF's advice: *"If your team needs a number, the defensible route is to collect it."* Run a short survey (Google Form) with 20–40 developers: seniors, interns, startup friends, Discord/Telegram dev communities. State the sample size on the slide.

**Survey questions (keep it under 2 minutes):**
1. How many third-party APIs does your main project call? (0 / 1–5 / 6–15 / 16+)
2. In the last 12 months, did a third-party API change in a way that broke or degraded your app? (Yes / No / Not sure)
3. If yes, what changed? (Field renamed or removed / Type changed / Limit or page size / Pagination / Rate limit / Meaning or units / Endpoint removed / Other)
4. How did you find out? (Our monitoring / Error logs / A customer or user / A teammate / Provider email or changelog / Other)
5. How long between the change and you noticing? (< 1 hour / same day / 1–7 days / > 1 week / never sure)
6. How long did the fix take? (< 1 hour / a few hours / 1–3 days / longer)
7. Would you install a tool that opens a PR when an API you depend on changes? (Yes / Maybe / No) and why not, if no.
8. Would your team pay for it? (Yes / Maybe / No)

Slide wording example: *"In our survey of 32 developers (Oct 2026, small sample), N said they found out about their last breaking API change from a user."*

---

## 6. Gaps nobody has measured (and we can say so)

- Direct cost of semantic API changes
- Failed transactions caused by API drift
- Engineering hours spent on broken third-party integrations
- **Mean time to detect a silent change.** Detection figures in public data are for loud outages or for data-quality incidents.

*Why the gap exists (Interpretation):* consumers rarely publish postmortems naming a provider; providers announce changes but not their effects; silent errors never become incidents. A product that detects drift across many customers would be the first to produce this data (see [market-gap.md](market-gap.md)).
