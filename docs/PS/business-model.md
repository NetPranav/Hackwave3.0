# Business model: thinking of Seismo as a startup

All prices and conversion numbers below are **assumptions** to validate with real users, not findings.

## 1. Customer

### Ideal customer profile (ICP)
- **Company:** SaaS, fintech, e-commerce, logistics or marketplace product; Seed to Series C; 10–300 engineers.
- **Dependency profile:** 10+ third-party APIs in the critical path (payments, KYC, shipping, messaging, maps, LLMs).
- **Pain trigger:** at least one "silent wrong data" incident in the past year found by a customer.
- **India wedge (hypothesis):** Indian fintech and commerce products depend on payment aggregators, shipping aggregators, GST/e-invoicing, KYC and Account Aggregator APIs. Developers often complain informally about changelog and documentation quality in this ecosystem. **Validate with interviews before putting it on a slide.**

### Personas and what each buys

| Persona | Role in the deal | What they care about | What we show them |
|---|---|---|---|
| Backend developer | **User, champion** | Not getting blindsided; less debugging | PR with the fix and the exact code impact |
| On-call engineer | User | Fast answer to "us or them?" | Timeline with deploys + drift |
| Eng manager / CTO | **Buyer** | Reliability, customer trust, fewer escalations | Dependency map, incidents prevented, time saved |
| Security / compliance lead | Second buyer (later) | Vendor inventory, personal-data flows, audits | Data-flow map, audit log, exports |

## 2. The "insurance problem"

Drift is **rare but painful**. Products that only help on bad days are bought like insurance, and insurance is hard to sell to developers. The Postman 2019 survey even found almost half of respondents said API breakage isn't frequent enough to matter (Vendor survey).

So the product must be useful **every week**, with drift protection as the reason to keep paying:

| Daily/weekly value (gets them in) | Rare-event value (makes them pay) |
|---|---|
| Live map of every API you depend on | Silent drift caught in minutes, not days |
| Deprecation and changelog radar | Fix PRs with impact analysis |
| Weekly "dependency health" digest | Drift-network early warnings |
| Rate-limit and cost forecasts | "Us or them" during incidents |
| Compliance data-flow map | Audit-ready history |

## 3. Go-to-market (product-led)

### Funnel
```
Discover        →  Install GitHub App   →  See dependency map  →  Add SDK       →  First real drift caught  →  Upgrade
(feed, content,    (2 min, no prod         ("aha #1": "we call     (1 line, open    ("aha #2")                  (team grows,
 GitHub Mktplace)   access)                 27 APIs?!")             source)                                      more APIs)
```

### Channels
1. **GitHub Marketplace** listing: developers find GitHub Apps where they already work.
2. **Public drift feed:** a page per popular API showing changes observed this month (from probes + opt-in network). Search traffic, bookmarks, newsletter sign-ups. Comparable to how status aggregators attract visitors.
3. **Open-source SDK + lockfile format:** trust and contributions; the SDK is the part that touches production, so it must be readable.
4. **"State of API Drift" report** (quarterly, from anonymised network data): becomes the source of the numbers the research review couldn't find. PR and backlinks.
5. **Changelog-to-PR bot for popular APIs:** "When Pipedrive/Shopify/Razorpay announce a change, get a PR". Each provider announcement is a marketing moment.
6. **Community:** India dev communities (Discord/Telegram, college tech clubs, hackathons), Dev.to/Hashnode write-ups of real drift caught (with permission).
7. **Design partners:** 5–10 startups get the paid tier free for 3 months in exchange for weekly feedback and a case study.

### Activation metrics
- **Aha #1:** dependency map rendered (target: 70% of installs within 10 minutes)
- **Aha #2:** first drift event on a field the customer's code actually reads
- **North-star metric:** *silent drift events caught on used fields before customer impact* (per month)

## 4. Pricing (hypotheses)

