# A6 · Review queue, notification settings, Compare & Simulate (Days 8–11)

**Done when:** a paise flip appears as a review card with an AI explanation and actions; alert channels are configurable with a working test-send; Compare & Simulate answers "what happens if…".
**Owner:** adarzhpathade · **Consumes:** [P6](P6-meaning-changes-ai-alerts.md) (`ai-explanation`, `review-item`; `GET/POST /v1/review`, `/v1/settings/notifications`, `/v1/notifications/test`, `/v1/compare`, `/v1/simulate`) · **Spec:** [dashboard.md](dashboard.md) §8, §9, §11.

| ID | Task | Output |
|---|---|---|
| A6.1 | Notification settings (channels, thresholds, WhatsApp number with sandbox join instructions, test-send button) | See §11 |
| A6.2 | Review queue and card: evidence, AI explanation with model name + latency badge or "template", suggested change, actions Mark expected / Snooze / Open suggestion PR | See §8 |
| A6.3 | Compare & Simulate page (replaces Compare v1): baseline vs current diff and the what-if form with impact path, alias coverage, suggestion preview | See §9 |
| A6.4 | Show "AI off → template text" state clearly (feature flag in settings) | Nothing breaks without NIM |

**DoD:** three demo scenarios (paise, enum, truncation) render correct cards · test-send reaches WhatsApp and Slack · simulate works for rename, unit, enum, limit.
