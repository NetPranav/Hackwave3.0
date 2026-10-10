# Architecture: how live detection works, from scratch

## 1. System overview

```
 CUSTOMER SIDE                                         SEISMO CLOUD (or self-hosted)
 ─────────────                                         ─────────────────────────────
 ┌──────────────────────────┐   fingerprints (async,   ┌──────────────────────────────┐
 │ Customer backend         │   sampled, fail-open)    │ Ingest API                   │
 │  └─ Seismo SDK wraps     │ ───────────────────────▶ │  └─ validate, rate-limit     │
 │     fetch/axios/requests │                          └──────────────┬───────────────┘
 │     (read-only)          │                                         ▼
 └──────────────────────────┘                          ┌──────────────────────────────┐
                                                       │ Profile store (Postgres)     │
 ┌──────────────────────────┐   webhooks + API         │  baselines · windows · events│
 │ GitHub repo              │ ◀──────────────────────▶ └──────────────┬───────────────┘
 │  └─ Seismo GitHub App    │   (scan code, open PRs)                 ▼
 └──────────────────────────┘                          ┌──────────────────────────────┐
                                                       │ Detector engine              │
 ┌──────────────────────────┐   probes (cron)          │  10+ rules, every few seconds│
 │ Third-party APIs         │ ◀─────────────────────── └──────────────┬───────────────┘
 │ (sandbox credentials)    │   changelog/spec fetch                  ▼
 └──────────────────────────┘                          ┌──────────────────────────────┐
                                                       │ Code mapper (from GitHub App)│
                                                       │  field → function → workflow │
                                                       └──────────────┬───────────────┘
                                                                      ▼
                                                       ┌──────────────────────────────┐
                                                       │ Severity + decision engine   │
                                                       │  confidence × impact         │
                                                       └───────┬──────────────┬───────┘
                                                               ▼              ▼
                                                     ┌──────────────┐ ┌───────────────┐
                                                     │ Fixer (PRs)  │ │ Review queue  │
                                                     │ + validation │ │ + explanation │
                                                     └──────┬───────┘ └───────┬───────┘
                                                            ▼                 ▼
                                                       ┌──────────────────────────────┐
                                                       │ Dashboard (graph, timeline,  │
                                                       │ diffs, tests) + Slack/email  │
                                                       └──────────────────────────────┘
```

## 2. Where can we "see" an API? (capture options)

| Option | How it works | Pros | Cons | Use |
|---|---|---|---|---|
| **A. In-process SDK** | Library wraps the HTTP client inside the app and inspects each response after it arrives | Sees decrypted data (no TLS interception); per-language control; can compute fingerprints locally | Needs a code change (one line); one SDK per language | ✅ **Primary** |
| **B. Forward proxy / egress gateway** | Outbound traffic is routed through a proxy (base-URL swap or `HTTP(S)_PROXY`) | Language-agnostic; can enforce policies | Sits in the critical path: if it's down or slow, the app breaks; HTTPS needs a base-URL swap or certificate interception; harder security review | ❌ Not for MVP. Lunar.dev already does egress gateways (see [competitors.md](competitors.md)) |
| **C. eBPF / kernel capture** | Reads traffic at the OS level, TLS via uprobes on the crypto library | Zero code change | Linux-only, root, complex; heavier security review | Roadmap (Enterprise). Keploy, Speedscale and Levo use eBPF |
| **D. OpenTelemetry spans** | Reuse existing HTTP client spans | Already deployed in many apps | Spans don't carry bodies by default | Roadmap: enrich OTel instrumentation with fingerprints |
| **E. Synthetic probes** | Scheduled calls with known requests (from GitHub Actions or our runner) | Never touches production traffic or user data; covers quiet endpoints; confirms suspicions | Needs sandbox credentials; sees only what the probe asks | ✅ **Secondary** |

**Boundary:** Seismo observes traffic of apps the customer **owns**. Observing APIs behind websites you don't own is reverse-engineering and often violates terms of service. Not a use case.

## 3. The SDK

