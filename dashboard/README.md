# Seismo frontend (`dashboard/`)

The whole browser side of Seismo in one Next.js app: the **public landing page** and the **signed-in dashboard**. Owner: @adarzhpathade. The folder keeps the name `dashboard/` because the team's CI, area guard and docs refer to it.

| Route | What | Code |
|---|---|---|
| `/`, `/docs/sdk` | Landing page (public) | `src/app/(marketing)/`, `src/components/landing/` |
| `/login` | GitHub sign-in | `src/app/login/` |
| `/app/...` | Dashboard (signed in) | `src/app/app/`, `src/components/dashboard/` |

Shared by both: fonts (`fonts/`), colours ([`DESIGN.md`](DESIGN.md)), UI primitives (`src/components/ui/`). Style references: `design/references/`. Rules for humans and agents: [`AGENTS.md`](AGENTS.md).

```bash
npm install
npm run dev     # http://localhost:3000 (landing) and /app (dashboard)
```
