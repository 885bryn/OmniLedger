# Household Asset & Commitment Tracker (HACT)

HACT (OmniLedger) is a household financial operations platform I orchestrated end-to-end: stakeholder discovery, domain modeling, roadmap planning, implementation, verification, and production deployment.

## Project Overview

This project helps a household manage assets, commitments, income, and timeline events in one place with clear audit history and predictable workflows.

It is designed to answer practical operational questions, not just store records:
- What is due this week?
- Which commitments are linked to which assets?
- What changed, when, and by whom?
- What is projected next vs already persisted?

## Why I Built It

I built this with my mom as the primary stakeholder and real-world user. I led discovery with her use cases, translated non-technical needs into a technical product scope, and then delivered the system through phased milestones.

This was intentionally run like a production program rather than a simple side project:
- Defined milestone/phase scope and execution workflow
- Planned ERD, data flow, and domain boundaries
- Implemented backend/frontend architecture
- Added verification and gap-closure loops
- Deployed to home-network production with repeatable release operations

## What It Does

- Asset management for real estate, vehicles, and financial items
- Financial commitments and income tracking with recurrence support
- Timeline event generation (pending, projected, exception handling)
- Completion/undo/edit workflows for event operations
- Dashboard views for portfolio snapshots, due-event metrics, and grouped event queues
- Role-aware access and scoped data views
- Audit trails for change accountability
- Demo data seeding for reproducible product walkthroughs

## General Architecture

### 1) Product and planning layer
- Requirement-driven milestone planning with phase artifacts (`ROADMAP.md`, `REQUIREMENTS.md`, `STATE.md`)
- Plan -> execute -> verify loop with explicit gap closure workflow

### 2) Backend domain and API layer
- Node.js + Express API
- Sequelize ORM with PostgreSQL in production
- Core models: `User`, `Item`, `Event`, `AuditLog`
- Domain services for item lifecycle, event lifecycle, auth, and audit behavior

### 3) Frontend interaction layer
- React + TypeScript + Vite
- shadcn-based UI surface system and reusable data-card patterns
- Framer Motion for shared motion language and tactile feedback in dense data UIs

### 4) Operations and deployment layer
- Containerized frontend/backend images published to GHCR
- GitHub Actions image-publish workflow (`.github/workflows/publish-prod-images.yml`)
- Portainer stack deployment on Ugreen NAS via pinned image tags
- Deterministic release/rollback model using explicit `IMAGE_TAG`

## Ownership Scope (What I Personally Orchestrated)

- Discovery and use-case definition with stakeholder
- ERD/domain design, data structures, and flow planning
- Milestone decomposition and phased technical planning
- Full-stack implementation direction and verification gates
- Release operations, deployment workflow, and production troubleshooting

---

This README also contains the canonical production runbook for deploying House ERP to a Ugreen NAS with Portainer.

## Deployment Runbook

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
   - `image_tag`: release tag using the standard format `YYYY.MM.DD-N` (for example `2026.03.06-1`)
   - `include_latest`: `false`
3. Wait for the workflow to complete successfully.
4. If `git` and `gh` CLI are installed and authenticated on the local machine, this workflow can be triggered from the CLI assistant instead of opening the GitHub Actions page manually.

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

### Route contract for operator checks

- Backend-direct checks to `http://<NAS_STATIC_IP>:8080` must use live backend mounts: `POST /auth/login`, `GET/POST /items` (no `/api/*` prefix).
- Frontend-gateway checks to `http://<NAS_STATIC_IP>:8085` keep the gateway prefix: `/api/*`.
- If a backend-direct check uses an `/api/*` path on port `:8080`, treat it as a documentation/path mismatch, not an immediate service outage.

### 1) Login succeeds, then session drops and protected routes return 401

**Symptom signature**

- Login call returns success (`200`), but next protected request returns `401`.
- Browser receives a session cookie but does not send it back on HTTP LAN traffic.

**Cause checks**

1. Capture login and protected-route behavior with one cookie jar:
   - `curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"email":"<admin-email>","password":"<password>"}' http://<NAS_STATIC_IP>:8080/auth/login`
   - `curl -i -b cookies.txt http://<NAS_STATIC_IP>:8080/items`
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