### 3.1 Install
```ts
// Node.js
import { seismo } from "@seismo/sdk";
seismo.init({ key: process.env.SEISMO_KEY, sampleRate: 0.1 }); // wraps fetch + axios
```
```python
# Python
import seismo
seismo.init(key=os.environ["SEISMO_KEY"], sample_rate=0.1)  # wraps requests + httpx
```

### 3.2 Behaviour guarantees
- **Read-only:** inspects a *clone* of the response; never modifies the original.
- **Fail-open:** all work runs after the response is handed back; exceptions are swallowed and counted; network failures drop the batch.
- **Bounded:** max body size inspected (default 256 KB), max fields per fingerprint (default 500), max queue (default 1,000 fingerprints) then drop.
- **Batched:** sends every 5 s or 100 fingerprints, gzip, HTTPS.
- **Allow/deny lists:** hosts to watch (default: all non-private hosts), fields to never inspect.
- **Overhead budget:** < 1 ms p99 added to the request path (fingerprinting happens off the hot path).

### 3.3 Fingerprint (what leaves the server)
The raw response stays on the customer's server:
```json
{"id": "pay_8812", "customer": {"name": "Priya Sharma", "email": "priya@x.com"},
 "amount": 49900, "currency": "INR", "status": "captured", "items": [{...}, {...}]}
```
What is sent:
```json
{
  "v": 1,
  "service": "api.payments.example",
  "endpoint": "GET /v1/payments/{id}",
  "status": 200,
  "latency_ms": 184,
  "ts": "2026-10-14T13:58:02Z",
  "req": { "query_keys": ["expand"], "limit_param": null },
  "headers": { "x-ratelimit-limit": "100", "sunset": null, "deprecation": null, "content-type": "application/json" },
  "shape_hash": "c41f…",
  "fields": {
    "id":             { "t": "string", "fmt": "prefixed_id", "len": 8 },
    "customer.name":  { "t": "string", "fmt": "text", "len": 12 },
    "customer.email": { "t": "string", "fmt": "email" },
    "amount":         { "t": "int", "mag": 4 },
    "currency":       { "t": "string", "fmt": "enum_candidate", "h": "9b2e…" },
    "status":         { "t": "string", "fmt": "enum_candidate", "h": "51aa…", "v": "captured" },
    "items":          { "t": "array", "n": 2, "id_hashes": ["e1…", "7c…"] }
  }
}
```
Numbers are summarised **per batch** (all fingerprints of one endpoint in one 5-second send) on the customer's server, so no single record's value is sent:
```json
{ "endpoint": "GET /v1/payments/{id}", "batch_n": 37,
  "num_sketch": { "amount": { "p5": 120, "p50": 520, "p95": 4900, "mag_hist": {"2": 20, "3": 15, "4": 2} } } }
```
No `min`/`max`: those are always one specific record's value. Percentiles are interpolated over the batch, and batches below 5 values are held back (see below).

Rules:
- **Strings are never sent**, only type, format class and length. Exception: values of fields on an explicit **enum allow-list** (e.g. `status`, `currency`) are sent in plain text, because enum labels aren't personal data and the plain value is needed to explain drift. Everything else is hashed with a per-customer salt.
- **The salt is generated and stored by the SDK on the customer's side and is never sent to Seismo.** Low-entropy values (enum labels, short IDs) could be brute-forced by anyone holding the salt, so Seismo deliberately doesn't hold it. Hashes are only compared with other hashes from the same customer (rename value-overlap, pagination overlap). The drift network shares only field paths, types and detector results, never hashes.
- **Numbers** are sent per response only as an order of magnitude (`mag = floor(log10(|x|))`). Percentiles come from the per-batch sketch above; the backend merges batch sketches into t-digests per field. Small batches (fewer than 5 values) are held back and merged into the next batch, so a percentile never equals one customer's single value.
- **Arrays** send length and salted hashes of item IDs (for pagination-overlap checks), never items.
- **Format classes** (computed locally): `email`, `uuid`, `prefixed_id`, `iso_date`, `epoch_s`, `epoch_ms`, `url`, `phone`, `currency_code`, `enum_candidate`, `text`.

