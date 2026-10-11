#!/usr/bin/env bash
# P0.8: `npm run setup`. Creates .env from .env.example, ensures the database exists, migrates.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

[ -f .env ] || { cp .env.example .env; echo "created .env (fill in the blanks)"; }
set -a; . ./.env; set +a
DATABASE_URL=${DATABASE_URL:-postgres://localhost:5432/seismo}

if command -v docker >/dev/null && docker info >/dev/null 2>&1 && [ "${USE_DOCKER_DB:-0}" = 1 ]; then
  docker compose up -d db
  export DATABASE_URL=postgres://seismo:seismo@localhost:5433/seismo
else
  name=${DATABASE_URL##*/}
  psql "${DATABASE_URL%/*}/postgres" -Atc "select 1 from pg_database where datname='$name'" | grep -q 1 || createdb "$name"
fi
npm run build -w contracts
npm run db:migrate -w backend
echo "setup done"
