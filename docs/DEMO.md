# Live demo runbook (localhost)

Everything below is real: the shop calls the fake providers, the Seismo SDK in the shop reports shapes to the backend,
detectors run every 5 s, Nemotron explains, alerts and PRs go to GitHub. Nothing on screen is mocked.


## 0. Online: the live shop on Vercel against this machine (recommended for the jury)

```bash
npm run dev                 # terminal 1: Seismo (backend, providers, GitHub App, dashboard)
npm run demo:online         # terminal 2: keep it running
npm run demo:traffic -- --shop --target <live shop URL> --rps 2   # terminal 3 (the URL is printed by demo:online)
```

`demo:online` opens two Cloudflare tunnels to this machine (the Seismo backend and the fake providers), gives the hosted
shop its own SDK key and salt, writes them into the shop's Vercel project, rebuilds Production from git, finds the
public address by pinging the deployment's aliases, tells Seismo where the shop is and sets it as the repo's homepage.
Nothing is hard-coded: it refuses to run with default secrets and stops with a clear message at any failed step.

The loop on the live site:
1. In the live shop's panel (bottom-right) change something, e.g. **orders · Change type · total_rupees → string**,
   or **users · Rename field · name → customer_name**.
2. The live shop breaks (the provider changed silently). Seismo on this machine sees it in about a minute.
3. A rename gets an automatic fix PR. A type or unit change waits in **Review**: press
   **Open fix PR (stress-tested)**. Either way the PR link is on the change, in the timeline and in the panel.
4. Merge the PR on GitHub. Vercel rebuilds the shop from `main` (about a minute) and the live shop works again.

The dashboard's **Demo Shop** link (Setup menu) and the Live activity hint open the shop wherever it runs: the hosted
one when it answers, otherwise the local one (`GET /v1/demo/shop` shows what was tried). Stopping `demo:online` closes
the tunnels: the hosted shop can no longer reach the providers, and links fall back to the local shop by themselves.
Keep `demo:online` running until after you merge: the rebuild after the merge uses the tunnel URLs stored in Vercel.

## 0b. Hosted engine on Render (free): nothing has to run on your laptop for the live shop

```bash
# once: RENDER_API_KEY=... in .env (Render Dashboard -> Account Settings -> API Keys)
npm run deploy:render                    # Postgres + the engine (backend, GitHub App, demo APIs) on Render's free plan
npm run demo:online -- --hosted          # the Vercel shop points at the engine (no tunnels), rebuilt once
npm run github:webhook -- --to hosted    # GitHub App events (merges, CI) go to the engine
SEISMO_ENGINE_URL=<engine url> npm run dev   # optional: your local dashboard on the hosted engine
```

Free Render services sleep after 15 minutes without requests and take about a minute to wake. The workflow
`.github/workflows/keepalive.yml` pings `/health` every 10 minutes (repository variable `SEISMO_ENGINE_URL`; scheduled
runs start once it is on `main`). Traffic to the live shop keeps it awake too. Back to the laptop engine:
`npm run github:webhook -- --to local`, then `npm run dev` and `npm run demo:online`.
Only one engine at a time: two would both react to the same merge.

## 1. Local only: start (two terminals)

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

**Self-healing renames (v3):** dashboard → Settings → **Self-heal renames** on. Rename a field in the shop panel: once the
alias PR is open (all checks C1–C9 passed), the SDK in the shop picks the rule up within 30 s and the shop shows the name
again **before anyone merges**. The timeline and the fix page show **Healed live · N responses**. Merging the PR keeps
the rule in the repo; switching the setting off removes the live rule within 30 s.

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
