---
phase: 19-environment-driven-production-configuration
plan: 02
subsystem: infra
tags: [environment, cors, nas, frontend, api]

requires:
  - phase: 19-01
    provides: production env contract validation and fail-fast startup guards
provides:
  - Backend CORS origin resolution derived from NAS_STATIC_IP with FRONTEND_ORIGIN override support.
  - Frontend API base URL resolution sourced from VITE_API_BASE_URL and VITE_NAS_STATIC_IP.
  - Portainer-oriented .env.example contract documenting NAS network variables.
affects: [phase-20-container-routing, deployment-networking]

tech-stack:
  added: []
  patterns: [shared network target resolver, shared frontend API base resolver]

key-files:
  created: [src/config/network-targets.js, test/api/app-network-env.test.js]
  modified: [src/api/app.js, frontend/src/lib/api-client.ts, frontend/src/features/export/use-export-backup.ts, frontend/src/__tests__/user-switcher-export-action.test.tsx, .env.example]

key-decisions:
  - "Production backend CORS allowlist resolves from FRONTEND_ORIGIN first, otherwise derives from NAS_STATIC_IP + FRONTEND_PORT."
  - "Frontend API base URL resolves from VITE_API_BASE_URL first, then VITE_NAS_STATIC_IP, with localhost fallback for local development."

patterns-established:
  - "Network targets: production values are environment-derived and never hardcoded in runtime code paths."
  - "Frontend transport and export flows share one API base URL resolver source of truth."

requirements-completed: [ENV-01]

duration: 2 min
completed: 2026-03-04
---

# Phase 19 Plan 02: Environment-Driven Network Targeting Summary

**Backend CORS and frontend transport routing now derive production addresses from NAS-provided environment variables instead of hardcoded localhost assumptions.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-04T22:10:31Z
- **Completed:** 2026-03-04T22:12:40Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added `resolveNetworkTargets` to centralize backend production origin resolution from `NAS_STATIC_IP` and optional `FRONTEND_ORIGIN` override.
- Wired backend CORS policy through the network resolver and added regression tests that lock production env behavior.
- Centralized frontend API base resolution and aligned export transport usage/tests with shared environment-derived URL behavior.
- Updated `.env.example` with Portainer-focused NAS/static-IP, admin identity, and DB password guidance.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add backend NAS-driven network target resolver and wire CORS origin policy** - `87cc3df` (feat)
2. **Task 2: Centralize frontend production API URL derivation from env** - `fed01c8` (feat)
3. **Task 3: Refresh env template with NAS network contract and operator hints** - `811d1a5` (docs)

## Files Created/Modified
- `src/config/network-targets.js` - Resolves allowed frontend origins based on runtime env and deployment mode.
- `src/api/app.js` - Uses shared network target resolver for CORS origin allowlist and fallback handling.
- `test/api/app-network-env.test.js` - Verifies production CORS origin behavior follows env values and avoids localhost fallback.
- `frontend/src/lib/api-client.ts` - Exposes shared API base URL resolver with env precedence.
- `frontend/src/features/export/use-export-backup.ts` - Reuses shared API base URL source of truth.
- `frontend/src/__tests__/user-switcher-export-action.test.tsx` - Asserts export transport uses shared base resolver and env precedence behavior.
- `.env.example` - Documents NAS-driven network contract and Portainer setup hints.

## Decisions Made
- Used `FRONTEND_ORIGIN` as explicit override for production CORS, with deterministic fallback to `http://${NAS_STATIC_IP}:${FRONTEND_PORT}`.
- Kept localhost defaults strictly for non-production or missing frontend env config to preserve local/dev test determinism.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added production session secret in new CORS regression tests**
- **Found during:** Task 1 (backend env CORS test execution)
- **Issue:** New production-mode app tests failed before CORS checks because existing session middleware requires `SESSION_SECRET` in production.
- **Fix:** Added `SESSION_SECRET` to production env test setup so the new env-origin scenarios can execute.
- **Files modified:** `test/api/app-network-env.test.js`
- **Verification:** `npm test -- test/api/app-network-env.test.js --runInBand`
- **Committed in:** `87cc3df` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required to unblock intended production-env CORS verification; no scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 19 is complete (2/2 plans) with ENV-01 satisfied across backend and frontend network targeting.
- Ready for Phase 20 production container and gateway routing implementation.

---
*Phase: 19-environment-driven-production-configuration*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: `.planning/phases/19-environment-driven-production-configuration/19-02-SUMMARY.md`
- FOUND: `87cc3df`
- FOUND: `fed01c8`
- FOUND: `811d1a5`
