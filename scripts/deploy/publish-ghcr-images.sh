#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
INCLUDE_LATEST=false

usage() {
  cat <<'USAGE'
Usage: publish-ghcr-images.sh [--dry-run] [--include-latest]

Required environment variables:
  GHCR_OWNER   GitHub owner/org for ghcr.io namespace
  IMAGE_TAG    Release tag for backend/frontend images
  GHCR_TOKEN   GHCR auth token (required unless --dry-run)

Optional environment variables:
  GHCR_USERNAME  Username for docker login (defaults to GHCR_OWNER)
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      ;;
    --include-latest)
      INCLUDE_LATEST=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

: "${GHCR_OWNER:?GHCR_OWNER is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

OWNER_LOWER="$(printf '%s' "${GHCR_OWNER}" | tr '[:upper:]' '[:lower:]')"
BACKEND_IMAGE="ghcr.io/${OWNER_LOWER}/house-erp-backend"
FRONTEND_IMAGE="ghcr.io/${OWNER_LOWER}/house-erp-frontend"
GHCR_USERNAME="${GHCR_USERNAME:-${GHCR_OWNER}}"

BACKEND_TAG_ARGS=(--tag "${BACKEND_IMAGE}:${IMAGE_TAG}")
FRONTEND_TAG_ARGS=(--tag "${FRONTEND_IMAGE}:${IMAGE_TAG}")

if [ "${INCLUDE_LATEST}" = true ]; then
  BACKEND_TAG_ARGS+=(--tag "${BACKEND_IMAGE}:latest")
  FRONTEND_TAG_ARGS+=(--tag "${FRONTEND_IMAGE}:latest")
fi

if [ "${DRY_RUN}" = false ]; then
  : "${GHCR_TOKEN:?GHCR_TOKEN is required unless --dry-run}"
  printf '%s' "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
fi

run_cmd() {
  if [ "${DRY_RUN}" = true ]; then
    printf '[dry-run] '
    printf '%q ' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run_cmd docker buildx build \
  --file Dockerfile.prod \
  --push \
  "${BACKEND_TAG_ARGS[@]}" \
  .

run_cmd docker buildx build \
  --file frontend/Dockerfile.prod \
  --push \
  "${FRONTEND_TAG_ARGS[@]}" \
  frontend

echo "Prepared publish contract:"
echo "  ${BACKEND_IMAGE}:${IMAGE_TAG}"
echo "  ${FRONTEND_IMAGE}:${IMAGE_TAG}"
if [ "${INCLUDE_LATEST}" = true ]; then
  echo "  ${BACKEND_IMAGE}:latest"
  echo "  ${FRONTEND_IMAGE}:latest"
fi
