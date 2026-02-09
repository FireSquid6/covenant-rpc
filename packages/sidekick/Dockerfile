FROM oven/bun:1 AS install

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/package.json
COPY packages/ion/package.json packages/ion/package.json
COPY packages/request-serializer/package.json packages/request-serializer/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/sidekick/package.json packages/sidekick/package.json

RUN bun install --frozen-lockfile --production

FROM oven/bun:1-slim

WORKDIR /app

COPY --from=install /app/node_modules node_modules

COPY packages/core packages/core
COPY packages/ion packages/ion
COPY packages/request-serializer packages/request-serializer
COPY packages/server packages/server
COPY packages/sidekick packages/sidekick

EXPOSE 8008

ENTRYPOINT ["bun", "packages/sidekick/exec/sidekick.ts"]
