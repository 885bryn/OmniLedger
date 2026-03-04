---
phase: 20-production-container-build-and-gateway-routing
plan: 02
subsystem: infra
tags: [docker, nginx, gateway, nas, frontend]

requires:
  - phase: 19-02
    provides: env-driven frontend/backend network target resolution
provides:
  - Frontend multi-stage production image that builds Vite assets and serves them from Nginx.
  - Strict runtime gateway resolution from NAS_STATIC_IP with fail-fast startup validation.
  - Same-origin /api gateway routing with JSON 502 envelopes for upstream failures.
affects: [phase-21-stack-deployment, production-routing]

tech-stack:
  added: [frontend/Dockerfile.prod, nginx template rendering via envsubst]
  patterns: [same-origin /api gateway prefix, strict env-validated upstream bootstrap]

key-files:
  created: [frontend/Dockerfile.prod, frontend/nginx/default.conf.template, frontend/docker-entrypoint.sh]
  modified: [frontend/Dockerfile.prod, frontend/nginx/default.conf.template]

key-decisions:
  - "Frontend production build defaults VITE_API_BASE_URL to /api while preserving build-arg override support."
  - "Gateway startup is strict: NAS_STATIC_IP must be present and valid IPv4 before Nginx starts."

patterns-established:
  - "Frontend production runtime renders Nginx config from env at startup instead of baking static upstream values."
  - "Gateway failures are returned as JSON envelopes to keep client behavior consistent."

requirements-completed: [CONT-02, CONT-03]

duration: 3 min
completed: 2026-03-04
---

# Phase 20 Plan 02: Frontend Container and Gateway Routing Summary

**A production frontend image now compiles SPA assets, serves them via Nginx, and routes same-origin `/api/*` requests through a strict NAS-derived gateway with JSON 502 failures.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T22:43:08Z
- **Completed:** 2026-03-04T22:46:36Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added `frontend/Dockerfile.prod` multi-stage build flow with lean Nginx runtime output from Vite `dist/` artifacts.
- Added strict runtime gateway bootstrap (`frontend/docker-entrypoint.sh`) that blocks startup when `NAS_STATIC_IP` is missing or invalid.
- Added Nginx routing contract (`frontend/nginx/default.conf.template`) for same-origin `/api/*` proxying and JSON `502/503/504` gateway error handling.
- Enforced API-path isolation by normalizing `/api` to `/api/` and keeping SPA fallback behavior under `location /`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build frontend multi-stage Dockerfile.prod with compiled asset runtime** - `bc9fad5` (feat)
2. **Task 2: Implement strict NAS-derived Nginx /api gateway routing** - `87d46a9` (feat)
3. **Task 3: Prove same-origin gateway behavior avoids production CORS breakage** - `4d7ff73` (feat)

## Files Created/Modified
- `frontend/Dockerfile.prod` - Multi-stage image build, default same-origin API base, runtime entrypoint wiring.
- `frontend/docker-entrypoint.sh` - Strict `NAS_STATIC_IP` validation and Nginx template rendering for backend upstream.
- `frontend/nginx/default.conf.template` - SPA static serving plus `/api/*` proxy and JSON gateway error envelope behavior.

## Decisions Made
- Installed `gettext` in the runtime image to guarantee `envsubst` availability for deterministic startup rendering.
- Used explicit JSON error envelope fields (`code`, `category`, `message`, `upstream`) for upstream outage diagnostics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Runtime gateway wiring required Dockerfile bootstrap updates**
- **Found during:** Task 2 (strict NAS-derived gateway implementation)
- **Issue:** New Nginx template and entrypoint would not execute in container runtime without explicit Dockerfile wiring.
- **Fix:** Updated runtime stage to install `gettext`, copy template/script into image, and set custom entrypoint.
- **Files modified:** `frontend/Dockerfile.prod`
- **Verification:** Script syntax check passed (`sh -n frontend/docker-entrypoint.sh`) and config contract patterns confirmed in template.
- **Committed in:** `87d46a9` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for gateway correctness; no feature scope expansion.

## Authentication Gates
None.

## Issues Encountered
- Docker daemon was unavailable in this execution environment (`dockerDesktopLinuxEngine` pipe missing), so required container build/run verification commands could not be executed end-to-end.
- Logged unrelated pre-existing frontend build/type issues to `.planning/phases/20-production-container-build-and-gateway-routing/deferred-items.md` as out-of-scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frontend production container and gateway routing artifacts are in place for Portainer stack composition in Phase 21.
- Once Docker daemon is available, run the plan verification commands to confirm runtime behavior in-container.

---
*Phase: 20-production-container-build-and-gateway-routing*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: `.planning/phases/20-production-container-build-and-gateway-routing/20-02-SUMMARY.md`
- FOUND: `bc9fad5`
- FOUND: `87d46a9`
- FOUND: `4d7ff73`
