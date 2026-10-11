# COMPLETION.md: what is built, what is verified, what is left

Status on **2026-10-11** (Day 1 of 14), branch `netpranav` (updated after P6, P7, P5.3/5.6/5.10, restart safety and P8 groundwork).
Everything below was checked by running the code, not by reading the plan. "Verified" means a test or a live run in this repo proves it; claims without proof are marked as such.

---

## 1. How it was verified

| Check | Result |
|---|---|
| Full test suite (`npx turbo run test --force`), run twice per change set | **170 tests** green: contracts 5 · services 9 · github-app 35 · sdk 26 · backend 92, plus environment-gated tests (3 Postgres-store tests pass against the local database; 2 live-NIM tests pass with `LIVE_NIM=1`) |
| Demo shop repo (`NetPranav/seismo-demo-shop`) | typecheck, 5 tests (invoice v1/v2 ± alias rule, alias guarantees), `next build`, 0 production advisories; its own CI green on GitHub |
| Typecheck + build of every engine package (`turbo run typecheck build`) | 10/10 tasks green |
| ESLint over the repo | clean |
| `npm run setup` on a real laptop (local Postgres 17) | creates the `seismo` database, applies migrations ("setup done") |
| **End-to-end suite over real HTTP** (`backend/test/e2e.test.ts`) | 12/12 green. Fake providers → shop traffic through the real SDK → backend ingest → baselines → detectors (P4 + P6) → severity joined with a code map produced by the real scanner → planner → PR dispatch → explanations → alerts to local fake Twilio/Resend/Slack + GitHub issue sink → graph/status/review APIs. One clean backend per scenario. Raw output: `backend/test/e2e-results.json` |
| **Live run of the real shop** (Next.js `next start`) against the fake providers and the backend | SDK inside Next.js captured all 4 providers with templated endpoints and exact call counts. Flipping `users-rename` blanked the customer name on checkout and invoice; the engine raised **D3 rename, breaking**, pointing at `app/checkout/page.tsx:14` and `lib/invoice.ts:7`, with the exact alias rule. The GitHub App call to open the PR reached GitHub and stopped at "not installed on this repo" (expected: the app must be installed by you) |
| Live NVIDIA NIM | Super (`nemotron-3-super-120b-a12b`) returned a valid, fact-checked explanation ("amount field unit change (×100)… lib/api/payments.ts (line 17) and lib/invoice.ts (line 8)… Review and fix manually"), ~10 s for the accepted answer, ~29 s with rejected retries. Ultra ignored `response_format` and looped to `max_tokens` → not used |
| Live Twilio | account `active` (Trial), credentials valid (read-only check, no message sent: `TWILIO_TO` missing) |
| Live boot with the real `.env` | backend `/health` OK; `/v1/*` returns 401 without a token and the user with a signed token; ingest rejects a bad SDK key (401); GitHub App boots, connects to smee and forwards webhooks; unsigned webhook → 400; internal routes without the shared token → 401 |
| GitHub App credentials | `GET /app` with the real key: app `seismo-app`, owner NetPranav, permissions checks/contents/issues/pull_requests write + metadata read, events push + pull_request. **Installed on 0 repos** (nothing to scan live yet) |
| Spikes | S1 NIM (revised: Super, not Ultra), S2 body capture (revised: own fetch wrapper), S3 Probot answered. S4 Twilio: credentials verified, message not sent. S5 host: not run |
| CI on GitHub | Earlier pushes failed (missing `packageManager` field, then a 5 s test timeout on slow runners). Both fixed. Run 38117192910 on the P6 commit: **all green** (docs, node incl. the e2e suite on Node 22, python, `ci-ok`) |

---

## 2. Defects the verification found and fixed (all in this commit range)

