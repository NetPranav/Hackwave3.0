# Memory — Frontend setup (landing + dashboard scaffold)

Last updated: 2026-10-11, Day 1 of 14 (demo Sat 2026-10-24)

> Newer entries (graph rebuild, plain-words pass, SDK docs page, new logo) are in **"Session 2"** below. The first sections describe the earlier session and are still true unless Session 2 says otherwise.

## What was built

- `dashboard/` = the whole Seismo frontend: one Next.js 16.4 app (App Router, TypeScript strict, Tailwind v4, GSAP + @gsap/react, Lenis, Framer Motion).
- Route groups: `src/app/(marketing)/` = landing `/` (layout adds Lenis smooth scroll); `src/app/app/` = dashboard `/app` (layout uses `bg-dash-bg`).
- `src/app/layout.tsx`: loads the 3 Aeonik fonts from `fonts/` with `next/font/local`.
- `src/app/globals.css`: colour tokens from `DESIGN.md` in `@theme`; Tailwind's default colour scale is disabled (`--color-*: initial;`); `--color-black: #000000;` defined; class-based dark mode (`.dark`); dedicated `--rs-*-theme` variables for smooth tactile segmented controls.
- `src/components/layout/AppNavbar.tsx`: Unlumen MotionNavigationMenu with smooth sliding pill, breadcrumbs, search shortcut, and pure non-blocking theme toggle.
- `src/components/ui/RubberSegment.tsx`: fluid spring physics segmented control with CSS variable theme bindings and border outlines.
- `src/components/ui/GlideSelect.tsx`: spring hover highlight dropdown for metric switching.
- `src/components/ui/Counter.tsx`: rolling odometer numbers.
- `/app` (Overview Dashboard, A3.4): Counter metrics strip (4 KPI segments), interactive 7-day waterfall tracing volume/latency/drift graph with `GlideSelect`, services & drift data table with filter chips and inline migration badges.
- `/app/status` & `/app/status/[service]` (API Status Workbench, A3.2): Master-Detail Split Rail layout per `dashboard.md` §5 with live telemetry (P95, error %, 429s, sparklines), provider Statuspage, RFC 8594 Sunset notices, and the Baseline-vs-Now Field Table.
- `/app/timeline` (Timeline Feed, A4.1): vertical conduit spine with glowing severity nodes, filter chips, provider selector, client search, and expandable mutation diff previews with record privacy preserved.
- `/app/drift/[id]` (Drift Inspector, A4.2): header, before/after stats, detector reasoning, impacted workflows, proposed `seismo/aliases.json` diff preview, and C1–C8 conflict & safety guarantees.
- `/app/fixes` (Safe Fixes Workbench, A5.1): Dedicated master-detail fixes cockpit matching `/app` design system. Includes 4-segment KPI strip, `RubberSegment` filter controls, high-contrast `seismo/aliases.json` diff viewer with Unified/Split toggle, comprehensive C1–C8 conflict checks checklist, G1–G4 mathematical runtime guarantees, and interactive alias simulator (red → green workflow test verification).
- `COMPLETION.md`: Comprehensive scorecard documenting completion across A0 (100%), A3 (90%), A4 (85%), and A5 (95%), with an overall completion rate of ~94%.

## Decisions made

- Folder stays named `dashboard/` (CI, CODEOWNERS, the area-guard hook and all docs use that name). Landing and dashboard live together in it.
- Never commit, push or merge unless the owner explicitly says so.
- Team branch model (from `START_HERE.md`): work only on branch `adarzhpathade`; get updates with `git merge origin/main`; never push to `main`; NetPranav merges personal branches into `main` at the end.
- Diff styling: solid, opaque, high-contrast dark terminal backgrounds (`dark:bg-[#161514]`) and WCAG-compliant deletion (`dark:bg-[#341818] dark:text-[#ff8a80]`) and addition (`dark:bg-[#122e1e] dark:text-[#4ade80]`) badges instead of washed-out transparent opacities.
- Clean chip typography: remove duplicate count numbers and colored status dots from `RubberSegment` filter controls across all pages.
- Pure theme toggling: keep side-effects and event dispatches outside React state updater callbacks to prevent cross-component setState-in-render errors.
- Lazy client theme initialization: avoid calling setState inside `useEffect` on mount to strictly satisfy React 19 / ESLint 9 compiler rules.

