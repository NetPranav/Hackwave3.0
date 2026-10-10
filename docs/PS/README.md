# Docs: PS 3 "The Internet After the API"

HackWave 3.0 · Resilient Infrastructure · Working product name: **Seismo** (placeholder; check name availability before using it publicly)

> **One line:** Your API is up, your monitor is green, and your app is still silently wrong. Seismo watches the third-party APIs your code depends on, catches silent changes in shape, behaviour and meaning, shows exactly which code they break, and opens a safe, reviewable fix PR. When it isn't sure, it asks a human.

> **Positioning:** "Dependabot for the APIs you depend on."

---

## Reading order

| # | File | What it answers |
|---|---|---|
| 1 | [problem.md](problem.md) | What exactly is broken in the world, who feels it, and why current tools miss it |
| 2 | [evidence.md](evidence.md) | Which facts we can say on stage, which we must not, and how we label them |
| 3 | [solution.md](solution.md) | What we build, how a user experiences it, and how fixes stay safe |
| 4 | [architecture.md](architecture.md) | How live detection works from scratch: capture, fingerprints, detectors, severity, data model, stack |
| 5 | [features.md](features.md) | MVP scope with acceptance criteria, dashboard screens, graph spec |
| 6 | [add-ons.md](add-ons.md) | Adjacent problems for the same users that reuse our data |
| 7 | [competitors.md](competitors.md) | Every relevant tool we found, a feature matrix, and how to answer "isn't this just X?" |
| 8 | [market-gap.md](market-gap.md) | Market size (honestly labelled), the gaps we found, why now |
| 9 | [advantages-disadvantages.md](advantages-disadvantages.md) | Real strengths, real weaknesses, design trade-offs, risk register, SWOT |
| 10 | [business-model.md](business-model.md) | Startup view: customers, go-to-market, pricing, moats, validation |
| 11 | [roadmap-demo.md](roadmap-demo.md) | 10-day build plan, demo script, fake services, judge Q&A, post-hackathon roadmap |
| 12 | [sources.md](sources.md) | Every source used, grouped and labelled |

Project-level files at the repo root:
- [`../AGENTS.md`](../../AGENTS.md): instructions for AI coding agents and teammates working in this repo
- [`../MEMORY.md`](../../MEMORY.md): decision log, open questions, key facts
- [`../PS3_Overview.md`](../../PS3_Overview.md): the original overview this folder expands on
- The two evidence PDFs in the root (the research teammate's reviews) are the base for [evidence.md](evidence.md)

---

## Evidence labels used everywhere

Every number or claim in these docs carries one of these labels:

| Label | Meaning |
|---|---|
| **Confirmed** | Stated in a primary source (provider changelog, RFC, peer-reviewed paper, regulator, official postmortem) |
| **Vendor claim** | Stated by a company about itself or its own product; likely biased |
| **Secondary** | Reported by a third party (news, directory, blog) and not checked against the original |
| **Unverified** | Seen only second-hand, or no source found; do **not** put it on a slide |
| **Interpretation** | Our reading of what a fact implies |
| **Assumption** | A number we chose for planning; to be validated |

Research date for web sources: **10 Oct 2026**. Re-check figures before any public slide.

---

## The idea in 60 seconds

1. **Install a GitHub App.** It scans the repo and maps every external API call: endpoint, fields read, where, and in which user workflow.
2. **Add a one-line SDK** that wraps the HTTP client. It never changes responses, never blocks the app, and never sends a record's values out. It sends only **shape and statistics** (types, presence, batch percentiles, customer-salted hashes, list sizes).
3. **Learn a baseline** per endpoint, then compare a rolling window against it with small, explainable detectors: missing field, rename, type change, **unit change (×100)**, **new enum value**, **silent truncation**, **pagination overlap**, error-shape change, rate-limit change, and `Sunset`/`Deprecation` headers.
4. **Score severity by code usage.** A change to a field nobody reads is logged. A change to `amount` used in checkout pages someone.
5. **Fix with a pull request** using the Tolerant Reader pattern: add a fallback, never replace. Unit or meaning changes go to human review with an explanation.
6. **Show it all** in an Obsidian-style graph: API → endpoint → field → code → workflow, coloured green/amber/red.

What makes it different from the cheap 2026 "schema drift monitors" (see [competitors.md](competitors.md)): **real traffic instead of polling only**, **semantic and behavioural detectors**, **code-aware severity**, **auto-fix PRs with a review ladder**, and later a **cross-customer drift network**.

---

## Glossary

| Term | Meaning |
|---|---|
| **Drift** | Any change in an external API's shape, behaviour or meaning compared with its learned baseline |
| **Structural drift** | Field added, removed, renamed or retyped |
| **Behavioural drift** | Same shape, different limits, defaults, pagination, rate limits or latency |
| **Semantic drift** | Same shape and type, different meaning (units, enum meaning, query semantics) |
| **Baseline** | The learned "normal" profile of an endpoint |
| **Fingerprint** | Shape + statistics of one response, computed on the customer's server |
| **Code map** | Which functions and workflows read which fields, from static analysis |
| **Tolerant Reader** | Read only what you need; tolerate unknown or missing fields ([Fowler, 2011](https://martinfowler.com/bliki/TolerantReader.html)) |
| **Fix ladder** | Fallback (auto-safe) → transform (needs confidence) → behaviour change (human) |
| **Drift network** | Cross-customer early warning: drift seen by one customer warns all others using the same API |
