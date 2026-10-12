# One image for every engine process (backend API, worker, fake providers, GitHub App). Pick the process with CMD.
# Build:  docker build -t seismo .
# Run:    docker run --env-file .env -p 4000:4000 seismo                      (backend API, default)
#         docker run --env-file .env -p 4100:4100 seismo node services/dist/server.js
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY contracts/package.json contracts/
COPY sdk-node/package.json sdk-node/
COPY backend/package.json backend/
COPY github-app/package.json github-app/
COPY services/package.json services/
RUN npm ci --no-audit --no-fund
COPY contracts contracts
COPY sdk-node sdk-node
COPY backend backend
COPY github-app github-app
COPY services services
COPY scripts scripts
RUN npx turbo run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# dev dependencies stay: drizzle-kit runs the migrations at start-up
COPY --from=build /app /app
RUN addgroup -S seismo && adduser -S seismo -G seismo && chown -R seismo:seismo /app
USER seismo
EXPOSE 4000 4100 3001
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" || exit 1
# default: the whole engine as one service (backend on $PORT; providers + GitHub App behind it). One process: override CMD.
CMD ["sh", "-c", "npm run db:migrate -w backend && node scripts/start-all.mjs"]
