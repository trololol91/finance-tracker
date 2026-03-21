#!/bin/bash
# Publish backend and frontend images to the container registry.
#
# Usage:
#   ./scripts/publish.sh                  # publishes as :latest
#   ./scripts/publish.sh 1.2.0            # publishes as :1.2.0 and :latest
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
  echo "No version specified — tagging as :latest only"
  TAGS=("latest")
else
  echo "Publishing version $VERSION"
  TAGS=("$VERSION" "latest")
fi

# Build args for the tag flags
TAG_ARGS_BACKEND=""
TAG_ARGS_FRONTEND=""
for TAG in "${TAGS[@]}"; do
  TAG_ARGS_BACKEND="$TAG_ARGS_BACKEND -t $REGISTRY/finance-tracker-backend:$TAG"
  TAG_ARGS_FRONTEND="$TAG_ARGS_FRONTEND -t $REGISTRY/finance-tracker-frontend:$TAG"
done

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "==> Building backend image..."
docker build $TAG_ARGS_BACKEND .

echo ""
echo "==> Building frontend image..."
docker build $TAG_ARGS_FRONTEND -f packages/frontend/Dockerfile .

echo ""
echo "==> Pushing backend..."
for TAG in "${TAGS[@]}"; do
  docker push "$REGISTRY/finance-tracker-backend:$TAG"
done

echo ""
echo "==> Pushing frontend..."
for TAG in "${TAGS[@]}"; do
  docker push "$REGISTRY/finance-tracker-frontend:$TAG"
done

echo ""
echo "Done. Images published:"
for TAG in "${TAGS[@]}"; do
  echo "  $REGISTRY/finance-tracker-backend:$TAG"
  echo "  $REGISTRY/finance-tracker-frontend:$TAG"
done
