# P5 · Fix it safely: the alias engine (Days 7–10)

**Done when:** after the rename flip, Seismo opens a PR on `seismo-demo-shop` whose only change is one line of **data** in `seismo/aliases.json`. The PR shows every safety check passed and CI is green. A human merges, the shop redeploys, the customer name is back, and the graph turns green. The guarantees below are proven by property tests, not just claimed.

**Depends on:** P2, P4 · **Contracts:** `alias-spec`, `fix-request`, `validation-result` · **Owners:** NetPranav (runtime, planner, checks), OVERxPOWERED (setup PR, PR bot, CI tracking), adarzhpathade (fix panel, demo tests)

---

## 1. The safety spec ("can't break even if it wanted to")

### 1.1 Nobody writes code at fix time, not the AI and not us
- A fix is a **data rule** appended to `seismo/aliases.json` in the customer's repo:
  ```json
  { "id": "a12", "kind": "alias", "endpoint": "GET /users/{id}", "path": "$",
    "target": "name", "source": "display_name",
    "driftEvent": "evt_8f2c", "addedAt": "2026-10-18" }
  ```
- The rules are applied by one small, audited function shipped in our SDK, `applyAliases(raw, rules)` from `@seismo/sdk/runtime`. It is tested once, in our repo, with property tests (§1.4).
- The AI's role is limited to helping **choose between ambiguous rename candidates**, and even then it returns zod-validated JSON (`{ "source": "display_name", "confidence": 0.91 }`). It is never evaluated or executed. See [ai-layer.md](ai-layer.md).

### 1.2 What `applyAliases` does
For each rule matching the endpoint, at `path` (supports `$`, `$.customer`, `$.items[*]`):
- If the parent is a plain object **and** it does **not** have `target` **and** it **does** have `source` → set `target = parent[source]` on a copy of that parent (copy-on-write along the path only).
- Otherwise do nothing.
- If no rule applied, return the **same object reference** that came in.
- Any unexpected input (non-object, cycles, getters) → return input unchanged; the function never throws.

Note the order: **the old field always wins.** We only *add* the old name when it's missing. (This replaces the earlier `firstPresent(["display_name","name"])` idea in `../PS/solution.md`.)

### 1.3 Guarantees
| ID | Guarantee | Meaning in plain words |
|---|---|---|
| **G1 Identity on the old shape** | If every rule's parent either lacks `source` or already has `target`, `applyAliases(x) === x` | Responses that look like before come out exactly as before |
| **G2 Additive only** | For any input, every key/value present in the input is present and unchanged in the output; the only differences are added `target` keys | It can add a name; it can never remove or change anything |
| **G3 No prototype tricks** | `target`/`source` must match `^[A-Za-z_][A-Za-z0-9_]{0,63}$` and are never `__proto__`, `constructor`, `prototype` or any `Object.prototype` key | A hostile or buggy rule can't pollute objects |
| **G4 Never throws** | Errors are caught; input is returned unchanged | The fix can't crash the app |

**Honest limit:** if a provider keeps sending the old field but stops updating it, we keep reading the stale old value (the old field wins). Detector **D16 dual-field divergence** (P4) watches for exactly this and raises a review item.

### 1.4 How we prove it
- **fast-check property tests** in our repo, 10,000 runs each, over arbitrary JSON (`fc.jsonValue()`), random rule sets and random paths: G1 (reference equality), G2 (deep containment), G3 (rejected keys never set), G4 (no throw on hostile inputs: cycles, getters, frozen objects, huge arrays).
- In the customer repo, the setup PR adds `seismo/aliases.test.ts` once. It loads `aliases.json` and re-runs G1/G2 for each concrete rule against generated old-shape and new-shape samples, so the guarantees are re-checked in **their** CI on every alias PR.

