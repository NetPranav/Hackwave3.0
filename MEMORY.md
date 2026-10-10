# MEMORY.md: project memory

A living log of decisions, open questions and facts for this project. Newest entries at the top of each section. Dates are absolute (YYYY-MM-DD).

## Snapshot (2026-10-11)

- **Event:** HackWave 3.0 (CDGI), PS 3 "The Internet After the API", ~10-day build.
- **Product (working name):** Seismo, "Dependabot for the APIs you depend on".
- **Stage:** research and design done (`docs/`), team workflow + CI + Claude coordination set up, no product code yet.
- **Core bet:** real-traffic, shape-only fingerprints + semantic/behavioural detectors + code-aware severity + fix PRs. Add-ons: changelog/deprecation radar and a (simulated) drift network.

## Decisions

| Date | Decision | Why | Where documented |
|---|---|---|---|
| 2026-10-11 | Team: NetPranav = lead + architecture/logic (backend, SDK), OVERxPOWERED = architecture/logic (GitHub App, fake services), adarzhpathade = frontend (shop, dashboard) | Split agreed by the lead; backend split between the two logic devs is changeable in `.team/OWNERSHIP.md` | `.team/OWNERSHIP.md`, `.github/CODEOWNERS` |
| 2026-10-11 | Branch model: `main` (lead only, merge-commit release PRs, tags) ← `develop` (default branch; squash-merged PRs; 1 approval + CI `ci-ok` + up to date) ← `<type>/<area>-<desc>` branches; `hotfix/*` from main | Keep main demo-ready; nobody breaks develop | `CONTRIBUTING.md` |
| 2026-10-11 | Enforcement: GitHub rulesets (server-side) + `.githooks/pre-push` (local) + Claude `permissions.deny` (no push to main/develop, no force push, no `gh pr merge`) | Defence in depth; rulesets are the real guard | `.claude/settings.json`, `CONTRIBUTING.md` §2 |
| 2026-10-11 | Claude-to-Claude coordination via git: SessionStart hook runs `scripts/team-status.sh`; per-person status published to a separate `team-status` branch; skills `/start-task`, `/handoff`, `/team-sync`; draft PRs from the first commit | Three separate machines can't share a live session; git is the shared bus; status off code branches avoids merge conflicts | `.team/README.md` |
| 2026-10-11 | Contracts first: cross-owner interfaces live in `contracts/` and change via their own PR | Lets frontend and backend build in parallel against mocks | `contracts/README.md` |
| 2026-10-11 | Feature branches stay current by merging `origin/develop` (no rebase, no force push) | Squash merge keeps develop clean anyway; avoids force-push risk | `CONTRIBUTING.md` §3 |
| 2026-10-11 | Working name "Seismo" (placeholder) | Docs need a name; check availability before public use | `docs/README.md` |
| 2026-10-11 | Positioning: "Dependabot for the APIs you depend on" | Developers instantly understand PR-based dependency bots | `docs/solution.md` |
| 2026-10-11 | Do **not** claim novelty for structural third-party drift, API lockfiles or MCP tool pinning | Research found 8+ polling drift tools (FlareCanary, DriftGuard, DriftMonitor, APIShift…), DriftGuard GitHub Action, Invariant mcp-scan, Bellwether, DriftCop | `docs/competitors.md` |
| 2026-10-11 | Differentiate on G1–G5: real-traffic shape-only profiling, semantic/behavioural detectors, code-aware severity, fix PRs with ladder, drift network | Not seen together in any tool during research | `docs/market-gap.md` |
| 2026-10-11 | Primary capture = in-process SDK (read-only, fail-open, sampled); probes secondary; no proxy in MVP | Proxy sits in the request path and is a hard security sell | `docs/architecture.md` §2, `docs/advantages-disadvantages.md` §3.1 |
| 2026-10-11 | Fixes ship as PRs to one adapter file per API, following Tolerant Reader (add, never replace) | Reviewable, reversible, safe even when a rename guess is wrong | `docs/solution.md` §4 |
| 2026-10-11 | Fix ladder: fallback → transform → behaviour; money/branching/persistence always reviewed | Safe handling when uncertain is a judging criterion | `docs/solution.md` §4.2 |
| 2026-10-11 | Fingerprints never carry a record's values; numbers only as magnitude + batch percentiles (no min/max); salt stays customer-side; enum allow-list is the only plain-value exception | Privacy is the main adoption blocker for payment-heavy customers | `docs/architecture.md` §3.3 |
| 2026-10-11 | LLM only explains/classifies/extracts; detection is deterministic | Avoid "AI wrapper" perception; explainable to judges | `docs/architecture.md` §9 |
| 2026-10-11 | Hackathon add-ons: changelog & deprecation radar + simulated drift network (two demo apps); "us or them" if time | Evidence-backed proactive story + memorable moat demo | `docs/add-ons.md` |
| 2026-10-11 | Demo stack: FastAPI fake services (users, payments, shipping, orders), Next.js shop + dashboard, Node SDK, Probot GitHub App | Fast to build; one SDK language | `docs/architecture.md` §11 |
| 2026-10-11 | Pricing hypothesis: Free / Team $49 / Business $299 / Enterprise; per monitored API | Anchored to competitor prices and Pandium's median of 15 integrations | `docs/business-model.md` §4 |