Competitor anchors (vendor-stated, via a competitor's comparison, Apr 2026): third-party pollers $12–$149/mo entry; Treblle paid tiers ~$25–$300/mo; Bump.sh $50–$250/mo; enterprise API security $2,500+/mo (Levo, per the same article).

| Tier | Price (assumption) | Includes |
|---|---|---|
| **Free** | $0 | 1 repo · dependency map · deprecation/changelog radar · up to 5 monitored APIs with probes · weekly digest · public drift feed |
| **Team** | **$49/mo** (or ₹2,999/mo India pricing) | Up to 15 monitored APIs · live SDK detection · code-aware alerts · fix PRs · Slack · 30-day history |
| **Business** | **$299/mo** + $5 per extra API | Unlimited repos · drift-network early warnings · "us or them" timeline · compliance data-flow export · SSO · audit log · 1-year history |
| **Enterprise** | Custom | Self-hosted backend · eBPF capture · data residency · SLA · dedicated support |

Why **per monitored API**: revenue scales with how many APIs a customer depends on, which tends to grow. As a rough proxy only: Pandium found a median of 15 integrations per fast-growing SaaS company (Secondary; it counts integrations a product *offers*, not APIs it consumes). It's also easy for a buyer to understand.

Why the Team tier includes 15 APIs: it roughly matches that proxy, so a typical team should fit without counting (to validate).

### Unit economics (rough, assumptions)
- Cost to serve per customer is mostly ingest + storage of fingerprints (small; shapes, not payloads) + LLM calls (only on drift events and code scans, which are rare) → high gross margin expected, typical for dev-tools SaaS.
- Biggest cost risk: LLM extraction on very large repos. Mitigate with caching per file hash and AST-first extraction.

## 5. Moats, weakest to strongest

1. **Features:** copyable. ❌
2. **Combination of code + traffic + provider signals:** hard to copy quickly. 🟡
3. **Workflow lock-in:** adapters, lockfile and review history live in customers' repos and processes. 🟢
4. **Drift-network data:** every customer makes detection faster for every other; a newcomer starts at zero. 🟢🟢
5. **Two-sided market (later):** providers would value knowing **which fields consumers actually read** before removing one (anonymised, opt-in). Turns providers from adversaries into customers. 🟢🟢

## 6. Validation plan (before and during the hackathon)

| Step | Goal | Success signal |
|---|---|---|
| 20–40 response survey ([evidence.md](evidence.md) §5) | Our own number on how drift is found and how long it takes | ≥ 30% say "found out from a user/customer" |
| 10 developer interviews (15 min) | Real stories, words to use on stage | ≥ 3 concrete incidents with details |
| Show the clickable demo to 5 backend devs | Willingness to install | ≥ 3 would install the GitHub App on a real repo |
| Price test question | Willingness to pay | ≥ 2 say their team would pay ~$49/mo |
| After hackathon: 5 design partners | Real usage | 1 real drift caught on a used field within 60 days |

## 7. Team and roles (hackathon)

| Role | Owns |
|---|---|
| Backend lead | Ingest, baselines, detectors, severity, probes |
| Integrations | GitHub App, code scan, PR bot, CI wiring |
| Frontend | Demo shop, dashboard, graph, timeline, demo panel |
| Product/pitch | Evidence, survey, deck, demo script, video, Q&A prep |

## 8. Post-hackathon path (if the team continues)

1. **Month 0–3:** Node + Python SDKs, GitHub App public beta, free tier, 5 design partners, public drift feed for 20 popular APIs.
2. **Month 3–6:** Team tier launch, changelog radar for top 50 APIs, Slack app, first "State of API Drift" mini-report.
3. **Month 6–12:** Business tier (network, compliance export, SSO), webhook drift, upgrade preview beta; apply to accelerators with usage data.

## 9. The pitch in four sentences

> Your app depends on APIs you don't control, and they change without breaking. Monitors stay green while customers see wrong data. Seismo learns how each API normally behaves from real traffic, catches silent changes in shape, behaviour and meaning, shows exactly which of your code breaks, and opens a safe fix PR. When it isn't sure, it asks a human. And the more teams use it, the earlier everyone hears about the next change.
