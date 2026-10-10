# Does finishing every phase build the whole app? (verification, 2026-10-11)

Method: every capability the product must show (the demo script in [P8](P8-launch.md), the official-PS table in [README](README.md) §1b, every dashboard route in [dashboard.md](dashboard.md) §1, every non-negotiable rule in `AGENTS.md`) is traced to a P task (NetPranav), an A task (Adarsh) and the API/contract that connects them. Anything without an owner or without a backing API was a gap and was fixed in the phase files.

## 1. Capability matrix

| Capability | NetPranav (P) | Adarsh (A) | Connecting contract / API | Result |
|---|---|---|---|---|
| Login with GitHub, protected app | P0.11 backend verifies session | A0.1 | `GET /v1/me` | ✅ (gap 1 fixed) |
| Mocks so the dashboard never waits | P0.0, P0.2 | A0.4 | `contracts/` + generator | ✅ (gap 2) |
| Four fake APIs with v1/v2 + rollout | P1.1–P1.3 | A1.3 Demo Control | admin API | ✅ |
| Demo shop that visibly breaks | — | A1.1, A1.2 | fake-services | ✅ (moved to A; NetPranav never edits it) |
| Compare v1/v2 | P1.2 `/admin/sample` | A1.4 | admin API | ✅ (gap 3) |
| Install GitHub App → scan → code map | P2.1–P2.4 | A2.1 onboarding | `installations`, `codemap` | ✅ |
| Scanner config files in the shop | P2.3/P2.4 read them | A1.1 creates `seismo.config.json`, `seismo.workflows.yml` | file formats in P2 | ✅ (gap 4) |
| Obsidian-style graph + impact path | P2.5, P2.8 | A2.2, A2.3 | `graph`, `GET /v1/graph` | ✅ |
| SDK capture, fingerprints, privacy | P3.2, P3.3, P3.8 | A3.1 installs it in the shop | `fingerprint` | ✅ (gap 5) |
| Ingest, baselines, SDK keys | P3.4, P3.5 | A3.5 key UI | keys API | ✅ (gap 6) |
| API status layer, provider status | P3.6 | A3.2, A3.3 | `status`, SSE | ✅ |
| Overview KPIs | P3.6 `/v1/overview` | A3.4 | overview | ✅ (gap 7) |
| Detect rename, structural, headers, errors, endpoint gone | P4.2–P4.4 | — | `drift-event` | ✅ |
| Code-aware severity | P4.5 | A4.2 | `GET /v1/drift-events` | ✅ |
| GitHub issue + dashboard bell | P4.6 | A4.3 | `notification` | ✅ |
| Red path on graph | P4.5 | A4.4 | SSE `drift.created` | ✅ |
| Alias runtime + G1–G4 proof | P5.2 | A5.3 wires it into the shop | `alias-spec` | ✅ |
| Setup PR, alias PR, check run | P5.3, P5.5, P5.6 | A5.1 fix panel | `fix-request`, `validation-result` | ✅ |
| Tests red → green | — | A5.2 | CI | ✅ |
| Merge → resolved → green | P5.9 | A5.4 | SSE `drift.resolved` | ✅ |
| Unit / enum / truncation detectors | P6.2–P6.4 | — | `drift-event` | ✅ |
| AI explain + judge, template fallback | P6.5, P6.11 | A6.4 | `ai-explanation` | ✅ |
| Review queue | P6.6 | A6.2 | `review-item` | ✅ |
| Alerts: WhatsApp, Slack/Discord, email | P6.7 | A6.1 | settings API | ✅ |
| Notification settings + test-send | P6.13 | A6.1 | `/v1/settings/notifications` | ✅ (gap 8) |
| Compare & Simulate | P6.10 | A6.3 | `/v1/compare`, `/v1/simulate` | ✅ (gap 9) |
| Webhook drift (Should), MCP (Later) | P6.12 | — | — | ✅ as scoped |
| Radar: feeds, OpenAPI, AI parser, matcher | P7.1–P7.6 | A7.1, A7.2 | `radar-item` | ✅ |
| Landing page, docs, polish | — | A7.3, A8.1, A8.2 | — | ✅ |
| Production, public GitHub App, demo reset | P8.2, P8.3, P8.5, P8.6 | A8.4 | — | ✅ |
| Rehearsals, backup video, release | P8.8, P8.10 | A8.3, A8.5, A8.6 | — | ✅ |
| SDK distribution | P0.10 | A3.1 | npm / tarball | ✅ |
| Safety rules (read-only SDK, privacy, additive aliases, AI never writes code) | P3.8, P5.2, P5.4, P6.5 tests | — | tests in CI | ✅ |

