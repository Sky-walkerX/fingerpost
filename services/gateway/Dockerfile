# Build context = repo root:  docker build -f services/gateway/Dockerfile -t fp-gateway .
FROM node:24-slim AS build
RUN npm install -g pnpm@11.10.0
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/
COPY services/gateway/package.json services/gateway/
RUN pnpm install --frozen-lockfile --filter @fingerpost/gateway...
COPY packages/protocol packages/protocol
COPY services/gateway services/gateway
RUN pnpm --filter @fingerpost/gateway... build \
 && pnpm --filter @fingerpost/gateway deploy --legacy --prod /out

FROM node:24-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
