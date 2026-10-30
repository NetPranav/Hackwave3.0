#!/usr/bin/env bash
# `npm run dev`: backend API, worker, fake services, GitHub App (when WEBHOOK_PROXY_URL is set) and the dashboard (v2-P0.1).
# Ports: PORT (backend, default 4000), SERVICES_PORT (4100), GITHUB_APP_PORT (3060), DASHBOARD_PORT (default 3000; the GitHub App's login callback is registered for 3000).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
# values given on the command line (PORT=4050 npm run dev) win over .env
cli_port=${PORT:-}; cli_dash=${DASHBOARD_PORT:-}
set -a; [ -f .env ] && . ./.env; set +a
[ -n "$cli_port" ] && PORT=$cli_port
[ -n "$cli_dash" ] && DASHBOARD_PORT=$cli_dash
trap 'kill 0' EXIT
# Hosted engine (npm run deploy:render): only the dashboard runs here, pointed at it. Running a local engine as well
# would mean two engines watching the same repo (duplicate PRs), so none is started.
if [ -n "${SEISMO_ENGINE_URL:-}" ]; then
  echo "dashboard only, engine: $SEISMO_ENGINE_URL"
  [ -d dashboard/node_modules ] || (cd dashboard && npm install --no-audit --no-fund)
  cd dashboard && SEISMO_API_URL="$SEISMO_ENGINE_URL" SERVICES_URL="$SEISMO_ENGINE_URL" DEMO_MODE="${DEMO_MODE:-true}" exec npx next dev -p "${DASHBOARD_PORT:-3000}"
fi
backend_port=${PORT:-4000}
# the backend reaches the GitHub App (PRs, issues, installations) over HTTP
export GITHUB_APP_PORT=${GITHUB_APP_PORT:-3060}
export GITHUB_APP_URL=${GITHUB_APP_URL:-http://localhost:$GITHUB_APP_PORT}
# ...and the GitHub App posts code maps and CI results back to the backend
export BACKEND_URL=${BACKEND_URL:-http://localhost:$backend_port}
npm run dev -w backend &
npm run worker -w backend &
PORT=${SERVICES_PORT:-4100} npm run dev -w services &
[ -n "${WEBHOOK_PROXY_URL:-}" ] && [ -d github-app ] && [ -f github-app/package.json ] && npm run dev -w github-app &
if [ -f dashboard/package.json ] && [ "${NO_DASHBOARD:-0}" != 1 ]; then
  [ -d dashboard/node_modules ] || (cd dashboard && npm install --no-audit --no-fund)
  (cd dashboard && SEISMO_API_URL="${SEISMO_API_URL:-http://localhost:$backend_port}" SERVICES_URL="${SERVICES_URL:-http://localhost:${SERVICES_PORT:-4100}}" DEMO_MODE="${DEMO_MODE:-true}" npx next dev -p "${DASHBOARD_PORT:-3000}") &
fi
wait
