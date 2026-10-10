# AI layer (NVIDIA NIM)

Owner: @NetPranav · Built in [P6](P6-meaning-changes-ai-alerts.md) (explainer, judge), [P7](P7-radar.md) (changelog parser) · Spike S1 in [P0](P0-foundation.md)

## 1. Principle
**AI explains and advises; deterministic code decides and acts.**
- Detection is rules and statistics (P4, P6).
- Fixes are data rules applied by a property-tested runtime (P5).
- The AI never writes code, never triggers an action, and never sees response values.
- Every AI output is JSON validated by zod. If the AI is slow, down or wrong-shaped, a template takes its place and the product still works.

Why this design: the safest pattern we found is to let a model *propose*, then gate everything with deterministic checks (schema validation, tests, builds) and prefer fixed rules over model output wherever a rule can cover the case (sources: Pixee codemodder docs on deterministic codemods; Spotify's background coding agents with verification loops, via ZenML; see [`../PS/sources.md`](../PS/sources.md)).

## 2. Provider setup

| Item | Value | Status |
|---|---|---|
| API | NVIDIA NIM hosted endpoint, OpenAI-compatible | Base URL `https://integrate.api.nvidia.com/v1` per third-party guides; **verify in S1** |
| Client | `openai` npm package with `baseURL` + `apiKey` from env | — |
| Quality model (`NIM_MODEL_SMART`) | `nvidia/nemotron-3-ultra-550b-a55b` (Nemotron 3 Ultra, 550B total / 55B active, released June 2026) | Model card ID confirmed on NVIDIA's API reference; availability to our key **verify in S1** |
| Fast model (`NIM_MODEL_FAST`) | A smaller Nemotron 3 (e.g. Super `nvidia/nemotron-3-super-120b-a12b`, or Nano) | **Verify in S1** |
| Structured output | `nvext.guided_json` (self-hosted NIM docs) or `response_format: json_schema`; on the hosted API it's unconfirmed | **Verify in S1**. Without it: JSON instructions + zod validation + retry |
| Rate limit | ~40 requests/min on the free tier per third-party reports (not official) | **Verify in S1**; we cap ourselves at 30/min |
| Known issue | Some developers report 403 on the hosted endpoint for certain models | S1 checks both models with our key |

S1 output (in MEMORY.md): working base URL, the two model IDs, whether structured output works, p50/p95 latency per task, and the choice of model per task.

## 3. Tasks

| Task | Model | Input (never raw values) | Output (zod schema) | Fallback |
|---|---|---|---|---|
| **Explainer** | Smart | Drift event: detector, endpoint, field path, before/after statistics, confidence; where used (file:line + ≤ 15-line snippet, optional); proposed action | `{ title, summary, impact, recommendation, risk, channels: { whatsapp ≤ 300 chars, slack, emailSubject, emailBody } }` | Template per detector |
| **Semantic judge** | Fast | Rename: candidate fields with type/format/similarity stats. Enum: new value + known values + where used. Unit: percentile ratios | `{ choice, confidence 0–1, reason ≤ 200 chars }` | Rule-based choice or "needs review" |
| **Changelog parser** (P7) | Smart | Changelog entry text (treated as untrusted data) | `{ changes: [{ endpoint?, field?, changeType, effectiveDate?, summary, quote }] }`; the quote must be a verbatim substring of the input | Item dropped |
| **PR/issue text** | Smart (reuses explainer) | Same as explainer + check results | Markdown sections filled into a fixed template | Template |

## 4. Guardrails
1. **JSON only, validated:** zod parse; on failure retry up to 2 times with the validation error; then fall back.
2. **Never on the hot path:** alerts send the template immediately and edit/follow up with the AI text when it arrives; UI shows "AI explanation pending".
3. **Cache:** keyed by a hash of the task + inputs; demo scenarios pre-warmed (P6.11).
4. **Rate limiting:** `bottleneck` at 30/min; queue in pg-boss; timeouts 20 s.
5. **Prompt-injection hygiene:** changelog text and code snippets go inside delimited data blocks; the system prompt says to treat them as data; outputs can't cause actions (they're only displayed or matched by deterministic code); quotes are verified.
6. **Privacy:** no response values ever; code snippets are optional (setting "Send code context to AI", default on for the demo repo) and disclosed on the landing page.
7. **Transparency:** every AI text in the UI shows the model name, latency and "AI-generated", with the template version one click away.
8. **Evaluation:** a fixed set of 10 drift cases (from P1 scenarios) runs in CI weekly or on demand; checks JSON validity, length limits, and that each explanation names the right field and impact. Used to pick Ultra vs Super in S1.

## 5. What the demo shows
- A review card where the AI explains the ×100 unit change in plain English, names checkout and invoice as affected, and recommends review (with model name + latency badge).
- The same explanation arriving on WhatsApp on the presenter's phone, and in Slack.
- The enum judgement with confidence ("closest to `shipped` 0.54").
- The radar turning a changelog paragraph into a matched, dated item.
- Toggling AI off live: the cards fall back to templates and everything still works. This shows the AI is an explainer, not a dependency.
