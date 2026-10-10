---
name: team-sync
description: Refresh the team picture mid-session. Fetches, shows open requests (especially ones for you), each teammate's status note, their branches and open PRs, then recommends what to do. Use when the user asks what the others are doing, before editing shared or someone else's files, before opening or finishing a PR, or after a long break.
---

# Team sync

1. Run `bash scripts/team-status.sh` and read the whole briefing.

2. Also run `bash scripts/team-request.sh list`.

3. **Interpret, don't just repeat.** Tell the user, briefly:
   - Open requests addressed to the user (do these first on their own branch, then `bash scripts/team-request.sh done <id>`).
   - New commits on `main`: optionally `git merge origin/main` into their own branch (offer; never rebase or force-push, never merge another person's branch).
   - Contract changes announced in teammates' statuses or open PRs touching `contracts/` that affect the user's area.
   - Blockers where a teammate needs something from the user (from their status "Blockers / needs from others").

4. Take no merge, push or status-publish action without the user's OK.
