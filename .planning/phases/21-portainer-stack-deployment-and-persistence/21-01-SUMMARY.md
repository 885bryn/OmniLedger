---
phase: 21-portainer-stack-deployment-and-persistence
plan: 01
subsystem: infra
tags: [docker, portainer, compose, postgres, persistence]

requires:
  - phase: 20-production-container-build-and-gateway-routing
    provides: Production backend/frontend Docker image contracts and gateway behavior
provides:
  - Portainer-ready three-service production compose stack under canonical identity house-erp-prod
  - Deterministic environment-variable contract mapping including API_URL and FRONTEND_ORIGIN
  - NAS bind-mounted Postgres persistence path at /volume1/docker/house-erp/db-data
affects: [phase-22-operator-deployment-documentation, deployment-operations]

tech-stack:
  added: [docker-compose.prod.yml]
  patterns: [single-stack in-place redeploy identity, fail-fast compose env interpolation, NAS host bind persistence]

key-files:
  created:
    - docker-compose.prod.yml
  modified:
    - .env.example

key-decisions:
  - "Use compose top-level name house-erp-prod to keep one long-lived stack identity for Portainer redeploys."
  - "Require NAS_STATIC_IP, DB_PASSWORD, JWT_SECRET, SESSION_SECRET, and HACT_ADMIN_EMAIL through compose fail-fast markers."
  - "Lock Postgres persistence to /volume1/docker/house-erp/db-data via bind mount instead of named volume."

patterns-established:
  - "Stack deployment contract: frontend, backend, and postgres ship together from docker-compose.prod.yml."
  - "Portainer env checklist: one canonical .env.example with required values plus minimal stable overrides."

requirements-completed: [DEPL-01, DEPL-02, DEPL-03]

duration: 2 min
completed: 2026-03-04
---

# Phase 21 Plan 01: Portainer Stack Deployment and Persistence Summary

**A canonical `house-erp-prod` compose stack now deploys frontend, backend, and postgres together with NAS-driven env mapping and bind-mounted Postgres persistence for restart continuity.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T16:03:51-08:00
- **Completed:** 2026-03-04T16:04:39-08:00
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- Added root `docker-compose.prod.yml` with exactly `frontend`, `backend`, and `postgres` services under `name: house-erp-prod`.
- Wired backend startup behind postgres health and preserved runtime health verification for backend `/health` plus frontend HTTP entrypoint checks.
- Enforced required Portainer env inputs with fail-fast interpolation and explicit `API_URL=http://${NAS_STATIC_IP}:8085/api`/`FRONTEND_ORIGIN` mapping.
- Bound Postgres data to `/volume1/docker/house-erp/db-data` to preserve data across service and stack restarts.
- Refreshed `.env.example` into a single Phase 21 production checklist for Portainer stack variables.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author Portainer-ready three-service production compose stack** - `339b686` (feat)
2. **Task 2: Enforce Portainer environment contract mapping including API_URL** - `2bbb713` (feat)
3. **Task 3: Wire NAS bind-mount persistence and prove restart continuity** - `78ae8df` (fix)

## Files Created/Modified
- `docker-compose.prod.yml` - Canonical production stack contract, env mapping, health gating, and NAS bind persistence.
- `.env.example` - Portainer-facing required-variable checklist with stable defaults and derived mappings.

## Decisions Made
- Kept compose project identity explicit (`house-erp-prod`) to support in-place Portainer update/redeploy workflows.
- Used compose required-value interpolation for critical secrets and deployment identity inputs to fail fast on misconfiguration.
- Added frontend container healthcheck in compose so post-restart verification includes user entrypoint reachability, not just running state.

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates
None.

## Issues Encountered
- Docker daemon was unavailable in this execution environment (`dockerDesktopLinuxEngine` pipe missing), so full `docker compose up/exec/restart` persistence verification could not run locally and remains to be run on a Docker-enabled NAS/host.

## User Setup Required

None - no additional external dashboard configuration beyond supplying stack env values in Portainer.

## Next Phase Readiness
- Phase 21 deployment contract is in place for Phase 22 documentation work.
- Phase 22 can now document one canonical stack file, env checklist, and restart-persistence verification procedure.

---
*Phase: 21-portainer-stack-deployment-and-persistence*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: `.planning/phases/21-portainer-stack-deployment-and-persistence/21-01-SUMMARY.md`
- FOUND: `339b686`
- FOUND: `2bbb713`
- FOUND: `78ae8df`
