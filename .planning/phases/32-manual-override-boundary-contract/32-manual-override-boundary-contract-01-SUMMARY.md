---
phase: 32-manual-override-boundary-contract
plan: "01"
subsystem: api
tags: [events, manual-override, origin-boundary, sequelize, regressions]
requires:
  - phase: 31-paid-flow-into-history
    provides: grouped history visibility and paid-flow ledger behavior that now depends on safe backend event contracts
provides:
  - Latest-safe recurring origin boundary enforcement with creation-day anchoring
  - Admin-visible suppression metadata for bogus historical projected rows on `/events`
  - Explicit `POST /events/manual-override` creation path for completed historical overrides
affects: [events-api, phase-32-plan-02, phase-33-historical-injection-ui]
tech-stack:
  added: []
  patterns:
    - latest-safe origin boundary combines explicit origin metadata, due-date seed, and item creation day
    - manual historical overrides persist as completed non-recurring events with warning-only extreme-date feedback
key-files:
  created:
    - src/db/migrations/20260310000000-add-event-manual-override-flag.js
    - src/domain/events/create-manual-override-event.js
    - test/api/events-manual-override-create.test.js
  modified:
    - src/domain/items/item-event-sync.js
    - src/domain/events/list-events.js
    - src/api/routes/events.routes.js
    - src/db/models/event.model.js
    - test/api/events-list.test.js
key-decisions:
  - "Use the latest valid date across origin metadata, due-date seed data, and item creation day as the shared safe boundary for projection and suppression."
  - "Treat manual overrides as explicit completed persisted rows that bypass only the origin boundary while still enforcing ownership, date, amount, and duplicate guards."
patterns-established:
  - "Admin-only suppression metadata: `/events` stays clean for normal users while admins receive inline counts for filtered bogus projected rows."
  - "Historical override contract: explicit route, completed persistence, `is_manual_override` tagging, and warning-only feedback for extreme valid dates."
requirements-completed: [SAFE-02, EVENT-02, EVENT-03]
duration: 5 min
completed: 2026-03-10
---

# Phase 32 Plan 01: Manual Override Boundary Contract Summary

**Recurring event projection now honors a latest-safe origin boundary, suppresses absurd historical junk rows from `/events`, and supports explicit completed manual overrides with `is_manual_override` persistence.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T00:01:27-07:00
- **Completed:** 2026-03-10T00:06:15-07:00
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Hardened recurring projection so weak metadata produces no guessed rows and creation-day anchoring blocks unsafe pre-origin leakage.
- Filtered already-persisted bogus recurring history from `/events` and exposed suppression counts only to admin responses.
- Added `POST /events/manual-override` so authenticated users and admins can persist completed pre-origin history with warning-capable validation.
- Extended event normalization and regressions so manual override rows surface with `is_manual_override = true` while duplicate, future-date, amount, and scope guards stay enforced.

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden projection boundaries and suppress absurd historical system rows** - `2f275e6` (feat)
2. **Task 2: Add explicit manual-override event creation with warning-capable validation** - `577e495` (feat)

**Plan metadata:** Pending final docs commit

## Files Created/Modified

- `src/domain/items/item-event-sync.js` - Shares the latest-safe projection boundary contract and creation-day anchor logic.
- `src/domain/events/list-events.js` - Suppresses bogus recurring rows, returns admin-only suppression counts, and exposes manual override flags.
- `src/api/routes/events.routes.js` - Adds the authenticated `POST /events/manual-override` route and route-local error mapping.
- `src/domain/events/create-manual-override-event.js` - Validates and persists completed manual overrides with audit attribution and warning support.
- `src/db/models/event.model.js` - Adds `is_manual_override` to the event persistence model.
- `src/db/migrations/20260310000000-add-event-manual-override-flag.js` - Adds the database column for manual override tagging.
- `test/api/events-list.test.js` - Locks absurd-date suppression, weak-metadata no-projection behavior, and admin-vs-user `/events` metadata behavior.
- `test/api/events-manual-override-create.test.js` - Covers pre-origin saves, warnings, duplicate guards, and owner/admin scope rules for manual overrides.

## Decisions Made

- Used the strictest valid boundary from explicit origin metadata, due-date seed data, and item creation day so projection safety does not depend on hardcoded year floors.
- Kept the manual override exception narrow: only origin-boundary bypass is allowed, while malformed dates, future dates, duplicate rows, invalid amounts, and owner-scope violations still fail.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend `/events` contracts now distinguish clean user payloads, admin suppression counts, and persisted manual override history flags required by the Phase 32 frontend follow-up.
- Ready for `32-manual-override-boundary-contract-02-PLAN.md` and the required browser/API handoff that verifies manual overrides remain allowed while bogus projected history stays suppressed.

---
*Phase: 32-manual-override-boundary-contract*
*Completed: 2026-03-10*

## Self-Check: PASSED

- FOUND: `.planning/phases/32-manual-override-boundary-contract/32-manual-override-boundary-contract-01-SUMMARY.md`
- FOUND: `2f275e6`
- FOUND: `577e495`
