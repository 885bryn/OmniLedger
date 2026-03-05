---
phase: 21-portainer-stack-deployment-and-persistence
verified: 2026-03-05T00:54:37Z
status: human_needed
score: 2/3 must-haves verified
re_verification:
  previous_status: diagnosed
  previous_score: 2/3 requirements satisfied in this environment
  gaps_closed: []
  gaps_remaining:
    - "Runtime persistence and live service health could not be executed in this environment because Docker daemon is unavailable."
  regressions: []
human_verification:
  - test: "Run pull-first deploy and restart persistence probe on Docker-enabled NAS host"
    expected: "Sentinel row remains after postgres restart and backend /health plus frontend / return success"
    why_human: "Current executor cannot connect to Docker daemon (npipe //./pipe/dockerDesktopLinuxEngine missing), so live runtime behavior cannot be verified here"
---

# Phase 21: Portainer Stack Deployment and Persistence Verification Report

**Phase Goal:** Operators can launch and keep a persistent production stack on Ugreen NAS via Portainer.
**Verified:** 2026-03-05T00:54:37Z
**Status:** human_needed
**Re-verification:** Yes - prior verification file existed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Operator can deploy `frontend`, `backend`, and `postgres` together using `docker-compose.prod.yml` in Portainer. | ✓ VERIFIED | `docker-compose.prod.yml` defines exactly those three services (`docker-compose.prod.yml:3`, `docker-compose.prod.yml:4`, `docker-compose.prod.yml:24`, `docker-compose.prod.yml:60`) and `docker compose config` renders all three under one stack name (`name: house-erp-prod`). |
| 2 | Operator can supply host env vars in Portainer and compose maps them into services including `API_URL=http://${NAS_STATIC_IP}:8085/api`. | ✓ VERIFIED | Required interpolation markers exist in compose (`docker-compose.prod.yml:8`, `docker-compose.prod.yml:9`, `docker-compose.prod.yml:35`, `docker-compose.prod.yml:37`) and render correctly in resolved config (`API_URL: http://192.168.1.50:8085/api`). |
| 3 | Postgres data persists in `/volume1/docker/house-erp/db-data` and remains available after service restarts. | ? UNCERTAIN | Bind mount contract exists (`docker-compose.prod.yml:68`) but restart continuity is runtime behavior; `docker version` shows daemon unavailable (`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`). |

**Score:** 2/3 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `docker-compose.prod.yml` | Three-service production stack with env mapping and NAS persistence | ✓ VERIFIED | Exists, substantive, and renderable via `docker compose -f docker-compose.prod.yml config`; no placeholder/stub content. |
| `.env.example` | Canonical Portainer stack variable checklist | ✓ VERIFIED | Includes GHCR/NAS/secrets variables and derived mappings (`.env.example:5`-`.env.example:24`), matching compose variable contract. |
| `.github/workflows/publish-prod-images.yml` | CI publish path for backend/frontend GHCR images | ✓ VERIFIED | Uses `docker/login-action` and `docker/build-push-action` with GHCR tags for both images (`.github/workflows/publish-prod-images.yml:33`-`.github/workflows/publish-prod-images.yml:74`). |
| `scripts/deploy/publish-ghcr-images.sh` | CLI publish path for deterministic GHCR push | ✓ VERIFIED | Requires `GHCR_OWNER`/`IMAGE_TAG`, optionally logs into GHCR, and runs `docker buildx build --push` for backend/frontend (`scripts/deploy/publish-ghcr-images.sh:42`-`scripts/deploy/publish-ghcr-images.sh:83`). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `docker-compose.prod.yml` | `ghcr.io/${GHCR_OWNER}/omniledger-frontend:${IMAGE_TAG}` | frontend image reference | WIRED | Present with required interpolation (`docker-compose.prod.yml:5`), and rendered to concrete tag in `docker compose config`. |
| `docker-compose.prod.yml` | `ghcr.io/${GHCR_OWNER}/omniledger-backend:${IMAGE_TAG}` | backend image reference | WIRED | Present with required interpolation (`docker-compose.prod.yml:25`), rendered correctly in `docker compose config`. |
| `docker-compose.prod.yml` | `API_URL=http://${NAS_STATIC_IP}:8085/api` | compose env interpolation from Portainer variables | WIRED | Defined in frontend and backend env (`docker-compose.prod.yml:9`, `docker-compose.prod.yml:43`) and rendered in resolved config output. |
| `docker-compose.prod.yml` | `/volume1/docker/house-erp/db-data:/var/lib/postgresql/data` | postgres host bind mount | PARTIAL | Wiring exists in compose (`docker-compose.prod.yml:68`), but runtime persistence after restart cannot be executed without Docker daemon. |
| `.github/workflows/publish-prod-images.yml` | `ghcr.io` | login + build-push actions publish tags | WIRED | GHCR login and push steps exist for both backend/frontend (`.github/workflows/publish-prod-images.yml:33`-`.github/workflows/publish-prod-images.yml:74`). |
| `scripts/deploy/publish-ghcr-images.sh` | `ghcr.io` | docker login + buildx build --push | WIRED | Script logs in (non-dry-run) and pushes both images (`scripts/deploy/publish-ghcr-images.sh:58`-`scripts/deploy/publish-ghcr-images.sh:83`). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| DEPL-01 | `21-01-PLAN.md`, `21-02-PLAN.md` | Deploy three-service production stack via `docker-compose.prod.yml` | ✓ SATISFIED | Compose defines `frontend`, `backend`, `postgres` and stack identity (`docker-compose.prod.yml:1`-`docker-compose.prod.yml:60`); config renders all services. |
| DEPL-02 | `21-01-PLAN.md`, `21-02-PLAN.md` | Portainer env vars map into services incl. `API_URL=http://${NAS_STATIC_IP}:8085/api` | ✓ SATISFIED | Required env interpolation in compose and checklist in `.env.example`; `docker compose config` resolves expected API_URL and FRONTEND_ORIGIN values. |
| DEPL-03 | `21-01-PLAN.md`, `21-02-PLAN.md` | Postgres data persists via `/volume1/docker/house-erp/db-data` mapping | ? NEEDS HUMAN | Bind mount is configured in compose, but restart persistence probe cannot run in this executor due unavailable Docker daemon. |

Requirement ID accounting: all plan-declared IDs (`DEPL-01`, `DEPL-02`, `DEPL-03`) exist in `.planning/REQUIREMENTS.md`; no orphaned Phase 21 requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None | - | No TODO/FIXME/placeholder/stub markers found in inspected phase files | ℹ️ Info | No blocker anti-patterns detected in deployment contract artifacts. |

### Human Verification Required

### 1. Pull-Based Deploy + Persistence Continuity

**Test:** On Docker-enabled NAS host, run `docker compose -f docker-compose.prod.yml pull`, `docker compose -f docker-compose.prod.yml up -d`, insert sentinel row in postgres, restart postgres, then query sentinel row; also validate backend `/health` and frontend `/`.
**Expected:** Sentinel row value remains after restart; backend health returns 200; frontend root responds successfully.
**Why human:** This executor cannot connect to Docker daemon (`//./pipe/dockerDesktopLinuxEngine` missing), so live runtime behavior is untestable here.

### Gaps Summary

No code/config gaps were found in compose/env/GHCR wiring for DEPL-01 and DEPL-02. Remaining risk is runtime-only verification for DEPL-03 (and end-to-end service health under real containers), which requires execution on the target NAS/host.

---

_Verified: 2026-03-05T00:54:37Z_
_Verifier: Claude (gsd-verifier)_
