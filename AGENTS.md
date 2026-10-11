# AGENTS.md

**Read [`START_HERE.md`](START_HERE.md) first: who you are and which tasks are yours.**

Instructions for AI coding agents (Claude Code, Codex, Cursor, etc.) and for teammates working in this repository. Read this first, then [`MEMORY.md`](MEMORY.md) for decisions and open questions. **Current plan: [`docs/roadmap/v2/README.md`](docs/roadmap/v2/README.md).**

## Project

- **Event:** HackWave 3.0 (CDGI) · Track: Resilient Infrastructure · **PS 3: "The Internet After the API"** · 14-day build (2026-10-11 → 2026-10-24, plan in [`docs/roadmap/`](docs/roadmap/README.md)).
- **Product (working name):** **Seismo**, "Dependabot for the APIs you depend on". It detects silent changes in third-party APIs (shape, behaviour, meaning), maps them to the code that uses them, and opens safe fix PRs, asking a human when unsure.
- **Status:** planning complete, team workflow set up, no product code yet. Full design is in [`docs/`](docs/PS/README.md); team rules in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Where things are

| Path | What |
|---|---|
| `docs/` | All design docs. Start at `docs/PS/README.md` |
| `PS3_Overview.md` | Original project overview |
| `*.pdf` (root) | Research teammate's evidence reviews; the base for `docs/PS/evidence.md` |
| `MEMORY.md` | Decision log, open questions, key facts |
| `CONTRIBUTING.md` | Branch model, naming, PR and release rules |
| `.team/` | Ownership (`OWNERSHIP.md`), status template, how the three Claude sessions coordinate |
| `contracts/` | Interfaces between owners; change these before the code |
| `scripts/` | `setup.sh`, `team-status.sh` (session briefing), `team-publish-status.sh`, `check-md-links.sh` |
| `.claude/` | Shared Claude Code settings (briefing hook, area-guard hook, permission rules) and skills `/handoff`, `/team-sync` |
| `docs/roadmap/` | **The build plan**: phases P0–P8 with owners, days, Definition of Done; cross-cutting specs (GitHub App, dashboard, AI layer, setup, libraries). Start here before coding |
| Planned code dirs | `contracts/` `sdk-node/` `backend/` `github-app/` `services/` `dashboard/` (npm workspaces; see `docs/roadmap/setup-and-deploy.md`). The demo shop lives in the separate repo `NetPranav/seismo-demo-shop` |

## Team workflow (mandatory for every agent session)

Three developers work in parallel, each with their own Claude Code session on their own computer:

| GitHub | Role | Owns |
|---|---|---|
| NetPranav | Lead · engine + everything except the dashboard | `contracts/`, `backend/`, `sdk-node/`, `github-app/`, `services/`, repo config; only person who merges release PRs into `main` |
| OVERxPOWERED | Invite pending, no tasks (2026-10-11) | — |
| adarzhpathade | Frontend: the whole dashboard incl. login | `dashboard/` (landing + login + all screens), demo repo `seismo-demo-shop` |

