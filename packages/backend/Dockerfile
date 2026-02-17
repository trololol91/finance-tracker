# Multi-stage build for optimized production image

# Stage 1: Build
FROM node:24.13.0-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY prisma.config.ts ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy Prisma schema and migrations
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:24.13.0-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY --chown=nestjs:nodejs package*.json ./
COPY --chown=nestjs:nodejs prisma.config.ts ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy Prisma files for migrations
COPY --chown=nestjs:nodejs prisma ./prisma

# Generate Prisma Client in production
RUN npx prisma generate

# Copy built application from builder stage
COPY --chown=nestjs:nodejs --from=builder /usr/src/app/dist ./dist

# Create logs directory
RUN mkdir -p logs && chown -R nestjs:nodejs logs

# Switch to non-root user
USER nestjs

# Expose application port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application (migrations run via docker-compose command override)
CMD ["node", "dist/main.js"]
