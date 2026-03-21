# Multi-stage build for the finance-tracker backend.
# Build context: repo root (required for npm workspace resolution).
#
# Directory layout inside the image mirrors the monorepo so that
# seedBuiltins() in ScraperPluginLoader resolves sibling packages via
# the same four-level-up path calculation it uses in development:
#
#   /usr/src/app/                          ← WORKDIR (workspace root)
#     packages/backend/dist/main.js        ← compiled NestJS app
#     packages/plugin-sdk/dist/            ← resolved via workspace symlink
#     packages/scraper-cibc/dist/          ← copied by seedBuiltins → SCRAPER_PLUGIN_DIR/cibc/
#     packages/scraper-cibc/node_modules/  ← isolated playwright (no browser binaries)
#     packages/scraper-stub/dist/          ← copied by seedBuiltins → SCRAPER_PLUGIN_DIR/stub/
#     node_modules/                        ← hoisted workspace deps

# ---- Stage 1: Builder --------------------------------------------------------
FROM node:24.13.0-alpine AS builder

WORKDIR /usr/src/app

# Copy workspace manifests first for better layer caching.
# All package.json files must be present before `npm ci` so workspace
# cross-dependencies are wired up correctly.
COPY package*.json ./
COPY packages/plugin-sdk/package.json    ./packages/plugin-sdk/
COPY packages/scraper-cibc/package.json  ./packages/scraper-cibc/
COPY packages/scraper-stub/package.json  ./packages/scraper-stub/
COPY packages/backend/package.json       ./packages/backend/

# Install all dependencies (dev included — needed for tsc and nest build).
# Skip playwright browser downloads; binaries are provided via a volume at runtime.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# --- Build plugin-sdk (all other packages depend on its type declarations) ---
COPY packages/plugin-sdk/tsconfig*.json ./packages/plugin-sdk/
COPY packages/plugin-sdk/src            ./packages/plugin-sdk/src
RUN npm run build -w packages/plugin-sdk

# --- Build scraper-stub (no extra runtime deps) ---
COPY packages/scraper-stub/tsconfig*.json ./packages/scraper-stub/
COPY packages/scraper-stub/src            ./packages/scraper-stub/src
RUN npm run build -w packages/scraper-stub

# --- Build scraper-cibc ---
COPY packages/scraper-cibc/tsconfig*.json ./packages/scraper-cibc/
COPY packages/scraper-cibc/src            ./packages/scraper-cibc/src
RUN npm run build -w packages/scraper-cibc

# Isolate playwright into packages/scraper-cibc/node_modules so that
# seedBuiltins() can copy a self-contained plugin directory to SCRAPER_PLUGIN_DIR.
# --no-workspaces prevents npm from hoisting deps to the workspace root.
RUN cd packages/scraper-cibc && npm install --omit=dev --no-workspaces

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

RUN apk add --no-cache \
    dumb-init \
    xvfb \
    # Fonts and libs required by Chromium when running with headless:false
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    fontconfig

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /usr/src/app

# Copy workspace manifests for production npm ci.
COPY --chown=nestjs:nodejs package*.json ./
COPY --chown=nestjs:nodejs packages/plugin-sdk/package.json   ./packages/plugin-sdk/
COPY --chown=nestjs:nodejs packages/scraper-cibc/package.json ./packages/scraper-cibc/
COPY --chown=nestjs:nodejs packages/scraper-stub/package.json ./packages/scraper-stub/
COPY --chown=nestjs:nodejs packages/backend/package.json      ./packages/backend/
COPY --chown=nestjs:nodejs packages/backend/prisma.config.ts  ./packages/backend/
COPY --chown=nestjs:nodejs packages/backend/prisma            ./packages/backend/prisma

# Install production dependencies only.
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD prevents the playwright postinstall hook
# from downloading ~500 MB of browser binaries into the image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --omit=dev && npm cache clean --force

# Regenerate Prisma client against the production node_modules.
RUN cd packages/backend && npx prisma generate

# Copy compiled artifacts from builder.
COPY --chown=nestjs:nodejs --from=builder /usr/src/app/packages/backend/dist     ./packages/backend/dist
COPY --chown=nestjs:nodejs --from=builder /usr/src/app/packages/plugin-sdk/dist  ./packages/plugin-sdk/dist

# Copy scraper packages used by seedBuiltins().
# scraper-cibc includes its isolated node_modules/playwright so the copied
# plugin directory is self-contained under SCRAPER_PLUGIN_DIR.
COPY --chown=nestjs:nodejs --from=builder /usr/src/app/packages/scraper-cibc/dist         ./packages/scraper-cibc/dist
COPY --chown=nestjs:nodejs --from=builder /usr/src/app/packages/scraper-cibc/node_modules ./packages/scraper-cibc/node_modules
COPY --chown=nestjs:nodejs --from=builder /usr/src/app/packages/scraper-stub/dist         ./packages/scraper-stub/dist

# Log directory writeable by the app user.
RUN mkdir -p packages/backend/logs && chown -R nestjs:nodejs packages/backend/logs

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]

# Run from WORKDIR so that the four-level-up path in seedBuiltins() resolves
# packages/scraper-{cibc,stub}/ relative to /usr/src/app.
# xvfb-run provides a virtual display for scrapers running with headless:false.
# When PLAYWRIGHT_HEADLESS=true the display is unused but costs nothing.
CMD ["xvfb-run", "-a", "node", "packages/backend/dist/main.js"]
