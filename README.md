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

### First-time deployment

Follow this sequence exactly for a brand-new `house-erp-prod` stack.

1. Publish Production Images with a new pinned tag.
   - GitHub Actions: run `Publish Production Images` with `image_tag=<new-tag>`.
   - CLI alternative: `GHCR_OWNER=<owner> IMAGE_TAG=<new-tag> GHCR_TOKEN=<token> bash scripts/deploy/publish-ghcr-images.sh`
2. Verify both GHCR images for the same tag exist.
3. In Portainer -> Stacks -> Add stack:
   - Name: `house-erp-prod`
   - Build method: Web editor
   - Paste contents of `docker-compose.prod.yml`
4. In Portainer Environment variables, paste the canonical block from this README and replace placeholders.
5. Click **Deploy the stack**.
6. Wait until `frontend`, `backend`, and `postgres` are healthy/running.
7. Validate runtime:
   - `http://<NAS_STATIC_IP>:8085/` loads frontend
   - `http://<NAS_STATIC_IP>:8080/health` returns healthy response

### Update/redeploy

Use this flow for routine releases. Do not edit compose image names or switch to `latest`.

1. Publish Production Images for the release tag (`IMAGE_TAG=<release-tag>`).
2. Confirm tag availability for both GHCR images.
3. Open Portainer -> Stacks -> `house-erp-prod` -> Editor.
4. Ensure compose content still matches `docker-compose.prod.yml`.
5. Update only stack environment values as needed:
   - Set `IMAGE_TAG=<release-tag>`
   - Keep `GHCR_OWNER` unchanged unless repository ownership moved
6. Click **Update the stack** (Portainer performs pull + recreate).
7. Verify deployment:
   - `http://<NAS_STATIC_IP>:8080/health` remains healthy
   - Login succeeds and protected pages stay authenticated

### Rollback

Use rollback when a newly deployed tag is not healthy or breaks required flows.

1. Identify the previous known-good pinned tag (example `2026.03.05-2`).
2. Confirm that tag still exists for both GHCR images.
3. Open Portainer -> Stacks -> `house-erp-prod` -> Editor.
4. Keep compose file aligned to `docker-compose.prod.yml`.
5. Change only stack variable:
   - `IMAGE_TAG=<known-good-tag>`
6. Click **Update the stack**.
7. Re-run health and login checks:
   - `http://<NAS_STATIC_IP>:8080/health`
   - frontend login + protected route access

Rollback rule: always move between previously published pinned tags; never apply runtime hotfix edits directly in the Portainer compose editor.

## Troubleshooting (Symptom -> Checks -> Fixes)

Use this section when a deployment or post-deploy validation fails. For each incident: run checks in order, confirm expected signatures, then apply the permanent fix.

### 1) Login succeeds, then session drops and protected routes return 401

**Symptom signature**

- Login call returns success (`200`), but next protected request returns `401`.
- Browser receives a session cookie but does not send it back on HTTP LAN traffic.

**Cause checks**

1. Capture login and protected-route behavior with one cookie jar:
   - `curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"email":"<admin-email>","password":"<password>"}' http://<NAS_STATIC_IP>:8080/api/auth/login`
   - `curl -i -b cookies.txt http://<NAS_STATIC_IP>:8080/api/items`
2. Inspect backend runtime env value:
   - `docker inspect house-erp-prod-backend-1 --format "{{range .Config.Env}}{{println .}}{{end}}" | grep SESSION_COOKIE_SECURE`

**Expected signatures**

- Login response includes `Set-Cookie` and may include `Secure` attribute.
- Protected call response is `401 Unauthorized`.
- Runtime env shows `SESSION_COOKIE_SECURE=true` while deployment is still HTTP.

**Permanent fix**

1. For current HTTP LAN runtime, set `SESSION_COOKIE_SECURE=false` in Portainer stack environment.
2. Click **Update the stack** and re-run login + protected-route checks.
3. Long-term hardening path: migrate frontend entrypoint to HTTPS/TLS, then set `SESSION_COOKIE_SECURE=true` and keep it true.

### 2) `/items` returns `Route not found`

**Symptom signature**

- `GET /api/items` or UI `/items` flow fails with `Route not found`.

**Cause checks**

1. Confirm API failure payload:
   - `curl -i http://<NAS_STATIC_IP>:8080/api/items`
2. Check backend logs for missing module or route registration failure:
   - `docker logs house-erp-prod-backend-1 --tail 200`
3. Confirm the required backend module exists in the running image:
   - `docker exec house-erp-prod-backend-1 sh -lc "ls -l /app/src/domain/items/financial-metrics.js"`

**Expected signatures**

- API response contains `Route not found` or `404` for `/api/items`.
- Backend logs include a load failure similar to `Cannot find module ... financial-metrics.js`.
- File check reports missing `/app/src/domain/items/financial-metrics.js`.

**Permanent fix**

1. Publish a corrected backend image that includes `src/domain/items/financial-metrics.js`.
2. Publish frontend and backend with the same new pinned `IMAGE_TAG`.
3. Update Portainer stack `IMAGE_TAG` only, redeploy, then re-run `/api/items` check.

### 3) Portainer deploy/update returns `500`

**Symptom signature**

- Portainer stack deploy/update action fails with HTTP `500`.

**Cause checks**

1. Validate compose interpolation before retrying Portainer:
   - `docker compose -f docker-compose.prod.yml config`
2. Verify required stack env values are present and non-empty in Portainer:
   - `GHCR_OWNER`, `IMAGE_TAG`, `NAS_STATIC_IP`, `DB_PASSWORD`, `JWT_SECRET`, `SESSION_SECRET`, `HACT_ADMIN_EMAIL`, `DATABASE_URL`
3. Re-check `DATABASE_URL` encoding when password contains reserved characters (`!`, `@`, `#`, `%`, etc.).

**Expected signatures**

- `docker compose ... config` fails with a required variable/interpolation error, or an invalid URL/parse signature.
- Portainer failure occurs before services become healthy.

**Permanent fix**

1. Correct missing/invalid env values in Portainer using this README's canonical variable block.
2. Ensure `DATABASE_URL` has percent-encoded password characters (for example `!` -> `%21`).
3. Re-run deploy/update only after `docker compose -f docker-compose.prod.yml config` renders successfully.

### 4) Image-tag drift between frontend and backend

**Symptom signature**

- UI and API behavior mismatch after deploy (for example: one side shows new features while the other still returns old contract errors).
- Incidents can include auth/session oddities, `/items` route mismatch, or schema/contract errors.

**Cause checks**

1. Inspect running image tags:
   - `docker ps --format "table {{.Names}}\t{{.Image}}" | grep omniledger-`
2. Confirm both services use the same `<IMAGE_TAG>`:
   - frontend: `ghcr.io/<owner>/omniledger-frontend:<tag>`
   - backend: `ghcr.io/<owner>/omniledger-backend:<tag>`
3. In Portainer stack editor, confirm only one shared `IMAGE_TAG` variable is used for both images.

**Expected signatures**

- Frontend and backend show different tags, or one service still uses an older image.

**Permanent fix**

1. Publish both images for one explicit release tag.
2. Set Portainer `IMAGE_TAG=<same-tag-for-both-services>` and redeploy.
3. Re-run verification gates; if failures persist, rollback to previous known-good pinned tag.