| # | Defect | Impact if shipped | Fix |
|---|---|---|---|
| 1 | **The SDK missed every `fetch` that used a keep-alive socket opened before `seismo.init()`.** The interceptor library hooks fetch at the socket level; undici rotates pooled sockets, so in the e2e run *every other request* was invisible, with no error counted | Half of a real app's traffic silently unobserved; renames not detected | The SDK now wraps `globalThis.fetch` directly (sees every call, returns the original Response untouched, restores fetch on `stop()`); `node:http` (axios/got) still uses the interceptor. Regression tests: warm socket before init, http path counted exactly once, fetch errors propagate unchanged |
| 2 | Fake services: `POST /admin/reset` with `content-type: application/json` and **no body** returned 400, so reset never happened | Demo Control "Reset" button would silently do nothing; scenarios pile up | Empty JSON body is treated as `{}`; test added |
| 3 | Backend returned **mock drift events** (`email → emailAddress`) whenever there were no real ones | A real user with zero drift would see invented drift | Mock data only when `SEISMO_MOCKS=1`; empty system returns empty results |
| 4 | `/v1/graph` and `/v1/status` ignored drift states | The "red path" could never appear | Graph and status are coloured from live drift events; resolved/expected/info never colour anything |
| 5 | Scanner wrote `/users/{param}`, SDK and drift events `/users/{id}` | Graph node ids did not match drift/status ids | One template syntax everywhere (`{id}`), plus normalisation in the graph |
| 6 | D17 (endpoint gone) and D12 (429 share) **could never fire in the engine**: fingerprints are split by status class, so a 2xx baseline never contains 404s or 429s | Two detectors were dead code (unit tests passed only because they hand-built the input) | Engine also builds all-class profiles and runs D12/D17 on them; engine-level tests added |
| 7 | Two endpoint-level findings of the same detector (D13 Sunset + Deprecation) overwrote each other | Lost alert | Event key includes the finding title when there is no field |
| 8 | Privacy: identical numbers in a batch made the percentile equal the exact value (e.g. ₹49,900) | A record's value could leave the server | Percentiles only with ≥ 5 **distinct** values, rounded to 3 significant figures |
| 9 | Provider-controlled field names like `__proto__` reached plain-object lookups | Crash / prototype-pollution risk | SDK drops `__proto__`/`constructor`/`prototype` keys; null-prototype maps; planner uses own-property checks |
| 10 | `.env.example` had comments on the same line as empty values, which made `AUTH_SECRET` look set while it was empty | Backend ran with auth **off** | Comments moved to their own lines; `AUTH_SECRET` generated in the local `.env` |
| 11 | GitHub App manifest was rejected by GitHub (`workflows` permission, installation events); code exchange crashed on a slow network | App could not be registered | Manifest fixed; exchange retried; `--callback-only` mode |
| 12 | CI: Turbo needs `packageManager`; ts-morph tests exceed 5 s on CI runners | Red CI | Field added; 60 s per-test timeout for engine packages |
| 13 | Scanner lost the data at `withAliases(await res.json(), …)` (0 field reads on the real shop) | Every shop wired for Seismo would map no fields | Alias wrappers are pass-through (`applyAliases`, `withAliases`, plus `passThrough` in `seismo.config.json`) |
| 14 | Scanner did not follow **imported** helpers (`invoiceLines(user)`, `shipmentLabel(status)`), recorded `data.slice` and `amount.toLocaleString` as fields | Missed reads, wrong field names | Import aliases resolved; `slice/sort/…` keep following the array; value methods read the value. Second fixture (copy of the real shop) with 7 tests |
| 15 | SDK classified short ids like `o_1` as enum values | ids hashed as enum candidates, compare showed `<enum>` | `prefixed_id` accepts one character after `_` |
| 16 | AI: zod-valid but useless output passed (`title: "..."`), Super **invented a deadline** ("by 2025-01-15"), Ultra ignored the schema | Wrong text in alerts | Schema spelled out in the prompt + a fact check after zod (no URLs, no dates not in the data, must name the field, must be prose); rejection is sent back as the retry reason; template after 3 failures. Explainer defaults to Super |
| 17 | AI rate limiter slept for the full computed wait instead of re-checking | Requests stalled up to a minute | Polls every ≤ 250 ms |
| 18 | `.turbo/` cache and logs had been committed | Repo noise | Untracked and ignored |
| 19 | Demo shop: Next 15.5.4 had a critical advisory; the vendored SDK tarball kept the old code under the same version | Vulnerable demo; stale SDK | Next 16.4.0 (0 production advisories); SDK bumped to 0.1.1 |

