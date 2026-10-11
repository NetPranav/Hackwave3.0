# Seismo: the full user flow (screen by screen, in order)

Use this to explain the whole UI to the judges: who the user is, what they do first, what they do next, and why each screen exists. Plain English, matching `GLOSSARY.md`. Screen names match the navbar.

**Status key:** BUILT = a page exists in `dashboard/src/app`. PLANNED = in `docs/roadmap/dashboard.md` but not in this folder yet. Say PLANNED out loud if a judge asks; do not demo it.

**The story in one line:** Watch your APIs, see what changed, see what it breaks, fix it safely, hear about it where you already look.

The navbar follows the same story, left to right: **MONITOR, CHANGES, FIXES, SETUP**.

---

## The user

A developer or tech lead on a small team. Their app calls third-party APIs (payments, CRM, search). They fear the quiet kind of break: the API still says 200 OK, but a field was renamed, a limit dropped, or a unit changed.

---

## The big picture (order of use)

| Step | Screen | Route | Status | The user asks |
|---|---|---|---|---|
| 0 | Landing page | `/` | page file exists; sections still being built | What is this and why should I care? |
| 1 | Sign in with GitHub | `/login` | PLANNED | Can I start in one click? |
| 2 | Onboarding: install the app, pick repos | `/onboarding` | PLANNED | How do I connect my code? |
| 3 | Install guide | `/docs/sdk` | BUILT | What is the one line I add? |
| 4 | Overview | `/app` | BUILT | Is anything wrong right now? |
| 5 | API Status | `/app/status` and its service pages | BUILT | Which API, which endpoint, which field? |
| 6 | Dependency Graph | `/app/graph` | BUILT | What do I depend on, and what breaks if it changes? |
| 7 | Timeline | `/app/timeline` | BUILT | What changed and when? |
| 8 | Change Details | `/app/drift/ID` | BUILT | Explain this one change fully. |
| 9 | Compare and Simulate | `/app/compare` | BUILT | Before vs now. And what if it changes again? |
| 10 | Safe Fixes | `/app/fixes` | BUILT | Is the automatic fix really safe? |
| 11 | Review Queue | `/app/review` | BUILT | What needs a human decision? |
| 12 | Notification Settings | `/app/settings` | BUILT | Where do alerts go? |
| 13 | Radar (upcoming changes) | `/app/radar` | PLANNED | What is announced but not live yet? |
| 14 | Demo Control | `/app/demo` | PLANNED (demo mode only) | Make the sample API change, live. |

---

## Phase 1. Discover and get connected (before the dashboard)

### 0. Landing page (`/`)
- **Goal:** understand the product in 10 seconds and click one button.
- **User sees:** hero line, DETECT / MAP / FIX tabs, the problem with labelled facts, what we catch, how it works, the comparison table, FAQ.
- **User does:** clicks Install on GitHub or Sign in with GitHub.
- **Leads to:** login, then onboarding.
- **Judge line:** The page explains the problem, our approach and why we are different, with every number labelled.
- Copy for every section is in `LANDING_CONTENT.md`.

### 1. Sign in (`/login`) - PLANNED
- GitHub only. Same identity as the app installation. One click, no passwords.

### 2. Onboarding (`/onboarding`) - PLANNED
- After installing the GitHub App, GitHub sends the user here.
- User picks which repos Seismo may read. Seismo scans them and builds the code map: which functions call which API fields.
- Result: a coverage number (how much of the code is mapped) and the first graph.

### 3. Install guide (`/docs/sdk`) - BUILT
- Shows the one line to add to the Node app.
- Explains the promises: read-only, never blocks, never throws into your code, sends shapes not values.
- User copies the line, deploys, and traffic starts to appear.

---

## Phase 2. Monitor (navbar: MONITOR)

### 4. Overview (`/app`) - BUILT
- **Goal:** a 5-second health check.
- **Top strip (4 numbers):** ACTIVE APIS, ACTIVE CHANGES, CODE COVERAGE, FIXES READY. Numbers animate in.
- **Attention bar:** appears only when something needs the user (Needs your attention), with a link into the problem.
- **Metric chart:** one chart with a switch (traffic, errors, response time, rate-limited). The user flips the metric with the sliding pill.
- **Services table:** one row per API with a filter (all services, services with a detected change, services with an open fix PR). Each row shows the API and call, the detected change, and a link to its status.
- **Leads to:** click a row to open API Status for that service. Click the attention bar to open Change Details.
- **Judge line:** One glance tells you if any API you use has silently changed.

