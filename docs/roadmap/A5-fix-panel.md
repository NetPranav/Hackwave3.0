# A5 · Fix panel and shop tests (Days 7–10)

**Done when:** the dashboard shows the alias PR with its diff, the C1–C8 checklist, CI status and PR link; the shop's tests go red → green around the alias rule.
**Owner:** adarzhpathade · **Consumes:** [P5](P5-fix-it-safely.md) (`alias-spec`, `fix-request`, `validation-result` contracts; fixes API; PR/check status) · **Spec:** [dashboard.md](dashboard.md) §7.

| ID | Task | Output |
|---|---|---|
| A5.1 | Fix panel (`/app/fixes` and inside drift detail): alias rule diff (react-diff-viewer-continued), C1–C8 ticks, CI status, PR link, revert link; empty state for non-alias events pointing to the review queue | See §7 |
| A5.2 | Shop tests: the invoice renders the customer name with a v2 fixture **only** after the alias rule exists (red → green on the PR's CI); `seismo/aliases.test.ts` from the setup PR runs in CI | Visible on the PR |
| A5.3 | Accept the setup PR (P5.3) and, if the codemod slips, wire `applyAliases` into `lib/api/*` by hand (fallback in P5) | Shop behaviour unchanged with empty rules |
| A5.4 | Graph turns green when the PR merges (SSE `drift.resolved`) | End-to-end demo |

**DoD:** red → green visible · fix panel updates live as CI finishes · paise flip shows no auto-PR.