## Open questions

| # | Question | Owner | Status |
|---|---|---|---|
| Q1 | **The official PS 3 PDF is not in the repo.** `PS3_Overview.md` paraphrases it, and the evidence PDF refers to an "MCP servers" part of the problem statement. Does the official PS require MCP/AI-agent coverage, and what are the exact judging criteria/weights? | Team | Open; add the PDF to the root |
| Q2 | Final product name (check domain, GitHub org, trademark) | Product | Open |
| Q3 | Which add-on is primary if time runs short: changelog radar or drift network? | Team | Open; decide by day 6 |
| Q4 | SDK language for MVP: Node only (current plan) or also Python? | Backend | Leaning Node only |
| Q5 | Survey results: our own number on how teams find out about API changes | Product | Not started |
| Q6 | Verify competitor features/prices on their own sites before the deck (all currently vendor claims via a competitor's article) | Product | Open |
| Q7 | Should the demo shop live in this repo (`shop/`) or a separate demo repo that the Seismo GitHub App is installed on? A separate repo makes the "install the app" demo cleaner. CI already allows `seismo/*` bot branches in case it stays here | Lead + OVERxPOWERED | Open |
| Q8 | The repo is **public**: the evidence PDFs and docs are visible to anyone, including other teams. Keep public (rulesets are free on public repos) or go private (rulesets on private repos need GitHub Pro/Team; the Student Pack includes Pro)? | Lead | Open |

## Key facts to remember (labelled)

- 1,970 of 3,075 web APIs did not always flag breaking changes in minor/patch releases; only 517 consistently used major versions (Confirmed, ICWE 2024).
- Pipedrive silently caps `limit` at 100 (from 500) since 2025-01-15; Lightspeed did the same at 1,000 in 2020-02 (Confirmed, changelogs).
- Jira Cloud changed text `=` to phrase search on 2026-10-06 (Confirmed, changelog; announced, not an incident).
- `Deprecation` header: RFC 9745, Standards Track, March 2025. `Sunset` header: RFC 8594, 2019 (Confirmed).
- No reliable measurement of the cost or time-to-detect of silent API drift exists (Confirmed absence, per the research teammate's cost review). Say "unmeasured", never invent a number.
- No public API incident exists for a units change (rupees → paise); it's an illustration. Mars Climate Orbiter and Knight Capital are analogies only.
- Acquisitions: Akita → Postman (2023-07), Optic → Atlassian (2024-04), Noname → Akamai (~$450M, closed 2024-06-25), Moesif → WSO2 (2025-05). Snyk → Invariant is Unverified.
- India DPDP Rules notified Nov 2025; main obligations ~May 2027 (Secondary; verify).

## People (roles)

- **@NetPranav:** lead, architecture/logic (backend, SDK), owns `main` and repo config.
- **@OVERxPOWERED:** architecture/logic (GitHub App, fake services).
- **@adarzhpathade:** frontend (demo shop, dashboard).
- **Research:** the two evidence PDFs in the root were written by a teammate (handle appears in the PDFs).

## Changelog of this file

- 2026-10-11: Added team roles, branch model, enforcement and Claude coordination decisions; Q7–Q8.
- 2026-10-11: Created with initial decisions, open questions and facts after the docs folder was written.
