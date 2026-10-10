# P0 · Foundation & spikes (Days 1–2) · NetPranav track

**Done when:** one command starts the whole system locally, every engine app deploys to staging from `netpranav` (the dashboard deploys from `adarzhpathade`, see A0), and every unknown below has a tested answer written in [`../../MEMORY.md`](../../MEMORY.md).

**Depends on:** nothing · **Contracts:** creates the `contracts/` package · **Owner:** NetPranav. Adarsh's counterpart is [A0](A0-dashboard-foundation.md).

## Sub-phases

| ID | Task | Owner | Output |
|---|---|---|---|
| P0.0 | **Day-1 first hour:** push contract skeletons (`contracts/dashboard-api.openapi.yaml` with every route the dashboard needs, plus `fake-services` and `graph` stubs) and the mock-data generator so Adarsh is never blocked | NetPranav | Adarsh's A-track mocks match the real API |
| P0.1 | Monorepo: npm workspaces + Turborepo; TypeScript base config; ESLint + Prettier; Vitest | NetPranav | `package.json` workspaces: `contracts`, `sdk-node`, `backend`, `github-app`, `services`, `dashboard` |
| P0.2 | `contracts/` package: zod schemas, generated TS types, JSON Schema (zod v4 `toJSONSchema`) and OpenAPI (zod-openapi); mock-data generator for the frontend | NetPranav | `@seismo/contracts` importable everywhere |
| P0.3 | Postgres on Neon (staging + prod) + local Postgres in Docker; drizzle ORM + migrations; pg-boss queue | NetPranav | `npm run db:migrate`, job queue ready |
| P0.4 | Backend skeleton: Fastify API (`/health`, `/v1/...`), worker process (pg-boss consumers), pino logging, SSE endpoint stub | NetPranav | Deployed to staging |
| P0.5 | Dev GitHub App per developer via the **manifest flow** (Probot), each with its own smee.io channel | NetPranav | dev apps for NetPranav and Adarsh; `npm run gh:register` documented |
| P0.6 | Fake services skeleton (Fastify) with admin API stub | NetPranav | Deployed to staging |
| P0.8 | One-command setup: `npm run setup` (env files, Docker Postgres, migrate, seed) and `npm run dev` (Turbo runs all apps + smee) | NetPranav | New laptop to running system in < 10 min |
| P0.9 | CI update: workspace-aware jobs (lint, typecheck, test, build via Turbo); deploy pipeline (see [setup-and-deploy.md](setup-and-deploy.md)) | NetPranav | `ci-ok` covers all workspaces |
| P0.11 | **Dashboard↔backend auth:** the backend verifies the Auth.js session (signed JWT shared secret or GitHub token check), maps the GitHub user to their installations, and accepts SSE with a short-lived token in the query string (EventSource cannot send headers) | NetPranav | `GET /v1/me`; every `/v1/*` route is user-scoped |
| P0.10 | **SDK distribution decision**: publish `@<scope>/seismo-sdk` to npm (preferred) or attach an `npm pack` tarball to a GitHub Release | NetPranav | Demo repo can `npm i` the SDK |

## Spikes (answer each in ≤ 2 hours, write the result in MEMORY.md)

| ID | Question | Owner | Pass criteria |
|---|---|---|---|
| S1 | NVIDIA NIM: exact hosted base URL, model IDs available to our key (Ultra `nvidia/nemotron-3-ultra-550b-a55b`, a Super/Nano option), structured output (`guided_json` or `response_format`), real rate limit, latency | NetPranav | A script returns zod-valid JSON from 2 models; p50 latency recorded; 403/permission issues ruled out |
| S2 | Can `@mswjs/interceptors` read a response body **without consuming it** for the app (fetch + axios/http)? | NetPranav | Test: app reads the body normally while the interceptor fingerprints a clone. Fallback: wrap `fetch` + an axios interceptor directly |
| S3 | Is Probot maintained and compatible with current Node? Else use `@octokit/app` + `@octokit/webhooks` directly | NetPranav | Hello-world app receives a webhook through smee |
| S4 | Twilio WhatsApp sandbox: join flow, 24-hour window, participant expiry, trial limits | NetPranav | A message arrives on a phone from a Node script |
| S5 | Node host for API, worker, services and GitHub App: does the free tier **sleep**? (sleeping hosts miss webhooks) Compare Render, Railway, Fly.io, Koyeb | NetPranav | Chosen host answers a webhook within 10 s after 30 min idle |

## Libraries
Turborepo · zod · zod-openapi · drizzle-orm · pg-boss · Fastify · pino · Probot (or @octokit/app) · smee-client · Next.js · Tailwind · shadcn/ui · Auth.js · Vitest · Docker Compose. Status in [libraries.md](libraries.md).

## Definition of Done
- [ ] `git clone && npm run setup && npm run dev` works on all three laptops
- [ ] Staging URLs live for dashboard, API, services, GitHub App webhook receiver
- [ ] Each developer's dev GitHub App receives webhooks locally
- [ ] Login with GitHub works on staging (preview-deploy login handled or explicitly out of scope)
- [ ] S1–S5 answered (S6 graph library is A0.2) in MEMORY.md (decision + date)
- [ ] CI runs lint/typecheck/test/build for every workspace

## Cut line
Must: P0.0, P0.1–P0.8, P0.11, S1–S5 · Should: P0.9 deploy automation (manual deploy acceptable for 2 days) · Later: Neon preview branches per PR
