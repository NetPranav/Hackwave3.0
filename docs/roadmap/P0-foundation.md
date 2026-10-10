# P0 · Foundation & spikes (Days 1–2)

**Done when:** one command starts the whole system locally, every app deploys to staging from its owner's branch (dashboard from `adarzhpathade`, everything else from `netpranav`), and every unknown below has a tested answer written in [`../../MEMORY.md`](../../MEMORY.md).

**Depends on:** nothing · **Contracts:** creates the `contracts/` package · **Owners:** all three

## Sub-phases

| ID | Task | Owner | Output |
|---|---|---|---|
| P0.1 | Monorepo: npm workspaces + Turborepo; TypeScript base config; ESLint + Prettier; Vitest | NetPranav | `package.json` workspaces: `contracts`, `sdk-node`, `backend`, `github-app`, `services`, `dashboard` |
| P0.2 | `contracts/` package: zod schemas, generated TS types, JSON Schema (zod v4 `toJSONSchema`) and OpenAPI (zod-openapi); mock-data generator for the frontend | NetPranav | `@seismo/contracts` importable everywhere |
| P0.3 | Postgres on Neon (staging + prod) + local Postgres in Docker; drizzle ORM + migrations; pg-boss queue | NetPranav | `npm run db:migrate`, job queue ready |
| P0.4 | Backend skeleton: Fastify API (`/health`, `/v1/...`), worker process (pg-boss consumers), pino logging, SSE endpoint stub | NetPranav | Deployed to staging |
| P0.5 | Dev GitHub App per developer via the **manifest flow** (Probot), each with its own smee.io channel | OVERxPOWERED | 3 dev apps; `npm run gh:register` documented |
| P0.6 | Fake services skeleton (Fastify) with admin API stub | OVERxPOWERED | Deployed to staging |
| P0.7 | Dashboard skeleton: Next.js (App Router) + Tailwind + shadcn/ui; Auth.js GitHub provider using the GitHub App's OAuth credentials; protected `/app` route | adarzhpathade | Login works on staging (stable domain). GitHub only accepts registered callback URLs, and Vercel previews get a new hostname each time, so check this first: either limit login to staging/production domains or use Auth.js's redirect proxy for previews |
| P0.8 | One-command setup: `npm run setup` (env files, Docker Postgres, migrate, seed) and `npm run dev` (Turbo runs all apps + smee) | NetPranav | New laptop to running system in < 10 min |
| P0.9 | CI update: workspace-aware jobs (lint, typecheck, test, build via Turbo); deploy pipeline (see [setup-and-deploy.md](setup-and-deploy.md)) | NetPranav | `ci-ok` covers all workspaces |
| P0.10 | **SDK distribution decision**: publish `@<scope>/seismo-sdk` to npm (preferred) or attach an `npm pack` tarball to a GitHub Release | NetPranav | Demo repo can `npm i` the SDK |

## Spikes (answer each in ≤ 2 hours, write the result in MEMORY.md)

| ID | Question | Owner | Pass criteria |
|---|---|---|---|
| S1 | NVIDIA NIM: exact hosted base URL, model IDs available to our key (Ultra `nvidia/nemotron-3-ultra-550b-a55b`, a Super/Nano option), structured output (`guided_json` or `response_format`), real rate limit, latency | NetPranav | A script returns zod-valid JSON from 2 models; p50 latency recorded; 403/permission issues ruled out |
| S2 | Can `@mswjs/interceptors` read a response body **without consuming it** for the app (fetch + axios/http)? | NetPranav | Test: app reads the body normally while the interceptor fingerprints a clone. Fallback: wrap `fetch` + an axios interceptor directly |
| S3 | Is Probot maintained and compatible with current Node? Else use `@octokit/app` + `@octokit/webhooks` directly | OVERxPOWERED | Hello-world app receives a webhook through smee |
| S4 | Twilio WhatsApp sandbox: join flow, 24-hour window, participant expiry, trial limits | OVERxPOWERED | A message arrives on a phone from a Node script |
| S5 | Node host for API, worker, services and GitHub App: does the free tier **sleep**? (sleeping hosts miss webhooks) Compare Render, Railway, Fly.io, Koyeb | OVERxPOWERED | Chosen host answers a webhook within 10 s after 30 min idle |
| S6 | Graph library: `react-force-graph-2d` vs `@react-sigma/core` + graphology with 500 nodes / 1,000 edges; custom node drawing; click-highlight | adarzhpathade | 60 fps pan/zoom on a laptop; highlight path works |

## Libraries
Turborepo · zod · zod-openapi · drizzle-orm · pg-boss · Fastify · pino · Probot (or @octokit/app) · smee-client · Next.js · Tailwind · shadcn/ui · Auth.js · Vitest · Docker Compose. Status in [libraries.md](libraries.md).

## Definition of Done
- [ ] `git clone && npm run setup && npm run dev` works on all three laptops
- [ ] Staging URLs live for dashboard, API, services, GitHub App webhook receiver
- [ ] Each developer's dev GitHub App receives webhooks locally
- [ ] Login with GitHub works on staging (preview-deploy login handled or explicitly out of scope)
- [ ] S1–S6 answered in MEMORY.md (decision + date)
- [ ] CI runs lint/typecheck/test/build for every workspace

## Cut line
Must: P0.1–P0.8, S1–S5 · Should: P0.9 deploy automation (manual deploy acceptable for 2 days) · Later: Neon preview branches per PR
