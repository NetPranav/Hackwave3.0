#!/usr/bin/env bash
# P0.8: `npm run dev`: backend API, worker, fake services (dashboard runs from its own folder).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
set -a; [ -f .env ] && . ./.env; set +a
trap 'kill 0' EXIT
npm run dev -w backend &
npm run worker -w backend &
npm run dev -w services &
[ -n "${WEBHOOK_PROXY_URL:-}" ] && [ -d github-app ] && [ -f github-app/package.json ] && npm run dev -w github-app &
wait