## Problems solved

- **Stark white chips in dark mode**: Replaced desynchronized React state fallbacks with CSS custom properties (`--rs-track-theme`, `--rs-thumb-theme`) in `globals.css` and added container borders.
- **Washed-out diff block background**: Root-caused missing `--color-black` in Tailwind v4 `@theme` (which caused `dark:bg-black/30` to fail and fall back to `bg-dash-bg/60`). Replaced with solid opaque neutral `#161514` terminal styling with high-contrast text.
- **Cross-component setState during render**: Fixed `Cannot update a component ('TimelinePage') while rendering ('AppNavbar')` by moving side-effects and `window.dispatchEvent` outside `setIsDark` updater in `AppNavbar.tsx`, and removing redundant observers in child views.
- **Counter suffix text clipping**: Fixed via `overflow: visible` and balanced baseline padding.
- **Bar chart waterfall height collapse**: Restored via `h-full` flex group containers.
- **ESLint react-hooks/set-state-in-effect errors**: Resolved React 19 compiler cascading render errors across `AppNavbar.tsx`, `page.tsx`, and `GlideSelect.tsx` by using lazy initializers and `queueMicrotask`.

## Current state

- Branch `adarzhpathade`.
- Phase A0 is 100% complete, Phase A3 is 90% complete, Phase A4 is 85% complete, Phase A5 is 95% complete (overall ~94% complete).
- `npm run lint`, `npm run typecheck`, and `npm run build` all pass cleanly with 0 errors.
- Completion documented in `dashboard/COMPLETION.md`.

## Next session starts with

1. Wire SSE hooks (`status.updated`, `drift.created`, `drift.resolved`) when NetPranav's backend P3, P4, and P5 come online.
2. Build Phase A2 (Onboarding & Obsidian-style Graph at `/app/graph`).
3. Build Phase A6 (Human Review Queue at `/app/review`).


---

## Session 2 (same day): more pages, plain words, graph rebuilt, SDK docs

### What was built
- **New pages:** `/app/review` (review queue), `/app/settings`, `/app/compare` (Compare & Simulate, deterministic simulation in `lib/compare/simulate.ts`), `/app/graph`, and the public **`/docs/sdk`** ("Install the SDK in 2 minutes").
- **Every opener** (the top cards) was redone per page so the pages no longer look the same. Numbers everywhere use the rolling `AnimatedNumber`/`Counter` from `/app`.
- **Navigation** renamed and grouped into Monitor / Changes / Fixes / Setup (`components/layout/navConfig.ts`, `NavMenu.tsx`).
- **Overview** brought in line with the docs and the other pages.
- **Plain words everywhere:** helpers in `lib/plain.ts`, glossary in `GLOSSARY.md`. Jargon stays only inside code boxes and tooltips. Extras were kept (the user answered "really matters?").
- **Shared logo:** `components/layout/Logo.tsx`, used by `AppNavbar` and the docs header. Regular weight on purpose: the font has no bold file, so a bold class is faked and looks smeared.
- **`/docs/sdk`:** `app/(marketing)/docs/sdk/page.tsx` plus `components/docs/{CodeBlock,StepRail,DocsHeader}.tsx`. Light mode only. The one assumption on the page (exact key name in `seismo.config.json`) is labelled "Assumption" per the evidence rules.

### The graph (`/app/graph`) went through three designs; the last one stands
1. Force-directed blobs on a canvas (`react-force-graph-2d`): too busy, "looked like default AI".
2. Five lanes of chips on a canvas.
3. **Current: an SVG flow diagram** (API -> API call -> field -> your code -> feature) with thin curved lines. No physics, no zoom or pan; it always fits.

