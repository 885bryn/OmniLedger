---
phase: 06-6
plan: 01
subsystem: api
tags: [domain, items, events, sequelize, jest]

requires:
  - phase: 04-4
    provides: event completion guard and audit-log action patterns
provides:
  - Item domain services for list, update, soft delete, and activity retrieval with ownership guards
  - Event domain service for grouped nearest-due list retrieval with deterministic ordering
  - Shared item/event query error categories for centralized HTTP mapping in the next plan
affects: [phase-06-api-contracts, frontend-dashboard-events, frontend-items-workflows]

tech-stack:
  added: []
  patterns: [domain-level query normalization, soft-delete via attributes marker, deterministic tie-break sorting]

key-files:
  created:
    - src/domain/items/list-items.js
    - src/domain/items/update-item.js
    - src/domain/items/soft-delete-item.js
    - src/domain/items/get-item-activity.js
    - src/domain/events/list-events.js
    - src/domain/items/item-query-errors.js
    - src/domain/events/event-query-errors.js
    - test/domain/items/list-items.test.js
    - test/domain/items/update-item.test.js
    - test/domain/items/soft-delete-item.test.js
    - test/domain/items/get-item-activity.test.js
    - test/domain/events/list-events.test.js
  modified: []

key-decisions:
  - "Represent soft delete state in item.attributes via _deleted_at/_deleted_by to avoid schema changes while preserving persistence semantics."
  - "Group events by due-date (YYYY-MM-DD) and sort deterministically by due_date asc, updated_at desc, id asc before transport mapping."

patterns-established:
  - "Domain query errors expose category + issues arrays for mapper-level HTTP translation."
  - "Regression tests lock tie-break ordering and ownership guard behavior for future route wiring."

requirements-completed: []

duration: 8 min
completed: 2026-02-25
---

# Phase 6 Plan 01: Domain Query/Mutation Foundation Summary

**Item list/edit/delete/activity and grouped nearest-due event domain services now ship with deterministic ordering and categorized query/mutation error contracts.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-25T03:27:50.092Z
- **Completed:** 2026-02-25T03:35:54.162Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Implemented `listItems`, `updateItem`, `softDeleteItem`, and `getItemActivity` with ownership guards and explicit failure categories.
- Implemented `listEvents` grouped nearest-due retrieval with deterministic tie-break behavior before API-layer mapping.
- Added focused domain regression tests for ordering, filter/search semantics, guard enforcement, soft-delete visibility, and activity payload shape.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement item and event domain services required by Phase 6 UI journeys** - `31378f6` (feat)
2. **Task 2: Add focused domain regression tests for ordering, filtering, and guard semantics** - `5b64a50` (test)

**Plan metadata:** pending

## Files Created/Modified
- `src/domain/items/list-items.js` - Item list query orchestration for search/filter/sort defaults and deterministic ordering.
- `src/domain/items/update-item.js` - Item mutation service with ownership checks, soft-delete immutability guard, and audit write.
- `src/domain/items/soft-delete-item.js` - Soft-delete persistence via attributes marker with idempotent behavior.
- `src/domain/items/get-item-activity.js` - Item + related event audit timeline retrieval with deterministic ordering.
- `src/domain/events/list-events.js` - Grouped nearest-due event listing scoped to actor-owned items.
- `src/domain/items/item-query-errors.js` - Categorized item domain query/mutation error types.
- `src/domain/events/event-query-errors.js` - Categorized event list query error types.
- `test/domain/items/list-items.test.js` - Regression tests for default ordering and search/filter/sort semantics.
- `test/domain/items/update-item.test.js` - Regression tests for update mutation behavior and guards.
- `test/domain/items/soft-delete-item.test.js` - Regression tests for soft-delete idempotence and visibility semantics.
- `test/domain/items/get-item-activity.test.js` - Regression tests for activity timeline payload and access guard.
- `test/domain/events/list-events.test.js` - Regression tests for grouped nearest-due ordering and range validation.

## Decisions Made
- Used attributes-based soft delete markers to keep the current schema stable while still enabling persistent delete semantics and list filtering.
- Standardized event grouping output by due-date bucket in domain so routes can remain thin mappers in Plan 02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing domain test files during Task 1 execution**
- **Found during:** Task 1 (domain service implementation)
- **Issue:** Task 1 verification command required five domain test files that were not yet present in the repository.
- **Fix:** Added baseline suites so verification could run, then expanded coverage in Task 2.
- **Files modified:** `test/domain/items/list-items.test.js`, `test/domain/items/update-item.test.js`, `test/domain/items/soft-delete-item.test.js`, `test/domain/items/get-item-activity.test.js`, `test/domain/events/list-events.test.js`
- **Verification:** `npm test -- test/domain/items/list-items.test.js test/domain/items/update-item.test.js test/domain/items/soft-delete-item.test.js test/domain/items/get-item-activity.test.js test/domain/events/list-events.test.js --runInBand`
- **Committed in:** `5b64a50`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was required to satisfy the plan's own verification gate; no scope creep beyond planned files.

## Issues Encountered
- New tests initially failed due to model-level validation constraints (password length, required minimum item attributes, and audit action format). Adjusted fixtures and action naming to match existing domain invariants.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Domain primitives and regression coverage are now in place for Plan 02 route-level contract wiring.
- Next plan can focus on transport mapping and integration tests without placeholder domain logic.

---
*Phase: 06-6*
*Completed: 2026-02-25*

## Self-Check: PASSED
- FOUND: `.planning/phases/06-6/06-01-SUMMARY.md`
- FOUND: `31378f6`
- FOUND: `5b64a50`