### 1.5 Conflict checks before any alias PR (all must pass, else → review item)
| ID | Check | Source of truth |
|---|---|---|
| C1 | Names are identifier-safe and not on the denylist (G3) | Rule |
| C2 | `target` is absent from ≥ 99% of recent responses at that path (we only add what's actually missing) | Baseline windows |
| C3 | `source` has the same dominant type and format class as `target` had in the baseline | Baseline |
| C4 | Value similarity supports the rename (distribution or hash overlap ≥ threshold) | Detector D3 evidence |
| C5 | App code doesn't already read `source` at that path with a different meaning, and no other rule targets the same key/path | Code map + `aliases.json` |
| C6 | The rename candidate is unambiguous (one candidate ≥ 0.75 and ≥ 0.15 ahead of the next); otherwise the AI judge may break the tie, and the result is still checked by C2–C5 | Detector + AI (JSON) |
| C7 | Property tests for this rule pass | `seismo/aliases.test.ts` in their CI |
| C8 | The repo's own CI is green | GitHub checks |

### 1.6 What never gets an automatic PR
Units, enum meanings, pagination, limits, removed endpoints, type changes, request-side changes. These become a **review item** with an AI explanation and a **suggested change** written from a deterministic template catalog (e.g. "divide `amount` by 100 in the payments adapter", "paginate until an empty page"). Optional, Should: a human can click **"Open PR with this suggestion"**. That PR is labelled `needs-review`, uses a data rule of kind `scale` (value ÷ 10^k) for unit changes, and is never auto-merged.

---

## 2. Sub-phases

| ID | Task | Owner | Output |
|---|---|---|---|
| P5.1 | `contracts/alias-spec`, `contracts/fix-request`, `contracts/validation-result` | NetPranav | Merged first |
| P5.2 | `@seismo/sdk/runtime`: `applyAliases` + G1–G4 property tests (fast-check) | NetPranav | 100% branch coverage on the runtime |
| P5.3 | **Setup PR** ("Install Seismo adapters"): adds `seismo/aliases.json` (empty), `seismo/aliases.test.ts`, and wraps each provider client's parsed JSON with `applyAliases(…)` using a deterministic **ts-morph codemod** limited to the files in `seismo.config.json` | OVERxPOWERED (bot) + NetPranav (codemod) | Identity-only change (empty rules ⇒ G1 holds everywhere); CI green |
| P5.4 | Alias planner: rename drift event → alias rule; conflict checks C1–C6 | NetPranav | Planner unit tests incl. every conflict case |
| P5.5 | PR bot: branch `seismo/alias-<id>`, one-file change via `octokit-plugin-create-pull-request`, title `fix(seismo): alias users.name ← display_name`, body with evidence, guarantees, checks, where used, how to revert; labels `seismo`, `auto-safe` | OVERxPOWERED | PR on the demo repo |
| P5.6 | "Seismo safety checks" **check run** on the PR (C1–C6 results) + tracking `check_suite`/`pull_request` webhooks → `validation-result` → dashboard | OVERxPOWERED | Live PR status in dashboard |
| P5.7 | Fix panel: diff view, C1–C8 checklist with ticks, CI status, PR link, revert link; review queue entry for non-alias changes | adarzhpathade | See [dashboard.md](dashboard.md) §7 |
| P5.8 | Demo-shop tests: invoice renders the customer name with a v2 fixture **only** after the alias rule exists (red → green) | adarzhpathade | Visible on the PR's CI |
| P5.9 | Resolution: PR merged → event `resolved` → baseline rebuilt from post-change samples → graph green | NetPranav | End-to-end demo |
| P5.10 | *(Should)* Human-triggered suggestion PR for unit changes (`scale` rule, `needs-review`) | NetPranav + OVERxPOWERED | Never auto-merged |
| P5.11 | *(Later)* Cleanup PR when `target` hasn't been missing for 30 days ("fast-forward 30 days" demo button) | OVERxPOWERED | Removes dead aliases |

## Libraries
fast-check · ts-morph · octokit-plugin-create-pull-request · @octokit/webhooks · react-diff-viewer-continued. Status in [libraries.md](libraries.md).

## Definition of Done
- [ ] Runtime property tests (G1–G4) green with 10,000 runs each
- [ ] Setup PR merges cleanly on the demo repo; shop behaviour unchanged
- [ ] Rename flip → alias PR in < 2 minutes with all checks passing; merge → shop fixed → graph green
- [ ] Each conflict case (C1–C6) blocks the PR and creates a review item instead (tests)
- [ ] Paise flip produces **no** automatic PR

## Cut line
Must: P5.1–P5.9 · Should: P5.10 · Later: P5.11, auto-merge option
