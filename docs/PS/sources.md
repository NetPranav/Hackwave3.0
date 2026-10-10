# Sources

Web research date: **10 Oct 2026**. Most web sources were read through search-result summaries, not full pages; re-check exact figures on the original page before they go on a slide. Labels: **P** = primary (provider, standard body, regulator, peer-reviewed), **V** = vendor about itself, **S** = secondary (news, directory, blog), **B** = biased (written by a competitor).

## Team research (root folder)
- *The Internet After the API: documented evidence* (PDF, research teammate). Cases A1–E3, academic evidence, claims to avoid. Its own source list includes Google Cloud, Cloudflare, Shopify, Pipedrive, Lightspeed, IRIS, Slack, Docker, AWS/Cloudflare R2, Jira, Spotify, Circle, Moov, 8x8, arXiv 1407.4266, ICWE 2024, arXiv 2307.09009.
- *Cost of API dependency failures: evidence review* (PDF, research teammate, 10 Oct 2026). Statistics S1–S6, A1–A7, E1–E7, D1–D7, "do not say" list. Its sources include Uptime Institute, ITIC, New Relic, Splunk, Parametrix, Uptrends, Google/Cloudflare/AWS postmortems, Amazon S3 SLA, DORA, Stripe Developer Coefficient, Postman 2019 (SD Times), Nylas, ICSM 2013, Maven studies, Nagle/Redman/Sammon, Monte Carlo/Wakefield, SEC (Knight Capital), NASA (Mars Climate Orbiter).
- `PS3_Overview.md` and the WhatsApp screenshot (problem/target user/current solution Q&A).

## Standards and patterns (P)
- RFC 9745, The Deprecation HTTP Response Header Field (Mar 2025): https://www.rfc-editor.org/rfc/rfc9745
- RFC 8594, The Sunset HTTP Header Field (May 2019, Informational): https://www.rfc-editor.org/rfc/rfc8594
- Martin Fowler, *Tolerant Reader* (2011): https://martinfowler.com/bliki/TolerantReader.html

## Competitors and adjacent tools
| Tool | Source | Label |
|---|---|---|
| API schema drift tools compared (2026), written by FlareCanary | https://dev.to/flarecanary/api-schema-drift-detection-tools-compared-2026-1ib4 | **B** |
| FlareCanary guide to schema drift monitoring | https://dev.to/flarecanary/the-complete-guide-to-api-schema-drift-monitoring-in-2026-259b | B |
| DriftMonitor | https://www.driftmonitor.app/ | V |
| DriftGuard blog | https://blog.getdriftguard.dev/what-is-api-schema-drift-and-why-it-breaks-production | V |
| Apify third-party API contract drift monitor | https://apify.com/invaluable_rondeau/third-party-api-contract-drift-monitor | V |
| api-schema-drift-watch (open source CLI) | https://github.com/Waqas-Ai-Engineer/api-schema-drift-watch | V |
| oasdiff (Nordic APIs article) | https://nordicapis.com/using-oasdiff-to-detect-breaking-changes-in-apis/ | S |
| oasdiff breaking-changes list | https://github.com/tufin/oasdiff/blob/v1.10.16/BREAKING-CHANGES.md | V |
| Optic acquisition by Atlassian | https://www.atlassian.com/blog/announcements/optic-acquisition | P (acquirer) |
| Postman acquires Akita (Business Wire) | https://www.businesswire.com/news/home/20230719991128/en/Postman-Acquires-Akita-Software-to-Help-Build-the-Future-of-API-Observability | P (press release) |
| Postman Insights docs | https://learning.postman.com/docs/insights/get-started/overview | V |
| APIToolkit / Monoscope (directory) | https://apis.io/providers/apitoolkit/ | S |
| Treblle (Capterra / Zoftwarehub) | https://www.capterra.co.uk/software/1018235/treblle · https://zoftwarehub.com/products/treblle/pricing | S |
| WSO2 acquires Moesif | https://wso2.com/library/blogs/wso2-acquires-api-analytics-and-monetization-leader-moesif/ | P (acquirer) |
| Datadog inferred service dependencies | https://docs.datadoghq.com/tracing/guide/inferred-service-opt-in/ | V |
| Keploy docs | https://keploy.io/docs/keploy-explained/introduction/ | V |
| Speedscale traffic replay | https://speedscale.com/kubernetes-traffic-replay/ | V |
| Tusk Drift (PyPI stats / directories) | https://pypistats.org/packages/tusk-drift-python-sdk | S |
| PactFlow (Gartner / Capterra) | https://www.gartner.com/reviews/product/smartbear-pactflow | S |
| Specmatic overview | https://apidog.com/blog/what-is-specmatic/ | S |
| Lunar.dev architecture docs | https://docs.lunar.dev/0.10.x/architecture | V |
| Lunar.dev and third-party API consumption (Nordic APIs) | https://nordicapis.com/the-undercurrents-of-third-party-api-consumption-management/ | S |
| Levo.ai (AppSecSanta) | https://appsecsanta.com/levo-ai | S |
| Akamai completes Noname acquisition | https://www.nasdaq.com/press-release/akamai-completes-acquisition-api-security-company-noname-2024-06-25 | P (press release) |
| Gable.ai, how it works | https://www.gable.ai/how-gable-works | V |
| whylogs (LangChain integration docs) | https://python.langchain.com/docs/integrations/providers/whylabs_profiling | S |
| Invariant Labs, Introducing MCP-Scan | https://invariantlabs.ai/blog/introducing-mcp-scan | V |
| MCP-Scan docs | https://explorer.invariantlabs.ai/docs/mcp-scan | V |
| Snyk/Invariant acquisition claim | https://appsecsanta.com/mcp-scan | S, **Unverified** |

## Market and context
| Topic | Source | Label |
|---|---|---|
| API monitoring platform market | https://marketintelo.com/report/api-monitoring-platform-market/amp | S (paid report summary) |
| API monitoring SaaS idea page (market figures) | https://ideaproof.io/startup-idea/api-monitoring-saas | S, weak |
| API management market (various) | https://technavio.com/report/api-management-market-analysis · https://www.kingsresearch.com/report/api-management-market-2586 · https://www.snsinsider.com/press-release/global-api-management-market | S |
| Postman State of the API 2025 (deep dive) | https://nordicapis.com/a-deep-dive-into-the-state-of-the-api-2025/ | S |
| SaaS median 15 integrations (Pandium data) | https://chiefmartec.com/2020/05/proof-platform-saas-apps-median-15-integrations/ | S |
| Public SaaS ~350 integrations | https://www.saastr.com/the-top-saas-companies-have-an-average-of-350-integrations | S |
| Stripe date-based versioning | https://levelup.gitconnected.com/why-stripes-api-never-breaks-the-genius-of-date-based-versioning-2c4683cf8adb | S |
| India DPDP Rules 2025 | https://www.hlc.com/en/publications/indias-digital-personal-data-protection-act-2023-brought-into-force- · https://www.tcsa.in/resources/dpdp-rules-2025-implementation-roadmap | S (law firm / consultancy) |

## Searched but not found (do not cite)
- KushoAI report claiming "41% of APIs see undocumented schema changes within 30 days": original not found.
- Postman Insights using eBPF: not confirmed.
- Traceable–Harness merger details: not confirmed in our searches.