1. **Read [`START_HERE.md`](START_HERE.md)** and the TEAM BRIEFING injected at session start. Do **open requests addressed to you** first.
2. **Who you are:** `git config seismo.handle`. Your branch is the lowercase handle (`netpranav`, `adarzhpathade`). **Work, commit and push only on your own branch.** Never push to `main` or another person's branch; never merge PRs. The area-guard hook also blocks edits while you are on any other branch (old `chore/*`, `docs/*`, `develop`): switch first, see START_HERE.md "Moving to your personal branch". Phase IDs: NetPranav `P0–P8`, Adarsh `A0–A8` (`docs/roadmap/`).
3. **Stay in your area.** adarzhpathade's Claude edits only `dashboard/` (and works in the separate demo shop repo). NetPranav's Claude may edit `dashboard/` only for the v2 integration (data layer, auth, API routes; lead's decision 2026-10-11) and never the demo shop unless the lead asks. A PreToolUse hook (`scripts/guard-area.sh`) blocks violations.
4. **Need something outside your area?** Don't edit it. Run `bash scripts/team-request.sh <their-handle> "what you need"` (stored in `REQUESTS.md` on the `team-status` branch) and tell your human to call or message that person. When you finish a request addressed to you: `bash scripts/team-request.sh done <id>`.
5. **Contracts first.** Interfaces between the backend and the dashboard live in `contracts/` (owned by NetPranav). The dashboard uses mock data shaped like the contracts until the real API exists.
6. **End each session with `/handoff`:** checks, commit, push your own branch, status note.
7. **Merging:** each person finishes their own phases first; the lead then merges personal branches into `main` through PRs (merge commit). Everyone gets others' work only from `main` (`git merge origin/main`).

## Non-negotiable product rules

1. **The SDK is read-only and fail-open.** It must never modify a response, never throw into app code, never block the request path. If the backend is down, the app must not notice.
2. **No value tied to a record leaves the customer's server.** Fingerprints carry types, format classes, lengths, orders of magnitude, batch percentiles (no min/max) and hashes salted with a key that stays in the SDK, never sent to us. The only plain values allowed are fields on the explicit enum allow-list. Keep the automated privacy test green.
3. **Detection is deterministic code.** The LLM explains and classifies; it never decides detection or auto-merge, and never receives raw response data.
4. **Fixes are data, and additive only.** A rename fix is one rule in the customer's `seismo/aliases.json`, applied by `applyAliases` from `@seismo/sdk/runtime`: add `target` from `source` **only when `target` is missing**; the old field always wins; never overwrite or delete; identity on old-shaped responses (guarantees G1–G4, checks C1–C8 in `docs/roadmap/P5-fix-it-safely.md`). Check keys with `hasOwn`, never truthiness. **The AI never writes code.**
5. **Fix ladder:** alias (automatic PR, human merges) → transform (review only, never auto-applied) → behaviour change (review only). Money, branching and persistence fields always go to review.
6. **Fix PRs touch only `seismo/aliases.json`** (plus the one-time setup PR). The bot refuses any other path.
7. **Nothing sits in the request path.** No proxy in the MVP.

## Evidence rules (for docs, deck, README, UI copy)

- Every number carries a label: Confirmed / Vendor claim / Secondary / Unverified / Interpretation / Assumption (`docs/PS/README.md`).
- Never use anything in the "Do NOT say" table in `docs/PS/evidence.md` §4. In particular: no dollar cost for API drift, no "41% of APIs…" figure, no "first to detect third-party drift".
- Analogies (Mars Climate Orbiter, Knight Capital) are always labelled "analogy, not an API".
- Competitor features and prices are vendor claims; say "per their public material".
- Add every new source to `docs/PS/sources.md`.

## Working conventions

- Keep docs in sync: if a decision changes, update the relevant `docs/*.md` **and** add a dated line to `MEMORY.md`.
- Demo-critical paths: fake service v2 switches, detectors D1–D5/D7/D9, code map, PR bot, graph, demo panel. Don't refactor these after day 7 (scope freeze).
- Tests to keep green: detector unit tests (one per detector with a v1→v2 fixture), privacy test, fail-open test (backend down → shop works), workflow tests (red on v2 without the alias rule, green with it), `applyAliases` property tests (G1–G4).
- Fix branches created by the bot are namespaced `seismo/*`.
- Secrets (GitHub App private key, LLM key, SDK keys) go in `.env` files that are git-ignored. Never commit them.
- Write for teammates who may be new to the codebase: short functions, clear names, comments only where intent isn't obvious.

## Commands

Available now:
```bash
bash scripts/setup.sh <github-handle>     # once per machine
bash scripts/team-status.sh               # team briefing
bash scripts/team-publish-status.sh       # publish .team/status/<handle>.md
bash scripts/check-md-links.sh            # docs link check (also in CI)
```
Engine (all real now):
```bash
npm install && npm run setup        # .env from .env.example, database, migrations
npm run gh:register                 # create your dev GitHub App (manifest flow)
npm run dev                         # backend + worker + fake providers (+ GitHub App when WEBHOOK_PROXY_URL is set)
npm test                            # every workspace via Turbo (unit, property, e2e)
npm run demo:traffic -- --rps 5     # traffic against the fake providers
npm run demo:reset -- --warm        # providers v1, Seismo data cleared, DEMO_REPO reset, AI cache warm
docker compose --profile full up --build   # everything in containers (offline backup)
```
CI (`.github/workflows/ci.yml`) runs ESLint and Turbo typecheck/test/build for the engine workspaces, and the dashboard's own scripts.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
