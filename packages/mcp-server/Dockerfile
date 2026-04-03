# Multi-stage build for the finance-tracker MCP server.
# Build context: repo root (required for npm workspace resolution).
#
# Directory layout inside the image mirrors the monorepo:
#
#   /app/                                    <- WORKDIR (workspace root)
#     packages/mcp-server/dist/index.js      <- compiled MCP server
#     node_modules/                          <- hoisted workspace deps

# ---- Stage 1: Builder --------------------------------------------------------
FROM node:24.13.0-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/
COPY packages/mcp-server/package.json ./packages/mcp-server/
COPY packages/frontend/package.json ./packages/frontend/

# Install all dependencies (dev included — needed for tsc and orval).
RUN npm ci --ignore-scripts

# Copy the OpenAPI spec used by orval to generate the API client.
COPY packages/frontend/openapi.json ./packages/frontend/openapi.json

# Copy mcp-server source and config.
COPY packages/mcp-server ./packages/mcp-server

# Generate the Orval API client from the OpenAPI spec.
RUN npm run -w packages/mcp-server generate:api

# Compile TypeScript.
RUN npm run -w packages/mcp-server build

# ---- Stage 2: Production -----------------------------------------------------
FROM node:24.13.0-alpine AS production

# Non-root user for security.
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy workspace manifests for production npm ci.
COPY package.json package-lock.json ./
COPY packages/mcp-server/package.json ./packages/mcp-server/

# Install production dependencies only.
# HUSKY=0 prevents the prepare lifecycle script from running husky.
ENV HUSKY=0
RUN npm ci --workspace=packages/mcp-server --omit=dev --ignore-scripts

# Copy compiled artifacts from builder.
COPY --from=builder /app/packages/mcp-server/dist ./packages/mcp-server/dist

USER nodejs

EXPOSE 3010

CMD ["node", "packages/mcp-server/dist/index.js"]
