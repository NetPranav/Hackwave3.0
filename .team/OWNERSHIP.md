# Ownership

Who owns which part of the repo. Owners review PRs that touch their area (see `.github/CODEOWNERS`) and decide on changes inside it. Change this file only through a PR the whole team can see.

| GitHub | Role | Primary areas | Typical work (from `docs/PS/roadmap-demo.md`) |
|---|---|---|---|
| NetPranav | Lead · engine + everything except the dashboard | `contracts/` (lead), `backend/`, `sdk-node/`, `github-app/`, `services/`, `.github/`, `.claude/`, `scripts/` | SDK, ingest, baselines, detectors, severity engine, probes, LLM explanations, merging release PRs into `main` |
| OVERxPOWERED | Invite pending; no tasks (2026-10-11). Former areas moved to NetPranav | — | Fake third-party services (v1/v2 switches), GitHub App, code scan + code map, PR bot, safety check run, alert dispatcher, radar sources |
| adarzhpathade | Frontend: whole dashboard incl. login | `dashboard/`, demo repo `seismo-demo-shop` | Landing page, dashboard, Obsidian-style graph, status, timeline, drift detail, review queue, Compare & Simulate, radar page, demo shop |

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
| Fake services → demo shop, dashboard | `contracts/fake-services` | OVERxPOWERED | adarzhpathade |
| Backend → PR bot | `contracts/fix-request.schema.json` | NetPranav | OVERxPOWERED |

The full list of contracts per phase is in [`../docs/roadmap/README.md`](../docs/roadmap/README.md) §5.