---

## 3. What happens for each kind of API change (verified end to end)

**The rule that never changes:** no code is generated or pasted, by us or by the AI. The only automatic fix is a **data rule** (one JSON object) appended to `seismo/aliases.json` in the customer's repo through a pull request that a human merges. That rule is applied by one small audited function, `applyAliases` from `@seismo/sdk/runtime`, which can only **add** a missing field from another field (the old name always wins, it never changes or deletes anything). Everything that is not a rename becomes a **review item** for a human.

| Scenario (fake provider toggle) | What Seismo did in the e2e run | Fix path | Why |
|---|---|---|---|
| none: v1 traffic before and after (soak) | 0 events, 0 PRs, graph all green | — | No false positives |
| **users-rename** `name → display_name` | **D3 rename** (score ≥ 0.75), amber on run 1, red on run 2 (confirmed), checks C1–C6 all pass → **one** PR with exactly `{"kind":"alias","endpoint":"GET /users/{id}","path":"$","target":"name","source":"display_name"}`; event `fix_pending`; graph path users → name → `app/checkout/page.tsx` → Checkout coloured; status row coloured. PR merged → event `resolved` → graph all green | **Automatic alias PR** (human merges) | A rename is the only change that can be fixed by adding data without changing meaning |
| **users-error-shape** 404 body `{error}` → `{errors:[]}` | **D11 error shape**, warning, joined with 5 code locations that call the endpoint; no PR | Review | Error handling code may branch on the shape; a human decides |
| **payments-amount-type** `amount` number → string | **D4 type change** on `POST /payments` and `GET /payments/{id}`, **breaking** (money field read in arithmetic + persistence); review item; no PR | Review | Type changes are never aliased; money always goes to review |
| **shipping-deprecation** `Sunset` + `Deprecation` headers | **D13**, two separate events (Sunset date and "marked deprecated"), warning; no PR | Review (+ radar in P7) | A heads-up, not a breakage yet |
| **orders-cursor** page → cursor | **D10 "Pagination changed to cursors (next_cursor); page, total gone"** plus D1/D2 entries, all **info** because the code never reads them; no alert, no PR | Review when code reads them | Pagination is behaviour, not a name |
| **payments-paise** ₹499 → 49,900 | **D5 "Unit change: amount ×100"** on `POST /payments` and `GET /payments/{id}`, breaking (money read in arithmetic). Review card: "…divide amount by 100 before using it… Money fields are never fixed automatically." Alerts: WhatsApp, email, Slack, GitHub issue, dashboard. **No PR** | Review (P5.10 `scale` suggestion PR not built) | Money + meaning |
| **shipping-enum** new `partially_shipped` | **D7 "New status value: partially_shipped"**, warning (half the traffic affected), joined with the checkout branch that reads `status`; AI judge (when on) may only pick a known label. No PR | Review | Meaning; the code's `if/switch` must be reviewed |
| **orders-limit-cap** asked 500, get 100 | **D9 "Silent truncation: asked 500, got exactly 100 in 100% of calls"**, breaking (the list feeds a money total). Review card: "Request pages until a page comes back with fewer than 100 items…". WhatsApp + others. **No PR** | Review | See below |
| **resolve after merge** | `resolved`, graph green | — | — |
| endpoint starts returning 404 (engine test) | **D17** "endpoint appears to be gone" | Review | Dependency disappeared |
| 429s become common / rate-limit header changes (detector test) | **D12** | Review | Behaviour change |

