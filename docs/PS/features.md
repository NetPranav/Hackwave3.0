# Features

> **Schedule, owners and up-to-date scope live in [`../roadmap/`](../roadmap/README.md)** (14-day plan, phases P0–P8). This file stays as the feature catalog.

Priorities use MoSCoW: **Must** (demo fails without it), **Should** (big win, build if on schedule), **Could** (only if ahead), **Later** (post-hackathon roadmap).

## 1. Feature list

### Capture and detection
| ID | Feature | Priority | Acceptance criteria |
|---|---|---|---|
| F1 | Node SDK wrapping `fetch` + `axios` | Must | Demo shop calls fake services through the SDK; with the backend stopped, the shop still works (fail-open) |
| F2 | Shape-only fingerprints + batch number sketches | Must | No string value from a response appears in the ingest log (test asserts it) |
| F3 | Endpoint normalisation | Must | `/users/42` and `/users/77` map to `GET /users/{id}` |
| F4 | Baseline learning with ready threshold | Must | Seed script makes all demo endpoints "ready" in < 60 s |
| F5 | Detectors D1–D3 (missing, new, rename) | Must | `name` → `display_name` flip detected as rename with confidence ≥ 0.75 in < 30 s |
| F6 | Detector D5 (unit change) | Must | Rupees → paise flip detected as "×100 unit change" in < 30 s; a 20% price rise is **not** flagged as unit change |
| F7 | Detector D7 (new enum value) | Must | Shipping `partially_shipped` detected; routed to review |
| F8 | Detector D9 (silent truncation) | Should | `limit=500` capped at 100 detected with "asked 500, got exactly 100" |
| F9 | Detectors D4, D11, D12, D13, D14 (type, error shape, rate limit, Sunset/Deprecation headers, empty-success) | Should | Each has a v2 switch in a fake service and a passing unit test |
| F10 | Detector D10 (pagination overlap/cursor) | Could | Page overlap detected on the fake orders service |
| F11 | Confirmation probe | Should | Red only after the probe reproduces; probe result visible on the event |
| F12 | Python SDK | Later | — |

### Code map and impact
| ID | Feature | Priority | Acceptance criteria |
|---|---|---|---|
| F13 | GitHub App install + repo scan (JS/TS) | Must | Installing on the demo repo lists all external calls with file:line |
| F14 | Field usage + usage kind (display, arithmetic, branching, persistence) | Must | `amount` in checkout is "arithmetic + money"; `name` on invoice is "display" |
| F15 | Workflow mapping via `seismo.workflows.yml` | Must | Checkout, Invoice, Orders, Shipping workflows appear in the graph |
| F16 | Code-aware severity | Must | Removing an unused field → Info; changing `amount` → Breaking |
| F17 | LLM fallback extraction for dynamic URLs | Could | At least one string-built URL resolved and marked "inferred" |
| F18 | Runtime call-site join | Later | — |

### Fixing and validation
| ID | Feature | Priority | Acceptance criteria |
|---|---|---|---|
| F19 | Setup PR: wrap API clients with `applyAliases`, add empty `seismo/aliases.json` + property test file | Must | Demo shop behaviour unchanged after merge |
| F20 | Rung 1 alias PR (rename): one data rule, safety checks C1–C8 | Must | PR opened automatically with diff, drift link, check run, CI |
| F21 | Rung 2 transform: review item with explanation + suggestion; optional human-triggered `needs-review` PR | Must (review item) / Should (PR) | Never auto-applied |
| F22 | Review card with LLM explanation + "expected change" button | Must | Shipping enum case shows explanation; no PR created when confidence < 0.6 |
| F23 | Shape replay tests (red → green) | Should | Workflow tests fail on v2 without adapter, pass with it; shown on dashboard |
| F24 | Cleanup PR for dead fallbacks | Could | Triggered manually in demo ("fast-forward 30 days" button) |
| F25 | Auto-merge for rung 1 when repo opts in | Later | — |

