# Seismo roadmap v3: what is left (from demo to production)

**This file lists only work that is NOT done.** Everything already built and verified is in
[`../../../COMPLETION.md`](../../../COMPLETION.md) (v2 checklist and "Before merge (v1)"). Updated 2026-10-11.

Two goals, in this order:
1. **The output is right**: Seismo catches every real change, raises no false alarms, and every fix it makes is safe.
2. **Nothing is lost**: every API observation reaches Seismo eventually, even when parts of it are down or overloaded.

---

## How Seismo handles traffic (what it does today, and why it scales)

Seismo never sees your users' requests and never sits in the request path.

```
 your users ──► your app ──► third-party API (Stripe, Razorpay, Shiprocket, …)
                   │  the SDK, inside your app, watches only these OUTBOUND calls
                   ▼
         one small fingerprint per endpoint per 5 s  ──►  Seismo backend
         (field names, types, sizes, counts; never values)
```

| Question | Answer |
|---|---|
| What is watched? | Only the calls **your servers make to third-party APIs**, not your users' requests to you |
| Does Seismo receive every call? | No. The SDK samples (default 10% of calls; 100% in the demo), profiles the response shape **inside your app**, and sends **one aggregated fingerprint per endpoint every 5 s**. 1 million calls a day to 20 endpoints is still about **20 small messages every 5 s** |
| Cost inside your app? | Measured p99 ≈ +0.6 ms per sampled call, on a copy of the response, after your code already has the original. Fail-open: if Seismo is down your app does not notice |
| What grows with traffic? | The **number of endpoints and customers**, not the number of calls. That is what the backend has to scale for (v3-P3) |
| Weak spot today | The detector re-reads 24 h of fingerprints every 5 s and keeps some state in memory. Fine for a demo, not for thousands of endpoints (v3-P3) |

---

## v3-P0 · Finish the hackathon (by 2026-10-24)

| ID | Task | Done when |
|---|---|---|
| P0.1 | Click through the real GitHub sign-in once (callback is registered for :3000) | Signed in on localhost:3000 with a real GitHub round trip |
| P0.2 | WhatsApp: number in Settings, sandbox joined, Send test | Message received |
| P0.3 | Fingerprint retention job (raw rows older than N hours deleted) | DB stays < 300 MB under demo traffic for 24 h |
| P0.4 | Refuse default `INTERNAL_TOKEN` / `DEMO_ADMIN_TOKEN` / `AUTH_SECRET` when `NODE_ENV=production` | Backend exits with a clear message |
| P0.5 | GitHub App runs inside the backend process (one awake service; no missed webhooks) | Merge/CI events recorded after a cold start |
| P0.6 | Deploy: dashboard + shop on Vercel, backend (+ app) + fake APIs on Render, Postgres; GitHub App callback/setup/webhook URLs updated | The demo runs without the laptop |
| P0.7 | Playwright smoke test: sign-in bypass → overview → flip → change appears | Runs locally |
| P0.8 | Rehearse the 2-minute script (`docs/DEMO.md`), backup video | Recorded |

## v3-P1 · One-click onboarding: the first PR installs the SDK too

Today the setup PR wraps the API reads; installing and starting the SDK is still manual. After v3-P1, **installing the
GitHub App and merging one PR is the whole setup**.

