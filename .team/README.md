# .team: how our three Claude Code sessions stay in sync

Each of us runs Claude Code on our own computer. They can't talk to each other directly, so they share state through **git**:

| Mechanism | What it gives every session | Where |
|---|---|---|
| **Team briefing hook** | On every session start, Claude reads: each teammate's published status, active branches and the areas they touch, open PRs, files that overlap with your branch, and whether you're behind `develop` | `.claude/settings.json` → `scripts/team-status.sh` |
| **Status files** | One Markdown file per person: what I'm doing now, which files, what's next, blockers, contract changes | Local draft: `.team/status/<handle>.md` (git-ignored). Published copy: branch `team-status`, `status/<handle>.md` |
| **Draft PRs** | Work is visible from the first commit | GitHub |
| **Ownership + contracts** | Who decides what; interfaces agreed before code | `.team/OWNERSHIP.md`, `contracts/` |
| **Skills** | Same procedure on every machine | `.claude/skills/start-task`, `handoff`, `team-sync` |

## Why a separate `team-status` branch?
Status changes many times a day. Keeping it out of code branches means it never causes merge conflicts in PRs and is visible to everyone the moment it's published, without waiting for a merge. Its commit history doubles as a log of who did what, when.

## Commands
```bash
bash scripts/team-status.sh             # print the briefing yourself
bash scripts/team-publish-status.sh     # publish .team/status/<you>.md to origin/team-status
```

Template for a status file: [`STATUS_TEMPLATE.md`](STATUS_TEMPLATE.md).