- Backend-direct `GET /items` or UI `/items` flow fails with `Route not found`.

**Cause checks**

1. Confirm API failure payload:
   - `curl -i http://<NAS_STATIC_IP>:8080/items`
2. Check backend logs for missing module or route registration failure:
   - `docker logs house-erp-prod-backend-1 --tail 200`
3. Confirm the required backend module exists in the running image:
   - `docker exec house-erp-prod-backend-1 sh -lc "ls -l /app/src/domain/items/financial-metrics.js"`

**Expected signatures**

- API response contains `Route not found` or `404` for `/items`.
- Backend logs include a load failure similar to `Cannot find module ... financial-metrics.js`.
- File check reports missing `/app/src/domain/items/financial-metrics.js`.

**Permanent fix**

1. Publish a corrected backend image that includes `src/domain/items/financial-metrics.js`.
2. Publish frontend and backend with the same new pinned `IMAGE_TAG`.
3. Update Portainer stack `IMAGE_TAG` only, redeploy, then re-run `/items` check.

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

## Verification gates (go-live required)

Run these gates after every first-time deployment, update, or rollback. Do not declare deployment successful until every gate passes.

| Gate | Request | Expected (status + body signature) | Failure interpretation |
| --- | --- | --- | --- |
| Backend health | `curl -i http://<NAS_STATIC_IP>:8080/health` | `200 OK`; body includes `"status":"ok"` (or equivalent healthy signature) | Backend container is not healthy, startup validation failed, or backend is unreachable from NAS port mapping. |
| Auth + session persistence | `curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"email":"<admin-email>","password":"<password>"}' http://<NAS_STATIC_IP>:8080/auth/login` then repeat protected call with same cookie jar | Login returns `200`; response includes `Set-Cookie`; second protected call with `-b cookies.txt` stays authorized (`200`/non-401) | Session cookie is not persisted/sent (often `SESSION_COOKIE_SECURE` mismatch for HTTP runtime), or auth/session middleware is broken in deployed image. |
| Protected-route expectation | `curl -i -b cookies.txt http://<NAS_STATIC_IP>:8080/items` and `curl -i http://<NAS_STATIC_IP>:8080/items` | Authenticated request succeeds (`200`); unauthenticated request returns expected denial (`401`/`403`) | Auth boundary is misconfigured if anonymous requests pass, or route stack is broken if authenticated request fails. |
| Item create functional check | `curl -i -b cookies.txt -H "Content-Type: application/json" -d '{"name":"Verification Item","category":"Asset"}' http://<NAS_STATIC_IP>:8080/items` then `curl -i -b cookies.txt http://<NAS_STATIC_IP>:8080/items` | Create call returns success (`200`/`201`) with created item id; follow-up list includes the new item | Item domain route or dependent module load failed (for example `Route not found`, missing `financial-metrics.js`, or backend/frontend contract drift). |
| Persistence restart check | Insert a sentinel item or row, restart only `postgres`, then fetch sentinel again. Example: `docker compose -f docker-compose.prod.yml restart postgres` followed by the same read request | Sentinel data remains present after restart; health and item list checks continue to pass | Postgres persistence mount/config is wrong (`/volume1/docker/house-erp/db-data` not effective), or startup ordering fails after restart. |

### Stop conditions

Stop rollout and keep the release out of service if any condition below is true:

1. `/health` does not return a healthy `200` signature.
2. `/auth/login` succeeds but session does not persist (protected follow-up returns `401`).
3. Authenticated `/items` or item-create checks fail with route/module errors.
4. Persistence restart check loses sentinel data or causes repeated backend health failures.
5. Frontend/backend image tags are not the same pinned `IMAGE_TAG`.

### Rollback trigger criteria

Trigger rollback immediately when a stop condition persists after one configuration correction attempt.

Rollback trigger:

1. Set `IMAGE_TAG=<previous-known-good-tag>` in Portainer.
2. Click **Update the stack**.
3. Re-run all verification gates above and record pass/fail outcomes.

Rollback is complete only when all gates pass on the known-good tag.
