# Solution

## 1. What we are building

**Seismo** (working name) is a **dependency guard for third-party APIs**. It learns how each external API your code calls normally behaves, detects silent changes in shape, behaviour and meaning, shows exactly which code and user workflows they break, and opens a safe pull request to fix them. When it isn't confident, it asks a human with a clear explanation instead of guessing.

> **"Dependabot for the APIs you depend on."** Dependabot watches your libraries and opens PRs. Seismo watches the APIs you call and opens PRs.

## 2. Three sources of truth

The core idea is to combine three signals that existing tools use separately:

| Source | Tells us | How we get it |
|---|---|---|
| **Code** | What you *use*: which endpoints, which fields, where, in which workflow | GitHub App scans the repo (AST via tree-sitter + LLM-assisted extraction for dynamic cases) |
| **Traffic** | What you *get*: the real shape, values and behaviour of responses, now vs before | One-line SDK wrapping the HTTP client, sending **shape and statistics only**; plus scheduled probes for low-traffic endpoints |
| **Provider signals** | What's *coming*: announced changes and deprecations | `Sunset` / `Deprecation` response headers, changelogs, OpenAPI specs, status pages |

> *"Code says what you use. Traffic says what you get. Changelogs say what's coming."*

## 3. User journey

1. **Install (2 minutes).** The developer installs the Seismo GitHub App on a repo and logs into the dashboard with GitHub.
2. **First "wow" with zero production access.** The repo scan builds a graph of every external API the code calls: service → endpoint → fields → functions → workflows. No SDK yet, so no trust required.
3. **Turn on live protection.** Add the SDK (one import + one init line). It wraps `fetch`/`axios` (Node) or `requests`/`httpx` (Python).
4. **Baseline.** Seismo learns each endpoint's normal profile from the first ~200 calls or 24 hours. Probes fill in endpoints with little traffic.
5. **Drift happens.** A detector fires. Seismo joins it with the code map to decide whether the change touches code you actually run.
6. **Alert with context.** Slack/email: *"Payments API: `amount` values jumped ~100× at 13:58. Used in `checkout.ts:42` and `invoice.ts:88` (Checkout, Invoice workflows). Likely rupees → paise. Needs review."*
7. **Fix.** Seismo opens a PR against a single adapter file, runs CI, and links the drift event. Safe fixes are labelled "auto-safe"; risky ones are labelled "needs review" with an explanation.
8. **Close the loop.** After merge, the graph goes back to green. When the old field hasn't appeared for 30 days, Seismo opens a cleanup PR that removes the dead fallback.

## 4. Fix philosophy: add, never replace

