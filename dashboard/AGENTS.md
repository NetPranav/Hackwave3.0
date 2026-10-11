<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Seismo frontend (landing + dashboard): agent rules

Owner: @adarzhpathade. Works for any coding agent (Antigravity, Claude Code, Codex, Cursor). Open **this folder** (`dashboard/`) as the workspace. The repo-wide rules are in the root [`AGENTS.md`](../AGENTS.md) and [`START_HERE.md`](../START_HERE.md); the parts that matter here are repeated below because the team's Claude Code hooks don't run in other tools.

## Team rules (read first, every session)

0. **Start every session with `remember restore`** (reads [`memory.md`](memory.md): what was built, current state, what to do next). End with `remember save` when the owner asks.
1. **Stay inside `dashboard/`.** Never create, edit or delete anything outside this folder (no `contracts/`, `docs/`, `scripts/`, `.github/`, root files). Reading them is fine. Need a change there? Tell the owner; they ask NetPranav (`bash scripts/team-request.sh NetPranav "what you need"` from the repo root).
2. **Branch: `adarzhpathade` only.** Check with `git branch --show-current`. Never work on `main` or anyone else's branch.
3. **Never commit, push or merge on your own.** Make the changes, show what changed, and wait until the owner explicitly says "commit" or "push". Never push to `main`, never force-push, never merge PRs.
4. **Getting updates:** `git fetch origin && git merge origin/main` (only when the owner asks). Never rebase.
5. **Team status** (only when the owner asks): edit `../.team/status/adarzhpathade.md`, then `bash scripts/team-publish-status.sh` from the repo root. Open requests for us: `bash scripts/team-request.sh list`.
6. **Secrets** (GitHub OAuth secret, tokens) go only in `.env.local` (git-ignored). Never commit them; list variable names in `.env.example`.
7. The task plan is `docs/roadmap/A0…A8` (ours) with every screen specified in `docs/roadmap/dashboard.md`. Commit messages carry the task ID: `feat(dashboard): A0.3 app shell`.

## 0. Context

