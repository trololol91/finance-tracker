# Stage 1: build
FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS builder
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/
COPY packages/scraper-cibc/package.json ./packages/scraper-cibc/
COPY packages/scraper-stub/package.json ./packages/scraper-stub/
COPY templates/scraper-starter/package.json ./templates/scraper-starter/

RUN npm ci

COPY packages/frontend ./packages/frontend
RUN npm run generate:api -w packages/frontend
RUN npm run build -w packages/frontend

# Stage 2: serve
FROM nginx:stable-alpine
COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY packages/frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh
EXPOSE 3002
ENTRYPOINT ["/docker-entrypoint.sh"]
