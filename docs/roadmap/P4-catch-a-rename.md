# P4 · Catch a rename: detectors + code-aware severity + first alerts (Days 6–8)

**Done when:** flipping users `name` → `display_name` turns the endpoint amber in < 30 s and red in < 60 s, the graph path users → name → invoice/checkout pulses red, a GitHub issue appears on the demo repo, and the dashboard bell shows the alert. Removing a field nobody reads stays a quiet "info" event.

**Depends on:** P2 (code map), P3 (baselines) · **Contracts:** `drift-event`, `notification` · **Owners:** NetPranav (detectors, severity), OVERxPOWERED (GitHub notifications), adarzhpathade (timeline, drift detail, graph states)

## Detector framework
- A detector is a pure function `(baseline, window, context) → Finding[]`. Each `Finding` has: detector ID, endpoint, field path, confidence (0–1), evidence (before/after statistics), suggested rung (alias / review).
- Runs in the worker every 5 s per endpoint with new data; window = most recent 20–200 samples capped at 15 min.
- Findings are merged into **drift events** with a state machine: `suspected → confirmed → fix_pending → resolved | expected`. A confirmation probe (replay one recorded request template against the provider) promotes `suspected` → `confirmed`.
- Every detector ships with a v1→v2 fixture test built from the P1 scenarios.

## Detectors in this phase (structural + header signals)

| ID | Detector | Rule (defaults, tunable) |
|---|---|---|
| D1 | Missing field | baseline presence ≥ 95%, window ≤ 5%, ≥ 20 samples |
| D2 | New field | absent in baseline, ≥ 50% of window |
| D3 | Rename | D1 + D2 under the same parent in the same window; score = 0.30 type + 0.20 format + 0.35 value similarity (hash overlap / distribution) + 0.15 name similarity (fastest-levenshtein + token overlap); ≥ 0.75 |
| D4 | Type change | dominant type differs in ≥ 80% of window |
| D11 | Error shape change | unseen 4xx/5xx body shape hash |
| D12 | Rate-limit change | `x-ratelimit-limit` changed, or 429 rate > 3× baseline |
| D13 | Deprecation signal | `Sunset` (RFC 8594) / `Deprecation` (RFC 9745) header or `Link rel="deprecation|sunset"` |
| D14 | Empty success | share of empty arrays/bodies on 200 > 5× baseline |
| D17 | Endpoint gone | share of 404/410 (or the provider's "removed" error shape) on a previously healthy endpoint > 20% of the window → "dependency disappeared" |
| D16 | Dual-field divergence | old and new field both present but values differ (hash) → the old field may be going stale (guards the alias fix's known limit, see P5) |

## Severity (code-aware)
`severity = confidence × impact × exposure`; impact from the code map's usage kinds (display 0.3 · arithmetic 0.7 · persistence 0.8 · branching 0.9 · money 1.0; 0.05 if no code reads the field). States: ⚪ info · 🟡 suspected · 🔴 breaking (confirmed and ≥ 0.5) · 🔵 fix pending · ✅ resolved. Full formula in [`../PS/architecture.md`](../PS/architecture.md) §7.

## Sub-phases

| ID | Task | Owner | Output |
|---|---|---|---|
| P4.1 | `contracts/drift-event` + `contracts/notification` | NetPranav | Merged first |
| P4.2 | Detector framework + scheduling + state machine + confirmation probes | NetPranav | Worker jobs |
| P4.3 | D1–D4 incl. rename scoring | NetPranav | Fixture tests green |
| P4.4 | D11–D14, D16, D17 | NetPranav | Fixture tests green |
| P4.5 | Severity engine joined with code map; impact paths via graphology BFS | NetPranav | `GET /v1/drift-events` |
| P4.6 | Notification fan-out v1: dashboard (DB + SSE) and **GitHub**: one issue per breaking event on the affected repo (labels `seismo`, severity), updated on state change | OVERxPOWERED | Issues appear on the demo repo |
| P4.7 | Timeline page, drift detail page (before/after stats, detector reasoning, where used), notification bell | adarzhpathade | See [dashboard.md](dashboard.md) §6–7 |
| P4.8 | Graph states: amber/red/blue/green; red path pulse from changed field to workflows | adarzhpathade | Live via SSE |
| P4.9 | Soak test: 10 minutes of v1 traffic → zero non-info events | NetPranav | Recorded in PR |

## Libraries
fastest-levenshtein · graphology-traversal · simple-statistics (KS/PSI helpers, or hand-rolled) · Octokit (issues). Status in [libraries.md](libraries.md).

## Definition of Done
- [ ] Rename flip: amber < 30 s, red < 60 s, correct impact path, GitHub issue, dashboard alert
- [ ] Error-shape and `Sunset` header flips detected with the right detector IDs
- [ ] Removing an unused field → info only, no alert
- [ ] 10-minute soak: no false positives
- [ ] Every detector has a fixture test

## Cut line
Must: D1–D4, D13, severity, dashboard + GitHub notifications, graph states · Should: D11, D12, D14, D16, D17, probes · Later: latency-shift detector (D15)