### 5. API Status (`/app/status`, then a page per service) - BUILT
- **List page:** one card per monitored API with a state: normal, changed, under review, fix pending.
- **Service page (the detail):**
  - Header: provider, number of endpoints, how many fields are mapped.
  - Provider strip: Traffic (requests per minute), Errors (share of failed requests), Response time, Rate-limited (HTTP 429 count).
  - Endpoint list. Open one to see every field: how many responses contain it, its usual size or length, and a Before to now comparison.
  - Healthy fields say: No changes, every field looks normal.
  - Privacy note on screen: Shapes only, no record values leave your server.
- **Leads to:** a changed field links to its Change Details and to its node in the graph.
- **Judge line:** We watch real traffic field by field, and show only shapes.

### 6. Dependency Graph (`/app/graph`) - BUILT
- **Goal:** answer what breaks if this changes.
- **User sees:** a map of services, endpoints, fields, code locations and workflows. Colours: normal, suspected, breaking, fix ready, unused. A Nothing has changed yet state when all is calm.
- **User does:** search and filter by severity; hover a node for live stats; click a node to open the side panel.
- **Side panel (Node details):** What changed, Comes from, Where it is used (file and line), Open changes, Fixes applied, Features at risk.
- **Path highlight:** clicking a changed field lights the full path to the features it threatens (This path), and dims the rest.
- **Honest limit shown on screen:** spots where the code builds a field name on the fly cannot be followed automatically.
- **Leads to:** from a node to its Change Details.
- **Judge line:** This is what turns a field changed into Checkout is at risk.

---

## Phase 3. Understand the change (navbar: CHANGES)

### 7. Timeline (`/app/timeline`) - BUILT
- **Goal:** the history of every change, newest first.
- **User sees:** event cards (type, which detector found it, time, severity, state) with deploy markers between them for context.
- **User does:** search events; filter by provider and by severity (BREAKING, SUSPECTED); pick a time range.
- **Each card says** whether the code is affected (Nothing in your code is affected when it is not).
- **Leads to:** click a card to open Change Details.

### 8. Change Details (`/app/drift/ID`) - BUILT
The most important page. It reads top to bottom like an incident report:
1. **Hero:** service, endpoint, field, severity, state, and how sure we are.
2. **Diagnosis:** plain words on what changed. A small label says no AI involved when a rule found it, or shows the AI model name when AI explained it.
3. **Evidence:** what the API returned before and after (shape and statistics only), shown as sparklines and a Before / Now diff.
4. **What it affects:** the places in your code that use this field, as file and line.
5. **Proposed fix:** Suggested fix, one small rule, with the fix type. If it is not safe to automate: No automatic fix for this change, and Needs a person, with a link to the Review Queue.
6. **Links out:** See all safety checks and the proof, which opens Safe Fixes.
- **Judge line:** Evidence, impact and a fix on one page, with no raw customer values.

### 9. Compare and Simulate (`/app/compare`) - BUILT
- **Compare mode:** pick an API call and see how it used to look next to how it looks now (a before/after shape diff built from fingerprints, not real data). If nothing changed: No differences, every field looks the way it always has.
- **Simulate mode (What if the provider changes):** pick a kind of change (rename a field, change units, add a value, cap a limit). See the places in your code it would affect, the path on the graph, and the answer to Is there already a safe fix for it? (Yes, already fixed, or No, with what we would suggest).
- **Use it for:** checking an announced change before it goes live.
- **Judge line:** You can ask what if before it breaks.

---

## Phase 4. Fix it (navbar: FIXES)

### 10. Safe Fixes (`/app/fixes`) - BUILT
- **Goal:** prove the automatic fix is safe before anyone merges it.
- **Left:** list of fixes with a status label (for example ready, merged).
- **Fix header:** which change it fixes, the pull request, and its status.
- **Alias diff:** the exact change, shown as a diff of one file. A badge says seismo/aliases.json is the only file this PR touches.
- **What the API sends now vs what the app receives:** a side-by-side showing the renamed field arriving, and the old name still working for the app.
- **Safety checks (C1 to C8), each with a tick and its evidence:** identifier is safe, target field is missing in at least 99% of responses, type and format match, value similarity evidence, no conflict in the code map, only one candidate, property tests pass (guarantees G1 to G4), and the customer repo CI is green.
- **Proof, the shop test:** SHOP TEST goes red on the new API, then green with the rule. This is the visual proof.
- **Guarantees:** only adds a field, never overwrites, old field wins, safe to apply twice.
- **User does:** reviews, then merges the PR on GitHub. Seismo never merges for them.
- **Leads to:** Review Queue for anything that is not a safe alias (OPEN REVIEW QUEUE button).
- **Judge line:** The AI never writes code. The fix is one data rule, and we show the proof.

