# Multi-stage build for the finance-tracker backend.
# Build context: repo root (required for npm workspace resolution).
#
# Directory layout inside the image mirrors the monorepo:
#
#   /usr/src/app/                          ← WORKDIR (workspace root)
#     packages/backend/dist/main.js        ← compiled NestJS app
#     node_modules/                        ← hoisted workspace deps
#
# plugin-sdk is built in the builder stage (backend imports its types)
# but is not copied to the production image — types are erased at runtime.

# ---- Stage 1: Builder --------------------------------------------------------
FROM node:24.13.0-alpine AS builder

WORKDIR /usr/src/app

# Copy workspace manifests first for better layer caching.
# All package.json files must be present before `npm ci` so workspace
# cross-dependencies are wired up correctly.
COPY package*.json ./
COPY packages/plugin-sdk/package.json    ./packages/plugin-sdk/
COPY packages/backend/package.json       ./packages/backend/

# Install all dependencies (dev included — needed for tsc and nest build).
# Skip playwright browser downloads; binaries are provided via a volume at runtime.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# --- Build plugin-sdk (backend imports its types) ---
COPY packages/plugin-sdk/tsconfig*.json ./packages/plugin-sdk/
COPY packages/plugin-sdk/src            ./packages/plugin-sdk/src
RUN npm run build -w packages/plugin-sdk

# --- Build backend ---
COPY packages/backend/tsconfig*.json  ./packages/backend/
COPY packages/backend/nest-cli.json   ./packages/backend/
COPY packages/backend/prisma.config.ts ./packages/backend/
COPY packages/backend/prisma          ./packages/backend/prisma
COPY packages/backend/src             ./packages/backend/src

# Generate Prisma client before compiling (required by backend source).
RUN cd packages/backend && npx prisma generate
RUN npm run build -w packages/backend

# ---- Stage 2: Production -----------------------------------------------------
FROM node:24.13.0-alpine AS production

RUN apk add --no-cache dumb-init su-exec

# Non-root user for security
RUN addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nestjs

WORKDIR /usr/src/app

# Copy workspace manifests for production npm ci.
# plugin-sdk must be present so npm can resolve the workspace symlink
# node_modules/@finance-tracker/plugin-sdk → packages/plugin-sdk.
COPY --chown=nestjs:nodejs package*.json ./
COPY --chown=nestjs:nodejs packages/plugin-sdk/package.json   ./packages/plugin-sdk/
COPY --chown=nestjs:nodejs packages/backend/package.json      ./packages/backend/
COPY --chown=nestjs:nodejs packages/backend/prisma.config.ts  ./packages/backend/
COPY --chown=nestjs:nodejs packages/backend/prisma            ./packages/backend/prisma

# Install production dependencies only.
# HUSKY=0 prevents the `prepare` lifecycle script from trying to run husky,
# which is a devDependency and is not installed in the production image.
# Remove the `prepare` script (husky) before installing — husky is a devDependency
# and its binary doesn't exist in a production install.
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 prevents playwright's postinstall from
# downloading browsers — browsers run in the separate playwright-server container.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm pkg delete scripts.prepare && npm ci --omit=dev && npm cache clean --force

# Regenerate Prisma client against the production node_modules.
RUN cd packages/backend && npx prisma generate

# Copy compiled artifacts from builder.
COPY --chown=nestjs:nodejs --from=builder /usr/src/app/packages/backend/dist     ./packages/backend/dist
# plugin-sdk dist is needed at runtime — scraper-plugin-loader imports
# @finance-tracker/plugin-sdk/testing to validate loaded plugins.
COPY --chown=nestjs:nodejs --from=builder /usr/src/app/packages/plugin-sdk/dist  ./packages/plugin-sdk/dist

# Log and data directories writeable by the app user.
RUN mkdir -p packages/backend/logs /data/scraper-plugins && \
    chown -R nestjs:nodejs packages/backend/logs /data/scraper-plugins

COPY packages/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Container starts as root so the entrypoint can fix bind-mount ownership,
# then drops to nestjs via su-exec.
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "packages/backend/dist/main.js"]
