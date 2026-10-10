# Libraries: reuse before we build

Rule (from the team): use existing libraries wherever they fit; we build only the glue and the parts that are actually new (detectors, severity, alias planner, safety checks).

**Status legend:** ✅ checked in research on 2026-10-11 (source in [`../PS/sources.md`](../PS/sources.md)) · 🔍 well known but not re-checked; confirm the current version, licence and maintenance when installing · 🧪 depends on a P0 spike

## Platform
| Need | Library | Status | Phase |
|---|---|---|---|
| Monorepo tasks + caching | Turborepo | 🔍 | P0 |
| Shared schemas → types, JSON Schema, OpenAPI | zod (v4 has `toJSONSchema`) + zod-openapi | 🔍 | P0 |
| HTTP API | Fastify (+ @fastify/rate-limit) | 🔍 | P0 |
| ORM + migrations | drizzle-orm + drizzle-kit | 🔍 | P0 |
| Job queue on Postgres (no Redis) | pg-boss | ✅ (2026 comparisons: Postgres-only, SKIP LOCKED) | P0 |
| Logging | pino | 🔍 | P0 |
| Tests | Vitest · Playwright · fast-check (property tests) · msw (HTTP mocks in tests) | 🔍 | all |
| Error tracking | @sentry/node, @sentry/nextjs (free tier) | 🔍 | P8 |

## GitHub
| Need | Library | Status | Phase |
|---|---|---|---|
| GitHub App framework incl. manifest flow, webhook verification | Probot | ✅ manifest flow documented by GitHub; maintenance 🧪 S3 | P0, P2 |
| Fallback app/auth/webhooks | @octokit/app · @octokit/webhooks · @octokit/rest | 🔍 | P0 |
| Local webhook tunnel | smee-client | 🔍 | P0 |
| PR with file changes in one call | octokit-plugin-create-pull-request (gr2m) | ✅ README: multi-file single commit, `update: true` | P5 |
| Download repo for scanning | Octokit tarball endpoint + `tar` | 🔍 | P2 |

## Code analysis and codemods
| Need | Library | Status | Phase |
|---|---|---|---|
| Parse TS/JS, follow property access, edit code safely | ts-morph | 🔍 | P2, P5.3 |
| Workflow config | js-yaml | 🔍 | P2 |
| Graph model + path queries | graphology + graphology-traversal | ✅ (graph data-model library) | P2 |

## Capture and statistics
| Need | Library | Status | Phase |
|---|---|---|---|
| Observe outbound fetch/http without changing responses | @mswjs/interceptors | ✅ read-only `response` listener; reading body without consuming 🧪 S2 | P3 |
| Percentile sketches | tdigest | 🔍 | P3 |
| KS / PSI / basic stats | simple-statistics (or hand-rolled) | 🔍 | P6 |
| Name similarity for renames | fastest-levenshtein | 🔍 | P4 |
| Compression for SDK batches | fflate | 🔍 | P3 |
| JSON shape inference (optional helper) | quicktype-core (multi-sample inference) | ✅ | P3 |
| Provider status pages | Atlassian Statuspage public `…/api/v2/summary.json` (no library; plain fetch) | ✅ | P3 |

## Fixes, diffs and UI
| Need | Library | Status | Phase |
|---|---|---|---|
| Visual JSON diff (Compare) | jsondiffpatch | 🔍 | P1, P6 |
| Code diff view | react-diff-viewer-continued | 🔍 | P5 |
| Obsidian-style force graph | react-force-graph-2d (d3-force) or @react-sigma/core + graphology | ✅ both options researched; pick in 🧪 S6 | P2 |
| Left-to-right impact chain | @xyflow/react (React Flow) | 🔍 | P4 |
| Charts / sparklines | recharts | 🔍 | P3 |
| UI kit | Tailwind + shadcn/ui | 🔍 | P0 |
| Auth | Auth.js (next-auth v5) GitHub provider | 🔍 | P0 |
| Data fetching | TanStack Query | 🔍 | P2 |

## AI and alerts
| Need | Library | Status | Phase |
|---|---|---|---|
| LLM client (OpenAI-compatible → NVIDIA NIM) | openai | ✅ NIM hosted API reported OpenAI-compatible; 🧪 S1 | P6 |
| Rate limiting / retries | bottleneck · p-retry | 🔍 | P6 |
| WhatsApp | twilio (sandbox) | ✅ sandbox flow, 24-hour window | P6 |
| Email | resend | 🔍 | P6 |
| Slack / Discord | incoming webhooks via `fetch` (no SDK needed) | 🔍 | P6 |

## Radar
| Need | Library | Status | Phase |
|---|---|---|---|
| RSS/Atom | rss-parser | 🔍 | P7 |
| HTML main text | @mozilla/readability + jsdom | 🔍 | P7 |
| Text diff | diff | 🔍 | P7 |
| OpenAPI breaking-change diff | openapi-diff (npm) or oasdiff (Go binary) | ✅ oasdiff researched (100+ checks); openapi-diff 🔍 | P7 |
| RSS output for fake providers | feed | 🔍 | P1 |

## Considered and not used (for now)
| Library / tool | Why not |
|---|---|
| Keploy, Speedscale, Tusk Drift | Record full payloads for testing; we need shape-only monitoring |
| BullMQ | Needs Redis; pg-boss keeps us on one database |
| Novu (notification infra) | Powerful but heavy for 5 channels; revisit after the hackathon |
| changedetection.io | Python service to run separately; rss-parser + readability is enough for the demo |
| An LLM agent framework | The AI does three bounded JSON tasks; a plain client is simpler and safer |
