---
phase: 19-environment-driven-production-configuration
plan: 01
subsystem: infra
tags: [environment, startup, auth, postgres, portainer]

requires:
  - phase: 18-data-portability-export-audit-fidelity
    provides: Stable backend auth/session and startup script baseline
provides:
  - Aggregated production env validation for NAS_STATIC_IP, HACT_ADMIN_EMAIL, and DB_PASSWORD
  - Startup preflight fail-fast behavior with explicit operator diagnostics
  - Env-only admin identity mapping and production postgres credential enforcement
affects: [phase-20-production-container-build-and-gateway-routing, phase-21-portainer-stack-deployment-and-persistence]

tech-stack:
  added: []
  patterns: [centralized production env contract, startup preflight validation gate, env-only production identity and db auth]

key-files:
  created:
    - src/config/production-env.js
    - test/config/production-env.test.js
    - test/scripts/startup-production-env.test.js
  modified:
    - src/scripts/startup.js
    - src/config/database.js
    - src/api/routes/auth.routes.js
    - test/api/auth-role-session.test.js

key-decisions:
  - "Treat blank required env vars as missing and report all issues in one deterministic diagnostic payload."
  - "Run production env preflight before DB readiness/migrations so startup exits before partial boot."
  - "Use HACT_ADMIN_EMAIL as the only configured admin identity source and ignore ADMIN_EMAIL fallback."

patterns-established:
  - "Production env contract: define required vars once and reuse across startup and tests."
  - "Fail-fast startup guard: validate config before external side effects (DB probes/migrations/server spawn)."

requirements-completed: [ENV-02, ENV-03, ENV-04]

duration: 3 min
completed: 2026-03-04
---

# Phase 19 Plan 01: Production Env Contract Summary

**Production startup now enforces NAS network, admin identity, and database secret inputs through an aggregated environment contract with explicit Portainer-safe diagnostics.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-04T22:01:17Z
- **Completed:** 2026-03-04T22:04:55Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added shared production env validation with deterministic multi-issue reporting and secret-safe messaging.
- Wired startup preflight to fail before DB checks, migrations, and API launch when production env is invalid.
- Enforced env-driven admin role mapping and production postgres credential requirements with regression coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create aggregated production env validator with actionable, secret-safe diagnostics** - `08c757f` (feat)
2. **Task 2: Wire startup fail-fast gate and explicit validation logs** - `d22756e` (feat)
3. **Task 3: Enforce env-driven admin identity and production DB auth paths** - `c07946d` (fix)

**Plan metadata:** `f58d077` (docs)

## Files Created/Modified
- `src/config/production-env.js` - Central production env parser and validation error type.
- `src/scripts/startup.js` - Production preflight validation before readiness, migration, and server boot.
- `src/config/database.js` - Production postgres env requirement enforcement when `DATABASE_URL` is absent.
- `src/api/routes/auth.routes.js` - Canonical admin identity source set to `HACT_ADMIN_EMAIL` only.
- `test/config/production-env.test.js` - Regression coverage for aggregated diagnostics and production DB auth config requirements.
- `test/scripts/startup-production-env.test.js` - Preflight fail-fast tests ensuring no boot side effects on invalid env.
- `test/api/auth-role-session.test.js` - Regression coverage for ignoring legacy `ADMIN_EMAIL` fallback.

## Decisions Made
- Validation output stays deterministic and includes variable-level Portainer fix hints without secret samples.
- Startup preflight executes only in production mode to preserve local dev/test compatibility.
- Production postgres fallback defaults remain available for non-production, but production requires explicit env credentials.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Environment-driven production contract and guardrails are in place for network target externalization in `19-02`.
- No blockers for proceeding to the next plan.

---
*Phase: 19-environment-driven-production-configuration*
*Completed: 2026-03-04*

## Self-Check: PASSED