This mirrors how **whylogs** profiles ML data so raw records stay in the customer's environment ([whylogs / WhyLabs](https://python.langchain.com/docs/integrations/providers/whylabs_profiling)); we apply the idea to outbound API responses.

### 3.4 Endpoint normalisation
`/v1/users/8812/orders?page=2` → `GET /v1/users/{id}/orders`. Path segments that look like IDs (numeric, UUID, `prefix_xxx`, long hex) become `{id}`. Query **keys** are kept, query **values** are dropped except known paging and limit parameters (`page`, `limit`, `per_page`, `$top`, `$skip`, `cursor` → presence only).

## 4. Baseline learning

Per `(service, endpoint, status class)` and per field path we keep:

| Statistic | Structure |
|---|---|
| Presence rate | count present / count total |
| Type distribution | counts per type |
| Null rate | count null / count present |
| Numeric distribution | t-digest merged from batch sketches (p5, p50, p95) |
| `log10` distribution | histogram of `floor(log10(x))` (for unit-change detection) |
| String length | t-digest |
| Format class | counts per class |
| Enum set | value counts (allow-listed) or hash counts; flagged as enum when distinct ≤ 20 with ≥ 200 samples |
| Array length | t-digest, max, **count at max** (lengths are counts, not record values) |
| Error body shape | set of shape hashes per 4xx/5xx status |
| Latency | t-digest |
| Rate-limit headers | last seen value + change history |
| 429 rate | per minute |

**Learning phase:** baseline is "ready" after ≥ 200 samples **or** 24 hours with ≥ 30 samples. Before that, detectors run in **observe-only** mode (amber at most).

**Baseline refresh:** after a change is accepted (fix merged or "expected change" marked), the baseline is rebuilt from post-change samples. Old baselines are kept as versions for the timeline.

## 5. Detection: what turns the flag red

The engine compares a **rolling window** (the most recent 20–200 samples, capped at 15 minutes, whichever is *smaller*) against the baseline. At ~5 req/s, 20 samples arrive in about 4 seconds, which is what makes the < 30 s detection target realistic; low-traffic endpoints simply take longer and lean on probes. Every rule is small, deterministic and explainable.

