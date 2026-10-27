# Build context = repo root:  docker build -f services/gateway/Dockerfile -t fp-gateway .
FROM node:24-slim AS build
RUN npm install -g pnpm@11.10.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@fingerpost/gateway..." \
 && pnpm --filter "@fingerpost/gateway..." build \
 && pnpm --filter @fingerpost/gateway deploy --legacy --prod /out

FROM node:24-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
