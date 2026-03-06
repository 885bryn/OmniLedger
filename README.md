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

### Portainer Environment Contract

Enter these variables in Portainer when creating or updating the `house-erp-prod` stack.

#### Required core

- `GHCR_OWNER`: GitHub owner/org for GHCR image paths (lowercase recommended)
- `IMAGE_TAG`: pinned release tag already published for both images
- `NAS_STATIC_IP`: NAS LAN address used by frontend/backend routing
- `DB_PASSWORD`: postgres runtime password
- `JWT_SECRET`: backend JWT signing secret
- `SESSION_SECRET`: backend session signing secret
- `HACT_ADMIN_EMAIL`: admin identity source for production startup mapping

#### Optional tuning

- `FRONTEND_PORT` (default `8085`)
- `BACKEND_PORT` (default `8080`)
- `DB_NAME` (default `hact_prod`)
- `DB_USER` (default `postgres`)
- `STARTUP_DB_MAX_RETRIES` (default `30`)
- `STARTUP_DB_RETRY_MS` (default `2000`)
- `SESSION_COOKIE_SECURE` (default `false` for current HTTP LAN runtime)

#### Derived values

- `FRONTEND_ORIGIN=http://${NAS_STATIC_IP}:${FRONTEND_PORT}`
- `API_URL=http://${NAS_STATIC_IP}:${FRONTEND_PORT}/api`
- `DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}`

#### Canonical Portainer variable block

Copy this block into Portainer stack environment variables and replace placeholders before deploy:

```env
GHCR_OWNER=<github-owner>
IMAGE_TAG=<published-release-tag>
NAS_STATIC_IP=<nas-ipv4-address>
DB_PASSWORD=<strong-postgres-password>
JWT_SECRET=<long-random-jwt-secret>
SESSION_SECRET=<long-random-session-secret>
HACT_ADMIN_EMAIL=<admin-email>

FRONTEND_PORT=8085
BACKEND_PORT=8080
DB_NAME=hact_prod
DB_USER=postgres
STARTUP_DB_MAX_RETRIES=30
STARTUP_DB_RETRY_MS=2000
SESSION_COOKIE_SECURE=false

FRONTEND_ORIGIN=http://${NAS_STATIC_IP}:${FRONTEND_PORT}
API_URL=http://${NAS_STATIC_IP}:${FRONTEND_PORT}/api
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
```

#### `DATABASE_URL` encoding rule

If `DB_PASSWORD` includes URL-reserved characters, percent-encode them in `DATABASE_URL`.

- Example password: `Prod!Pass2026`
- Encoded `DATABASE_URL` password segment: `Prod%21Pass2026`
- Resulting form: `postgres://${DB_USER}:Prod%21Pass2026@postgres:5432/${DB_NAME}`
