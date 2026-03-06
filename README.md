# Household Asset & Commitment Tracker (HACT)

This document is the canonical production runbook for deploying House ERP to a Ugreen NAS with Portainer.

## Production Deployment (Ugreen NAS + Portainer)

Use this path only for production operations.

- Always publish pinned GHCR image tags first, then deploy the same tag in Portainer.
- Never use floating `latest` for deployment, recovery, or rollback decisions.
- Keep frontend and backend on the same explicit `IMAGE_TAG` for deterministic behavior.

### Deployment Scope

- Target stack file: `docker-compose.prod.yml`
- Registry target: GHCR only (`ghcr.io`)
- Publish entry points:
  - GitHub Actions workflow: `.github/workflows/publish-prod-images.yml`
  - Local CLI helper: `scripts/deploy/publish-ghcr-images.sh`

### Publish Production Images (Do This First)

Publish images before touching the Portainer stack.

#### Option A: GitHub Actions (recommended)

1. Open Actions -> `Publish Production Images`.
2. Run workflow with:
   - `image_tag`: release tag (for example `2026.03.06-1`)
   - `include_latest`: `false`
3. Wait for the workflow to complete successfully.

#### Option B: Local CLI publish

1. Export required variables:
   - `GHCR_OWNER`
   - `IMAGE_TAG`
   - `GHCR_TOKEN`
2. Run:
   - `bash scripts/deploy/publish-ghcr-images.sh`
3. Optional dry-run:
   - `bash scripts/deploy/publish-ghcr-images.sh --dry-run`

#### Verify pushed images

Confirm both images exist for the same tag:

- `ghcr.io/<ghcr_owner>/omniledger-backend:<image_tag>`
- `ghcr.io/<ghcr_owner>/omniledger-frontend:<image_tag>`

Do not continue to Portainer until both image tags are available.
