---
phase: 06-6
plan: 02
subsystem: api
tags: [express, sequelize, api-contracts, jest, frontend-support]

requires:
  - phase: 06-6
    provides: item/event domain query and mutation services with categorized errors
provides:
  - Expanded HTTP contracts for items list/update/delete/activity, events list grouping, and users listing
  - Centralized query/mutation error mapping for new item/event endpoints with deterministic issue envelopes
  - Endpoint integration suites that lock Phase 6 frontend transport behaviors
affects: [phase-06-frontend-shell, dashboard-events-page, items-workflows, user-switcher]

tech-stack:
  added: []
  patterns: [thin route-to-domain adapters, centralized error envelope mapper, sqlite-backed API integration tests]

key-files:
  created:
    - src/api/routes/users.routes.js
    - test/api/items-list-and-mutate.test.js
    - test/api/events-list.test.js
    - test/api/users-list.test.js
  modified:
    - src/api/routes/items.routes.js
    - src/api/routes/events.routes.js
    - src/api/app.js
    - src/api/errors/http-error-mapper.js

key-decisions:
  - "Standardize new item mutation/query route failures under item_query_failed while preserving category-level detail for UI field/page messaging."
  - "Expose GET /users as deterministic username-sorted transport payload for local/dev actor switching with existing x-user-id semantics."

patterns-established:
  - "Route query normalization maps snake_case request params into domain camelCase inputs before domain execution."
  - "Integration suites assert both happy-path contracts and issue-envelope shape/category stability for frontend safety."

requirements-completed: []

duration: 5 min
completed: 2026-02-25
---

# Phase 6 Plan 02: API Contract Wiring Summary

**Phase 6 frontend workflows now have concrete transport contracts for item list/edit/delete/activity, grouped due-date events retrieval, and users actor selection with centralized deterministic issue-envelope behavior.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25T03:39:19.404Z
- **Completed:** 2026-02-25T03:44:45.004Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Expanded API surface to include `GET /items`, `PATCH /items/:id`, `DELETE /items/:id`, `GET /items/:id/activity`, `GET /events`, and `GET /users`.
- Extended centralized error mapping so new item/event query and mutation failures emit stable issue-envelope codes/categories/statuses.
- Added endpoint integration suites validating deterministic ordering/grouping, error-envelope categories, soft-delete visibility semantics, activity payload shape, and user-switcher payload behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand items/events/users routes and mapper wiring for Phase 6 contracts** - `7a6ab75` (feat)
2. **Task 2: Add endpoint integration suites proving frontend contract completeness** - `ba2fc4d` (test)

**Plan metadata:** captured in planning docs commits (`9a23167`, follow-up normalization commit).

## Files Created/Modified
- `src/api/routes/items.routes.js` - Added list/update/delete/activity routes with query/body mapping into domain services.
- `src/api/routes/events.routes.js` - Added grouped `GET /events` endpoint while preserving existing completion behavior.
- `src/api/routes/users.routes.js` - Added deterministic users list endpoint for actor source retrieval.
- `src/api/app.js` - Wired users router and expanded centralized mapper chain for query errors.
- `src/api/errors/http-error-mapper.js` - Added item/event query error mappers with category-to-status mapping.
- `test/api/items-list-and-mutate.test.js` - Contract coverage for list controls, mutate envelopes, delete visibility semantics, and activity payloads.
- `test/api/events-list.test.js` - Contract coverage for grouped due sections, deterministic ordering, filters, and range validation envelopes.
- `test/api/users-list.test.js` - Contract coverage for deterministic actor options payload and empty-state response shape.

## Decisions Made
- Kept route handlers as thin adapters over domain services so transport behavior is explicit without duplicating domain validation logic.
- Used stable envelope codes (`item_query_failed`, `event_query_failed`) with category-specific issues for frontend field/page error rendering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing endpoint test files required by plan verification command**
- **Found during:** Task 1 (route/mapper wiring)
- **Issue:** Task 1 verification command referenced three API test files that did not exist yet, causing immediate verification failure.
- **Fix:** Created baseline suites for the three contract files so Task 1 verification could run, then expanded full coverage in Task 2.
- **Files modified:** `test/api/items-list-and-mutate.test.js`, `test/api/events-list.test.js`, `test/api/users-list.test.js`
- **Verification:** `npm test -- test/api/items-list-and-mutate.test.js test/api/events-list.test.js test/api/users-list.test.js --runInBand`
- **Committed in:** `7a6ab75`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was required to satisfy the planned verification gate; no scope beyond planned files/contracts.

## Issues Encountered
- Test fixture assumptions initially conflicted with existing model invariants (unique normalized username, completed-event validation, and sqlite timestamp behavior); fixtures/assertions were updated to align with domain/model constraints.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend contract surface now matches Phase 6 dashboard/items/events/user-switcher workflows expected by the upcoming frontend plans.
- Ready for `06-03-PLAN.md` frontend runtime/bootstrap work with stable API endpoints and integration guardrails.

---
*Phase: 06-6*
*Completed: 2026-02-25*

## Self-Check: PASSED
- FOUND: `.planning/phases/06-6/06-02-SUMMARY.md`
- FOUND: `7a6ab75`
- FOUND: `ba2fc4d`
