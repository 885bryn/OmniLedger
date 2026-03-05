---
phase: 21-portainer-stack-deployment-and-persistence
verified: 2026-03-05T00:31:39Z
status: diagnosed
score: 2/3 requirements satisfied in this environment
diagnosed_blockers:
  - "Docker daemon unavailable in current executor environment (`//./pipe/dockerDesktopLinuxEngine` not found), blocking pull/up/exec/restart runtime probes."
---

# Phase 21: Portainer Stack Deployment and Persistence Verification Report

**Phase Goal:** Operators can launch and keep a persistent production stack on Ugreen NAS via Portainer using GHCR-published images.
**Verified:** 2026-03-05T00:31:39Z
**Status:** diagnosed
**Re-verification:** Yes - reran after GHCR image contract updates (Plan 21-02)

## Deployment Contract Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Compose contract targets GHCR image tags only for frontend/backend | ✓ PASS | `docker-compose.prod.yml` now uses `image: ghcr.io/${GHCR_OWNER}/house-erp-frontend:${IMAGE_TAG}` and `image: ghcr.io/${GHCR_OWNER}/house-erp-backend:${IMAGE_TAG}` with required interpolation. |
| Portainer env checklist includes GHCR deployment variables | ✓ PASS | `.env.example` includes required `GHCR_OWNER` and `IMAGE_TAG` values plus existing NAS/runtime secrets. |
| Compose render resolves concrete GHCR image tags | ✓ PASS | `GHCR_OWNER=example-owner IMAGE_TAG=phase21-gap ... docker compose -f docker-compose.prod.yml config` renders frontend/backend images as `ghcr.io/example-owner/house-erp-frontend:phase21-gap` and `ghcr.io/example-owner/house-erp-backend:phase21-gap`. |

## Pull-First Runtime Attempt

Command attempted:

```bash
GHCR_OWNER=example-owner IMAGE_TAG=phase21-gap ... docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d ...
```

Observed failure:

```text
unable to get image 'ghcr.io/example-owner/house-erp-backend:phase21-gap':
error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/images/...":
open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

Diagnosis: Runtime verification did not execute because this host has no reachable Docker daemon. This is an execution-environment blocker, not a compose/image-contract defect.

## Requirements Coverage

| Requirement | Status | Evidence |
| --- | --- | --- |
| DEPL-01 | ✓ SATISFIED | GHCR image publish paths exist in both CI (`.github/workflows/publish-prod-images.yml`) and CLI (`scripts/deploy/publish-ghcr-images.sh`); compose contract consumes those image tags without `build:` directives. |
| DEPL-02 | ✓ SATISFIED | Compose env interpolation continues to require Portainer-provided deployment values; `API_URL=http://${NAS_STATIC_IP}:8085/api` mapping remains intact and renders correctly in `docker compose config`. |
| DEPL-03 | ! DIAGNOSED (blocked in this executor) | Persistence bind mount remains `/volume1/docker/house-erp/db-data`, but restart continuity proof requires rerun on NAS/host with Docker daemon available. |

## Required Follow-Up on NAS/Host

Run on Docker-enabled NAS/host to close DEPL-03 runtime evidence:

1. `docker compose -f docker-compose.prod.yml pull`
2. `docker compose -f docker-compose.prod.yml up -d`
3. Insert sentinel row in postgres (`stack_persistence_probe`)
4. `docker compose -f docker-compose.prod.yml restart postgres`
5. Query sentinel row, verify latest value remains
6. Verify backend `/health` and frontend `/` from running containers

When this sequence passes on NAS, update this file status to `verified` with captured outputs.

---

_Verified: 2026-03-05T00:31:39Z_
_Verifier: Claude (gsd-executor)_
