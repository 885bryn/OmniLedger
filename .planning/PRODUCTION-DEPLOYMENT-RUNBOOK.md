# OmniLedger / House ERP Production Deployment Runbook (NAS + Portainer)

Last updated: 2026-03-06

## 1) Canonical Architecture

- NAS host IP: `192.168.68.62`
- Frontend container: nginx on `:80`, published as `8085:80`
- Backend container: node/express on `:8080`, published as `8080:8080`
- Database container: postgres `:5432` on internal docker network
- Frontend browser URL: `http://192.168.68.62:8085`
- Frontend API path: `/api/*` proxied to backend

## 2) Publish Images from GitHub Actions

Run workflow: `.github/workflows/publish-prod-images.yml`

Recommended input values:

- `image_tag`: explicit release tag, example `2026-03-06-hotfix-1`
- `include_latest`: optional (`true` allowed, but do not deploy from `latest` during incident recovery)

Expected images:

- `ghcr.io/<owner>/omniledger-backend:<image_tag>`
- `ghcr.io/<owner>/omniledger-frontend:<image_tag>`

## 3) Portainer Stack Deployment

Use the same explicit tag for frontend and backend.

```yaml
services:
  frontend:
    image: ghcr.io/<owner>/omniledger-frontend:<image_tag>
  backend:
    image: ghcr.io/<owner>/omniledger-backend:<image_tag>
```

Always redeploy with image pull/recreate enabled.

## 4) Required Portainer Environment Values

Use real values in Portainer env panel (no placeholders in running stack).

```env
GHCR_OWNER=<owner>
IMAGE_TAG=<same-tag-as-published>

NAS_STATIC_IP=192.168.68.62
FRONTEND_PORT=8085
BACKEND_PORT=8080

DB_NAME=hact_prod
DB_USER=postgres
DB_PASSWORD=<db-password>
DATABASE_URL=postgres://postgres:<url-encoded-db-password>@postgres:5432/hact_prod

JWT_SECRET=<jwt-secret>
SESSION_SECRET=<session-secret>
SESSION_COOKIE_SECURE=false

HACT_ADMIN_EMAIL=<admin-email>

STARTUP_DB_MAX_RETRIES=30
STARTUP_DB_RETRY_MS=2000
```

Notes:

- For HTTP LAN access, `SESSION_COOKIE_SECURE=false` is required.
- If password contains `!`, encode as `%21` in `DATABASE_URL`.
- Prefer distinct values for DB/JWT/SESSION secrets.

## 5) Smoke Test Checklist

After deploy, verify in order:

1. `GET /api/health` -> `200 {"status":"ok","ready":true}`
2. `POST /api/auth/login` -> `200` and cookie is set
3. `GET /api/items` while logged out -> `401 authentication_required` (not `404`)
4. Create item in UI -> `POST /api/items` returns `201` or `422` (not `404`)

## 6) Incident Record and Fixes

### Incident A: Login succeeds, session immediately expires

Symptoms:

- `/auth/login` returns `200`
- dashboard flashes, then redirects to login
- subsequent `/users`, `/events`, `/items` return `401`

Root cause:

- Secure session cookie in production over plain HTTP LAN, browser does not persist cookie.

Fix:

- Backend supports env override for cookie secure flag.
- Set `SESSION_COOKIE_SECURE=false` in Portainer backend env for HTTP deployment.

Tech debt:

- Move frontend entrypoint to HTTPS/TLS and restore `SESSION_COOKIE_SECURE=true`.

### Incident B: `Route not found` on `/api/items`

Symptoms:

- `GET /api/health` returns `200`
- `POST /api/items` returns `404 {"error":{"code":"not_found"...}}`

Root cause:

- Backend route module load failure due missing file in image: `src/domain/items/financial-metrics.js`.
- `items.routes.js` failed with: `Cannot find module './financial-metrics'`.

Fix:

- Add missing file to git and push commit `b68333c`.
- Republish images.
- Redeploy Portainer stack pinned to same explicit frontend/backend tag.

## 7) Quick Runtime Debug Commands (Portainer Exec)

Frontend (`/bin/ash`):

```sh
nginx -T | grep -n "location /api/\|proxy_pass"
wget -S -O- http://backend:8080/items
```

Backend (`/bin/sh`):

```sh
node -e "fetch('http://127.0.0.1:8080/items').then(async r=>{console.log('status',r.status);console.log(await r.text())})"
node -e "try{require('./src/api/routes/items.routes');console.log('items.routes load: OK')}catch(e){console.log('items.routes load: FAIL');console.log(e.message)}"
```
