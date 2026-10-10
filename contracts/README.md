# contracts/

Interfaces between the parts owned by different people. **Contract first, code second.** This is how three people build in parallel without breaking each other.

## Rules
1. A contract change is its own PR (`docs/contracts-<name>` or `feature/contracts-<name>`), reviewed by everyone (all three are code owners here).
2. After it merges, producer and consumer implement against it independently. Consumers build against mock data that matches the contract.
3. A breaking change gets a new version (`…v2…`) and both versions live side by side until every consumer has moved.
4. Every contract file starts with: owner (producer), consumers, version, last change.

## Planned contracts

The authoritative list, with the phase each one is written in, is [`../docs/roadmap/README.md`](../docs/roadmap/README.md) §5. Contracts are zod schemas in this package (`@seismo/contracts`) that generate TS types, JSON Schema and OpenAPI.


| File | Producer → consumer | Describes |
|---|---|---|
| `fingerprint.schema.json` | SDK → backend ingest (@NetPranav) | Shape-only response fingerprint + batch sketch (see `docs/PS/architecture.md` §3.3) |
| `dashboard-api.openapi.yaml` | backend (@NetPranav) → dashboard (@adarzhpathade) | Services, endpoints, drift events, graph data, review queue, demo controls, WebSocket events |
| `codemap.schema.json` | GitHub App (@NetPranav) → backend (@NetPranav) | Call sites, field reads, usage kinds, workflows |
| `fix-request.schema.json` | backend (@NetPranav) → PR bot (@NetPranav) | Drift event + rung + adapter change to open as a PR |
| `fake-services` | services (@NetPranav) → demo shop + dashboard (@adarzhpathade) | Endpoints, v1/v2 payloads, admin toggle API |

Write these first (day 1–2) so frontend and backend work can start in parallel.
