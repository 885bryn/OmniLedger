---
phase: 02-item-creation-workflow
plan: 02
subsystem: api
tags: [express, items, validation, integration-tests, sequelize]
requires:
  - phase: 02-item-creation-workflow
    provides: Domain create-item defaults, validation categories, and canonical serializer
provides:
  - Express API bootstrap with POST /items routing
  - Centralized item-create validation error mapping for HTTP responses
  - Endpoint integration coverage for create success/defaults/validation flows
affects: [phase-03-net-status, api-error-contracts]
tech-stack:
  added: [express, supertest]
  patterns: [thin-route-to-domain-delegation, centralized-http-error-mapping, endpoint-level-contract-tests]
key-files:
  created:
    - src/api/app.js
    - src/api/routes/items.routes.js
    - src/api/errors/http-error-mapper.js
    - test/api/items-create.test.js
  modified:
    - package.json
    - package-lock.json
    - src/domain/items/create-item.js
key-decisions:
  - "Return canonical item payload directly from POST /items while keeping error details in a stable error envelope."
  - "Map ItemCreateValidationError to HTTP 422 with field-level issues and category-specific actionable messages."
  - "Keep API tests integration-level by wiring real router + middleware against in-memory sqlite models."
patterns-established:
  - "Express app construction remains exportable via createApp() for tests and runtime bootstrap reuse."
  - "Item create route remains transport-thin and delegates all business rules to domain service."
requirements-completed: [ITEM-04]
duration: 3 min
completed: 2026-02-24
---

# Phase 2 Plan 2: Item Creation HTTP Workflow Summary

**POST /items is now exposed through Express with deterministic canonical success payloads, centralized validation error mapping, and integration tests covering defaults, parent-link checks, and actionable multi-issue feedback.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-24T09:35:39Z
- **Completed:** 2026-02-24T09:39:35Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added Express app bootstrap with JSON parsing, route mounting, and centralized error middleware.
- Implemented `POST /items` controller delegation to `createItem` with 201 canonical response behavior.
- Added HTTP error mapping that translates item-create validation categories into stable client-facing error envelopes.
- Added API integration tests for success payload shape, defaults merge semantics, invalid type/missing key categories, parent-link errors, and multi-issue aggregation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add HTTP runtime dependencies and API bootstrap** - `04b96e8` (feat)
2. **Task 2: Implement POST /items route and centralized error mapping** - `eb2726f` (feat)
3. **Task 3: Add API integration tests for create success, defaults, and validation feedback** - `a4d5525` (test)

## Files Created/Modified
- `src/api/app.js` - Exportable Express bootstrap with middleware ordering and centralized item-create error handling.
- `src/api/routes/items.routes.js` - Thin `POST /items` route delegating creation to the domain service.
- `src/api/errors/http-error-mapper.js` - Stable HTTP envelope mapping for item-create validation failures.
- `test/api/items-create.test.js` - Endpoint integration tests for success/defaults/validation semantics.
- `src/domain/items/create-item.js` - Canonical serializer timestamp normalization to guarantee HTTP payload timestamps.
- `package.json` - Added Express runtime dependency and Supertest test dependency.
- `package-lock.json` - Locked dependency graph updates for new API/testing packages.

## Decisions Made
- Used a centralized mapper (`mapItemCreateError`) in app-level error middleware so route handlers stay focused on transport delegation.
- Returned item create success payload as canonical persisted fields directly to align with existing domain serializer and avoid envelope churn.
- Added integration tests against `createApp()` with mocked sqlite runtime to verify route + middleware + domain behavior end-to-end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed canonical timestamp key serialization for HTTP responses**
- **Found during:** Task 3 (Add API integration tests for create success, defaults, and validation feedback)
- **Issue:** Domain serializer produced undefined `created_at`/`updated_at` under sqlite because Sequelize exposed `createdAt`/`updatedAt`, causing timestamp keys to disappear from JSON responses.
- **Fix:** Normalized serializer output to map camelCase timestamp keys to canonical snake_case keys before response serialization.
- **Files modified:** `src/domain/items/create-item.js`
- **Verification:** `npm test -- test/domain/items/create-item.test.js --runInBand` and `npm test -- test/api/items-create.test.js --runInBand`
- **Committed in:** `a4d5525` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was required for correctness of the HTTP success contract; no scope creep.

## Issues Encountered
- Task 1 and Task 2 per-task verification command initially returned "No tests found" because `test/api/items-create.test.js` is introduced in Task 3 by design.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for Phase 3 net-status retrieval work with a stable API bootstrap, route/error pattern, and endpoint test harness in place.
- ITEM-04 behavior is fully verified at both domain and HTTP entrypoint levels.

---
*Phase: 02-item-creation-workflow*
*Completed: 2026-02-24*

## Self-Check: PASSED

- FOUND: `.planning/phases/02-item-creation-workflow/02-02-SUMMARY.md`
- FOUND: `04b96e8`
- FOUND: `eb2726f`
- FOUND: `a4d5525`