| # | Detector | Rule (defaults) | Catches |
|---|---|---|---|
| D1 | **Missing field** | Baseline presence ≥ 95% and window presence ≤ 5% over ≥ 20 samples | Removal, rename (half) |
| D2 | **New field** | Field absent in baseline, present in ≥ 50% of window | Addition, rename (other half) |
| D3 | **Rename** | D1 and D2 fire for the same object within the same window; candidate pair scored (see §5.1); score ≥ 0.75 | `name` → `display_name` |
| D4 | **Type change** | Dominant type in window ≠ dominant type in baseline (≥ 80% of window) | `"499"` → `499` |
| D5 | **Unit change** | Median ratio `r = p50_window / p50_baseline`; `k = log10(r)`; `|k − round(k)| < 0.05` and `round(k) ∈ {±1, ±2, ±3}`; p5 and p95 ratios agree within 20% (see §5.2) | Rupees → paise, seconds → ms |
| D6 | **Value drift** | Population Stability Index > 0.25 or KS test p < 0.001 on a numeric field, when D5 doesn't explain it | General meaning shift |
| D7 | **New enum value** | Field is an enum in baseline; a value never seen appears in ≥ 1% of window | `"partially_shipped"` |
| D8 | **Enum value vanished** | Value with ≥ 5% baseline share has 0% in a window of ≥ 200 | Status merged or renamed |
| D9 | **Silent truncation** | New array-length max `M` < baseline max; ≥ 30% of window responses have length exactly `M`; baseline share at any single cap < 5%. Confirmed if the request asked for more than `M` (see §5.3) | Pipedrive-style limit cap |
| D10 | **Pagination change** | Item-hash overlap between consecutive pages > 0 (overlap), or page N == page 1 (page param ignored), or a cursor field appears (`next`, `next_cursor`, `nextPageToken`, `Link` header) | IRIS overlap, Shopify cursor switch |
| D11 | **Error shape change** | A 4xx/5xx body shape hash never seen for that status | `{error}` → `{errors: []}` |
| D12 | **Rate-limit change** | `x-ratelimit-limit` header value changed, or 429 rate > 3× baseline | Slack/Docker style limits |
| D13 | **Deprecation signal** | `Sunset` ([RFC 8594](https://www.rfc-editor.org/rfc/rfc8594)) or `Deprecation` ([RFC 9745](https://www.rfc-editor.org/rfc/rfc9745)) header appears, or a `Link` with `rel="deprecation"` / `rel="sunset"` | "The provider told you; nobody reads headers" |
| D14 | **Empty-success** | Share of 200s with empty arrays / zero-length bodies > 5× baseline | Removal turned into `[]` (Jira MCP report) |
| D15 | **Latency shift** | p95 latency > 2× baseline over 15 minutes | Behaviour change, throttling |

### 5.1 Rename scoring
For each vanished field `A` and new field `B` under the same parent object:

```
score = 0.30 · type_match(A, B)            # same dominant type → 1
      + 0.20 · format_match(A, B)          # same format class → 1
      + 0.35 · value_similarity(A, B)      # see below
      + 0.15 · name_similarity(A, B)       # token overlap / edit distance: name ↔ display_name
```
`value_similarity`: numeric → 1 − KS distance between distributions; enum/hashed → Jaccard overlap of hashes (same salt per customer, so the same value hashes the same); text → similarity of length distributions.
If several candidates qualify, the highest wins; ties go to review.

Rename fixes are **fallbacks**, so even a wrong match is harmless (the old field is still read). That is why the threshold can be moderate.

### 5.2 Unit-change detection (the ×100 case)
A pure unit change multiplies every value by the same constant, so the **whole distribution shifts by the same factor** on a log scale. Example: baseline `amount` p5 = 99, p50 = 520, p95 = 4,900; window p5 = 9,900, p50 = 52,000, p95 = 490,000. All three ratios ≈ 100, `log10(100) = 2.00` → integer → **unit change, ×100, confidence high**.
A real business change (prices went up) moves percentiles by *different* factors and rarely lands exactly on a power of ten. Known non-decimal factors (4.45 lbf·s→N·s, 1,000 ms/s, 60 s/min, 1.609 mi/km) are checked too.
Gradual rollout: if the window mixes both distributions (bimodal `log10` histogram), state = amber "rollout in progress"; the transform waits until ≥ 95% of the window is in the new mode.

### 5.3 Silent-truncation signature (the Pipedrive case)
Normal list endpoints return lengths spread out (1, 7, 23, 480…). A silent cap produces a **pile-up at one exact number**. Rule D9 looks for that pile-up below the old maximum. If the SDK recorded a `limit` request parameter larger than the pile-up value, the cap is confirmed: *"You asked for 500, got exactly 100 in 64% of calls since 15 Jan."* This is the failure mode two official changelogs describe (Pipedrive, Lightspeed; see [evidence.md](evidence.md)).

### 5.4 Confirmation probe
Before an event goes red, the probe runner replays one representative request (sandbox credentials, from the fingerprint's endpoint + query keys) and checks that the change reproduces. This removes most false alarms caused by one odd response or a provider A/B test.

## 6. Code map (the GitHub App)

### 6.1 What it extracts
For each external call site:
- **Client + endpoint** (e.g. `axios.get(\`${PAYMENTS}/v1/payments/${id}\`)` → `GET /v1/payments/{id}`)
- **Fields read** from the response (`res.data.amount`, destructuring, `?.`)
- **Usage kind** per field: `display` (rendered/logged), `arithmetic` (+ − × ÷, comparisons), `branching` (`if`/`switch`/ternary), `persistence` (written to DB/queue), `outbound` (sent to another API)
- **Function → route → workflow** (workflow names from a small config file, route prefixes or test names: `checkout`, `invoice`, `order-history`)

### 6.2 How
1. **ts-morph** for JS/TS (MVP, see [`../roadmap/P2-see-your-apis.md`](../roadmap/P2-see-your-apis.md)); tree-sitter for Python later. Follow variables within a function and one level across calls.
2. *(Post-MVP)* **LLM-assisted extraction** for dynamic code the AST can't resolve (string-built URLs, generic clients): the model gets the snippet and returns a structured JSON of endpoint + fields; results are cached per file hash and marked "inferred".
3. **Runtime join**: the SDK's call-site stack frame (file:line, sampled) confirms which code produced which call, improving the map over time.

Honest limit: static analysis of dynamic languages is incomplete. The map is labelled with coverage ("312 field reads mapped, 18 inferred, 4 unresolved") and the runtime join fills gaps.

## 7. Severity and decisions

```
severity = confidence × impact × exposure
  confidence ∈ [0,1]  from the detector (+0.1 if confirmation probe reproduced)
  impact     = max over usages of field: display 0.3 · arithmetic 0.7 · persistence 0.8 · branching 0.9 · money 1.0
               (money = arithmetic/persistence on fields named like amount/price/total/fee or currency-adjacent)
               0.05 if the field is not read anywhere in code
  exposure   = share of endpoint traffic affected (0..1), floor 0.2
```

| State | Rule | Action |
|---|---|---|
| 🟢 Normal | no detector firing | — |
| ⚪ Info | change on a field nobody reads, or additive change | Timeline entry only |
| 🟡 Suspected | detector firing, not confirmed, or severity 0.2–0.5 | Dashboard + digest |
| 🔴 Breaking | confirmed and severity ≥ 0.5 | Alert (Slack/email) + fix flow |
| 🔵 Fix pending | PR opened | Track CI + review |
| ✅ Resolved | PR merged or marked expected | Baseline rebuilt |

**Fix routing:**
- Rung 1 (alias) that passes conflict checks C1–C6 → "auto-safe" PR adding one data rule to `seismo/aliases.json`; a human merges after CI (C7–C8) is green. Spec: [`../roadmap/P5-fix-it-safely.md`](../roadmap/P5-fix-it-safely.md).
- Rung 2 (transform) → review item with explanation and suggestion; never auto-applied. A human may open a `needs-review` suggestion PR.
- Rung 3 (behaviour) → review item with explanation and a suggested change; no automatic PR.
- Confidence < 0.6 on any rung → no PR; review card with the evidence and a "this is expected" button.

## 8. Validation (regression tests)

1. **Repo CI** runs on every fix PR (GitHub checks).
2. **Shape replay tests:** from stored fingerprints, Seismo generates synthetic responses matching the **new** shape (types, formats, ranges, enum values; fake values, no real data) and runs the workflow tests against the adapter. Red → green on the dashboard.
3. **Before/after diff:** the PR description shows a table of workflow tests before the fix (fail) and after (pass).

## 9. Where the LLM is used (and where it is not)

| Used for | Not used for |
|---|---|
| Plain-English explanation of a drift event for the review card and PR description | Detecting drift (deterministic rules only) |
| Classifying a new enum value's likely meaning ("`partially_shipped` is closer to `shipped`"), with confidence | Deciding to auto-merge |
| Extracting endpoints/fields from dynamic code the AST can't resolve | Seeing raw customer data (it gets statistics and code only) |
| Summarising provider changelog entries into structured changes (add-on) | — |

Model choice (decided 2026-10-11): **NVIDIA NIM, Nemotron family**: a quality model (Nemotron 3 Ultra) for explanations and a faster one for classification, picked by a benchmark spike. Outputs are JSON validated with zod; invalid output → template fallback. Full spec: [`../roadmap/ai-layer.md`](../roadmap/ai-layer.md).

## 10. Data model (MVP)

| Table | Key columns |
|---|---|
| `orgs`, `users` | GitHub org/user IDs, plan |
| `repos` | org, installation ID, default branch, scan status |
| `services` | host, display name, org |
| `endpoints` | service, method, path template |
| `field_profiles` | endpoint, path, baseline version, stats (JSONB), ready flag |
| `windows` | endpoint, time bucket, aggregated stats (JSONB) |
| `fingerprints_raw` | short retention (24 h) for debugging; shape only |
| `drift_events` | endpoint, field, detector, confidence, severity, state, evidence (JSONB), first/last seen |
| `code_refs` | repo, file, line, endpoint, field, usage kind, workflow, inferred flag |
| `workflows` | repo, name, entry points |
| `fixes` | drift event, rung, PR URL, CI status, review status |
| `probes` | endpoint, request template, schedule, last result |
| `provider_notices` (add-on) | service, source URL, date, parsed change, matched endpoints |

## 11. Tech stack

**Updated 2026-10-11: all TypeScript.** The full list with verification status is in [`../roadmap/libraries.md`](../roadmap/libraries.md); layout and environments in [`../roadmap/setup-and-deploy.md`](../roadmap/setup-and-deploy.md).

| Part | Choice | Why |
|---|---|---|
| Fake services | Node + **Fastify**, v1/v2 scenario toggles + admin API | Same language as everything else |
| Demo shop | **Next.js**, separate repo `seismo-demo-shop` | The GitHub App is installed on a real separate repo |
| SDK | TypeScript (Node); runtime `applyAliases` in `@seismo/sdk/runtime` | Matches demo app |
| Backend | **Fastify** API + **pg-boss** worker | One language; Postgres-only queue |
| Storage | **Postgres** (Neon in the cloud, Docker locally) via drizzle | JSON columns for statistics |
| Contracts | **zod** → TS types, JSON Schema, OpenAPI, mock data | Shared by all three developers |
| GitHub App | **Probot** (or @octokit/app), manifest flow | Standard tooling |
| Code scan | **ts-morph** (no LLM in the MVP) | Precise TS/JS analysis |
| LLM | **NVIDIA NIM** (Nemotron), OpenAI-compatible client, JSON outputs | See [`../roadmap/ai-layer.md`](../roadmap/ai-layer.md) |
| Dashboard | Next.js + Tailwind + shadcn/ui; react-force-graph-2d or Sigma (graph); React Flow (impact chain) | Graph look + clarity |
| Live updates | Server-sent events (polling as fallback) | Simple |
| Tests | Vitest, Playwright, fast-check (property tests) | Red → green + proven guarantees |
| Auth | GitHub OAuth through the GitHub App (Auth.js) | No separate login system |
| Hosting | Vercel (dashboard), a non-sleeping Node host (API, worker, services, app), Neon | Public URLs for webhooks and the landing page |

## 12. Security and privacy model

- Shape-only telemetry; per-customer salted hashes; enum allow-list is explicit and visible in the dashboard.
- Data residency option (self-hosted backend) on the roadmap; for India, this matters as DPDP Rules phase in (main duties around May 2027 per secondary sources; see [add-ons.md](add-ons.md)).
- GitHub App: minimal permissions (contents read, pull requests write, checks read, metadata read); fix branches are namespaced `seismo/*`.
- Probe credentials stored encrypted; sandbox keys recommended.
- Audit log of every PR, approval and baseline change.

## 13. Failure modes and how we handle them

| Failure | Handling |
|---|---|
| Seismo backend down | SDK drops telemetry; app unaffected; dashboard shows data gap |
| Low traffic endpoint | Probes on schedule; confidence capped until enough samples |
| Provider A/B test (two shapes at once) | Bimodal detection → amber "mixed shapes", no PR until stable |
| Our own deploy changed the request (not the provider) | Correlate with GitHub deploy/commit timeline; label "possibly self-inflicted" ("us or them" add-on) |
| Seasonal value changes (sale prices) | Unit detector requires power-of-ten + consistent percentile ratios; general drift (D6) stays amber unless code impact is high |
| Code map wrong or incomplete | Shown with coverage; runtime call-site join corrects it; review before any rung 2/3 fix |
