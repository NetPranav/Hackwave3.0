---
name: start-task
description: Start a new piece of work the team-safe way in this repo. Syncs with develop, creates a correctly named feature branch, claims the task in the shared team status, and opens a draft PR so teammates and their Claude sessions can see it. Use whenever beginning a new task, feature, fix or doc change.
---

# Start a task

Follow these steps in order. Stop and ask the user whenever a step says so.

1. **Know the team state.** Use the TEAM BRIEFING from session start; if it isn't in context or is older than ~1 hour, run `bash scripts/team-status.sh`. Check:
   - Is a teammate already working on this task, or on the same files/area? If yes, **stop**: tell the user who and what, and suggest coordinating.
   - Read `.team/OWNERSHIP.md`. If the task is outside the user's own areas (`git config seismo.handle`), **ask** before continuing and plan to tag the owner on the PR.
   - If the task needs a change in `contracts/`, the first PR should be the contract change only (see `CONTRIBUTING.md` §5).

2. **Agree on the task in one line** with the user: the goal, the area, and the branch name `<type>/<area>-<short-desc>` (types: feature, fix, chore, docs, refactor, test; areas: backend, sdk, github-app, services, shop, dashboard, contracts, docs, infra).

3. **Create the branch from fresh develop:**
   ```bash
   git status --porcelain            # if there are uncommitted changes, ask the user what to do first
   git fetch origin
   git switch -c <branch> origin/develop
   ```

4. **Claim it in the team status.** Edit `.team/status/<handle>.md` (create it from `.team/STATUS_TEMPLATE.md` if missing): Updated time, Branch, Now, Areas/files, Next, Blockers, Contract changes. Then:
   ```bash
   bash scripts/team-publish-status.sh
   ```

5. **Make the work visible:**
   ```bash
   git commit --allow-empty -m "chore(<area>): start <short description>"
   git push -u origin HEAD
   gh pr create --draft --base develop --title "<type>(<area>): <summary>" --body "<what and why; acceptance criteria; 'Work in progress'>"
   ```
   The title must be a Conventional Commit; CI checks it.

6. **Report** the branch name and draft PR URL, then start the actual work.

Never commit on `main`, `develop` or `team-status`. Never push to them; the project settings deny it anyway.
