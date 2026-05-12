# syntax=docker/dockerfile:1.7
#
# Web (Vite SPA) container for prmd.ai.
#
# Build context MUST be the monorepo root so workspace deps resolve. The
# cloudbuild config passes `.` as the context and `-f apps/web/Dockerfile`.
#
# Two build-args feed the runtime image:
#   VITE_CLERK_PUBLISHABLE_KEY — public Clerk key (safe to ship)
#   API_URL                   — Cloud Run URL of the @prmd/api service,
#                                e.g. https://prmd-ai-api-xxxx-uc.a.run.app
#                                Used by nginx to proxy /api/*.

FROM node:20-alpine AS deps
WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm ci --no-audit --no-fund

# ----------------------------------------------------------------------------
FROM deps AS build

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

ARG VITE_CLERK_PUBLISHABLE_KEY=""
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

WORKDIR /repo/apps/web
RUN npm run build

# ----------------------------------------------------------------------------
FROM nginx:alpine AS runner

# envsubst lives in gettext on alpine; pulled in to template nginx.conf at start.
RUN apk add --no-cache gettext

COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template

ARG API_URL=""
ENV API_URL=$API_URL

EXPOSE 8080

# nginx:alpine entrypoint runs envsubst on /etc/nginx/templates/* into
# /etc/nginx/conf.d/ before launching nginx, so $API_URL is substituted.
CMD ["nginx", "-g", "daemon off;"]