### Dashboard
| ID | Feature | Priority | Acceptance criteria |
|---|---|---|---|
| F26 | GitHub login | Must | OAuth login shows the user's installed repos |
| F27 | **Dependency graph** (Obsidian-style) | Must | See §3 |
| F28 | Service health cards | Must | Live call counts and state per service |
| F29 | Change timeline | Must | Each drift event with type, time, severity, state |
| F30 | Drift detail page | Must | Before/after stats, detector reasoning, affected code, proposed fix |
| F31 | Impact chain view (left-to-right) | Should | Change → fields → functions → workflows, animated red → green |
| F32 | Validation results panel | Should | Tests red → green per workflow |
| F33 | Demo control panel | Must | Buttons to flip each fake service to v2 live; reset button |
| F34 | Status banner | Should | "Change detected → 3 workflows affected → Fix PR opened → Tests passed" |
| F35 | Slack/email alert | Could | One Slack webhook message per red event |

## 2. Dashboard screens

1. **Overview:** service cards (green/amber/red), counts of APIs, endpoints, fields mapped, open drifts, PRs pending.
2. **Graph:** the Obsidian-style dependency graph (below).
3. **Timeline:** vertical list of drift events, filter by service/severity/state; deploys from GitHub shown as markers (prepares the "us or them" add-on).
4. **Drift detail:** header (service, endpoint, field, detector, confidence, severity); before/after statistics (sparklines, percentiles, presence); "where it's used" (file:line list with usage kind); proposed fix (diff); validation (tests before/after); actions (approve PR, mark expected, snooze).
5. **Review queue:** all items needing a human, sorted by severity.
6. **Settings:** SDK key, sample rate, enum allow-list, probe credentials, workflows file, alert channels, AI on/off.
7. **Demo panel** (hackathon only): v1/v2 switches, traffic generator, reset.

## 3. Dependency graph spec ("Obsidian view")

**Purpose:** answer *"what do we depend on, and what breaks if X changes?"* at a glance. It must answer a question, not just look cool.

| Element | Spec |
|---|---|
| Node types | Service (large circle) · Endpoint (medium) · Field (small dot) · Code location (square) · Workflow (diamond, outer ring) |
| Edges | service → endpoint → field → code location → workflow |
| Colour | 🟢 normal · 🟡 suspected · 🔴 breaking · 🔵 fix pending · ⚪ unused field (dimmed) |
| Size | Endpoint size ∝ call volume; field size ∝ number of code reads |
| Interaction | Click a node → highlight its full upstream/downstream path, dim the rest; hover → tooltip with stats; search box; filter by service or workflow |
| Animation | On a new red event the path pulses red; on merge it fades to green |
| Layout | Force-directed for overview (`react-force-graph-2d` or `sigma.js`); the drift detail page uses a left-to-right **React Flow** chain for readability |
| Deprecations | Endpoints with `Sunset`/`Deprecation` headers or matched changelog notices get a clock badge with the date |
| Unused fields | Fields returned but never read are dimmed; useful as "what we could ignore" and for later cost/PII work |

## 4. Fake services for the demo

| Service | Endpoints | v2 switches (each a separate toggle) |
|---|---|---|
| **users** | `GET /users/{id}`, `GET /users` | `name` → `display_name` (rename) · error body `{error}` → `{errors: []}` |
| **payments** | `GET /payments/{id}`, `POST /payments` | `amount` rupees → paise (×100) · `amount` string → number (type) |
| **shipping** | `GET /shipments/{id}` | new status `partially_shipped` (enum) · `Sunset` header added |
| **orders** | `GET /orders?limit=&page=` | max limit 500 → 100 silently (truncation, Pipedrive-style) · page → cursor |
| **weather** (optional) | `GET /forecast` | temperature °C → K (offset, not a ratio: a deliberate "hard" case that should land in review via D6) |

Each service exposes `POST /admin/version` to flip toggles, and `POST /admin/reset`.

## 5. Non-functional requirements

| Requirement | Target |
|---|---|
| SDK overhead | < 1 ms p99 on the request path |
| Detection latency (demo traffic of ~5 req/s) | < 30 s from flip to amber, < 60 s to red (with probe) |
| False positives in the demo | 0 on the "normal" scenario during a 10-minute soak |
| Privacy | Automated test: no response string values in ingest storage |
| Reliability | Demo runs fully offline on one laptop (Docker Compose), with a recorded backup video |
