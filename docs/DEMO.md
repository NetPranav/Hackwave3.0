# Live demo runbook (localhost)

Everything below is real: the shop calls the fake providers, the Seismo SDK in the shop reports shapes to the backend,
detectors run every 5 s, Nemotron explains, alerts and PRs go to GitHub. Nothing on screen is mocked.

## 1. Start (two terminals)

```bash
# terminal 1, this repo: backend :4000, fake providers :4100, GitHub App :3060, dashboard :3000
npm run dev
# terminal 2, the shop repo (its .env.local points at :4100 and :4000, key dev-key, DEMO_PANEL=true)
cd ../seismo-demo-shop && npm run dev:live     # http://localhost:3100, and pulls merged PRs from GitHub every 10 s
```

Open the dashboard at http://localhost:3000/app (Overview → **Live activity**) next to the shop.

## 2. Show live traffic

- Click **Buy now** in the shop (or **Place another order**). Each order calls users, shipping and payments.
  Within ~5 s the Live activity feed shows `users: 1 call to GET /users/{id}` etc.
- For a steady stream (needed before a change can be detected): `npm run demo:traffic -- --shop --rps 2`.
  Seismo needs about **2 minutes** of normal traffic as a baseline, then about **1 minute** to confirm a change.

## 3a. Make a provider change with one click (recommended in front of the jury)

In the shop, **Demo changes** (bottom-right) lists every provider change: rename a field, change a data type, change units,
cap a limit, add a status value, change the error format, announce a sunset, switch to cursors. Click one; keep placing
orders (or keep `demo:traffic --shop` running). The same panel shows **Seismo detected** with severity and, for a rename,
the link to the automatic fix PR. **Merge that PR on GitHub**: `npm run dev:live` pulls it within 10 s and the shop is
fixed without anyone touching the code. **Reset all to normal** puts every provider back to v1.

**Your own change:** under the buttons, *Or describe your own change*: pick the provider, the kind (rename, change type,
multiply, new value, remove, cap a list), the field and the new name/value, **Apply**. It is live at once; **undo** removes it.
Use a new name each run (e.g. `name → full_name`, then `name → customer_name`): a rename whose fix is already merged
no longer breaks the shop.

**Fixes beyond renames:** a type change, a unit change or a new status value appears in the **Review queue** with the
proposed rule. **Open fix PR (stress-tested)** runs the C9 stress test (2000 generated responses with the repo's other
rules) and opens a `needs-review` PR only if it passes; the shop's CI runs the same stress test again.

The dashboard's Overview chart defaults to **LIVE · 32 MIN** (one bar per minute, refreshed every 5 s).

## 3b. Make a provider change by hand (pick one, save the file: the fake provider restarts by itself)

All edits are in `services/src/` (the fake third-party APIs). Undo with `git checkout services/src` afterwards.

| Change | Edit | What the jury sees |
|---|---|---|
| **Rename a field** (best visual) | `services/src/data.ts`: in `USERS`, rename every `name:` to `full_name:` | Shop checkout shows **"name missing"**. Seismo: D1 "field removed" → D3 "renamed name → full_name" (breaking), Nemotron explanation, GitHub issue, and an **automatic alias PR** on the shop that adds one rule to `seismo/aliases.json`. Merge it → the name is back |
| **Change a type** | `services/src/app.ts`, in `pay()`: replace `amount: on('payments-amount-type') ? String(n) : n` with `amount: String(n)` (verified live: detected in ~55 s, Nemotron answered in 12 s, GitHub issue) | D4 "Type changed: amount integer → string" (breaking, money → review queue, **no** automatic PR), Nemotron explanation, GitHub issue |
| **Change units** | `services/src/data.ts`: in `PAYMENTS`, multiply each `rupees` by 100 (paise) | D5 "Unit change ×100" on a money field → review queue with a suggested scale rule; never an automatic PR |
| **Silent limit** | `services/src/app.ts`, `/orders`: change `Math.min(Number(q.limit ?? 20) \|\| 20, 500)` to `…, 100)` | D9 "asked for 500, got exactly 100" (truncation) |

The same changes can be switched on without editing files: dashboard → **Setup → Demo Control** (flip, gradual rollout, reset).

## 4. What to point at

1. **Live activity**: `CHANGE` (detector), `NEMOTRON` (asked … / answered in N s, "checked: no invented facts"),
   `ALERT` (GitHub issue, WhatsApp if a number is set in Settings), `FIX PR` (link to the PR).
2. **Timeline** and **Change details**: before/after shape (synthetic, no real values), the code lines that read the field,
   the AI explanation and its model name.
3. **Graph**: the red path from the provider to the shop's checkout feature.
4. **Fixes**: the PR with checks C1–C8. **Review**: money and logic changes wait for a human.

## 5. Reset between runs

`git checkout services/src` (undo hand edits), then dashboard → Demo Control → **Reset everything**
(clears events and baselines; let traffic run 2 minutes again before the next change).
