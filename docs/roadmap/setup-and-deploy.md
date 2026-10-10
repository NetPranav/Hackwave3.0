# Setup, environments and deployment

Owner: @NetPranav · Built in [P0](P0-foundation.md), finished in [P8](P8-launch.md)

## 1. Repository layout (monorepo, npm workspaces + Turborepo)

```
Hackwave3.0/
├── contracts/      @seismo/contracts: zod schemas → TS types, JSON Schema, OpenAPI, mock data   (shared)
├── sdk-node/       @seismo/sdk: capture + fingerprints; @seismo/sdk/runtime: applyAliases        (NetPranav)
├── backend/        Fastify API + pg-boss worker: ingest, baselines, detectors, severity,
│                   alias planner, AI, alerts dispatcher jobs, radar, status, graph               (NetPranav)
├── github-app/     Probot app: install flow, scanner (ts-morph), PR bot, checks, issues          (OVERxPOWERED)
├── services/       Fake third-party providers (users, payments, shipping, orders) + admin API    (OVERxPOWERED)
├── dashboard/      Next.js: landing, auth, dashboard, Demo Control                               (adarzhpathade)
├── docs/  scripts/  .github/  .claude/  .team/
└── docker-compose.yml   Postgres (+ optional everything-in-containers profile for offline demo)

Separate repo: NetPranav/seismo-demo-shop (Next.js shop; the app Seismo watches)                  (adarzhpathade)
```
The alert dispatcher lives in `backend/` as jobs but is owned by OVERxPOWERED (folder `backend/src/alerts/`, CODEOWNERS entry added in P6).

## 2. One-command local setup
```bash
git clone https://github.com/NetPranav/Hackwave3.0.git && cd Hackwave3.0
bash scripts/setup.sh <github-handle>   # team workflow (already exists)
npm install
npm run setup     # copies .env.example → .env files, starts Postgres in Docker, runs migrations, seeds demo data
npm run gh:register   # once: creates your personal dev GitHub App via the manifest flow, writes its secrets to .env
npm run dev       # Turbo: backend API + worker, services, github-app (+ smee tunnel), dashboard
```
Extra scripts: `npm run demo:traffic -- --rps 5`, `npm run demo:reset`, `npm run test`, `npm run e2e`, `npm run db:studio`.

## 3. Environments

| Env | Branch | Dashboard | Node services | Database | GitHub App |
|---|---|---|---|---|---|
| Local | any | localhost:3000 | localhost (Turbo) | Docker Postgres | personal dev app + smee |
| Staging | `netpranav` (backend etc.) / `adarzhpathade` (dashboard) | Vercel (staging domain) | Node host, staging | Neon `staging` branch | `seismo-staging` |
| Preview | every PR | Vercel preview URL | (uses staging API) | — | — |
| Production | `main` | Vercel production domain | Node host, prod | Neon `main` | `Seismo` (public) |

Node host is chosen by spike S5 (must not sleep: webhooks). Candidates: Render, Railway, Fly.io, Koyeb.

## 4. CI/CD
- **CI** (`.github/workflows/ci.yml`, already live): `pr-rules`, `docs`, `node`, `python`, aggregate `ci-ok`. P0.9 switches `node` to a Turbo pipeline (`turbo run lint typecheck test build --filter=...[origin/main]` so only changed workspaces run) and adds an `e2e` job (privacy test, fail-open test, alias property tests).
- **CD:** Vercel deploys `dashboard/` (staging from `adarzhpathade`, prod from `main`). The Node host auto-deploys `backend`, `services`, `github-app` from `netpranav` (staging) and `main` (prod). Migrations run as a release step before the new version starts.
- **Releases:** the lead merges personal branches into `main` through PRs (merge commit), tag `v0.N`; `v1.0` on Day 14.
- **The demo repo** (`seismo-demo-shop`) has its own CI (lint, typecheck, Vitest incl. `seismo/aliases.test.ts`) and deploys to Vercel on push to its `main`.

## 5. Secrets and config
- Every app has `.env.example` (committed) listing every variable with a comment; real values only in `.env` (git-ignored), Vercel/host env settings, and GitHub Actions secrets.
- Key secrets: `DATABASE_URL`, GitHub App `APP_ID` / `PRIVATE_KEY` (base64) / `WEBHOOK_SECRET` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, `AUTH_SECRET`, `NIM_API_KEY`, `NIM_BASE_URL`, `NIM_MODEL_SMART`, `NIM_MODEL_FAST`, `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_FROM`, `RESEND_API_KEY`, `DEMO_ADMIN_TOKEN`, `SEISMO_SDK_KEY` (demo shop).
- The repo is public: a leaked key must be rotated immediately (see [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) §9).

## 6. Observability of Seismo itself
pino structured logs · `/health` and `/ready` on every Node service · Sentry (free tier) on API, worker and dashboard · an uptime ping on the webhook endpoint · job dashboard for pg-boss (simple admin page).

## 7. SDK distribution (decided in P0.10)
Preferred: publish `@<scope>/seismo-sdk` to npm (public, provenance enabled) from CI on tag `sdk-v*`. Fallback: `npm pack` tarball attached to a GitHub Release and installed by URL. GitHub Packages is avoided because installing from it requires auth even for public packages.