| ID | Task | Done when |
|---|---|---|
| P1.1 | Publish `@seismo/sdk` to npm (semver, changelog, provenance); `@seismo/sdk/auto` starts itself from `SEISMO_KEY` | `npm i @seismo/sdk` works; one import starts it |
| P1.2 | Setup PR v2 adds the dependency, the start-up hook for the detected framework (Next.js `instrumentation.ts`, Express/Fastify/Nest entry file), the `withAliases` wrappers, `seismo/` files and the provider host map from the code map | One PR; the app reports traffic after merge + deploy |
| P1.3 | The key reaches the app without copy-paste: GitHub Actions secret / Vercel / Render integrations write `SEISMO_KEY` (with the user's consent) | No manual key step for Vercel/Render users |
| P1.4 | The setup PR is tested before it opens: build + typecheck + the repo's tests in a sandbox (same rule as fix PRs: no green, no PR) | A broken setup PR is never opened |

## v3-P2 · Self-healing small changes; PRs for big ones

The idea: Seismo fixes **minute** changes by itself, at once, and opens a PR for **big** ones. Safety rule kept: only
changes that cannot break anything are applied without a human.

| Change | What happens | Why it is safe |
|---|---|---|
| Rename, field moved, field added back under an old name | **Healed live** within seconds (rule pushed to the SDK), then a PR records it in the repo | Aliases only ADD a missing field; proven by G1–G4 |
| Type / unit / enum value | Rule proposed, stress-tested, **PR with one click**; never applied before a human merges | Values change, so a person decides |
| Limit cap, pagination, error format, removed endpoint | Precise code suggestion and impact; optional template code PR (see P2.4) | Needs a code change |

| ID | Task | Done when |
|---|---|---|
| P2.1 | Live rules: the SDK fetches signed rules for its project (ETag, every 30 s, fail-open, cached); `withAliases` applies repo rules + live alias rules | A rename is healed in the running app before any PR is merged |
| P2.2 | Opt-in per project ("auto-heal renames"), kill switch, every live rule expires unless its PR is merged within N days | Turning it off removes live rules within 30 s |
| P2.3 | Post-fix verification: after a rule is live or merged, production traffic must show the old field back for the code; otherwise the rule is withdrawn and the change reopened | A wrong rule never stays |
| P2.4 | Template code fixes for limit caps / cursor pagination: a `fetchAllPages` helper in the SDK + codemod at the call site, behind the same sandbox build + tests | A limit cap gets a passing PR |
| P2.5 | Cleanup PR when a provider reverts and a rule is no longer used (v1-P5.11) | Unused rules are removed |

## v3-P3 · Never lose an observation, scale to many customers

| ID | Task | Done when |
|---|---|---|
| P3.1 | SDK delivery guarantees: bounded in-memory queue + optional on-disk spool, retries with backoff + jitter, honours `Retry-After`, batch id for idempotency | Backend down for 10 min → no fingerprints lost (within the bound) |
| P3.2 | Ingest: accept → write to a durable queue (Postgres/pg-boss first, Redis Streams or Kafka later) → workers; dedupe by batch id; 429 only when the queue is full | Ingest p99 < 50 ms at 10× demo load; replays are harmless |
| P3.3 | Incremental detection: per-minute rollups per endpoint (mergeable sketches: counts, type histograms, t-digest for numbers), baselines updated incrementally, detection reads rollups only | A pass costs O(endpoints), not O(history) |
| P3.4 | Partitioned workers (per project), one leader per partition; all engine state (investigations, quarantine, activity, alert log, radar, AI cache) in Postgres | Restart or a second instance changes nothing |
| P3.5 | Time-series storage for rollups (Timescale or ClickHouse), retention tiers (raw 6 h, minute 30 d, hour 1 y) | Storage bounded and predictable |
| P3.6 | Alerts and PRs as queued jobs with retries, idempotency and a dead-letter queue; GitHub calls rate-limit aware | A crash mid-send loses nothing; no duplicate PRs |

## v3-P4 · Detection you can trust (accuracy)

| ID | Task | Done when |
|---|---|---|
| P4.1 | Benchmark: labelled corpus of real API changes (public changelogs + recorded shapes) + no-change traffic; precision/recall/time-to-detect measured in CI, release blocked on regressions | Published numbers per detector |
| P4.2 | Low-traffic endpoints: sequential tests that need fewer samples, longer windows when traffic is thin, confidence shown honestly | A change on a 1-call-per-minute endpoint is caught |
| P4.3 | Seasonality: baselines per hour-of-day/day-of-week; rollout-aware (a change on 5% of responses, rising) | No alarm for normal daily patterns; gradual rollouts caught early |
| P4.4 | Bootstrap from the provider's OpenAPI / SDK types so detection works from minute one | Useful alerts in the first hour |
| P4.5 | Learn from people: "expected" adopts the new shape and tunes thresholds; "wrong" feeds the benchmark | Repeat false alarms drop |
| P4.6 | Shadow mode for new detectors (score, do not alert) before they ship | No detector ships untested |

## v3-P5 · Production platform

| ID | Task |
|---|---|
| P5.1 | Organisations, projects, teams, roles; every query scoped; GitHub org membership checked |
| P5.2 | Secrets manager, encryption of stored webhooks/phone numbers, key rotation, audit log |
| P5.3 | Rate limits on all routes; strict outbound URL policy (no internal addresses) for user webhooks |
| P5.4 | Observability: Sentry, metrics, traces, SLOs ("change detected within N min for 99%"), status page |
| P5.5 | Staging + production, infrastructure as code, backups with restore drills, on-call |
| P5.6 | Privacy/compliance: DPA, data residency, retention policy, independent privacy audit, self-hosted option |

## v3-P6 · Reach (more customers can use it)

| ID | Task |
|---|---|
| P6.1 | SDKs: Python, then Java, Go, Ruby (same fingerprint contract and privacy test) |
| P6.2 | Zero-code capture: OpenTelemetry collector processor, gateway plugins (Envoy, Kong, NGINX) |
| P6.3 | Scanner: more languages, monorepos, incremental scans |
| P6.4 | GitLab and Bitbucket; GraphQL, gRPC, inbound webhooks |
| P6.5 | Routing to owning teams, PagerDuty, Jira/Linear tickets, digests, quiet hours, business impact ("affects checkout: X% of orders") |
| P6.6 | Radar with real public changelogs and status pages |

## Order

```
P0 (hackathon) ─► P1 one-click onboarding ─► P2 self-healing ─► P3 never lose data / scale ─► P4 accuracy ─► P5 platform ─► P6 reach
                                              (P3 and P4 can run in parallel once P2.1 exists)
```

## Definition of Done (every task)
Works against real traffic (not only mocks), has tests (property tests for anything that changes data), CI green, and
is ticked in `COMPLETION.md` with how it was verified.
