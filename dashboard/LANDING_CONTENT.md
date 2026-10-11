# Landing page content (copy bank)

Use this file as the source for every landing section. Plain, easy English (see `GLOSSARY.md`). Order: Hero, Problem, What we catch, How it works, Detect, Map, Fix safely, Meaning + AI, Alerts + Review, Compare + Radar, Privacy, Why we're better, FAQ, CTA.

**Rules that apply to every line below** (from `AGENTS.md` and `docs/PS/evidence.md`):
- Every number carries its label (Confirmed / Vendor claim / Secondary / Unverified / Interpretation / Assumption). Show the label as a small mono tag next to the number.
- Never say: a dollar cost for API drift, "41% of APIs", "first to detect third-party drift", "15-20 hours to diagnose".
- Analogies are always tagged **analogy, not an API**.
- Competitor facts are **per their public material** (vendor claims).
- Our own stat tiles use **real numbers from our test output**. Slots marked `[FILL]` must be filled from `npm test`, not guessed.

---

## 1. Hero

**Tag:** `API DRIFT GUARD`

**Headline (A is the default):**
- A: Your API is up. Your monitor is green. Your app is still silently wrong.
- B: Dependabot for the APIs you depend on.

**Sub-line:** Seismo watches the APIs you use, catches silent changes in shape, behaviour and meaning, shows which of your code breaks, and opens a safe fix PR.

**Buttons:** `INSTALL ON GITHUB` / `SIGN IN WITH GITHUB` / `WATCH THE 90-SECOND DEMO`

**Tab strip under the hero (Scorecard style):** `DETECT` `MAP` `FIX`

| Tab | One-line caption | Panel shows |
|---|---|---|
| DETECT | Learn what normal looks like. Flag the moment it changes. | Field baseline chart + a flagged point |
| MAP | See exactly which code reads the changed field. | Mini dependency graph, path to Checkout turns red |
| FIX | Get a small, safe PR. A human merges it. | The `seismo/aliases.json` diff + PR badge |

**Trust line under tabs:** Read-only SDK / Fails open / We see shapes, never values

---

## 2. The problem

**Section tag:** `1 THE PROBLEM`

**Heading:** Documented is not the same as told.

**Body:** Providers do announce changes, but as sentences in a changelog. Your code can't read a sentence. Uptime monitors only ask "is it up?". When a field is renamed, a limit is lowered or a number changes its unit, the API still answers `200 OK`. Your app keeps running and quietly gets it wrong.

**Loop diagram (Scorecard "traditional workflow"):**
`BUILD` > `DEPLOY` > `PROVIDER CHANGES SILENTLY` > `USER NOTICES` > `DEBUG FOR DAYS` > back to `BUILD`

**Evidence strip (5 cells, HydraDB benchmark-row style). Copy exactly, keep the tag:**

| Cell | Text | Tag |
|---|---|---|
| 1 | **1,970 of 3,075** web APIs did not always flag breaking changes in minor or patch releases. Only 517 used major versions consistently. | `CONFIRMED` ICWE 2024 (Serbout and Pautasso) |
| 2 | **Pipedrive**, 15 Jan 2025: asking for 500 items now returns at most 100. No error. | `CONFIRMED` official changelog |
| 3 | **Lightspeed**, Feb 2020: asking for over 1,000 returns the first 1,000. Not rejected. | `CONFIRMED` official changelog |
| 4 | **Jira Cloud**, 6 Oct 2026: a text search `=` now matches any text containing the phrase. Same syntax, wider results. | `CONFIRMED` announced change, not an incident |
| 5 | **Same model name, different behaviour**: GPT-4 prime-number accuracy 84% (Mar 2023) vs 51% (Jun 2023) on one benchmark. | `PEER-REVIEWED` HDSR 2024. Say "behaviour drift", never "lost money" |

**Optional analogy card (grey, small):** Mars Climate Orbiter, 1999: one side sent pound-force seconds, the other expected newton-seconds. Nothing errored. `ANALOGY, NOT AN API`

**Honest line (keep it, it builds trust):** Nobody has measured what silent API drift costs. We say "unmeasured" and don't invent a number.

---

## 3. What we catch

**Section tag:** `2 WHAT WE CATCH`

**Heading:** Six kinds of silent change.

