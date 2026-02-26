---
phase: 09-rbac-scope-admin-safety-mode
plan: 08
subsystem: api
tags: [rbac, authorization, ownership, api-contracts, jest]

requires:
  - phase: 09-02
    provides: owner-scope threading across item and event domain entry points
provides:
  - Ownership-denial responses normalize to 404/not_found for foreign direct access.
  - Item and event denial envelopes share a plain ownership-policy message.
  - API regressions lock non-leaky ownership contract semantics.
affects: [admin-mode, item-api, events-api, auth-05]

tech-stack:
  added: []
  patterns: [shared ownership-denial mapper normalization, non-leaky direct-access denial contracts]

key-files:
  created: []
  modified:
    - src/api/errors/http-error-mapper.js
    - src/domain/items/get-item-net-status.js
    - src/domain/items/get-item-activity.js
    - src/domain/items/update-item.js
    - src/domain/items/soft-delete-item.js
    - src/domain/events/complete-event.js
    - test/api/items-net-status.test.js
    - test/api/items-list-and-mutate.test.js
    - test/api/events-complete.test.js

key-decisions:
  - "Map ownership-denial categories to 404/not_found at the shared HTTP mapper boundary for consistent API contracts."
  - "Use plain direct denial copy ('You can only access your own records.') while keeping foreign resource existence opaque."

patterns-established:
  - "Ownership denial normalization: treat forbidden ownership checks as not_found at API boundaries"
  - "Regression locking: add negative assertions to block forbidden fallback semantics"

requirements-completed: [AUTH-05]

duration: 4 min
completed: 2026-02-26
---

# Phase 9 Plan 8: Ownership-Denial Contract Normalization Summary

**Item and event foreign-resource direct access now returns a shared 404/not_found envelope with plain ownership-policy copy and regression coverage that blocks 403 leakage semantics.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T03:29:16Z
- **Completed:** 2026-02-26T03:34:11Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Normalized item/event ownership-denial mapping to a shared 404/not_found contract.
- Updated item detail/activity/update/delete and event complete/undo denial paths to plain direct ownership copy.
- Locked API regressions to reject mixed 403 ownership-denial semantics.

## Task Commits

Each task was committed atomically:

1. **Task 1: Normalize ownership-denial mapping to 404-style contracts with plain direct policy copy** - `924cf93` (fix)
2. **Task 2: Lock contract tests to prevent reintroduction of ownership leakage semantics** - `2555224` (test)

## Files Created/Modified
- `src/api/errors/http-error-mapper.js` - Added shared ownership-denial normalization to 404/not_found envelopes.
- `src/domain/items/get-item-net-status.js` - Converted foreign-owner denial metadata to non-leaky not_found semantics.
- `src/domain/items/get-item-activity.js` - Normalized foreign activity access denials to not_found semantics.
- `src/domain/items/update-item.js` - Normalized foreign update denials to not_found semantics.
- `src/domain/items/soft-delete-item.js` - Normalized foreign delete denials to not_found semantics.
- `src/domain/events/complete-event.js` - Normalized foreign complete/undo denials to not_found semantics.
- `test/api/items-net-status.test.js` - Updated foreign-access assertions to 404/not_found with negative forbidden checks.
- `test/api/items-list-and-mutate.test.js` - Added foreign mutate/activity denial regressions for 404/not_found behavior.
- `test/api/events-complete.test.js` - Updated foreign complete/undo assertions to 404/not_found with negative forbidden checks.

## Decisions Made
- Ownership-denial categories are normalized through the shared HTTP mapper to prevent per-endpoint drift.
- Ownership denial copy is explicit about policy while not revealing whether a foreign record exists.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AUTH-05 denial semantics are now contract-consistent across targeted item/event direct-access pathways.
- Ready for next Phase 9 plan work on admin mode and lens controls.

---
*Phase: 09-rbac-scope-admin-safety-mode*
*Completed: 2026-02-26*

## Self-Check: PASSED
