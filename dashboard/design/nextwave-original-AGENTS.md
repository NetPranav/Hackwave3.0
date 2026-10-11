# Agent Rules — Nextwave 3.0

You are building an Awwwards-level frontend for a hackathon submission. You do not improvise and you do not add your own ideas — you replicate the reference UI in `ui-refrences/` pixel-perfect, then elevate it with motion and polish.

## 0. Project Context

- **Frontend only.** There is no backend in this repo. Dashboard/data views use static or mock data (local JSON, hardcoded arrays, or `faker`-style fixtures) — never build API routes, auth, or a database unless explicitly asked.
- **Hackathon timeline.** Optimize for a polished, demo-ready build over exhaustive production hardening (e.g. don't build account-recovery flows or empty-state copy for scenarios the demo will never hit). Visual polish and motion quality are the bar you're judged on — do not cut corners there.
- **Reference source of truth:** `ui-refrences/*.png` (currently 7 screenshots of one landing page — "Scorecard", an agent-evaluation platform) and `design.md` (exact color hex values). `AGENTS.md` mirrors `design.md`'s values for convenience, but `design.md` wins on any conflict.
- **No dashboard reference exists yet** even though `design.md` defines light/dark dashboard palettes. Do not build a dashboard page speculatively — wait for reference screenshots before implementing it, then apply those palettes.

---

## 1. Tech Stack (Non-Negotiable)

| Layer | Tool |
|---|---|
| Framework | Next.js (App Router), latest |
| Language | TypeScript, strict mode |
| Styling | Tailwind CSS v4 |
| Smooth Scroll | Lenis |
| Animation | GSAP (ScrollTrigger, SplitText, Flip) |
| Micro-interactions | Framer Motion |
| 3D (only if a reference shows it) | Three.js + React Three Fiber |
| Package Manager | npm |

### Installation (run once, from this directory)

```bash
npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
npm install gsap @gsap/react lenis framer-motion
```

Only if a reference contains 3D elements:
```bash
npm install three @react-three/fiber @react-three/drei
```

---

## 2. Agent Workflow — Use `.agents/skills/`

This repo has workflow skills already set up in `.agents/skills/`. Use them — don't freelance a process that already exists:

| Skill | When |
|---|---|
| `architect` | Before starting a new section or page — align on scope and plan before writing code. |
| `imprint` | After building any UI component — capture its classes into `ui-registry.md` so the next component matches. Run `imprint audit` first if `ui-registry.md` doesn't exist yet and components already do. |
| `review` | After finishing a feature, before moving on — checks plan alignment, design-system drift, and production readiness. |
| `recover` | When stuck after multiple failed fix attempts — diagnoses whether this is a targeted bug, a polluted session, or a wrong approach, before you touch more code. |
| `remember` | `save` at the end of a session, `restore` at the start of the next one. |

For GSAP specifically, don't rely on general knowledge — read the matching skill first: `gsap-core` (tweens/easing), `gsap-scrolltrigger` (scroll animation, pinning), `gsap-timeline` (sequencing), `gsap-react` (`useGSAP`, cleanup), `gsap-plugins`, `gsap-utils`, `gsap-performance`. Section 5 below states only the project-specific rules; the skills are the detailed reference.

---

## 3. Fonts

Three custom fonts live at the repo root in `/fonts/` (sibling to `src/`, not inside it). Load them via `next/font/local` in the root layout using a relative path, e.g. from `src/app/layout.tsx`:

```ts
const aeonik = localFont({ src: "../../fonts/aeonik-regular.woff2", variable: "--font-aeonik" });
```

| Font File | CSS Variable | Usage |
|---|---|---|
| `aeonik-regular.woff2` | `--font-aeonik` | Headings, body text |
| `aeonik-light.woff2` | `--font-aeonik-light` | Subheadings, descriptions |
| `aeonikmono-regular.woff2` | `--font-aeonik-mono` | Labels, buttons, nav links, monospace UI |

**Rules:**
- Nav links, buttons, labels, tags, small-caps text → `font-aeonik-mono uppercase tracking-wide`.
- Headings → `font-aeonik` at large sizes, tight leading.
- Body/paragraph text → `font-aeonik-light`.
- Never use system fonts or Google Fonts. Only these three.

---

## 4. Color System

Defined in `design.md` — read it before writing any code; this table is a mirror, not the source.

### Landing Page

| Token | Hex | Tailwind Name |
|---|---|---|
| Page background | `#f0f0f0` | `page-bg` |
| Section background | `#ffffff` | `section` |
| Graph strokes | `#dcdcdc` | `graph-stroke` |
| Button background | `#1c1b1a` | `btn-primary` |
| Box outlines | `#cccccc` | `box-outline` |
| Accent | `#ff6e3e` | `accent` |
| Text | `#1a1918` | `text-primary` |

### Dashboard — Light (not yet referenced, implement only once a screenshot exists)

| Token | Hex | Tailwind Name |
|---|---|---|
| Background | `#f8f8f8` | `dash-bg` |
| Section | `#ffffff` | `dash-section` |
| Graph bars | `#d9d9d9` | `dash-graph` |
| Primary button | `#1a1918` | `dash-btn-primary` |
| Secondary button | `#f0f0f0` | `dash-btn-secondary` |

### Dashboard — Dark (same caveat)

| Token | Hex | Tailwind Name |
|---|---|---|
| Background | `#252321` | `dark-dash-bg` |
| Section | `#252321` | `dark-dash-section` |
| Borders | `#484642` | `dark-border` |
| Graph bars | `#5c5956` | `dark-graph` |
| Secondary button | `#5c5956` | `dark-btn-secondary` |
| Primary button | `#948e86` | `dark-btn-primary` |

**Rules:**
- Never use colors outside this palette, and never use Tailwind's default scale (`gray-500`, `blue-600`, etc.) — map every hex to a named Tailwind token in config instead of using arbitrary values inline.
- Accent `#ff6e3e` is used sparingly — active states, CTAs, live indicators, numbered labels.

---

## 5. Design Language

Extracted from `ui-refrences/`. Follow exactly; check `ui-registry.md` (once `imprint` has populated it) before inventing a new pattern for something that already exists.

### Layout
- Max content width `1440px`, centered. Page padding `px-6 md:px-10 lg:px-16`.
- Sections are full-width white cards, `rounded-lg`/`rounded-xl`, `border border-box-outline`.
- Vertical rhythm between sections: `py-20 md:py-32`.
- Two-column sections: left text column + right visual/card column with a clear gutter.

### Typography
- Hero: `text-5xl md:text-7xl lg:text-8xl font-aeonik leading-[0.95] tracking-tight`.
- Section heading: `text-3xl md:text-4xl font-aeonik leading-tight`.
- Mono labels: `text-xs font-aeonik-mono uppercase tracking-[0.2em]`.
- Body: `text-sm md:text-base font-aeonik-light leading-relaxed text-text-primary/70`.
- Section numbers ("1", "2") are small bordered circles with accent-colored text.

### Buttons
- Primary: `bg-btn-primary text-white font-aeonik-mono uppercase text-sm tracking-wider px-6 py-3 rounded-md`.
- Secondary/outline: `border border-box-outline bg-transparent font-aeonik-mono uppercase text-sm px-6 py-3 rounded-md`.
- Accent CTA: `bg-accent text-white font-aeonik-mono uppercase text-sm tracking-wider px-8 py-4 rounded-md`.
- All buttons: hover `scale-[1.02]` + opacity transition.

### Cards
- White, `border border-box-outline`, `rounded-xl`, inner padding `p-6 md:p-8`.
- Nested cards use a different radius or inset shadow for depth.

### Navigation
- Sticky top nav, white background, `border-b border-box-outline`.
- Logo left, links center-left, CTAs right: outline "Book a Demo" + filled "Login" with a chevron/sparkle icon.
- All nav text: `font-aeonik-mono uppercase text-xs tracking-[0.15em]`.

---

## 6. Motion Rules (project-specific — see `.agents/skills/gsap-*` for API detail)

- **Lenis**: initialize once in the root layout, wraps the whole app. `duration: 1.2`, `easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))`, `smoothWheel: true`.
- **Every section animates in on scroll** via ScrollTrigger, `start: "top 85%"`, `toggleActions: "play none none none"`. Subtle, not flashy.
  - Headings: `SplitText` by line, `y: 40, opacity: 0, stagger: 0.1, duration: 0.8, ease: "power3.out"`.
  - Body text: `y: 20, opacity: 0, duration: 0.6, delay: 0.2`.
  - Cards/panels: `y: 60, opacity: 0, duration: 0.9, ease: "power2.out"`, staggered if multiple.
- **Framer Motion** is for component-level micro-interactions only (hover, press, toggles, tooltips, modals, `AnimatePresence` page transitions) — never for scroll-triggered animation; that's GSAP's job.
- **Performance**: animate only `transform` and `opacity`, never `width`/`height`/`top`/`left`/`margin`/`padding`. Lazy-load below-fold sections and images.
- Use `useGSAP()` (from `@gsap/react`) for all GSAP code in components — see `gsap-react` skill for cleanup patterns.

---

## 7. Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout — fonts, Lenis, global providers
│   └── page.tsx            # Landing page
├── components/
│   ├── layout/              # Navbar, Footer
│   ├── landing/              # One file per landing section (Hero, Platform, ...)
│   └── ui/                   # Reusable primitives (Button, Card, SectionLabel, ...)
├── lib/
│   ├── lenis.ts
│   └── gsap.ts               # Plugin registration
└── hooks/
    └── useScrollAnimation.ts
```

Add `src/app/dashboard/` and `src/components/dashboard/` only once dashboard references exist (see Section 0).

---

## 8. Hard Rules

1. **Reference UI is law.** Replicate what's in `ui-refrences/` exactly — don't add sections, change layout, or reinterpret the design.
2. **Don't invent content.** If a screenshot's text is illegible, use placeholder text matching its tone and length — don't fabricate specifics.
3. **Don't add unrequested features.** No dashboard, no dark-mode toggle, no extra pages until there's a reference or explicit ask.
4. **Every visible section animates on scroll**, subtly — no static sections, no flashy overkill.
5. **Responsive 375px–1440px+** using Tailwind breakpoints.
6. **Semantic HTML** — correct heading hierarchy, landmarks, alt text.
7. **No placeholder images.** If a reference shows an image/illustration you can't source, ask the user for the asset rather than fabricating a URL or path.
8. **Component-first.** Every distinct UI block is its own component — no monolithic page files.
9. **Clean TypeScript.** No `any`, no inline styles, no magic numbers — use Tailwind tokens from Section 4.
10. **Read `design.md` before writing any code that touches color.**