| Card | Plain description | Before / After (example) | Detector family |
|---|---|---|---|
| Renamed field | A field got a new name. Old code reads nothing. | `customer_id` to `customerId` | Shape |
| Changed default or limit | Same request, fewer results. | ask 500, get 100 | Behaviour |
| New error format | Errors come in a different body. | text message to JSON object | Shape |
| Pagination change | Pages overlap or end early. | `page=2` to cursor token | Behaviour |
| Rate limit change | New limits, new 429s. | 1000/min to 100/min | Behaviour |
| Meaning change | Same field, different unit or enum meaning. | amount in rupees to paise | Meaning |

**Caption under the cards:** Shape, behaviour and meaning. Most tools stop at shape.

---

## 4. How it works (our approach)

**Section tag:** `3 HOW IT WORKS`

**Heading:** Three steps. No proxy. Nothing in your request path.

| Step | Title | Text |
|---|---|---|
| 1 | Install the GitHub App | We read your repo and build a code map: which functions call which API fields. |
| 2 | Add one line of SDK | A read-only, fail-open SDK sends shape fingerprints of the responses your app already gets. |
| 3 | Get alerts and safe PRs | When a baseline changes, you see the exact code at risk and get a small fix PR. |

**Architecture diagram (dark band, HydraDB dashed-arrow style):**

`YOUR APP + SDK` -> `INGEST (fingerprints only)` -> `DETECTORS (deterministic code)` -> `CODE MAP (who reads this field?)` -> `SEVERITY` -> `ALERTS + FIX PR BOT`

Side note box: `AI` sits **beside** the line, not on it. It explains and classifies. It never decides detection, and never sees raw response data.

**Orange block title:** Orchestration around your app, not inside it.

---

## 5. Detect

**Section tag:** `4 DETECT`

**Heading:** Learn normal. Flag the moment it moves.

**Body:** Seismo builds a baseline for every field of every API you call: type, how often it appears, length, order of magnitude and batch percentiles. When live traffic stops matching, it tells you which field changed and how.

**Chart panel (Scorecard candlestick):** one field's "presence %" or "size" over days, one point turns orange. Tooltip: `BASELINE MEDIAN / NOW / CHANGE`.

**Detector to verdict diagram (Scorecard scoring graph):**
`SHAPE` + `BEHAVIOUR` + `MEANING` -> `SCORING...` -> per-field `PASS` / `FAIL` rows
Result card buttons: `RUN AGAIN` / `EXPLORE WHAT NEEDS FIXING`

**Three small facts:**
- Deterministic code decides. Same input, same answer, every time.
- Each detector has a test with a v1 to v2 fixture. `[FILL: detector count from backend tests]`
- Severity is **code-aware**: a changed field nobody reads is low. A changed field in checkout is high.

---

## 6. Map: the dependency graph

**Section tag:** `5 MAP`

**Heading:** Know what breaks before your users do.

**Body:** The graph links every API, endpoint and field to the files and workflows that use it. When a field drifts, the path from change to Checkout lights up.

**Legend:** green normal / yellow suspected / red breaking / blue fix pending / grey unused field / clock = deprecation date

**Animation (dark panel, canned demo data):** field node turns red, path to `Checkout` pulses, PR badge appears, path fades to green.

**Caption:** Click any node to see where it's read, as `file:line` links to GitHub.

---

## 7. Fix safely

**Section tag:** `6 FIX`

**Heading:** Small fixes. Add only. Human merges.

**Body:** A rename fix is one rule in `seismo/aliases.json`. Seismo adds the new field from the old one **only when the new field is missing**. The old field always wins. Nothing is overwritten or deleted. The AI never writes code.

**Code diff card (illustrative shape; check the real format in the `contracts/` alias-spec before shipping):**

    {
      "service": "pay-provider",
      "rules": [
        { "source": "customer_id", "target": "customerId" }
      ]
    }

Badge: `PR #... / seismo/aliases.json only`

**Guarantees grid (4 cells, plain wording of G1-G4):**

| ID | Plain words |
|---|---|
| G1 | Old-shaped responses pass through unchanged. |
| G2 | We only add fields. We never change or remove one. |
| G3 | If the target already exists, we leave it alone. |
| G4 | Running the fix twice gives the same result as once. |

