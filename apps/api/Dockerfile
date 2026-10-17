FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/permissions/package.json packages/permissions/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY apps/api apps/api
COPY packages packages
COPY turbo.json ./
RUN pnpm --filter @puffinpal/permissions build \
  && pnpm --filter database build \
  && pnpm --filter @puffinpal/api build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/permissions/package.json packages/permissions/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
RUN pnpm install --prod --frozen-lockfile

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system --gid 1001 puffinpal && useradd --system --uid 1001 --gid puffinpal --home-dir /app puffinpal
COPY --from=production-dependencies --chown=puffinpal:puffinpal /workspace/node_modules ./node_modules
COPY --from=production-dependencies --chown=puffinpal:puffinpal /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=production-dependencies --chown=puffinpal:puffinpal /workspace/packages/database/node_modules ./packages/database/node_modules
COPY --from=builder --chown=puffinpal:puffinpal /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=puffinpal:puffinpal /workspace/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=puffinpal:puffinpal /workspace/packages/database/package.json ./packages/database/package.json
COPY --from=builder --chown=puffinpal:puffinpal /workspace/packages/database/dist ./packages/database/dist
COPY --from=builder --chown=puffinpal:puffinpal /workspace/packages/permissions/package.json ./packages/permissions/package.json
COPY --from=builder --chown=puffinpal:puffinpal /workspace/packages/permissions/dist ./packages/permissions/dist
USER puffinpal
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/src/main.js"]

FROM builder AS migration
ENV NODE_ENV=production
WORKDIR /workspace/apps/api
CMD ["pnpm", "run", "prisma:migrate:deploy"]

