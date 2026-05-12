# syntax=docker/dockerfile:1.7
#
# API container for prmd.ai.
#
# Build context MUST be the monorepo root (C:/git/github/Prompd/prmd.ai) so
# the build can see the workspace package.json files. The cloudbuild config
# passes `.` as the context and `-f apps/api/Dockerfile`.
#
# Runs the Express API with tsx so we don't need a separate tsc build step
# for the API or the @prmd/shared workspace package. Cloud Run cold-start
# overhead from tsx is negligible at this traffic volume.

FROM node:20-alpine AS deps
WORKDIR /repo

# Copy lockfile + workspace manifests first for cache-friendly installs.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# npm 7+ installs every workspace from the root lockfile by default. Web's
# manifest is copied above so the lockfile resolves cleanly.
RUN npm ci --no-audit --no-fund

# ----------------------------------------------------------------------------
FROM deps AS build

# Copy sources actually needed at runtime.
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Pull @prmd-ai/agent-pack from prompdhub.ai into apps/api/.prompd/packages
# so the compiler can resolve the agent templates at runtime. Version is
# read from apps/api/prompd.json's dependencies map — single source of
# truth, no Dockerfile edits when bumping the pack version.
#
# `prompd install` requires an explicit package@version argument; passing
# just `prompd install` does not auto-resolve from prompd.json yet.
WORKDIR /repo/apps/api
RUN PACK_VERSION=$(node -p "require('./prompd.json').dependencies['@prmd-ai/agent-pack']") \
    && echo "Installing @prmd-ai/agent-pack@${PACK_VERSION}" \
    && npx --yes prompd install "@prmd-ai/agent-pack@${PACK_VERSION}"

# ----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 prmd

COPY --from=build --chown=prmd:nodejs /repo /app

USER prmd

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

WORKDIR /app/apps/api

# npm 10 finds the workspace `start` script (tsx src/index.ts) without
# re-resolving anything. Avoids hardcoding the hoisted tsx path.
CMD ["npm", "start", "--silent"]