> Check the exact wording of G1-G4 against `docs/roadmap/P5-fix-it-safely.md` before shipping this card.

**Proof line:** Proven with property tests. `[FILL: number of generated cases per property from the test config]`

**Fix ladder (3 steps, left to right):**

| Step | What | Who acts |
|---|---|---|
| Alias | Rename-style change. Automatic PR. | Human merges |
| Transform | Unit or format change (for example divide by 100). Review only. | Human asks for it |
| Behaviour change | Limits, pagination, meaning. Review only. | Human decides |

**Rule callout:** Money, branching and saved-data fields **always** go to review.

**Extra line:** The bot only touches `seismo/aliases.json` (plus the one-time setup PR). It refuses any other path.

**Tests line:** Shop tests go red on the new API, then green with the alias rule.

---

## 8. Meaning changes and AI

**Section tag:** `7 MEANING`

**Heading:** The hardest changes don't change the shape.

**Body:** A field can keep its name and type and still change what it means: rupees to paise, a new enum value, a default that changed. Seismo watches value patterns (magnitude, enum sets, formats) without keeping any value.

**Example card (clearly labelled illustration):**
`amount` before: typical size about 10^3. After: typical size about 10^5. Same type, same name.
Tag: `ILLUSTRATION. No public incident exists for a rupee-to-paise change.`

**AI box:**
- Explains the change in plain words and suggests who should look.
- Checked by a fact filter: no invented URLs, no dates that aren't in the data, must name the field.
- If the check fails, a template text is used instead.
- Shows its source on every card: model name or `TEMPLATE`.

---

## 9. Alerts and the review queue

**Section tag:** `8 ALERTS`

**Heading:** Told in the place you already look.

**Channel chips:** Dashboard / GitHub (issue, check, comment) / WhatsApp / Slack / Discord / Email

**Review queue card (Scorecard "select metrics" style, checkbox rows):**
- [x] Rename `customer_id` to `customerId` - safe alias - PR ready
- [ ] `amount` changed unit - needs review - money field
- [ ] Page size 500 to 100 - behaviour - needs decision

**Caption:** When Seismo is unsure, it asks. It never guesses on money.

---

## 10. Compare, Simulate and Radar

**Section tag:** `9 PREPARE`

**Heading:** See it before it ships.

