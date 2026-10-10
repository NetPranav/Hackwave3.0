# Hackwave3.0 · Seismo (working name)

**HackWave 3.0 · PS 3 "The Internet After the API".** "Dependabot for the APIs you depend on": Seismo detects silent changes in third-party APIs (shape, behaviour, meaning), maps them to the code that uses them, and opens safe fix PRs, asking a human when unsure.

- Design docs: [`docs/`](docs/README.md)
- How we work (branches, PRs, releases): [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Instructions for AI coding agents: [`AGENTS.md`](AGENTS.md) · decisions and open questions: [`MEMORY.md`](MEMORY.md)

## Team

| GitHub | Role |
|---|---|
| @NetPranav | Lead · architecture/logic (backend, SDK) · merges releases into `main` |
| @OVERxPOWERED | Architecture/logic (GitHub App, fake services) |
| @adarzhpathade | Frontend (demo shop, dashboard) |

## Get started (each teammate, once)

```bash
git clone https://github.com/NetPranav/Hackwave3.0.git
cd Hackwave3.0
bash scripts/setup.sh <your-github-handle>
claude            # Claude Code shows a team briefing automatically
```

Then, inside Claude Code: `/start-task` → build → `/handoff` → mark the PR ready → a teammate reviews → squash-merge into `develop`.

## Branches

`main` (demo-ready; only the lead merges release PRs, nobody pushes directly) ← `develop` (integration, PRs only, default branch) ← `feature/<area>-<desc>` (your work). Live team status lives on the `team-status` branch. Details in [`CONTRIBUTING.md`](CONTRIBUTING.md).
