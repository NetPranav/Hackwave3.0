# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, etc.) and for teammates working in this repository. Read this first, then [`MEMORY.md`](MEMORY.md) for decisions and open questions.

## Project

- **Event:** HackWave 3.0 (CDGI) · Track: Resilient Infrastructure · **PS 3: "The Internet After the API"** · ~10-day build.
- **Product (working name):** **Seismo**, "Dependabot for the APIs you depend on". It detects silent changes in third-party APIs (shape, behaviour, meaning), maps them to the code that uses them, and opens safe fix PRs, asking a human when unsure.
- **Status:** planning complete, team workflow set up, no product code yet. Full design is in [`docs/`](docs/README.md); team rules in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Where things are

| Path | What |
|---|---|
| `docs/` | All design docs. Start at `docs/README.md` |
| `PS3_Overview.md` | Original project overview |
| `*.pdf` (root) | Research teammate's evidence reviews; the base for `docs/evidence.md` |
| `MEMORY.md` | Decision log, open questions, key facts |
| `CONTRIBUTING.md` | Branch model, naming, PR and release rules |
| `.team/` | Ownership (`OWNERSHIP.md`), status template, how the three Claude sessions coordinate |
| `contracts/` | Interfaces between owners; change these before the code |
| `scripts/` | `setup.sh`, `team-status.sh` (session briefing), `team-publish-status.sh`, `check-md-links.sh` |
| `.claude/` | Shared Claude Code settings (hook + permission rules) and skills `/start-task`, `/handoff`, `/team-sync` |
| Planned code dirs | `services/` `shop/` `sdk-node/` `backend/` `github-app/` `dashboard/` `tests/` (see `docs/roadmap-demo.md` §2) |

## Team workflow (mandatory for every agent session)

Three developers work in parallel, each with their own Claude Code session on their own computer:

| GitHub | Role | Owns |
|---|---|---|
| NetPranav | Lead · architecture/logic | `backend/`, `sdk-node/`, repo config; only person who merges release PRs into `main` |
| OVERxPOWERED | Architecture/logic | `github-app/`, `services/` |
| adarzhpathade | Frontend | `shop/`, `dashboard/` |

1. **Read the TEAM BRIEFING** injected at session start (from `scripts/team-status.sh`). It lists each teammate's published status, active branches, open PRs, overlaps with your files, and how far behind `develop` you are. Act on its warnings. Re-run it with `/team-sync` before touching shared files.
2. **Who you are:** `git config seismo.handle`. Work inside that person's areas (`.team/OWNERSHIP.md`). Touching another owner's area needs the user's OK, and the owner gets tagged on the PR.
3. **Never work on `main`, `develop` or `team-status`.** Start every task with `/start-task`: a `<type>/<area>-<desc>` branch from `origin/develop`, the status claimed, a draft PR opened.
4. **Contracts first.** Anything crossing an ownership boundary goes through `contracts/` in its own PR before implementation (`contracts/README.md`).
5. **Keep the branch current by merging** `origin/develop` (never rebase pushed branches, never force-push).
6. **End with `/handoff`:** checks pass, branch pushed, status published to `team-status`, PR updated. Humans mark PRs ready and merge; agents never run `gh pr merge` or push to protected branches (denied in `.claude/settings.json`; GitHub rulesets enforce it server-side too).
7. **Conflicts in a teammate's files:** stop and ask; don't resolve them on your own.

## Stack (planned)

FastAPI (fake services + backend) · Postgres (SQLite OK for demo) · Node/TypeScript SDK wrapping `fetch`/`axios` · Next.js + Tailwind (shop + dashboard) · react-force-graph or sigma.js (graph) + React Flow (impact chain) · Probot GitHub App · tree-sitter (code scan) · Claude API for explanations/classification · Vitest/Jest + Playwright · Docker Compose. Details: `docs/architecture.md` §11.

## Non-negotiable product rules

1. **The SDK is read-only and fail-open.** It must never modify a response, never throw into app code, never block the request path. If the backend is down, the app must not notice.
2. **No value tied to a record leaves the customer's server.** Fingerprints carry types, format classes, lengths, orders of magnitude, batch percentiles (no min/max) and hashes salted with a key that stays in the SDK, never sent to us. The only plain values allowed are fields on the explicit enum allow-list. Keep the automated privacy test green.
3. **Detection is deterministic code.** The LLM explains and classifies; it never decides detection or auto-merge, and never receives raw response data.
4. **Fixes are additive (Tolerant Reader).** Read new field if present, else old. Never replace. Use `firstPresent` (key exists and value not null/undefined), never `||`.
5. **Fix ladder:** fallback (auto-safe) → transform (review) → behaviour change (review). Money, branching and persistence fields always go to review.
6. **One adapter file per external API** (`seismo/adapters/<api>.ts`); fix PRs touch adapters, not call sites.
7. **Nothing sits in the request path.** No proxy in the MVP.

## Evidence rules (for docs, deck, README, UI copy)

- Every number carries a label: Confirmed / Vendor claim / Secondary / Unverified / Interpretation / Assumption (`docs/README.md`).
- Never use anything in the "Do NOT say" table in `docs/evidence.md` §4. In particular: no dollar cost for API drift, no "41% of APIs…" figure, no "first to detect third-party drift".
- Analogies (Mars Climate Orbiter, Knight Capital) are always labelled "analogy, not an API".
- Competitor features and prices are vendor claims; say "per their public material".
- Add every new source to `docs/sources.md`.

## Working conventions

- Keep docs in sync: if a decision changes, update the relevant `docs/*.md` **and** add a dated line to `MEMORY.md`.
- Demo-critical paths: fake service v2 switches, detectors D1–D5/D7/D9, code map, PR bot, graph, demo panel. Don't refactor these after day 7 (scope freeze).
- Tests to keep green: detector unit tests (one per detector with a v1→v2 fixture), privacy test, fail-open test (backend down → shop works), workflow tests (red on v2 without adapter, green with adapter).
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
To be filled in once code exists (expected: `docker compose up`; `npm run dev` / `npm test` in `shop/`, `dashboard/`, `sdk-node/`, `github-app/` with a committed `package-lock.json`; `uvicorn` + `pytest` + `ruff check .` in `backend/` and `services/`). CI (`.github/workflows/ci.yml`) runs lint/typecheck/test/build for any of these folders that has a `package.json` / `pyproject.toml` / `requirements.txt`. Update this section when they're real.