**Compare and Simulate (Scorecard base-vs-test bars):**
- Orange = Base (today's API). Lavender = Test (the new version).
- Cards: `FIELDS PRESENT`, `TYPE MATCH`, `ENUM VALUES`. Bars show pass rate. Tooltip with the change.
- Caption: Replay the new shape against your code map before you upgrade.

**Radar (clock badges):**
- Reads `Deprecation` and `Sunset` headers and provider changelogs.
- Links each notice to the exact code that will break, with the date.
- `Deprecation` header = RFC 9745 (Mar 2025). `Sunset` header = RFC 8594 (2019). `CONFIRMED`
- Rule: the AI may only quote the changelog word for word. No paraphrased dates.

---

## 11. Privacy and safety

**Section tag:** `10 SAFETY`

**Heading:** We see shapes, not values.

| Card | Text |
|---|---|
| Read-only | The SDK never changes a response. |
| Fail-open | If Seismo is down, your app doesn't notice. It never throws into your code. |
| Not in the path | No proxy. Nothing sits between you and the provider. |
| No record values leave | We send types, lengths, magnitudes and batch percentiles (no min/max). Hashes use a salt that stays on your server. |
| Allow-list only | The only plain values are fields you put on an enum allow-list. |
| Tested | An automated privacy test and a fail-open test run in CI. |

---

## 12. Why we're better (dark comparison table)

**Section tag:** `11 COMPARE`

**Heading:** Others watch the shape. We watch the meaning and your code.

**Intro (honest):** Polling drift monitors for third-party APIs already exist and are cheap. We don't claim to be first. We combine things we didn't find together in one tool.

**Table (our column highlighted in orange, HydraDB style). Competitor cells are `PER THEIR PUBLIC MATERIAL`:**

| Capability | Pollers (FlareCanary, DriftGuard, DriftMonitor, APIShift) | Spec diff (oasdiff, Optic) | Contract tests (Pact) | Observability (Datadog, Postman Insights) | **Seismo** |
|---|---|---|---|---|---|
| Watches third-party APIs you call | yes | no | partial | partial | yes |
| Uses real production traffic | no | no | no | yes | yes |
| Needs no spec or provider help | yes | no | no | yes | yes |
| Shape changes | yes | yes | yes | partial | yes |
| Behaviour changes (limits, pagination) | no | no | no | partial | yes |
| Meaning changes (units, enums) | partial | no | no | no | yes |
| Knows which of your code is hit | no | no | partial | no | yes |
| Opens a safe fix PR | no | no | no | no | yes |
| Values never leave your server | n/a | n/a | n/a | no / unclear | yes |
| Not in the request path | yes | yes | yes | yes / partial | yes |
| Zero install in the app | yes | yes | no | partial | no (one-line SDK) |

Use check, half and cross icons in the UI. Footnote under the table: `Competitor cells are our reading of their public material and may be out of date. Verify before presenting (open question Q6).`

**Honest trade-off (keep it, it earns trust):** Pollers need no install at all. We need one SDK line, because real traffic is what lets us see meaning and your code.

**One-line positioning:** Unlike schema pollers, Seismo understands values and your code. Unlike observability platforms, it understands API contracts. Unlike contract testing, it needs nothing from the provider.

**"Without Seismo / With Seismo" rows (HydraDB two-column style):**

| Without Seismo | With Seismo |
|---|---|
| Users find the bug first | You see it the moment the baseline moves |
| "Which code reads this field?" grep and guess | Code map shows the path to Checkout |
| Changelog read by hand, maybe | Radar ties each notice to the code with a date |
| Fix by hand under pressure | Small PR, one file, human merges |
| Unsure fixes get shipped anyway | Money and behaviour go to review |

---

## 13. Numbers we can show (stat tiles)

Only real, checkable numbers. Fill from the repo, then keep the source link.

| Tile | Value | Source to check |
|---|---|---|
| Detectors | `[FILL]` | `backend/` detector tests |
| Proven guarantees | 4 (G1-G4) | `applyAliases` property tests |
| Conflict checks before a fix PR | 8 (C1-C8) | planner and safety check |
| Fake services in the demo | `[FILL]` | `services/` |
| Fix PR touches | 1 file | `seismo/aliases.json` |
| Record values that leave your server | 0 | privacy test |

---

## 14. FAQ

1. **Is this a proxy?** No. Nothing sits in your request path.
2. **What if Seismo goes down?** Your app doesn't notice. The SDK fails open.
3. **Do you see my customer data?** No. We receive shapes: types, lengths, magnitudes, percentiles. Plain values only for fields on your enum allow-list.
4. **Does the AI change my code?** No. The AI only explains and classifies. A fix is one data rule you review and merge.
5. **What if the rename guess is wrong?** The rule only adds a field when it's missing. Your old field always wins, so a wrong guess can't overwrite anything.
6. **Why not just use a drift poller?** Pollers are cheap and good for structure. They can't see your real traffic, your values or your code. Use both if you like.
7. **Which languages?** Node and TypeScript SDK first.
8. **Which APIs?** Any HTTP API your Node app calls (fetch and axios).

---

## 15. Final CTA

**Heading:** Know when your APIs change. Before your users do.

**Sub-line:** Install the GitHub App, add one line, and see your first dependency map in minutes.

**Buttons:** `INSTALL ON GITHUB` / `SIGN IN WITH GITHUB`

**Footer:** GitHub repo / Docs (`/docs/sdk`) / Privacy note / Team / Compare column: `Seismo vs pollers`, `Seismo vs observability`, `Seismo vs contract tests`

---

## Nav labels

`PRODUCT` `HOW IT WORKS` `COMPARE` `DOCS` `GITHUB` `SIGN IN`

---

## Open items before this goes live

1. Fill every `[FILL]` from real test or repo output.
2. Verify competitor cells on their own sites (Q6) or keep the "per public material" footnote.
3. Check G1-G4 wording against `docs/roadmap/P5-fix-it-safely.md`.
4. Add every new source to `docs/PS/sources.md` (owner: NetPranav; ask via `team-request.sh`).
5. Final product name is still open (Q2). Keep "Seismo" as a placeholder.