**Verdict on completeness:** with the gaps below fixed, every screen has an API behind it, every API has an owner, and every cross-person handoff is a named request. Nothing in the demo script lacks a task.

## 2. Gaps found and fixed in this pass

| # | Gap | Fix |
|---|---|---|
| 1 | Nothing said how the backend trusts the dashboard's Auth.js session, or how SSE authenticates (EventSource cannot send headers) | P0.11 |
| 2 | Adarsh was blocked on contract skeletons (his status note says so) | P0.0: contracts + mock generator come first on Day 1 |
| 3 | Compare view needed v1 and v2 samples regardless of toggles | `/admin/sample` in P1.2 |
| 4 | `seismo.config.json` and `seismo.workflows.yml` live in the shop but nobody owned them | A1.1 |
| 5 | SDK install in the shop was assigned to NetPranav, who must never edit the shop | P3.7 became a request; A3.1 does it. P3.8 and P8.5 only run or call the shop |
| 6 | No projects / SDK-key API for the settings page | P3.4 |
| 7 | No endpoint for the overview KPI tiles | P3.6 |
| 8 | No settings/test-send API behind the notification settings page | P6.13 |
| 9 | Compare & Simulate had a UI task but no backend task | P6.10 rewritten as API, A6.3 as UI |
| 10 | Installations/scan-progress endpoint for onboarding | P2.5 |

Still **open decisions** (not gaps in the plan): final product name, npm scope, deadline confirmation, competitor price checks (`MEMORY.md` Q2, Q6, Q10, Q11).

## 3. Does it fit in 14 days? (honest answer: tight)

OVERxPOWERED has no tasks, so NetPranav carries the whole engine, the GitHub App, the fake services and alerts.

| Track | Tasks | Notes |
|---|---|---|
| P-track (NetPranav) | about 70 sub-tasks (P0: 13 + 5 spikes, P1: 4, P2: 6, P3: 8, P4: 7, P5: 9, P6: 11, P7: 6, P8: 7) | about 5 per day for 14 days |
| A-track (Adarsh) | about 40 sub-tasks (A0: 5, A1: 5, A2: 4, A3: 5, A4: 4, A5: 4, A6: 4, A7: 3, A8: 6) | about 3 per day, but UI tasks are large |

Risk spots: Day 3–4 (fake services + GitHub App + scanner together), Day 7 (SDK + privacy test + detector framework), Days 11–12 (AI layer, dispatcher, radar and production deploy all land near the freeze).

**Mitigations already in the plan:**
1. The scope freeze moved from end of Day 11 to **end of Day 12 for Musts only**; Day 13–14 are launch and fixes only.
2. Use the cut lines in [README](README.md) §7 early rather than late. First to go: P7 radar (keep header badges), Discord and email, D6/D10, P6.12 webhook drift, P5.10/P5.11.
3. **Never cut** (the demo needs them): P2 graph, P4 rename, P5 safe alias PR, P6 unit change + review queue, WhatsApp or Slack alert, backup video.
4. If a third person is available (OVERxPOWERED), hand over the cleanly separable pieces: P1 fake services, P6.7 alert dispatcher, P7 radar fetchers. Each has a contract, so it needs no extra coordination.

## 4. Review checklist before building starts
- [ ] NetPranav pushes P0.0 contract skeletons on Day 1 and sends Adarsh a request.
- [ ] Adarsh is on branch `adarzhpathade` (request #2 sent) and has merged his design-system work into it.
- [ ] PR #3 is merged into `main` so the new rules reach everybody.
- [ ] Spikes S1–S6 are answered in `MEMORY.md` by the end of Day 2.