### 11. Review Queue (`/app/review`) - BUILT
- **Goal:** the changes Seismo will not fix on its own.
- **Card types:** Automatic fix (you merge), Code change (needs review), Convert values (needs review, for example a unit change).
- **Each card shows:** the evidence, an AI explanation panel (model name, or Off: standard text when AI is off), and a suggestion panel built from fixed templates, not from AI.
- **Rule shown:** money, branching and saved-data fields always land here.
- **Actions (decision bar):** Mark expected, Snooze, Open suggestion PR.
- **After a decision:** the card moves to a handled row (for example Marked expected). When empty the page says All clear.
- **Judge line:** When Seismo is unsure, it asks a person.

---

## Phase 5. Get told and set up (navbar: SETUP)

### 12. Notification Settings (`/app/settings`) - BUILT
- **Goal:** alerts reach the user in the place they already look.
- **Channel strip:** five channels: Dashboard, GitHub (issue in a repo), WhatsApp, Slack or Discord (one webhook), Email. Each shows a status: ON, SETUP NEEDED or OFF, and has its own switch.
- **Per-channel threshold:** each channel picks how serious a change must be before it sends: all, suspected and up, or breaking only.
- **Input checks:** the webhook must start with https, WhatsApp needs a full number with country code (for example +91), GitHub needs owner/repository, email must be a valid address. Clear error text for each.
- **Test send:** one clearly marked test message per channel. It stays disabled until the channel is on and finished.
- **AI explanations switch:** on means alerts and review cards are explained by AI. Off means standard text is used everywhere.
- **Judge line:** Alerts you can test in one click, and AI you can turn off.

### 13. Radar (`/app/radar`) - PLANNED
- Upcoming changes sorted by effective date, from Deprecation and Sunset headers and provider changelogs.
- Each item: source link, the exact quote, the code it would hit, and a Simulate button that opens Compare and Simulate already filled in.

### 14. Demo Control (`/app/demo`) - PLANNED, demo mode only
- A panel that flips the sample provider from v1 to v2 so the judges can watch a change happen live.
- Not part of the customer product.

### Always on
- **Navbar:** MONITOR, CHANGES (pulsing dot when something needs attention), FIXES (NEEDS YOU tag on the Review Queue), SETUP. Breadcrumb next to the logo. Light and dark mode.
- **Links across screens:** the same IDs are used in status, graph, timeline and change details, so every view links to the same thing.
- **Notification bell with live updates:** not built yet (the Dashboard channel is on in settings, the bell itself is planned).

---

## The 3-minute demo order (what to click, what to say)

| Time | Screen | Click | Say |
|---|---|---|---|
| 0:00 | Landing | Scroll the hero tabs | Your API is up, your monitor is green, and your app is still silently wrong. |
| 0:30 | Install guide | Show the one line | One line, read-only, never blocks your app. We see shapes, not values. |
| 0:45 | Overview | Point at ACTIVE CHANGES and the attention bar | One glance: something changed. |
| 1:00 | API Status | Open the changed service, then the changed field | Same field, Before and now. Real traffic, shapes only. |
| 1:20 | Dependency Graph | Click the red field | The path lights up to the feature at risk, with file and line. |
| 1:45 | Change Details | Scroll evidence, impact, proposed fix | Evidence, impact and a fix on one page. |
| 2:05 | Safe Fixes | Show the diff, checks C1 to C8, the red to green shop test | One file, add only, human merges. The AI never writes code. |
| 2:30 | Review Queue | Show a money field card | When it is unsure, or it touches money, it asks a person. |
| 2:45 | Compare and Simulate | Run a what-if | You can ask what if before it breaks. |
| 2:55 | Notification Settings | Press test send | Told where you already look. |

## What to say if a judge asks about missing screens

- **Login, onboarding, Radar, Demo Control, bell:** designed and specified (`docs/roadmap/dashboard.md`), the backend side exists, the screens are not in this build yet. Do not click them.
- **Data in the dashboard:** the screens run on mock data shaped exactly like the shared API contracts, so switching to the live backend is a data-source change, not a redesign.
- **Numbers on screen:** the sample values are demo data. Facts about other companies on the landing page are labelled with their source.

## Open items

1. Confirm the step order with a real click-through before presenting.
2. Update the PLANNED rows as login, onboarding and radar land.
3. Keep the plain words in sync with `GLOSSARY.md` if screen titles change.
