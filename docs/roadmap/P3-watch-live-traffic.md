# P3 · Watch live traffic: SDK + ingest + API status layer (Days 4–7)

**Done when:** with the SDK installed in the demo shop, the dashboard's API Status page shows live calls, errors, latency and provider status for every external API within 10 seconds; stopping our backend doesn't affect the shop at all; and an automated test proves no response value ever reaches our database.

**Depends on:** P0, P1 · **Contracts:** `fingerprint`, `status` · **Owners:** NetPranav (SDK, ingest, baselines, status), OVERxPOWERED (SDK install in shop, privacy/fail-open tests), adarzhpathade (status UI)

## How capture works (summary; full design in [`../PS/architecture.md`](../PS/architecture.md) §3)
- `@seismo/sdk` is initialised once in the shop's server code. It observes outbound `fetch`/`undici`/`http` calls (via `@mswjs/interceptors` if spike S2 passes, else thin `fetch` + axios wrappers). It is **read-only, fail-open, sampled** (default 10%, 100% in demo mode).
- For each sampled response it computes a **fingerprint**: endpoint template, status, latency, headers of interest (`x-ratelimit-*`, `Sunset`, `Deprecation`, `Link`), field paths with type/format/length/order-of-magnitude, salted hashes for enum candidates and item IDs, array lengths, request `limit`/`page` params. **No values leave the server** except allow-listed enum values.
- Numbers are summarised per 5-second batch (p5/p50/p95 + magnitude histogram, no min/max, batches < 5 values held back).
- The salt is generated and kept by the SDK; the backend never sees it.

## Sub-phases

| ID | Task | Owner | Output |
|---|---|---|---|
| P3.1 | `contracts/fingerprint` + `contracts/status` | NetPranav | Merged first |
| P3.2 | SDK capture layer (interceptors or wrappers), sampling, bounded queue, batching, gzip, retry-once-then-drop | NetPranav | `@seismo/sdk` v0.1 published (P0.10) |
| P3.3 | Fingerprinter: endpoint normalisation, type/format classifiers, magnitude, salted hashes, batch sketches | NetPranav | Unit tests per format class |
| P3.4 | Ingest API: per-project SDK keys, rate limiting, zod validation, write to windows tables | NetPranav | `POST /v1/ingest` |
| P3.5 | Baselines: per endpoint × field profile (presence, types, nulls, t-digest percentiles, enum sets, array lengths, error shapes, latency, rate-limit headers); "ready" after 200 samples or 24 h | NetPranav | Baseline API |
| P3.6 | **API status layer**: per service and endpoint: calls/min, error %, p95 latency, 429s, last seen, drift state, deprecation dates; **provider status** polled from Statuspage `…/api/v2/summary.json` for known providers (mapped in config) | NetPranav | `GET /v1/status`, SSE `status.updated` |
| P3.7 | Install SDK in `seismo-demo-shop`; enum allow-list config (`status`, `currency`) | OVERxPOWERED | Shop sends fingerprints on staging |
| P3.8 | **Privacy test**: run shop traffic, scan ingest storage for any response string value → must find none. **Fail-open test**: stop backend → shop p95 unchanged, no errors | OVERxPOWERED | Both in CI (e2e job) |
| P3.9 | API Status page + endpoint detail + live updates (SSE) + graph node colours from status | adarzhpathade | See [dashboard.md](dashboard.md) §5 |

## Libraries
@mswjs/interceptors (spike S2) · tdigest · fastest-levenshtein (later, rename) · fflate (gzip) · Fastify rate-limit · recharts (sparklines). Status in [libraries.md](libraries.md).

## Definition of Done
- [ ] Shop traffic visible on the Status page within 10 s (staging)
- [ ] Baselines "ready" for all demo endpoints after the traffic generator runs ~1 minute at 5 rps
- [ ] Privacy test and fail-open test pass in CI
- [ ] SDK adds < 1 ms p99 to the request path (measured)
- [ ] Provider status shows for at least one real Statuspage provider (e.g. GitHub's status page) to prove the integration

## Cut line
Must: capture, fingerprint, ingest, baselines, status page, privacy + fail-open tests · Should: Statuspage provider status, SSE (polling every 2 s is acceptable) · Later: Python SDK, OpenTelemetry integration
