# Roadmap: Household Asset & Commitment Tracker (HACT)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 shipped 2026-02-25 (details: `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v2.0 Auth, Timeline & Data Lifecycle** - Phases 8-13 shipped 2026-03-02 (details: `.planning/milestones/v2.0-ROADMAP.md`, audit: `.planning/milestones/v2.0-MILESTONE-AUDIT.md`)
- ✅ **v3.0 Data Portability** - Phases 14-18 shipped 2026-03-04 (details: `.planning/milestones/v3.0-ROADMAP.md`, audit: `.planning/milestones/v3.0-MILESTONE-AUDIT.md`)
- 🚧 **v4.0 Interactive Production Deployment for Ugreen NAS** - Phases 19-23 planned

## Overview

This milestone delivers environment-driven production deployment for Ugreen NAS through Portainer by sequencing configuration externalization, production container and gateway behavior, deployable stack wiring with NAS persistence, and operator-ready deployment documentation.

## Phases

- [x] **Phase 19: Environment-Driven Production Configuration** - Externalize required network, identity, and database secrets with startup validation for missing values. (completed 2026-03-04)
- [x] **Phase 20: Production Container Build and Gateway Routing** - Deliver production-grade backend/frontend images and Nginx API routing driven by NAS address configuration. (completed 2026-03-04)
- [x] **Phase 21: Portainer Stack Deployment and Persistence** - Provide deployable three-service production compose stack with Portainer env injection and NAS-backed Postgres persistence. (completed 2026-03-05)
- [x] **Phase 22: Operator Deployment Documentation** - Publish production README guidance that allows operators to deploy successfully using the required Portainer environment values. (completed 2026-03-06)
- [x] **Phase 23: Operator Runbook Route Contract Alignment** - Close DOCS-01 audit gaps by aligning README verification/troubleshooting endpoint commands with live backend route contracts and re-verifying operator flows. (completed 2026-03-07)

## Phase Details

### Phase 19: Environment-Driven Production Configuration
**Goal**: Operators can run production configuration entirely through environment variables without hardcoded network or identity values.
**Depends on**: Phase 18
**Requirements**: ENV-01, ENV-02, ENV-03, ENV-04
**Success Criteria** (what must be TRUE):
  1. Operator can set `NAS_STATIC_IP` externally and frontend/backend resolve production network targets from environment configuration.
  2. Operator can set `HACT_ADMIN_EMAIL` externally and backend admin/God Mode identity assignment follows that value.
  3. Operator can set `DB_PASSWORD` externally and postgres/backend authentication uses the provided environment secret with no checked-in credential.
  4. Operator sees clear startup validation errors whenever required production environment variables are missing.
**Plans**: 2 plans
Plans:
- [x] 19-01-PLAN.md - Add production env contract validation with fail-fast startup diagnostics and env-driven identity/DB auth.
- [x] 19-02-PLAN.md - Externalize backend/frontend network target resolution from NAS env configuration and refresh env template guidance.

### Phase 20: Production Container Build and Gateway Routing
**Goal**: Maintainers can build deployable production containers and serve frontend API traffic through Nginx without production CORS breakage.
**Depends on**: Phase 19
**Requirements**: CONT-01, CONT-02, CONT-03
**Success Criteria** (what must be TRUE):
  1. Maintainer can build and run backend production image from `Dockerfile.prod` with deployment-suitable runtime behavior.
  2. Maintainer can build and run frontend multi-stage production image from `Dockerfile.prod` that serves compiled assets in container runtime.
  3. User-facing frontend API calls route through the Nginx gateway to backend targets derived from `NAS_STATIC_IP` and complete without CORS failures.
**Plans**: 2 plans
Plans:
- [x] 20-01-PLAN.md - Add deployment-safe backend `Dockerfile.prod` and reproducible image/runtime verification flow.
- [x] 20-02-PLAN.md - Add frontend multi-stage `Dockerfile.prod` with Nginx `/api/*` gateway routing and JSON 502 handling.

### Phase 21: Portainer Stack Deployment and Persistence
**Goal**: Operators can launch and keep a persistent production stack on Ugreen NAS via Portainer.
**Depends on**: Phase 20
**Requirements**: DEPL-01, DEPL-02, DEPL-03
**Success Criteria** (what must be TRUE):
  1. Operator can deploy `frontend`, `backend`, and `postgres` together using `docker-compose.prod.yml` in Portainer.
  2. Operator can supply host environment variables in Portainer, and compose maps them into services including `API_URL=http://${NAS_STATIC_IP}:8085/api`.
  3. Postgres data persists in `/volume1/docker/house-erp/db-data` and remains available after service restarts.
**Plans**: 2 plans
Plans:
- [x] 21-01-PLAN.md - Create Portainer-ready production compose stack with env injection and NAS Postgres persistence verification.
- [x] 21-02-PLAN.md - Close GHCR-first deployment gap by publishing frontend/backend images, switching compose to `image:` tags, and recording pull-based persistence verification evidence.

### Phase 22: Operator Deployment Documentation
**Goal**: Operators can execute production deployment successfully using a single, explicit README procedure.
**Depends on**: Phase 21
**Requirements**: DOCS-01
**Success Criteria** (what must be TRUE):
  1. Operator can follow the production deployment README and identify every required Portainer stack environment variable without guessing.
  2. Operator can complete deployment using only the documented steps and variable list, with no missing-configuration blockers.
**Plans**: 2 plans
Plans:
- [x] 22-01-PLAN.md - Build the single production README runbook with explicit Portainer variable contract and first-time/update/rollback flows.
- [x] 22-02-PLAN.md - Add symptom-first troubleshooting and gate-based deployment verification with stop/rollback criteria.

### Phase 23: Operator Runbook Route Contract Alignment
**Goal**: Operators can run README verification/troubleshooting commands end-to-end without false failures caused by route-path mismatches.
**Depends on**: Phase 22
**Requirements**: DOCS-01
**Gap Closure**: Closes milestone audit gaps from `.planning/v4.0-MILESTONE-AUDIT.md` (DOCS-01 unsatisfied + broken verification flows).
**Success Criteria** (what must be TRUE):
  1. Backend-direct README checks use live backend route mounts (`/auth/*`, `/items`) rather than frontend gateway-prefixed `/api/*` paths on backend port.
  2. README verification and troubleshooting flow commands no longer produce false route-not-found outcomes when deployment is healthy.
  3. DOCS-01 is re-verified as satisfied in phase verification and milestone re-audit.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 19. Environment-Driven Production Configuration | 2/2 | Complete    | 2026-03-04 |
| 20. Production Container Build and Gateway Routing | 2/2 | Complete   | 2026-03-04 |
| 21. Portainer Stack Deployment and Persistence | 2/2 | Complete   | 2026-03-05 |
| 22. Operator Deployment Documentation | 2/2 | Complete    | 2026-03-06 |
| 23. Operator Runbook Route Contract Alignment | 2/2 | Complete   | 2026-03-07 |
