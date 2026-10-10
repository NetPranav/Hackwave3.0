# Ownership

Who owns which part of the repo. Owners review PRs that touch their area (see `.github/CODEOWNERS`) and decide on changes inside it. Change this file only through a PR the whole team can see.

| GitHub | Role | Primary areas | Typical work (from `docs/roadmap-demo.md`) |
|---|---|---|---|
| NetPranav | Lead · architecture/logic | `backend/`, `sdk-node/`, `.github/`, `.claude/`, `scripts/` | SDK, ingest, baselines, detectors, severity engine, probes, LLM explanations, merging release PRs into `main` |
| OVERxPOWERED | Architecture/logic | `github-app/`, `services/` | Fake third-party services (v1/v2 switches), GitHub App, code scan + code map, PR bot, CI wiring of fix PRs |
| adarzhpathade | Frontend | `shop/`, `dashboard/` | Demo shop, dashboard, Obsidian-style graph, timeline, drift detail, review queue, demo panel |

## Shared areas (everyone; PR visible to all)

| Path | Rule |
|---|---|
| `contracts/` | Interfaces between owners. Change by contract-only PR first; all three are code owners |
| `docs/` | Design docs. Keep in sync with decisions; log decisions in `MEMORY.md` |
| `tests/` | Cross-area tests (privacy test, workflow tests). Add, don't delete others' tests |
| `docker-compose.yml` | Lead reviews |

## Boundaries between owners (the contracts)

| From → To | Contract (planned file) | Producer | Consumer |
|---|---|---|---|
| SDK → backend ingest | `contracts/fingerprint.schema.json` | NetPranav | NetPranav |
| Backend → dashboard | `contracts/dashboard-api.openapi.yaml` | NetPranav | adarzhpathade |
| GitHub App → backend | `contracts/codemap.schema.json` | OVERxPOWERED | NetPranav |
| Fake services → shop | `contracts/fake-services.md` | OVERxPOWERED | adarzhpathade |
| Backend → PR bot | `contracts/fix-request.schema.json` | NetPranav | OVERxPOWERED |
