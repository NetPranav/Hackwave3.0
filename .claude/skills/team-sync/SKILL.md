---
name: team-sync
description: Refresh the team picture mid-session. Fetches, shows each teammate's published status, active branches, open PRs and file overlaps with your branch, then recommends what to do. Use when the user asks what the others are doing, before editing shared or someone else's files, before opening or finishing a PR, or after a long break.
---

# Team sync

1. Run `bash scripts/team-status.sh` and read the whole briefing.

2. Also check what's waiting on the user:
   ```bash
   gh pr list --search "review-requested:@me" --state open
   gh pr list --author "@me" --state open
   ```

3. **Interpret, don't just repeat.** Tell the user, briefly:
   - Overlaps: which teammate's branch touches the same files, and whether to coordinate now.
   - Behind develop: if more than a few commits, recommend `git fetch origin && git merge origin/develop` (offer to do it; never rebase or force-push).
   - Contract changes announced in teammates' statuses or open PRs touching `contracts/` that affect the user's area.
   - Blockers where a teammate needs something from the user (from their status "Blockers / needs from others").
   - PRs waiting for the user's review.

4. Take no merge, push or status-publish action without the user's OK.
