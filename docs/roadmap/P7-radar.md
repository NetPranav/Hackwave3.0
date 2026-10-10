# P7 · Changelog & deprecation radar (Days 9–11)

**Done when:** posting an announcement on the fake orders provider's changelog ("from 25 Oct, `limit` is capped at 100") produces, within a minute and **before** the change is switched on, a radar item that names the affected code (`lib/api/orders.ts:42 limit=500`). It includes an AI explanation and a deterministic suggestion (paginate until empty), and the endpoint shows a clock badge on the graph. `Sunset`/`Deprecation` headers seen in traffic appear on the same radar.

**Depends on:** P2 (code map), P3 (headers), P6 (AI layer) · **Contracts:** `radar-item` · **Owners:** OVERxPOWERED (sources + matching), NetPranav (AI parsing), adarzhpathade (radar page, badges)

## Signals the radar reads

| Source | How | Library |
|---|---|---|
| Provider changelog (RSS/Atom) | Poll every 15 min (1 min in demo mode); new entries only | rss-parser |
| Provider changelog (HTML) | Fetch → extract main text → diff against the last snapshot | @mozilla/readability + jsdom, `diff` |
| Provider OpenAPI spec | Fetch → compare with the last version → structured breaking changes | openapi-diff (npm) or oasdiff (Go binary) |
| `Sunset` / `Deprecation` headers | Already captured by the SDK (P3, D13) | — |
| Provider status page | Statuspage `summary.json` (P3) | — |

Sources per provider live in a registry file (`backend/radar/providers.json`): the demo's four fake providers plus a few real public changelogs to show it isn't staged (e.g. GitHub's changelog feed; verify feed URLs in P7.1).

## Pipeline
1. New text/spec diff → **AI parser** (JSON only): `{ changes: [{ endpoint?, field?, changeType, effectiveDate?, summary, quote }] }`. The quote must be a verbatim substring of the source (checked); otherwise the item is dropped. This prevents invented changes.
2. **Matcher** (deterministic): resolve each change to endpoints and fields in the code map; unresolved changes stay as "FYI" items.
3. **Radar item:** affected code sites, effective date, explanation, suggested change from the template catalog, link to the source. Severity uses the same code-aware impact as P4.
4. On the effective date, if traffic shows the change, the radar item links to the resulting drift event.

## Sub-phases

| ID | Task | Owner | Output |
|---|---|---|---|
| P7.1 | `contracts/radar-item`; provider registry; verify real feed URLs | OVERxPOWERED | Merged first |
| P7.2 | Fetchers: RSS, HTML snapshot diff, OpenAPI diff; scheduling via pg-boss | OVERxPOWERED | New-entry events |
| P7.3 | AI changelog parser with quote verification | NetPranav | JSON changes |
| P7.4 | Matcher against the code map + suggestion templates | OVERxPOWERED + NetPranav | Radar items |
| P7.5 | Radar page (upcoming changes by date, filters), clock badges on graph endpoints, links to sources | adarzhpathade | See [dashboard.md](dashboard.md) §10 |
| P7.6 | Alerts for new radar items (same dispatcher, lower default severity) | OVERxPOWERED | Slack/email |

## Definition of Done
- [ ] Demo announcement → matched radar item in < 60 s, before the flip
- [ ] `Sunset` header on shipping shows with its date on the radar and as a graph badge
- [ ] OpenAPI diff of the orders provider (v1 → v2 spec) produces structured items
- [ ] An AI "change" whose quote isn't in the source is rejected (test)

## Cut line
Must: headers on radar, RSS + AI parser + matcher for the fake providers · Should: HTML snapshot diff, OpenAPI diff, real public feeds · Later: email newsletters as a source
