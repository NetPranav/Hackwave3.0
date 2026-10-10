# A4 · Timeline, drift detail, graph alert states (Days 6–8)

**Done when:** after the rename flip the bell rings, the timeline shows the event, the drift page explains it, and the graph path from the field to its workflows pulses red.
**Owner:** adarzhpathade · **Consumes:** [P4](P4-catch-a-rename.md) (`drift-event`, `notification` contracts, `GET /v1/drift-events`, `/v1/notifications`, SSE `drift.created`) · **Spec:** [dashboard.md](dashboard.md) §6–7.

| ID | Task | Output |
|---|---|---|
| A4.1 | Timeline page with filters (type, severity, state, service) | See §6 |
| A4.2 | Drift detail page: header, before/after stats, detector reasoning, where used (file:line links), React Flow chain "change → field → functions → workflows" | See §7 |
| A4.3 | Notification bell with unread count (SSE), mark-read | See §11 |
| A4.4 | Graph states: amber/red/blue/green, red path pulse, fade to green on resolution | Live via SSE |

**DoD:** rename flip → bell + red path in < 60 s · an info-level event creates no bell notification.
