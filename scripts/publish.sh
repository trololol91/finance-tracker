#!/bin/bash
# Publish backend and frontend images to the container registry,
# then update docker-compose.release.yml with the new image references.
#
# Usage:
#   ./scripts/publish.sh 1.2.0
#
# Prerequisites:
#   docker login ghcr.io   (or your registry of choice)
#
# Set REGISTRY to override the default:
#   REGISTRY=docker.io/yourusername ./scripts/publish.sh 1.2.0

set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io/yourusername}"
VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Error: version required. Usage: ./scripts/publish.sh 1.2.0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "==> Building playwright-server image..."
docker build \
  -t "$REGISTRY/finance-tracker-playwright:$VERSION" \
  -t "$REGISTRY/finance-tracker-playwright:latest" \
  docker/playwright-server

echo ""
echo "==> Building backend image..."
docker build \
  -t "$REGISTRY/finance-tracker-backend:$VERSION" \
  -t "$REGISTRY/finance-tracker-backend:latest" \
  .

echo ""
echo "==> Building frontend image..."
docker build \
  -t "$REGISTRY/finance-tracker-frontend:$VERSION" \
  -t "$REGISTRY/finance-tracker-frontend:latest" \
  -f packages/frontend/Dockerfile .

echo ""
echo "==> Pushing playwright-server..."
docker push "$REGISTRY/finance-tracker-playwright:$VERSION"
docker push "$REGISTRY/finance-tracker-playwright:latest"

echo ""
echo "==> Pushing backend..."
docker push "$REGISTRY/finance-tracker-backend:$VERSION"
docker push "$REGISTRY/finance-tracker-backend:latest"

echo ""
echo "==> Pushing frontend..."
docker push "$REGISTRY/finance-tracker-frontend:$VERSION"
docker push "$REGISTRY/finance-tracker-frontend:latest"

echo ""
echo "==> Updating docker-compose.release.yml..."
sed -i \
  "s|image: .*/finance-tracker-playwright:.*|image: $REGISTRY/finance-tracker-playwright:$VERSION|" \
  docker-compose.release.yml
sed -i \
  "s|image: .*/finance-tracker-backend:.*|image: $REGISTRY/finance-tracker-backend:$VERSION|" \
  docker-compose.release.yml
sed -i \
  "s|image: .*/finance-tracker-frontend:.*|image: $REGISTRY/finance-tracker-frontend:$VERSION|" \
  docker-compose.release.yml

echo ""
echo "Done. Images published and docker-compose.release.yml updated to $VERSION."
echo "Commit and tag the release:"
echo "  git add docker-compose.release.yml"
echo "  git commit -m \"chore(release): $VERSION\""
echo "  git tag v$VERSION"
