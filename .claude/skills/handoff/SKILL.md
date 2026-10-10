---
name: handoff
description: Save and share this session's work. Runs checks, commits, pushes to the user's OWN personal branch, and publishes their team status note. Use at the end of a work session, after finishing a chunk of work, or when the user says "handoff", "wrap up", "save my work" or "push my work".
---

# Handoff

1. **Check where you are.** `git config seismo.handle` gives the person; their branch is the lowercase handle (`netpranav`, `adarzhpathade`). If `git rev-parse --abbrev-ref HEAD` isn't that branch, **stop and ask**; never commit on `main` or someone else's branch.

2. **Summarise the session:** `git status --porcelain`, `git diff --stat`, `git log --oneline -5`.

3. **Run the checks for the folders you touched** (lint, typecheck, tests; see `AGENTS.md` → Commands). If something fails, fix it or tell the user before going further.

4. **Commit** with Conventional Commit messages (`feat(dashboard): …`, `feat(backend): …`). Ask about half-finished experiments. Never commit secrets or `.env` files.

5. **Push your own branch only:** `git push` (first time: `git push -u origin <your-branch>`). Never force-push; never push `main` or another person's branch.

6. **Status note:** update `.team/status/<handle>.md` (Now, Done, Next, Blockers) in a few short lines, then `bash scripts/team-publish-status.sh`.

7. **Requests:** if this work finishes something another person was waiting for, or you now need something from them, run `bash scripts/team-request.sh <handle> "text"` (or `done <id>`), and remind your human to call or message them.

8. **Report** in a few lines: what was pushed, to which branch, open requests.