### The limit cap (500 → 100), concretely
1. **Detection (D9, built and verified):** the SDK sends the request's own `limit` (a customer-chosen parameter, not response data) and the array length sketch of the response. D9 fires when a new array-length maximum M is below the baseline maximum, at least 30 % of responses are exactly M, and the request asked for more than M. Evidence shown: *"asked 500, got exactly 100 in 64 % of calls"*.
2. **Severity:** joined with the code map. The call site with `limit=500` (`lib/api.ts`) and every read of `data[]` are listed with file:line; a truncated list that feeds totals (`orders.reduce`) is arithmetic → high impact.
3. **No automatic fix, by design.** `applyAliases` works on *responses*; a cap is fixed on the *request side* (loop over pages), which is code. Seismo never writes code. The review card carries a **fixed, pre-written template** (not AI text): *"The provider now returns at most 100 items per request. Request pages until a page comes back with fewer than 100 items (or an empty page), then merge the results."* plus the call site to change. A human makes the change.
4. **Same pattern** for rate limits (D12: back off / throttle), pagination changes (D10), units (D5: scale, review-only), enums (D7: map the new value, review-only).

---

## 4. P-series (NetPranav)

Legend: ✅ done and verified by tests (+ live where stated) · 🟡 partly done · ⏳ written but needs an external account/repo to prove live · ❌ not started

