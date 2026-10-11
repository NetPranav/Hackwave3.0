# COMPLETION.md: what is built, what is verified, what is left

Status on **2026-10-11** (Day 1 of 14), branch `netpranav` at the commit that adds this file.
Everything below was checked by running the code, not by reading the plan. "Verified" means a test or a live run in this repo proves it; claims without proof are marked as such.

---

## 1. How it was verified

| Check | Result |
|---|---|
| Full test suite, run **twice** in a row (`npx turbo run test --force`) | 95 tests, 5 packages, green both times: contracts 5 · services 9 · github-app 16 · sdk 20 · backend 45 |
| Typecheck + build of every engine package (`turbo run typecheck build`) | 10/10 tasks green |
| ESLint over the repo | clean |
| `npm run setup` on a real laptop (local Postgres 17) | creates the `seismo` database, applies migrations ("setup done") |
| **End-to-end suite over real HTTP** (`backend/test/e2e.test.ts`) | 12/12 green. Fake providers → shop traffic through the real SDK → backend ingest → baselines → detectors → severity joined with a code map produced by the real scanner → planner → PR dispatch → graph/status/review APIs. One clean backend per scenario. Raw output: `backend/test/e2e-results.json` |
| Live boot with the real `.env` | backend `/health` OK; `/v1/*` returns 401 without a token and the user with a signed token; ingest rejects a bad SDK key (401); GitHub App boots, connects to smee and forwards webhooks; unsigned webhook → 400; internal routes without the shared token → 401 |
| GitHub App credentials | `GET /app` with the real key: app `seismo-app`, owner NetPranav, permissions checks/contents/issues/pull_requests write + metadata read, events push + pull_request. **Installed on 0 repos** (nothing to scan live yet) |
| Spikes | S1 NIM, S2 body capture, S3 Probot answered (see `MEMORY.md`). S4 Twilio, S5 host: not run |
| CI on GitHub | Earlier pushes failed (missing `packageManager` field, then a 5 s test timeout on slow runners). Both fixed. Run 38114122769 on the verification commit: **all green** (docs, node incl. the e2e suite on Node 22, python, `ci-ok`) |

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
| **orders-cursor** page → cursor | D1 `page` removed, D1 `total` removed, D2 `next_cursor` new, all **info** (the shop's code does not read them); no PR | Review when code reads them; D10 pagination (P6) | Pagination is behaviour, not a name |
| **payments-paise** ₹499 → 49,900 | **Not detected yet** (fingerprints already carry the magnitude shift `mag 2 → 4`; detector D5 is P6). No PR | P6: D5 unit change → review; optional human-triggered `needs-review` PR with a `scale` rule (÷100), never auto-merged | Money + meaning |
| **shipping-enum** new `partially_shipped` | **Not detected yet** (allow-listed enum labels are already in fingerprints; D7 is P6). No PR | P6: D7 → review + AI judgement of the closest known value | Meaning; the code's `if/switch` must be reviewed |
| **orders-limit-cap** asked 500, get 100 | **Not detected yet** (fingerprints already carry `reqLimit 500` and array `max 100`, `atMax`; D9 is P6). No PR | P6: D9 → review with a fixed template suggestion | See below |
| **resolve after merge** | `resolved`, graph green | — | — |
| endpoint starts returning 404 (engine test) | **D17** "endpoint appears to be gone" | Review | Dependency disappeared |
| 429s become common / rate-limit header changes (detector test) | **D12** | Review | Behaviour change |

### The limit cap (500 → 100), concretely
1. **Detection (P6, D9):** the SDK already sends the request's own `limit` (a customer-chosen parameter, not response data) and the array length sketch of the response. D9 fires when a new array-length maximum M is below the baseline maximum, at least 30 % of responses are exactly M, and the request asked for more than M. Evidence shown: *"asked 500, got exactly 100 in 64 % of calls"*.
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
| P0.11 | Dashboard↔backend auth | 🟡 | Backend side verified live (signed tokens, SSE token). `/v1/me` still returns placeholder name/installations (not mapped to real installations); dashboard side is Adarsh's |
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
| P3.4 projects + keys + ingest | 🟡 | create/revoke keys and validated gzip ingest tested. **Gaps:** keys kept in memory (lost on restart); every key's data lands in project `dev`; no ownership check on `/v1/projects/{id}/keys`; no ingest rate limit |
| P3.5 baselines | ✅ | presence, types, formats, enums, magnitude, lengths, shapes; `ready` flag computed (engine uses its own 50-sample minimum) |
| P3.6 status + overview + provider status | ✅ / 🟡 | Real numbers + drift colours; Statuspage poller written for GitHub only, not shown live |
| P3.7 install snippet + request to Adarsh | ❌ | Waiting for the shop repo |
| P3.8 privacy + fail-open tests | ✅ | secrets never on the wire; backend down → app unaffected |

### P4 · Catch a rename
| ID | Status | Evidence / missing |
|---|---|---|
| P4.1 contracts | ✅ | drift-event, notification |
| P4.2 framework, schedule (5 s), state machine | 🟡 | suspected → confirmed by persistence over 2 runs (verified). **Confirmation probes not built.** Events live in memory (`drift_events` table unused → lost on restart) |
| P4.3 D1–D4 incl. rename scoring | ✅ | real-traffic fixtures + e2e |
| P4.4 D11–D14, D16, D17 | ✅ | D11/D12/D13/D17 verified in engine; D14/D16 unit-level |
| P4.5 severity + impact | ✅ | confidence × impact × exposure; unread field → info (verified) |
| P4.6 notifications: dashboard SSE + **GitHub issue** | 🟡 | SSE events emitted. **GitHub issue per breaking event not built** |
| P4.9 soak | ✅ | e2e soak: 0 events |

### P5 · Fix it safely
| ID | Status | Evidence / missing |
|---|---|---|
| P5.1 contracts | ✅ | alias-spec, fix-request, validation-result |
| P5.2 `applyAliases` + G1–G4 | ✅ | fast-check, 10,000 runs each, + hostile inputs (cycles, getters, proxies, 200k arrays, frozen). Branch coverage not measured |
| P5.3 setup PR (codemod + `aliases.test.ts`) | ❌ | Fallback in the plan: Adarsh wires `applyAliases` by hand (A5.3) |
| P5.4 planner C1–C6 | ✅ | every conflict case blocks (tests) |
| P5.5 PR bot | ✅ / ⏳ | one-file change only, `seismo/*` branch, labels, body with checks + usages + revert; idempotent. Proven with a fake GitHub client, **not on a real repo yet** |
| P5.6 check run + CI tracking (C7/C8) | ❌ | `validation.ci` stays `pending` |
| P5.9 merge → resolved → green | ✅ / ⏳ | verified in engine + e2e; the webhook path from GitHub not exercised live |
| P5.10 suggestion PR for units | ❌ | Should |
| P5.11 cleanup PR | ❌ | Later |

### P6 · Meaning changes, AI, alerts: ❌ not started
D5/D9 (P6.2), D7/D8 (P6.3), D6/D10 (P6.4), NIM client (P6.5, only the spike exists), review items with explanations (P6.6: a basic review queue exists from P5), alert dispatcher (P6.7), Compare & Simulate API (P6.10), notification settings API (P6.13: in-memory GET/PUT exists, not persisted), AI cache (P6.11), webhook drift (P6.12).

### P7 · Radar: ❌ not started
The fake providers already publish `/changelog` (RSS) and `openapi.json` for it.

### P8 · Launch: ❌ not started
Production, public app, demo reset (a services-only `npm run demo:reset` exists), reliability, rehearsals, `v1.0`.

---

## 5. A-series (Adarsh, `adarzhpathade`)

Checked on GitHub: `origin/adarzhpathade` contains **no `dashboard/`** (the merge of his old branch was reverted). The old branch `origin/chore/dashboard-design-system` has a Next.js scaffold with the design system (fonts, globals, layout, smooth scroll, landing reference images). The repo `NetPranav/seismo-demo-shop` **does not exist**.

| Phase | Status | Notes |
|---|---|---|
| A0 foundation | 🟡 | A0.1 scaffold + design system exist on the old branch only; GitHub login, A0.2 graph spike, A0.3 shell, A0.4 mock layer, A0.5 CI: not started |
| A1 demo shop, Demo Control, Compare v1 | ❌ | Shop repo not created; blocks P2 live scan, P3.7, P5 live PR |
| A2 onboarding + graph | ❌ | APIs ready: `/v1/graph`, `/v1/graph/impact`, `/v1/coverage`, `/v1/installations` |
| A3 status page | ❌ | APIs ready: `/v1/status`, `/v1/overview`, SDK keys |
| A4 timeline + drift | ❌ | APIs ready: `/v1/drift-events`, SSE `drift.created/updated` |
| A5 fix panel | ❌ | Data ready: `fix.rule`, `fix.validation.checks`, `prUrl` |
| A6 review + settings | ❌ | `/v1/review` ready; Compare & Simulate API not yet (P6.10) |
| A7 radar UI | ❌ | waits for P7 |
| A8 landing + launch | ❌ | — |

**Most urgent for the team:** Adarsh moves to `adarzhpathade`, brings the dashboard scaffold over, and creates `seismo-demo-shop` (A1.1). Without the shop nothing can be proven on a real repo.

---

## 6. Known limitations (honest list)

1. **State in memory:** drift events, SDK keys and notification settings are lost when the backend restarts (fingerprints and code maps are in Postgres).
2. **Single project:** all ingested data is read as project `dev`; multi-project scoping and key ownership checks are missing.
3. **`/v1/me`** returns the signed-in login but placeholder installations.
4. **`applyAliases` without an endpoint applies every rule to every response.** Still additive and safe (G1–G4), but the setup PR / manual wiring must pass the endpoint (`applyAliases(body, rules, 'GET /users/{id}')`).
5. **SDK + Next.js:** Next.js patches `fetch` too; call `seismo.init()` once in server start-up (instrumentation file) so our wrapper sees the calls. The `node:http` path still relies on the interceptor library: init before the first outbound request.
6. **Scanner coverage** is proven on one fixture shop; real repos will have unresolved calls (they are reported, not hidden).
7. **SDK overhead** p99 ≈ +0.6 ms on localhost (budget 1 ms); measured on one laptop only.
8. **Dev dependency audit:** 9 advisories in dev-only tools (drizzle-kit's bundled esbuild-kit); production dependencies: 0.
9. **Local port 4000** is used by another project on this laptop; run the backend with `PORT=4050` locally.
10. **Rotate the NVIDIA key** after the hackathon (it was pasted in chat).

## 7. What is needed to continue

| From | What |
|---|---|
| NetPranav | Add `TWILIO_TO=whatsapp:+91…` (S4); choose a host (S5); add `RESEND_API_KEY` (optional); run `bash scripts/admin/bootstrap-github.sh`; merge PR #3 |
| Adarsh | Switch to `adarzhpathade`; A0 shell + mock layer; **create `seismo-demo-shop` (A1.1)** |
| Then (NetPranav's Claude) | Install the app on the shop → live scan; live alias PR; then P6 (D5/D7/D9/D10, NIM explanations, alerts), P7, P8 |
