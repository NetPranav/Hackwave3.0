# AGENTS.md

**Read [`START_HERE.md`](START_HERE.md) first: who you are and which tasks are yours.**

Instructions for AI coding agents (Claude Code, Codex, Cursor, etc.) and for teammates working in this repository. Read this first, then [`MEMORY.md`](MEMORY.md) for decisions and open questions.

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
| `.claude/` | Shared Claude Code settings (hook + permission rules) and skills `/start-task`, `/handoff`, `/team-sync` |
| `docs/roadmap/` | **The build plan**: phases P0–P8 with owners, days, Definition of Done; cross-cutting specs (GitHub App, dashboard, AI layer, setup, libraries). Start here before coding |
| Planned code dirs | `contracts/` `sdk-node/` `backend/` `github-app/` `services/` `dashboard/` (npm workspaces; see `docs/roadmap/setup-and-deploy.md`). The demo shop lives in the separate repo `NetPranav/seismo-demo-shop` |

## Team workflow (mandatory for every agent session)

Three developers work in parallel, each with their own Claude Code session on their own computer:

| GitHub | Role | Owns |
|---|---|---|
| NetPranav | Lead · engine + everything except the dashboard | `contracts/`, `backend/`, `sdk-node/`, `github-app/`, `services/`, repo config; only person who merges release PRs into `main` |
| OVERxPOWERED | Invite pending, no tasks (2026-10-11) | — |
| adarzhpathade | Frontend: the whole dashboard incl. login | `dashboard/` (landing + login + all screens), demo repo `seismo-demo-shop` |

1. **Read the TEAM BRIEFING** injected at session start (from `scripts/team-status.sh`). It lists each teammate's published status, active branches, open PRs, overlaps with your files, and how far behind `develop` you are. Act on its warnings. Re-run it with `/team-sync` before touching shared files.
2. **Who you are:** `git config seismo.handle`. Work inside that person's areas (`.team/OWNERSHIP.md`). Touching another owner's area needs the user's OK, and the owner gets tagged on the PR.
3. **Never work on `main`, `develop` or `team-status`.** Start every task with `/start-task`: a `<type>/<area>-<desc>` branch from `origin/develop`, the status claimed, a draft PR opened.
4. **Contracts first.** Anything crossing an ownership boundary goes through `contracts/` in its own PR before implementation (`contracts/README.md`).
5. **Keep the branch current by merging** `origin/develop` (never rebase pushed branches, never force-push).
6. **End with `/handoff`:** checks pass, branch pushed, status published to `team-status`, PR updated. Humans mark PRs ready and merge; agents never run `gh pr merge` or push to protected branches (denied in `.claude/settings.json`; GitHub rulesets enforce it server-side too).
7. **Conflicts in a teammate's files:** stop and ask; don't resolve them on your own.

## Stack (planned)

**All TypeScript** (decided 2026-10-11): npm workspaces + Turborepo · zod contracts · Fastify API + pg-boss worker · Postgres (Neon / Docker) via drizzle · Node SDK (`@seismo/sdk`, runtime `applyAliases`) · Probot GitHub App + ts-morph scanner · Next.js + Tailwind + shadcn/ui (landing + dashboard) · react-force-graph-2d or Sigma (graph) + React Flow · **NVIDIA NIM (Nemotron)** via an OpenAI-compatible client for explanations/classification only · Twilio WhatsApp, Slack/Discord webhooks, Resend email · Vitest, Playwright, fast-check · Vercel + a non-sleeping Node host. Details: `docs/roadmap/libraries.md`, `docs/roadmap/setup-and-deploy.md`.

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
Planned (P0, see `docs/roadmap/setup-and-deploy.md` §2): `npm install` · `npm run setup` · `npm run gh:register` · `npm run dev` · `npm run test` · `npm run e2e` · `npm run demo:traffic` · `npm run demo:reset`. CI (`.github/workflows/ci.yml`) runs lint/typecheck/test/build for every workspace folder that has a `package.json`. Update this section when they're real.