### P0 · Foundation
| ID | Task | Status | Evidence / what is missing |
|---|---|---|---|
| P0.0 | Contract skeletons + mock generator | ✅ | `contracts/src`, `contracts/generated/openapi.json` (22 routes), mock data validated against the schemas; request #3 sent to Adarsh |
| P0.1 | Monorepo (workspaces, Turbo, TS, ESLint, Prettier, Vitest) | ✅ | build/typecheck/lint green |
| P0.2 | `@seismo/contracts` zod → types, JSON Schema, OpenAPI | ✅ | generated on build |
| P0.3 | Postgres + drizzle + pg-boss | ✅ / 🟡 | Local Postgres: 7 tables migrated, pg-boss job ran. Neon staging/prod not created |
| P0.4 | Fastify API + worker + SSE | ✅ / ⏳ | Live locally; not deployed to staging |
| P0.5 | Dev GitHub App via manifest flow | ✅ (NetPranav) | App `seismo-app` authenticates; Adarsh's dev app not made |
| P0.6 | Fake services skeleton | ✅ / ⏳ | Live locally; not deployed |
| P0.8 | `npm run setup` / `npm run dev` | ✅ | setup verified; dev script starts backend, worker, services, app |
| P0.9 | CI via Turbo | ✅ | green on GitHub (run 38114122769); deploy automation not built |
| P0.10 | SDK distribution decision | ✅ | `docs/roadmap/sdk-distribution.md` (npm scope still open, Q10) |
| P0.11 | Dashboard↔backend auth | ✅ / ⏳ | Signed tokens + SSE token verified live; `/v1/me` returns the installations of the signed-in account from the GitHub App (tested; live once the app is installed). Dashboard side is Adarsh's |
| S1 NIM | ✅ | `response_format` json_schema works on Ultra (~3.8 s) and Super (~1.9 s) |
| S2 body capture | ✅ (revised) | Library interception misses pre-existing keep-alive sockets → own fetch wrapper (defect #1) |
| S3 Probot | ✅ | Probot 14.3.2 on Node 26, custom routes via `addHandler` |
| S4 Twilio | ❌ | Credentials in `.env`; `TWILIO_TO` (your WhatsApp number) missing |
| S5 Node host | ❌ | Needs your hosting account |

### P1 · Demo world
| ID | Status | Evidence / missing |
|---|---|---|
| P1.1 payloads + seed data | ✅ | Indian names, ₹ prices; 8 scenarios in `SCENARIOS` |
| P1.2 providers, toggles, rollout %, `/admin/sample` | ✅ | 9 service tests (mixed traffic at 50 % verified) |
| P1.3 per-provider `openapi.json` + `/changelog` (HTML + RSS) | ✅ | tested |
| P1.8 traffic generator | ✅ (not run against a real shop) | `npm run demo:traffic` |

### P2 · See your APIs
| ID | Status | Evidence / missing |
|---|---|---|
| P2.1 contracts | ✅ | codemap, graph, installations |
| P2.2 app, install flow | ⏳ | Code + routes tested with fakes and a booted Probot server; **no live install yet** |
| P2.3 scanner | ✅ | 9 fixture tests: fetch/axios, templates, destructuring, caller following, array callbacks, usage kinds incl. money, unresolved calls reported. **Fixture has ~9 patterns, roadmap asks ≥ 10 fixture repos' patterns** |
| P2.4 workflows + re-scan on push | ✅ / ⏳ | workflows file + route-folder default tested; push re-scan written, not exercised live |
| P2.5 graph API, impact, installations, SSE `graph.updated` | ✅ | tested; installations derived from stored scans (scan progress is "done" only) |
| P2.8 coverage numbers | ✅ | incl. unresolved count |

### P3 · Watch live traffic
| ID | Status | Evidence / missing |
|---|---|---|
| P3.1 contracts | ✅ | fingerprint v1 (status class split) |
| P3.2 SDK capture, sampling, queue, batching, gzip, retry-once-then-drop | ✅ | 20 SDK tests; overhead measured (p50 +0.04 ms, p99 ≈ +0.6 ms; budget < 1 ms) |
| P3.3 fingerprinter | ✅ | format classes, magnitude, salted hashes, batch sketches |
| P3.4 projects + keys + ingest | ✅ | Keys created/listed/revoked, stored as hashes in Postgres and reloaded on restart (pg test). One deployment watches one project (`SEISMO_PROJECT`, default `dev`). **Ownership:** only the owner manages keys (`SEISMO_PROJECT_OWNERS`, else the first signed-in user claims it, persisted); another project id → 404, someone else's → 403; a key of another project cannot be revoked. **Ingest:** per-project token bucket (`INGEST_RATE_PER_MIN`, default 1200) → 429 + `Retry-After` (the SDK drops the batch, fail-open); bodies over 512 KB → 413. Tests: `backend/src/app.test.ts`, `test/pg.test.ts`. Several projects per deployment is post-hackathon |
| P3.5 baselines | ✅ | presence, types, formats, enums, magnitude, lengths, shapes; `ready` flag computed (engine uses its own 50-sample minimum) |
| P3.6 status + overview + provider status | ✅ / 🟡 | Real numbers + drift colours; Statuspage poller written for GitHub only, not shown live |
| P3.7 SDK in the shop | ✅ | Done directly in the shop (lead's request): `instrumentation.ts` + `withAliases`; verified live inside Next.js |
| P3.8 privacy + fail-open tests | ✅ | secrets never on the wire; backend down → app unaffected |

### P4 · Catch a rename
| ID | Status | Evidence / missing |
|---|---|---|
| P4.1 contracts | ✅ | drift-event, notification |
| P4.2 framework, schedule (5 s), state machine | ✅ | suspected → confirmed over 2 runs; events persisted in Postgres (`drift_events`) and reloaded at start; **baseline freeze** while a confirmed change is open (restart test: no lost event, no duplicate PR or alert). Confirmation probes not built (persistence is the confirmation) |
| P4.3 D1–D4 incl. rename scoring | ✅ | real-traffic fixtures + e2e |
| P4.4 D11–D14, D16, D17 | ✅ | D11/D12/D13/D17 verified in engine; D14/D16 unit-level |
| P4.5 severity + impact | ✅ | confidence × impact × exposure; unread field → info (verified) |
| P4.6 notifications: dashboard SSE + **GitHub issue** | ✅ | SSE events emitted. One GitHub issue per drift event, found again by a hidden marker and updated on each state change (opened → fix pending → resolved): `alerts/dispatcher.ts` + `github-app/src/issues.ts`, tested in `p6.test.ts`/e2e. Live issue needs the app installed |
| P4.9 soak | ✅ | e2e soak: 0 events |

### P5 · Fix it safely
| ID | Status | Evidence / missing |
|---|---|---|
| P5.1 contracts | ✅ | alias-spec, fix-request, validation-result |
| P5.2 `applyAliases` + G1–G4 | ✅ | fast-check, 10,000 runs each, + hostile inputs (cycles, getters, proxies, 200k arrays, frozen). Branch coverage not measured |
| P5.3 setup PR (codemod + `aliases.test.ts`) | ✅ / ⏳ | Deterministic ts-morph codemod wraps fetch `.json()` and axios responses (`withAliases` / `withAliasesResponse`), adds `seismo/aliases.{json,ts,test.ts}`, idempotent, output re-parsed and re-scanned in tests; one-commit PR via the git data API (`POST /internal/setup`). Not run on a real repo yet (app not installed) |
| P5.4 planner C1–C6 | ✅ | every conflict case blocks (tests) |
| P5.5 PR bot | ✅ / ⏳ | one-file change only, `seismo/*` branch, labels, body with checks + usages + revert; idempotent. Proven with a fake GitHub client, **not on a real repo yet** |
| P5.6 check run + CI tracking (C7/C8) | ✅ / ⏳ | "Seismo safety checks" check run with C1–C6 on the PR head commit; `check_suite.completed` on `seismo/alias-*` → C7/C8 + CI state on the event. The existing app must tick the **Check suite** event in its settings (new registrations subscribe automatically) |
| P5.9 merge → resolved → green | ✅ / ⏳ | verified in engine + e2e; the webhook path from GitHub not exercised live |
| P5.10 suggestion PR for units | ✅ | Only when a human clicks "Open PR" on a D5 review card: one `scale` rule (÷ factor), branch `seismo/scale-*`, label `needs-review`, never merged by Seismo. Applied by a separate `applyTransforms` (T1 identity, T2 only the named number changes by the exact factor, T3 never throws; property-tested). Shop test: ₹49,900 → ₹499 only with the rule |
| P5.11 cleanup PR | ❌ | Later |

### P6 · Meaning changes, AI, alerts
| ID | Status | Evidence / missing |
|---|---|---|
| P6.1 contracts | ✅ | `AiExplanationBody` (what the model must return), `AiJudgement`, `AiExplanation`, `ReviewItem` (+reason), `Notification` (+title, error, read), per-channel thresholds, `Compare`/`FieldDiff`, typed `SimulateRequest` |
| P6.2 D5 unit + D9 truncation | ✅ | real-traffic tests + e2e (paise ×100; asked 500 got 100). D5 also checks known non-decimal factors when percentiles exist |
| P6.3 D7/D8 enum | ✅ | labels only for allow-listed fields, salted hashes otherwise; D8 folded into D7 when both happen |
| P6.4 D6 value drift, D10 pagination | ✅ | D6 unit-tested (not explained by D5); D10 on real traffic (cursor appears, page fields gone). Page-overlap check (page N == page 1) not built |
| P6.5 AI client | ✅ | NIM over `fetch`, zod + fact check, 2 retries with the error, template fallback, cache by event signature (optional file), 30/min limiter, 45 s timeout; tested with a fake NIM + one live call |
| P6.6 review items | ✅ | every non-alias event, deterministic suggestion from the template catalog (every detector has one), reason, explanation; actions expected / snooze; `open_pr` returns 501 (P5.10 not built) |
| P6.7 alert dispatcher | ✅ / ⏳ | dashboard log + SSE, WhatsApp (Twilio), Slack, Discord, email (Resend), GitHub issue per event updated through its states; once per event per channel, failures logged and retried; WhatsApp breaking-only by default. Tested against local fake endpoints; **no real message sent yet** (`TWILIO_TO`, Slack URL, Resend key missing; app not installed). In-process, not pg-boss jobs |
| P6.10 Compare & Simulate API | ✅ | synthetic before/after from statistics (no real values), field diff; simulate rename/remove/type/units/enum/limit against the code map |
| P6.11 AI pre-warm | ✅ | `POST /internal/ai/warm` + `AI_CACHE_FILE` |
| P6.12 webhook drift | ✅ | `seismo.observeWebhook()` / `seismo.webhook()` in the SDK, tested; the fake payments provider does not send webhooks yet |
| P6.13 notification settings API | ✅ | GET/PUT validated, persisted in Postgres (`settings` table), test-send |

### P7 · Radar
| ID | Status | Evidence / missing |
|---|---|---|
| P7.1 contract + registry | ✅ | `RadarItem` (change type, date, verbatim quote, matched files, severity, suggestion, extractor, linked drift event), `AnnouncedChange`; registry = the four fake providers. Real public feeds not added (URLs need verifying) |
| P7.2 fetchers | ✅ | RSS + Atom parser, OpenAPI structural diff (orders `maxLimit 500 → 100` verified), polling every 15 min / 1 min in demo mode. HTML snapshot diff not built |
| P7.3 changelog parser | ✅ | Rules extractor (limit, rename, units, removal, deprecation, enum, type, pagination; several date formats) and AI extractor (NIM); **every AI change must quote the source verbatim or it is dropped** (tested with an invented change). Live NIM extracted the limit change with a verbatim quote |
| P7.4 matcher | ✅ | Change → call sites and field reads in the code map → `matchedFiles`, severity capped at warning (announced, not happening), template suggestion. DoD verified: announcement on the orders changelog → item naming `lib/api/orders.ts:4` **before** the flip |
| P7.6 alerts | ✅ | New items go through the same dispatcher (info → dashboard only); `Sunset`/`Deprecation` headers (D13) appear on the radar with their date |

### P8 · Launch
| ID | Status | Evidence / missing |
|---|---|---|
| P8.2 production environment | 🟡 | `Dockerfile` (one image, all processes, 1.15 GB) **built**; `docker-compose --profile full up` verified: Postgres healthy, migrations applied in the container, backend `/ready` OK, providers healthy, GitHub App reached the real GitHub API. Host ports configurable (`BACKEND_PORT`, …). No host chosen (S5) |
| P8.3 public GitHub App | ❌ | Needs the production URL |
| P8.4 install-from-scratch test | ❌ | Needs the app installed |
| P8.5 demo reset | ✅ / ⏳ | `npm run demo:reset [-- --warm]`: providers → v1, Seismo data cleared, demo repo PRs closed / `seismo/*` branches deleted / rules emptied (**only the repo in `DEMO_REPO`**, tested), AI cache warm |
| P8.6 reliability | 🟡 | `/health`, `/ready` (checks the stores), container health checks, events/keys/settings persisted. No Sentry, no uptime ping |
| P8.8 rehearsals, P8.10 release | ❌ | Need the dashboard and the live install |

---

## 5. A-series (Adarsh, `adarzhpathade`)

Checked on GitHub: `origin/adarzhpathade` contains **no `dashboard/`** (the merge of his old branch was reverted). The old branch `origin/chore/dashboard-design-system` has a Next.js scaffold with the design system. **`NetPranav/seismo-demo-shop` now exists** (created by NetPranav's Claude on the lead's request, 2026-10-11).

| Phase | Status | Notes |
|---|---|---|
| A0 foundation | 🟡 | A0.1 scaffold + design system exist on the old branch only; GitHub login, A0.2 graph spike, A0.3 shell, A0.4 mock layer, A0.5 CI: not started |
| A1 demo shop, Demo Control, Compare v1 | 🟡 | **A1.1 done** (shop with checkout, invoice, orders; SDK wired in `instrumentation.ts`; `withAliases` in every client; `seismo.config.json`, `seismo.workflows.yml`, `seismo/aliases.json` + `aliases.test.ts`), **A1.5 done** (CI green). A1.2 breakage is visible (blank name, "Billed to —", ₹ amounts) but not styled; A1.3 Demo Control and A1.4 Compare UI are dashboard work |
| A2 onboarding + graph | ❌ | APIs ready: `/v1/graph`, `/v1/graph/impact`, `/v1/coverage`, `/v1/installations` |
| A3 status page | ❌ | APIs ready: `/v1/status`, `/v1/overview`, SDK keys |
| A4 timeline + drift | ❌ | APIs ready: `/v1/drift-events`, SSE `drift.created/updated` |
| A5 fix panel | 🟡 | A5.2 shop test (name blank on v2 without the rule, back with it) and A5.3 manual `withAliases` wiring are done in the shop; the panel UI is not |
| A6 review + settings | ❌ | `/v1/review` ready; Compare & Simulate API not yet (P6.10) |
| A7 radar UI | ❌ | waits for P7 |
| A8 landing + launch | ❌ | — |

**Most urgent for the team:** install `seismo-app` on `seismo-demo-shop` (lead), and Adarsh builds the dashboard against the now-real APIs.

---

## 6. Known limitations (honest list)

1. **State:** drift events, SDK keys, settings, fingerprints and code maps are in Postgres. Still in memory: the alert log, radar items and the AI cache (file cache optional), so a restart can resend a radar alert.
2. **Single project:** all ingested data is read as project `dev`; multi-project scoping and key ownership checks are missing.
3. **`/v1/me`** matches installations by account login only (organisation membership is not checked).
4. **`applyAliases` without an endpoint applies every rule to every response.** Still additive and safe (G1–G4), but the setup PR / manual wiring must pass the endpoint (`applyAliases(body, rules, 'GET /users/{id}')`).
5. **SDK + Next.js:** Next.js patches `fetch` too; call `seismo.init()` once in server start-up (instrumentation file) so our wrapper sees the calls. The `node:http` path still relies on the interceptor library: init before the first outbound request.
6. **Scanner coverage** is proven on one fixture shop; real repos will have unresolved calls (they are reported, not hidden).
7. **SDK overhead** p99 ≈ +0.6 ms on localhost (budget 1 ms); measured on one laptop only.
8. **Dev dependency audit:** 9 advisories in dev-only tools (drizzle-kit's bundled esbuild-kit); production dependencies: 0.
9. **Local port 4000** is used by another project on this laptop; run the backend with `PORT=4050` locally.
10. **AI latency:** 3–30 s per explanation on the hosted API. Alerts wait at most `ALERT_AI_WAIT_MS` (8 s) and otherwise send the template; the dashboard receives the AI text when it arrives. Pre-warm the demo scenarios.
11. **Alerts run in-process** (not pg-boss jobs): a backend crash mid-send loses that alert.
12. **Rotate the NVIDIA key** after the hackathon (it was pasted in chat).

## 7. What is needed to continue

| From | What |
|---|---|
| NetPranav | In the GitHub App settings tick the **Check suite** event (for C7/C8). **Install `seismo-app` on `seismo-demo-shop`** (https://github.com/apps/seismo-app/installations/new); add `TWILIO_TO=whatsapp:+91…` (and join the sandbox); optional `SLACK_WEBHOOK_URL`, `RESEND_API_KEY`, `ALERT_EMAIL_TO`; choose a host (S5); merge the `netpranav` → `main` PR |
| Adarsh | Switch to `adarzhpathade`; A0 shell + mock layer; **create `seismo-demo-shop` (A1.1)** |
| Then (NetPranav's Claude) | Live: setup PR check, scan, alias PR, CI → C7/C8, real WhatsApp; Docker image build; deploy to the chosen host; public app (P8.3) |
