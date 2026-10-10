# The Seismo GitHub App

Owner: @NetPranav · Built in [P0](P0-foundation.md) (dev apps), [P2](P2-see-your-apis.md) (install + scan), [P4](P4-catch-a-rename.md) (issues), [P5](P5-fix-it-safely.md) (PRs + checks), [P8](P8-launch.md) (publish)

## 1. What the app does
1. **Identity:** users sign in to the dashboard with GitHub through this app's OAuth (user-to-server tokens). One app = login + repo access, so installations and users line up automatically.
2. **Read code:** scan installed repos to build the code map (P2), and re-scan on push.
3. **Write fixes:** open alias PRs that change `seismo/aliases.json` (P5) and the one-time setup PR.
4. **Report:** open/update issues for breaking drift (P4), post a "Seismo safety checks" check run on its PRs, comment on PRs.

## 2. Permissions and events (least privilege)

| Repository permission | Level | Why |
|---|---|---|
| Contents | **Read & write** | Read code for the scan; create branches and commits for fix PRs (*read-only is not enough to open PRs*) |
| Pull requests | Read & write | Open and update fix PRs |
| Checks | Read & write | Read CI results on our PRs; create the "Seismo safety checks" check run |
| Issues | Read & write | One issue per breaking drift event |
| Metadata | Read | Required by GitHub |

| Account permission | Level | Why |
|---|---|---|
| Email addresses | Read | Default notification email |

**Subscribed events:** `installation`, `installation_repositories`, `push`, `pull_request`, `check_suite`, `check_run`.

**Other settings:** "Request user authorization (OAuth) during installation" **on**; **Setup URL** = `https://<dashboard>/onboarding` (redirect after install, with `installation_id`); **Callback URL** = Auth.js GitHub callback; webhook secret set; "Expire user authorization tokens" on.

Adding a permission later forces every installation to re-approve, so get the list right in P2.

## 3. Environments (one app per environment)

| App | Who | Webhook URL | Visibility |
|---|---|---|---|
| `seismo-dev-netpranav`, `seismo-dev-overxpowered`, `seismo-dev-adarzhpathade` | Each developer | Own smee.io channel → `localhost` | Private (only that dev's account) |
| `seismo-staging` | Team | Staging host `/github/webhooks` | Private, installed on the demo repo |
| `Seismo` | Production | Production host `/github/webhooks` | **Public** |

All created through the **manifest flow** (Probot implements it: start the app, open the "Register GitHub App" page, and it writes `APP_ID`, `PRIVATE_KEY`, `WEBHOOK_SECRET` and the OAuth client ID/secret to `.env`). The manifest (`github-app/app.yml`) is committed, so all apps get identical permissions. A shared dev app would send everyone's webhooks to everyone, so each developer gets their own.

## 4. Publishing (making it installable by anyone)
1. In the production app's settings: **"Where can this GitHub App be installed?" → Any account.** That's what "publishing" means for a GitHub App. It needs no review and takes effect immediately.
2. Public install link: `https://github.com/apps/<slug>/installations/new`. This is the landing page's "Install on GitHub" button.
3. Fill in the listing: name, description, logo, homepage (landing page), and a privacy note ("shape-only telemetry; we never store response values").
4. **GitHub Marketplace listing is optional** and needs GitHub's review (days to weeks). It isn't needed for the hackathon; it's a post-hackathon step.
5. App names are globally unique. `github.com/apps/seismo` returned 404 on 2026-10-11, so the slug looks free (private apps don't show). Register the production app early (P0/P2) to reserve it.

## 5. Install flow (what the user sees)
Landing → **Install on GitHub** → GitHub "Install Seismo" page (choose repos) → authorize → redirected to **setup URL** `/onboarding?installation_id=…` → dashboard shows "Scanning N repos…" → graph appears (P2) → "Add the SDK for live monitoring" step with a copy-paste snippet and the project's SDK key (P3) → optional "Merge the Seismo setup PR" step (P5.3).

## 6. Webhook handling rules
- Verify signatures (Probot/@octokit/webhooks do this).
- **Answer within 10 seconds:** enqueue a pg-boss job and return 202. Never scan or call the LLM inside the request.
- Jobs are idempotent (keyed by delivery ID); retries with backoff.
- Installation tokens are short-lived; mint per job via `@octokit/app`.
- The host must not sleep (spike S5), or webhooks are lost during the demo.

## 7. Security
- Private key and secrets only in env vars (base64 PEM); never in the repo (it's public).
- Fix PRs only touch `seismo/aliases.json` (and, once, the setup PR files). The bot refuses any other path.
- Branches are namespaced `seismo/*`; the bot never pushes to the default branch.
- Every bot action is written to an audit log table and shown in the dashboard.