- This folder is the **whole Seismo frontend**: one Next.js app with the public **landing page** (`/`, `/docs/sdk`, route group `src/app/(marketing)/`) and the signed-in **dashboard** (`/app/...`, `src/app/app/`). Landing content: `docs/roadmap/dashboard.md` §2. The dashboard shows detected API drift: overview, the Obsidian-style dependency graph, API status, timeline, drift detail, fixes, review queue, compare & simulate, radar, settings and Demo Control (routes in `docs/roadmap/dashboard.md` §1). The demo shop is a separate repo (`NetPranav/seismo-demo-shop`).
- **Data:** until the backend exists, use typed mock data in `src/lib/mock/` behind a `USE_MOCKS` switch, shaped exactly like the shared contracts in `../contracts/` (zod schemas, `@seismo/contracts`, owned by @NetPranav). Never invent fields that aren't in a contract; if one is missing, ask for a contract change. No database here. Server code in this app is limited to auth (Auth.js) and thin server routes that keep secrets off the browser (e.g. Demo Control's admin token).
- **UI copy (landing page especially) follows the evidence rules:** every number carries a label (Confirmed / Vendor claim / Secondary / Unverified / Interpretation / Assumption); use only facts from `docs/PS/evidence.md`; nothing from its "Do NOT say" table (§4): no dollar cost for API drift, no "41% of APIs…", no "first to detect third-party drift". Analogies (Mars Climate Orbiter, Knight Capital) are labelled "analogy, not an API". Competitor claims are "per their public material".
- **Product promises the UI must not contradict:** we see shapes, never values (no customer record values on screen beyond enum allow-list fields); detection is deterministic and the AI only explains (show model name or "template"); fixes are additive alias rules in `seismo/aliases.json`, only aliases get automatic PRs, money/branching/persistence changes always go to review.
- **Visual references:** `design/references/landing-*.png` are **style references only** (another product's landing page); they fit our landing page most directly. Copy the visual language (grid lines, mono labels, bordered cards, bar charts, orange accent), never its text, branding or exact layout. Dashboard screen references will be added under `design/references/` by the owner; **don't build a dashboard screen until its reference exists** unless the owner asks.
- Hackathon timeline: polished and demo-ready beats production hardening. Visual and motion quality is not where to cut corners.

## 1. Stack

Next.js (App Router, see the version note above) · TypeScript strict · Tailwind CSS v4 · shadcn/ui (themed with our tokens) · Auth.js (GitHub) · TanStack Query · SSE (`EventSource`) · Lenis · GSAP (ScrollTrigger, SplitText, Flip) · Framer Motion · graph: `react-force-graph-2d` or `@react-sigma/core` + graphology (decided in A0.2) · `@xyflow/react` · recharts · jsondiffpatch · react-diff-viewer-continued · tests: Vitest, Playwright, msw · `@sentry/nextjs` (P8) · npm. Library status: `docs/roadmap/libraries.md`; reuse a listed library before writing your own.

The repo is planned to become an npm workspaces + Turborepo monorepo (P0.9, by NetPranav). Until then this folder has its own `package-lock.json`; after it, installs and `npm run dev` may run from the repo root. Don't set that up from here.

```bash
npm install        # once
npm run dev        # http://localhost:3000
npm run lint && npm run typecheck && npm run build   # what CI runs
```

## 1a. How the frontend connects to the rest of Seismo

- **Contracts we consume** (zod in `../contracts/`, list in `docs/roadmap/README.md` §5): `fake-services` (P1: Demo Control, Compare) · `graph` + `installations` (P2: graph, onboarding, repos) · `status` (P3: status, overview) · `drift-event` + `notification` (P4: timeline, drift, bell) · `alias-spec`, `fix-request`, `validation-result` (P5: fix panel) · `ai-explanation` + `review-item` (P6: review queue) · `radar-item` (P7: radar). Build each screen on mocks of its contract; switch to the real API when NetPranav sends a request.
- **Login:** GitHub only, via Auth.js. Until the Seismo GitHub App exists, use the owner's own GitHub OAuth App for staging, then swap the client ID/secret. GitHub accepts only registered callback URLs and Vercel preview hosts change, so login works only on the stable staging/production domains. After installing the app, GitHub redirects to `/onboarding?installation_id=…` (`docs/roadmap/github-app.md` §5).
- **Backend auth (P0.11):** the backend verifies the Auth.js session; `GET /v1/me` returns the user. SSE (`EventSource`) can't send headers, so live updates use a short-lived token in the query string. Fallback when SSE fails: poll every 2 s.
- **Environment variables** (real values in `.env.local`, names in `.env.example`): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `AUTH_SECRET`, backend API URL, `USE_MOCKS`, `DEMO_MODE` (shows `/app/demo`), `DEMO_ADMIN_TOKEN` (server-side only, never in the browser).
- **Deploy:** Vercel. Staging deploys from branch `adarzhpathade`, production from `main` (`docs/roadmap/setup-and-deploy.md` §3).
- **Definition of Done for every task** (`docs/roadmap/README.md` §6): works on staging (not only locally), at least one automated test for its main path, CI green (lint, typecheck, build), contract merged before the code that uses it. Committing, pushing and publishing status happen only when the owner says so (Team rules 3).

## 2. Skills (`.agents/skills/`)

| Skill | When |
|---|---|
| `architect` | Before a new screen or section: agree on scope and plan before code |
| `imprint` | After building a UI component: record its classes in `ui-registry.md` so the next one matches |
| `review` | After finishing a feature: plan alignment, design drift, readiness |
| `recover` | Stuck after several failed fixes: diagnose before touching more code |
| `remember` | `save` at the end of a session, `restore` at the start of the next (personal notes; the team status note is separate, see Team rules 5) |
| `gsap-*` | Read the matching one before writing GSAP code: `gsap-core`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-plugins`, `gsap-utils`, `gsap-performance` (`gsap-frameworks` is for Vue/Svelte; not needed here) |

The original Nextwave rules this file was adapted from are kept in `design/nextwave-original-AGENTS.md` for reference; this file wins on any conflict.

## 3. Fonts

`fonts/` (sibling to `src/`), loaded with `next/font/local` in `src/app/layout.tsx`. Tailwind utilities:

| Utility | File | Use |
|---|---|---|
| `font-aeonik` | `aeonik-regular.woff2` | Headings, body |
| `font-aeonik-light` | `aeonik-light.woff2` | Subheadings, descriptions, paragraphs |
| `font-aeonik-mono` | `aeonikmono-regular.woff2` | Nav, buttons, labels, tags, table headers, IDs, numbers in data |

Nav, buttons and labels: `font-aeonik-mono uppercase tracking-wide`. Never system or Google fonts.

## 4. Colours

[`DESIGN.md`](DESIGN.md) is the source of truth; tokens live in `src/app/globals.css` (`@theme`). Tailwind's default colour scale is **disabled** (`--color-*: initial`), so `gray-500` and friends produce nothing; use the tokens.

| Group | Utilities (`bg-*`, `text-*`, `border-*`) |
|---|---|
| Landing / shared | `page-bg` `section` `graph-stroke` `btn-primary` `box-outline` `accent` `text-primary` `white` |
| Dashboard light | `dash-bg` `dash-section` `dash-graph` `dash-btn-primary` `dash-btn-secondary` |
| Dashboard dark | `dark-dash-bg` `dark-dash-section` `dark-border` `dark-graph` `dark-btn-primary` `dark-btn-secondary` |

- Dark mode is class-based: `dark:` variants apply under `.dark`.
- Accent `#ff6e3e` is used sparingly: active states, CTAs, live indicators, numbered labels, and drift that needs attention.
- Need a colour that isn't here (e.g. a "safe" status)? Ask the owner and add it to `DESIGN.md` first.

## 5. Design language (from the style references)

- **Layout:** max width `1440px`, centred; padding `px-6 md:px-10 lg:px-16`. Light grid-line backgrounds (`graph-stroke`) behind visual panels.
- **Type:** hero `text-5xl md:text-7xl font-aeonik leading-[0.95] tracking-tight`; section heading `text-3xl md:text-4xl`; mono label `text-xs font-aeonik-mono uppercase tracking-[0.2em]`; body `text-sm md:text-base font-aeonik-light leading-relaxed text-text-primary/70`.
- **Buttons:** primary `bg-btn-primary text-white font-aeonik-mono uppercase text-sm tracking-wider px-6 py-3 rounded-md`; outline `border border-box-outline`; accent CTA `bg-accent text-white`. Hover `scale-[1.02]` + opacity.
- **Cards:** `bg-section border border-box-outline rounded-xl p-6 md:p-8`; nested cards differ in radius or use an inset shadow.
- **Data:** bar charts with flat `dash-graph` bars and mono axis labels; tables with mono uppercase headers.
- Check `ui-registry.md` before inventing a pattern that may already exist.

## 6. Motion

- **Lenis** runs on the landing side only, via `src/app/(marketing)/layout.tsx` → `src/components/layout/SmoothScroll.tsx` (driven by the GSAP ticker; options in `src/lib/lenis.ts`).
- **GSAP:** import from `@/lib/gsap` (plugins are registered there); use `useGSAP()` in components. Sections reveal on scroll with `start: "top 85%"`, `toggleActions: "play none none none"`: headings SplitText by line `y: 40, opacity: 0, stagger: 0.1, duration: 0.8, ease: "power3.out"`; body `y: 20, duration: 0.6, delay: 0.2`; cards `y: 60, duration: 0.9, ease: "power2.out"`.
- **Framer Motion** only for micro-interactions (hover, press, toggles, tooltips, modals, `AnimatePresence`), never scroll-driven animation.
- Animate only `transform` and `opacity`. Respect `prefers-reduced-motion` (`gsap.matchMedia()`).
- Dashboard data views stay calm: motion should explain a state change (new drift, PR opened), not decorate.

## 7. Structure

```
src/
├── app/
│   ├── layout.tsx       # root: fonts, colours (shared)
│   ├── (marketing)/     # landing side: "/" and "/docs/sdk"; layout adds Lenis
│   ├── login/           # "/login"
│   └── app/             # dashboard side: "/app/..."; layout = shell
├── components/
│   ├── layout/          # nav, SmoothScroll, shells
│   ├── landing/         # one file per landing section
│   ├── dashboard/       # one file per dashboard block (once references exist)
│   └── ui/              # primitives shared by both: Button, Card, SectionLabel, ...
├── lib/                 # gsap.ts, lenis.ts, mock/ (contract-shaped data)
└── hooks/
```

## 8. Hard rules

1. References set the style; Seismo's docs set the content.
2. Don't invent content or numbers; use placeholder text that matches tone and length.
3. No unrequested screens or features.
4. Responsive from 375px to 1440px+.
5. Semantic HTML: heading order, landmarks, alt text.
6. No placeholder images; ask for assets.
7. Component-first; no monolithic page files.
8. Clean TypeScript: no `any`, no inline styles, tokens over arbitrary values.
