<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Dashboard: agent rules

Owner: @adarzhpathade. These rules add to the root [`AGENTS.md`](../AGENTS.md) (team workflow, product rules, evidence rules); they don't replace it.

## 0. Context

- This is the **Seismo dashboard** (Next.js). It shows detected API drift: service cards, the dependency graph, timeline, drift detail, review queue and the demo panel (`docs/PS/roadmap-demo.md`). In the demo it sits on the right of a split screen next to the shop.
- **Data:** until the backend exists, use typed mock data in `src/lib/mock/`, shaped exactly like `contracts/dashboard-api.openapi.yaml` (owned by @NetPranav). Never invent fields that aren't in the contract; if one is missing, ask for a contract change first. No API routes, auth or database here.
- **UI copy follows the root evidence rules:** no invented numbers, labelled claims, nothing from the "Do NOT say" table in `docs/PS/evidence.md` §4.
- **Visual references:** `design/references/landing-*.png` are **style references only** (another product's landing page). Copy the visual language (grid lines, mono labels, bordered cards, bar charts, orange accent), never its text, branding or exact layout. Dashboard screen references will be added under `design/references/` by the owner; **don't build a dashboard screen until its reference exists** unless the owner asks.
- Hackathon timeline: polished and demo-ready beats production hardening. Visual and motion quality is not where to cut corners.

## 1. Stack

Next.js (App Router, see the version note above) · TypeScript strict · Tailwind CSS v4 · Lenis · GSAP (ScrollTrigger, SplitText, Flip) · Framer Motion · npm (commit `package-lock.json`).

```bash
npm install        # once
npm run dev        # http://localhost:3000
npm run lint && npm run typecheck && npm run build   # what CI runs
```

## 2. Skills (`.claude/skills/`)

| Skill | When |
|---|---|
| `architect` | Before a new screen or section: agree on scope and plan before code |
| `imprint` | After building a UI component: record its classes in `ui-registry.md` so the next one matches |
| `review` (`dashboard:review`) | After finishing a feature: plan alignment, design drift, readiness |
| `recover` | Stuck after several failed fixes: diagnose before touching more code |
| `gsap-*` | Read the matching one before writing GSAP code: `gsap-core`, `gsap-react`, `gsap-scrolltrigger`, `gsap-timeline`, `gsap-plugins`, `gsap-utils`, `gsap-performance` |

Session memory is handled by the team flow (`/start-task`, `/handoff`, `/team-sync`), not a separate skill.

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

- **Lenis** runs once via `src/components/layout/SmoothScroll.tsx` (driven by the GSAP ticker; options in `src/lib/lenis.ts`).
- **GSAP:** import from `@/lib/gsap` (plugins are registered there); use `useGSAP()` in components. Sections reveal on scroll with `start: "top 85%"`, `toggleActions: "play none none none"`: headings SplitText by line `y: 40, opacity: 0, stagger: 0.1, duration: 0.8, ease: "power3.out"`; body `y: 20, duration: 0.6, delay: 0.2`; cards `y: 60, duration: 0.9, ease: "power2.out"`.
- **Framer Motion** only for micro-interactions (hover, press, toggles, tooltips, modals, `AnimatePresence`), never scroll-driven animation.
- Animate only `transform` and `opacity`. Respect `prefers-reduced-motion` (`gsap.matchMedia()`).
- Dashboard data views stay calm: motion should explain a state change (new drift, PR opened), not decorate.

## 7. Structure

```
src/
├── app/                 # routes; layout.tsx = fonts + SmoothScroll
├── components/
│   ├── layout/          # nav, SmoothScroll, shells
│   ├── dashboard/       # one file per dashboard block (once references exist)
│   └── ui/              # primitives: Button, Card, SectionLabel, ...
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