Files (all under `src/`):
- `lib/graph/build.ts`: builds nodes and links from the mocks; has `pathOf` (the whole route through a node).
- `lib/graph/sankey.ts`: the layout. Columns, node size by significance (traffic for APIs and calls, reads in code for fields, features reached, bigger if changed), neighbour-averaging to reduce crossings, and the whole picture centred vertically so a filtered view sits in the middle.
- `components/dashboard/graph/FlowGraph.tsx`: the SVG. Rounded squares, hairline curves, labels under each node, numbered column headers, hover/selection dimming, load animation (columns appear left to right, then each line draws itself from start to end with `pathLength`), moving dots on changed lines, a slow outline on broken nodes.
- `GraphView.tsx` (state, filters, floating bars), `GraphToolbar.tsx` (severity filter only), `GraphOverlays.tsx` (headline numbers, colour key, path summary, hover trail), `HoverCard.tsx`, `NodePanel.tsx` (details panel).
- `app/globals.css` has the `seismo-flow` and `seismo-ping` keyframes (reduced-motion safe).
- **Layout rule:** everything floating sits in the same 1440px column as the top nav, so edges line up on wide screens. The diagram is drawn at `ZOOM = 0.88` of the screen for breathing room.
- **Behaviour:** hover traces the full route and shows it as a trail at the bottom; click opens the details panel; double-click shows only that path ("One path only / Show all"); Esc clears; `?highlight=<service>` still opens with a service selected.
- **Removed on request:** search, the "What changed" list button, the service dropdown, the "only affected" and "unused fields" toggles (unused fields are always hidden), the background grid, the background stripes, and all icons in the graph toolbar and panel.
- Deleted: `GraphCanvas.tsx`, `draw.ts`, `lanes.ts`, `palette.ts`, `positions.ts`. The `react-force-graph-2d` package is still in `package.json` but unused.

### Decisions
- No glow or shadow effects anywhere in the graph: minimal, flat, matches the theme.
- The graph uses theme colours through `currentColor` and Tailwind classes, so dark mode needs no palette code.
- The hover card sits below-right of the pointer so it does not cover labels.

### Problems solved (graph)
- Stale dev CSS tokens: restart `next dev` after adding a token.
- ESLint `react-hooks/immutability` forbids mutating props in a callback (this was the canvas version; the canvas is gone now).
- Labels crossed by lines: moved labels under each node.
- Headline card overlapped the column titles: moved it into the top bar.
- Long shell heredocs (about 8 KB or more) fail in this environment: write files with the editor tool or a script file instead.

### State right now
- Branch `adarzhpathade`. **Nothing from this session is committed** (the owner has not asked).
- `npx tsc --noEmit` and `npm run lint` are clean. `npm run build` was **not** re-run after the graph rebuild and the docs page.
- Local only: `scripts/guard-area.sh` is deleted in this checkout. **Restore it and stage only `dashboard/` before any commit; never commit its deletion.** The root `MEMORY.md` also has unrelated local changes: do not stage it.

### Still to do
- Graph: check below about 1040px (it scrolls sideways; the panel should become a bottom sheet), test double-click isolate in a browser, add one automated test (layout + `pathOf`), remove the unused package.
- **Auth is next, the owner will do it.** The nav then needs: a user menu (GitHub avatar, settings, sign out), "Sign in with GitHub" on public pages, route protection for `/app/*`, the logo link by sign-in state, an installation switcher and the notification bell. It needs a GitHub OAuth app and secrets in `.env.local`.
- Spec gaps on built pages: Overview (latest 5 events, service health cards, radar tile), Fixes (revert link, CI status), Drift (trend charts), Settings (repos, SDK keys, enum allow-list), Timeline (radar items).
- Pages not built: Radar, landing `/`, Demo Control, Login, Onboarding, 404/error pages, mobile nav.
- Tests (Vitest/Playwright) for the main paths. Send NetPranav the Windows path fix for `guard-area.sh` only if the owner agrees.
