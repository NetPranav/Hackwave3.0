---
name: handoff
description: Publish what was done and what's next so the other two developers and their Claude sessions can see it. Commits and pushes the feature branch, merges in the latest develop, updates the shared team status and the PR. Use at the end of a work session, after finishing a chunk of work, before switching tasks, or when the user says "handoff", "wrap up", "sync my work" or "update the team".
---

# Handoff

1. **Summarise the session** for yourself:
   ```bash
   git log --oneline origin/develop..HEAD
   git diff --stat origin/develop...HEAD
   git status --porcelain
   ```

2. **Run the checks for the areas you touched** (tests, lint, typecheck; see `AGENTS.md` → Commands). If something fails, fix it or tell the user before going further.

3. **Commit pending work** with Conventional Commit messages (`feat(backend): …`). Ask the user about half-finished or experimental changes. Never commit secrets, `.env` files, or `.team/status/` (it's git-ignored on purpose).

4. **Bring the branch up to date without rewriting history:**
   ```bash
   git fetch origin
   git merge origin/develop
   ```
   Resolve conflicts only in files the user owns (`.team/OWNERSHIP.md`). For conflicts in a teammate's files, **stop and ask**. Re-run checks after a merge. Never rebase a pushed branch, never force-push.

5. **Push:** `git push` (sets upstream with `-u origin HEAD` if needed).

6. **Update the shared status.** Rewrite `.team/status/<handle>.md`: Updated time, Branch, PR, Now, Areas/files, **Done since last update**, Next, Blockers / needs from others, Contract changes. Keep it short and concrete, because teammates' Claude sessions read it at startup. Then:
   ```bash
   bash scripts/team-publish-status.sh
   ```

7. **Update the PR.** Make sure the description reflects what's done and how it was tested (`gh pr edit --body …`). Only if the user says it's ready: `gh pr ready`. Never merge PRs; humans merge.

8. **Report** in a few lines: what was pushed, PR link and CI state (`gh pr checks`), what the status now says, anything a teammate needs to act on.
