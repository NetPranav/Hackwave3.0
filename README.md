# Hackwave3.0 · Seismo (working name)

**HackWave 3.0 · PS 3 "The Internet After the API".** "Dependabot for the APIs you depend on": Seismo detects silent changes in third-party APIs (shape, behaviour, meaning), maps them to the code that uses them, and opens safe fix PRs, asking a human when unsure.

- Design docs: [`docs/PS/`](docs/PS/README.md) · **Build roadmap (phases P0–P8):** [`docs/roadmap/`](docs/roadmap/README.md)
- How we work (branches, PRs, releases): [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Instructions for AI coding agents: [`AGENTS.md`](AGENTS.md) · decisions and open questions: [`MEMORY.md`](MEMORY.md)

## Team

| GitHub | Role |
|---|---|
| @NetPranav | Lead · architecture/logic (backend, SDK) · merges releases into `main` |
| @OVERxPOWERED | Architecture/logic (GitHub App, fake services) |
| @adarzhpathade | Frontend (landing, dashboard, demo shop repo) |

## Get started (each teammate, once)

```bash
git clone https://github.com/NetPranav/Hackwave3.0.git
cd Hackwave3.0
bash scripts/setup.sh <your-github-handle>
claude            # Claude Code shows a team briefing automatically
```

Then work only on your own branch (`netpranav` or `adarzhpathade`) and end each session with `/handoff` in Claude Code. Your tasks: [`START_HERE.md`](START_HERE.md).

## Branches

`main` is the default branch: pull from it to get everyone's merged work. Each person has one personal branch (`netpranav`, `adarzhpathade`, `overxpowered`) and pushes only there. The lead merges personal branches into `main` through PRs. Cross-team asks go through `bash scripts/team-request.sh`. Details in [`CONTRIBUTING.md`](CONTRIBUTING.md).
