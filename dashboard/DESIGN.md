# Design System Colors

Source of truth for colours. Tokens are defined in `src/app/globals.css`; usage rules are in [`AGENTS.md`](AGENTS.md) §4.

## Landing Page
- Page Background: `#f0f0f0`
- Section Color: `#ffffff`
- Graph Strokes: `#dcdcdc`
- Button Background: `#1c1b1a`
- Box Outlines: `#cccccc`
- Accent Color: `#ff6e3e`
- Text Color: `#1a1918`

## Dashboard (Light)
- Dashboard Background: `#f8f8f8`
- Dashboard Section: `#ffffff`
- Graph Bar Colors: `#d9d9d9`
- Primary Button Color: `#1a1918`
- Secondary Button Color: `#f0f0f0`

## Dashboard (Dark)
- Dashboard Background: `#252321`
- Dashboard Section: `#252321`
- Border Colors: `#484642`
- Graph Bar Colors: `#5c5956`
- Secondary Button Color: `#5c5956`
- Primary Button Color: `#948e86`

## Status (semantic, both themes)
- OK / nominal / merged: `#2e7d32` (light), `#4ade80` (dark): `text-ok dark:text-ok-bright`
- Warning / sunset / review: `#b26a00` (light), `#ffb74d` (dark): `text-warn dark:text-warn-bright`
- Drift / needs attention: the accent `#ff6e3e`
- Removed / broken (diff deletions, failing test): `#991b1b` (light), `#ff8a80` (dark) → `text-bad dark:text-bad-bright`
- Recessed surface for code and diffs: `#f3f3f0` (light), `#161514` (dark) → `bg-inset dark:bg-dark-inset`
- No other hues (blue, violet, rose) in the dashboard.
