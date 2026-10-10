# PS 3: The Internet After the API — Project Overview

HackWave 3.0 · Resilient Infrastructure · Build time: ~10 days

## One-line pitch

> "Your API is up, your monitor is green, and your app is still silently wrong. We fix that."

A "shock absorber" between your app and the external services it depends on. It learns how each service normally behaves, catches silent changes, finds what breaks, fixes it automatically, and proves the fix works. When unsure, it asks a human instead of guessing.

---

## 1. The problem

Apps depend on APIs they don't control (payments, users, maps, weather). Providers change them without notice. Usually nothing crashes: the API still returns `200 OK` with valid JSON, but the meaning has changed, so the app quietly shows wrong data.

| Change type | Example |
|---|---|
| Renamed field | `name` → `display_name` |
| Changed default | page size drops from 50 to 20, so records go missing |
| New error format | `{"error": "..."}` → `{"errors": [...]}` |
| Pagination change | page numbers → cursor tokens |
| Rate limit | new 429 errors after 100 calls/min |
| Meaning change | amount in rupees → amount in paise (valid JSON, 100× wrong) |

The PDF says not to rely only on documented schemas, so behavioral and meaning changes must be caught too.

---

## 2. How the system works

```
Your app ──► Proxy ──► External APIs
               │
               ▼
        Behavior model      (learns normal responses)
               │
               ▼
        Change detector     (structural + semantic)
               │
               ▼
        Impact analysis     (which workflows break)
               │
               ▼
        Adapter + validation (patch, then re-test)
           │             │
           ▼             ▼
      Auto-apply     Human review
   (tests pass,     (uncertain or
    confident)        failing)
```

1. **Proxy:** every outgoing call passes through it and is recorded. The app itself doesn't change.
2. **Behavior model:** learns each endpoint's normal shape: fields, types, value ranges, error formats, page sizes, latency.
3. **Change detector:**
   - Structural changes (missing field, type change) are caught with plain code.
   - Semantic changes (values 100× bigger, a new field holding the old field's values) are judged by an LLM with a confidence score.
4. **Impact analysis:** scans the app's code to map which functions and workflows use which fields.
5. **Adapter:** a small translation layer inside the proxy (e.g. map `display_name` → `name`, divide amount by 100).
6. **Validation:** re-runs workflow tests with the adapter.
   - Tests pass and confidence is high → fix applied.
   - Otherwise → sent to a human with an explanation.

**Key design choice:** adapters live inside the proxy, so the app never changes and every fix is reversible.

---

## 3. What we build

### Backend
- 3–4 fake services (users, payments, shipping, weather), each with a v1/v2 switch.
- The proxy, behavior model, change detector, impact mapper, adapter engine and test runner.

### Frontend
**Demo shop app:** login, products, checkout, invoice page. Shows judges the breakage (wrong name, ₹49,900 instead of ₹499, missing order).

**Monitoring dashboard** (the main frontend):
- Service health: live call counts and status (normal / changed / under review)
- Change timeline: each change with type, time and severity
- Impact graph: change → fields → workflows, animated red then green
- Adapter view: before/after code diff with an Approve button
- Validation results: tests red → green
- Demo control panel: buttons to flip each service to v2 live

**Presentation tip:** split screen, with the shop app on one side and the dashboard on the other, plus a status banner stepping through "Change detected → 3 workflows affected → Fix applied → Tests passed."

---

## 4. Tech stack

| Part | Tool |
|---|---|
| Fake services + proxy | Python FastAPI (or Node Express); the proxy is a forwarding + logging middleware |
| Storage | SQLite or Postgres |
| Behavior learning | Plain Python: infer types, ranges, frequencies from samples |
| Semantic judgement | LLM API comparing old vs new samples |
| Code impact map | AST parsing or text search for field names |
| Adapters | JSON mapping rules applied in the proxy |
| Validation | pytest or Playwright |
| Frontend | React / Next.js + Tailwind, React Flow for the graph, WebSockets or polling for live updates |

---

## 5. 10-day plan

| Day | Work |
|---|---|
| 1 | Demo app + 4 fake services with switchable versions |
| 2–3 | Proxy recording all traffic; behavior model |
| 4–5 | Change detection: structural + LLM semantic |
| 6 | Dependency map from code analysis |
| 7–8 | Adapter generation, regression validation, human-review path |
| 9 | Dashboard: timeline, impact graph, diffs, test results |
| 10 | Polish, backup demo video, pitch deck, rehearsal |

---

## 6. 3-minute demo script

1. **Normal:** the app works; everything is green.
2. **Rename:** flip users to `display_name`. The system detects it, shows checkout and invoice are affected, generates the mapping, re-runs tests, and the app works again.
3. **Meaning change:** flip payments to paise. A plain schema checker misses it; ours flags "values jumped ~100×, likely a unit change," fixes it and validates.
4. **Uncertain change:** flip shipping to a confusing new status value. Confidence is low, so it refuses to auto-fix and asks a human with a clear explanation. This is the trust moment.

---

## 7. What judges look for (from the PDF)

- Accurate change detection, including behavioral changes
- Dependency mapping
- Semantics-aware compatibility fixes
- Regression validation
- Safe handling when automatic repair is uncertain

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| LLM false alarms | Code handles structural checks; LLM only answers "same meaning?" with a confidence score |
| Scope creep | JSON REST only; 5–6 change types done well |
| Weak visuals | Give the dashboard and impact graph real time on days 9–10 |
| Half-working demo | Record a backup demo video on day 10 |

---

## 9. PS 3 vs PS 1

| Area | Stronger | Why |
|---|---|---|
| Easy to build | PS 1 | Narrower scope, proven tools |
| Easy to explain | PS 1 | Understood instantly |
| UI wow out of the box | PS 1 | A live browser driven by AI |
| Real-world impact | PS 3 | Silent API changes affect almost every app |
| Novelty | PS 3 | Self-healing tests are already sold widely; auto-adapting to API changes is mostly unsolved |
| Low competition | PS 3 | Fewer teams will pick it |
| Technical depth | PS 3 | Real engineering, not an LLM wrapper |

**Verdict:** with 10 days and a team comfortable with backend work, PS 3 is the stronger pick. Its main weakness is execution risk, so finishing a working demo is everything.