### 4.1 Tolerant Reader
Our fixes follow the **Tolerant Reader** pattern ([Martin Fowler, 2011](https://martinfowler.com/bliki/TolerantReader.html)): read only what you need, tolerate unknown and missing fields, and don't bind tightly to the provider's schema. Applied to drift:

- When `name` is renamed to `display_name`, we don't replace `name`. We read `display_name` **if present**, otherwise `name`.
- If our rename guess is wrong, the old field is still read, so **the fix cannot make things worse**. That makes rename fixes *safe by construction*, which is what allows auto-fixing them.

### 4.2 The fix ladder

| Rung | Change type | Fix | Who approves |
|---|---|---|---|
| **1. Fallback** | Rename, added wrapper object, alternative error shape | Read new field if present, else old | Auto-safe PR (CI must pass) |
| **2. Transform** | Unit change (×100), format change (date string → epoch), type coercion | Convert value at the boundary, e.g. `amount / 100` | Human review; auto-apply only if confidence is very high **and** tests pass **and** the team opted in |
| **3. Behaviour** | Page size cap, page → cursor, new rate limit, new enum value, removed endpoint | Code change: paginate until empty, add backoff, map new status, migrate endpoint | Always human review; PR is a suggestion |

### 4.3 One adapter file per API, not edits scattered across the codebase
If `user.name` is read in 40 places, editing 40 lines makes an unreviewable PR. Instead the bot owns **one normalisation file per external API** at the boundary:

```ts
// seismo/adapters/users.ts  (generated; one place to review)
import { firstPresent } from "@seismo/runtime";

export function normalizeUser(raw: any) {
  return {
    ...raw,
    // drift #12 · 2026-10-14 · users API renamed name → display_name · confidence 0.93
    name: firstPresent(raw, ["display_name", "name"]),
  };
}
```

```ts
// seismo/adapters/payments.ts
export function normalizePayment(raw: any) {
  return {
    ...raw,
    // drift #13 · 2026-10-14 · amount ~100× larger (median 520 → 52,000)
    // likely rupees → paise · confidence 0.88 · approved by a reviewer (money field: never auto-applied)
    amount: raw.amount / 100,
  };
}
```

Caveat for transforms: if the provider rolls out gradually, old- and new-unit responses can be mixed for a while. Transforms therefore stay in review until the detector sees the new distribution in nearly all recent samples (see the unit-change detector in [architecture.md](architecture.md)).

First run: the bot opens a one-time "introduce adapters" PR that routes each API client's responses through its adapter. After that, every fix touches only adapter files.

### 4.4 Pitfalls the fixes must avoid
1. **Falsy values.** `raw.amount || raw.new_amount` breaks when `amount` is `0`, `""` or `false`. `firstPresent` checks "key exists and value is not `null`/`undefined`", never truthiness.
2. **Meaning changes have no second field.** For rupees → paise the name stays `amount`; only a transform works. Never auto-apply a transform on money without review.
3. **Writes are different from reads.** If the API now expects `display_name` in a request body, sending both fields can be rejected. Request-side fixes are always rung 3.
4. **Fallback debt.** Every fallback is tracked; cleanup PRs remove dead ones.

## 5. Human-in-the-loop principles

- **Ask, don't guess, when it matters.** Money fields, fields used in `if`/`switch` branching, and anything written to a database go to review regardless of confidence.
- **Explain like a senior engineer.** Every review request says what changed (with before/after statistics), where it is used, what we propose, how confident we are and why, and what happens if the team does nothing.
- **Never trigger irreversible actions on an unfamiliar value.** This follows Circle's own integration guidance on unknown statuses (see [evidence.md](evidence.md)).
- **Every fix is reversible.** It's a PR; revert is one click.

## 6. Safety principles (why it's safe to put in production)

| Principle | What it means |
|---|---|
| **Read-only** | The SDK never modifies a response. Fixes ship as code through PRs, not by rewriting traffic at runtime |
| **Fail-open** | If Seismo is down or slow, the app doesn't notice. Telemetry is async, buffered, and dropped on failure |
| **Shape-only** | No value tied to a record or identifier leaves the customer's server. Only types, presence, batch-level percentiles, list sizes and hashes (salted with a key that never leaves the customer) are sent. The one exception is plain values of fields the customer explicitly allow-lists as enums (e.g. `status`) |
| **Sampled** | Default 10% of calls (configurable); overhead budget under 1 ms per call |
| **Open source SDK** | Customers can read every line that touches their production data |
| **Least privilege** | GitHub App asks only for the permissions it needs: read code, write to branches it creates, open PRs |

## 7. What it is not

- Not an uptime monitor. We assume you already have one.
- Not an API gateway or proxy. Nothing sits in the request path.
- Not a tool for monitoring your **own** inbound API (Treblle, Postman Insights and others do that).
- Not an "AI wrapper". Detection is deterministic code; the LLM only explains changes and helps classify ambiguous ones (see [architecture.md](architecture.md)).

## 8. How this maps to the judging criteria

| Criterion | Our answer |
|---|---|
| Accurate change detection incl. behavioural | 10+ detectors over a learned baseline, including truncation, pagination overlap, unit change and enum drift; confirmation probes reduce false alarms |
| Dependency mapping | GitHub App code map: API → endpoint → field → function → workflow, shown as a graph |
| Semantics-aware compatibility fixes | Fix ladder: fallback, transform, behaviour; adapter file per API |
| Regression validation | Fix PR runs the repo's CI plus generated workflow tests replaying recorded response shapes |
| Safe handling when uncertain | Confidence + impact rules route to human review with an explanation; PRs are always reversible |
