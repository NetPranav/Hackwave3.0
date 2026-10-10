# P6 · Catch meaning changes + AI explanations + alert channels (Days 8–11)

**Done when:**
1. The rupees → paise flip is detected as "×100 unit change" (p5/p50/p95 all ×100), lands in the review queue with an AI explanation, sends WhatsApp + Slack/Discord + email alerts, and produces **no** automatic PR (money field).
2. The shipping `partially_shipped` flip is detected as a new enum value. The AI's JSON judgement ("closest to `shipped` 0.54 / `pending` 0.46; used in a refund `if`") appears on the review card.
3. The orders limit cap is detected as silent truncation ("asked 500, got exactly 100 in 64% of calls").

**Depends on:** P4, P5 · **Contracts:** `ai-explanation`, `review-item`, `notification` (extended) · **Owners:** NetPranav (detectors, AI layer), OVERxPOWERED (alert dispatcher), adarzhpathade (review queue, settings, Compare & Simulate)

## Detectors in this phase (semantic + behavioural)

| ID | Detector | Rule (defaults) |
|---|---|---|
| D5 | Unit change | `k = log10(p50_window / p50_baseline)`; \|k − round(k)\| < 0.05, round(k) ∈ {±1, ±2, ±3}; p5 and p95 ratios agree within 20%; known non-decimal factors (60, 1000, 4.45, 1.609) also checked; bimodal window → "rollout in progress" |
| D6 | Value drift | PSI > 0.25 or KS p < 0.001 when D5 doesn't explain it → review only |
| D7 | New enum value | enum field (≤ 20 distinct, ≥ 200 samples); unseen value in ≥ 1% of window |
| D8 | Enum value vanished | value with ≥ 5% baseline share at 0% over ≥ 200 samples |
| D9 | Silent truncation | new array-length max M < baseline max; ≥ 30% of responses exactly M; confirmed if request `limit` > M |
| D10 | Pagination change | item-hash overlap between consecutive pages, page N == page 1, or a cursor field appears |

## AI layer (full spec in [ai-layer.md](ai-layer.md))
- OpenAI-compatible client pointed at NVIDIA NIM; models from env (`NIM_MODEL_SMART`, `NIM_MODEL_FAST`), chosen by spike S1.
- **Tasks:** (1) **Explainer**: drift event + statistics + where used → JSON with title, summary, impact, recommendation and per-channel text (WhatsApp ≤ 300 chars, Slack, email). (2) **Semantic judge**: ambiguous rename candidates, nearest meaning of a new enum value, sanity check of a unit change → JSON choice + confidence.
- **Guardrails:** zod-validated JSON only; 2 retries; then a deterministic template. Never on the hot path; alerts go out with the template first and are updated with the AI text when it arrives. Results cached by event signature. Client-side rate limiter below the NIM limit. Inputs are statistics, field paths and short code snippets only, never response values. A setting turns code snippets off.

## Alert channels
| Channel | How | Notes |
|---|---|---|
| Dashboard | DB notifications + SSE + bell | Always on |
| GitHub | Issue per breaking event (P4) + comment on the alias PR | Always on for installed repos |
| WhatsApp | Twilio WhatsApp **sandbox** | Recipients join the sandbox once; free-form messages work only within 24 h of the recipient's last message, and sandbox participation reportedly expires after ~3 days. **Rejoin on demo morning** |
| Slack / Discord | Incoming webhook URL per project | Block Kit / embed formatting |
| Email | Resend (free tier) | Critical alerts immediately + daily digest |

Dispatcher rules: one alert per drift event per channel, updates are threaded or edited where possible, severity thresholds per channel (default: WhatsApp only for 🔴), quiet hours later.

## Sub-phases

| ID | Task | Owner | Output |
|---|---|---|---|
| P6.1 | `contracts/ai-explanation`, `contracts/review-item`, extend `notification` | NetPranav | Merged first |
| P6.2 | D5 unit change + D9 truncation (fixture tests) | NetPranav | Must |
| P6.3 | D7/D8 enum detectors | NetPranav | Must |
| P6.4 | D6 value drift, D10 pagination | NetPranav | Should |
| P6.5 | AI client (NIM), prompt templates, zod schemas, retries, template fallback, cache, rate limiter | NetPranav | `ai.explain()`, `ai.judge()` |
| P6.6 | Review items: created for every non-alias event with explanation + deterministic suggested change; actions: mark expected, snooze, open suggestion PR (P5.10) | NetPranav | `GET/POST /v1/review` |
| P6.7 | Alert dispatcher (pg-boss jobs): Slack/Discord webhooks, Resend email, Twilio WhatsApp, GitHub comments; dedup + thresholds | OVERxPOWERED | Alerts on all channels |
| P6.8 | Notification settings page (channels, thresholds, WhatsApp number, test-send button) | adarzhpathade | Settings UI |
| P6.9 | Review queue + review card (evidence, AI explanation with model name + latency, suggested change, actions) | adarzhpathade | See [dashboard.md](dashboard.md) §8 |
| P6.10 | **Compare & Simulate**: endpoint baseline vs current shape diff (synthetic examples from fingerprints, `jsondiffpatch`), and "what-if": pick a change type (rename/unit/enum/limit) → impact path + whether current aliases cover it + preview of the suggestion | adarzhpathade + NetPranav | See [dashboard.md](dashboard.md) §9 |
| P6.11 | Pre-warm AI cache for the three demo scenarios | NetPranav | Demo never waits on the LLM |
| P6.12 | *(Should)* **Webhook drift**: `seismo.webhook(handler)` wrapper fingerprints inbound provider webhooks; same detectors; the fake payments provider sends `payment.captured` webhooks with a v2 variant | NetPranav + OVERxPOWERED | Official PS mentions webhooks |

## Libraries
openai (OpenAI-compatible client) · zod · bottleneck (rate limit) · p-retry · twilio · resend · simple-statistics · jsondiffpatch. Status in [libraries.md](libraries.md).

## Definition of Done
- [ ] Paise, enum and truncation flips detected with correct evidence; no auto-PR for any of them
- [ ] AI explanations appear on review cards; with NIM disabled, template text appears instead and nothing breaks
- [ ] WhatsApp, Slack/Discord and email received for a 🔴 event on staging
- [ ] A 20% price increase does **not** trigger D5 (test)
- [ ] Compare & Simulate shows diffs for all scenarios

## Cut line
Must: D5, D7, D9, explainer, review queue, WhatsApp + Slack · Should: D6, D10, semantic judge, email, Discord, what-if simulation, webhook drift (P6.12) · Later: quiet hours, per-user preferences
