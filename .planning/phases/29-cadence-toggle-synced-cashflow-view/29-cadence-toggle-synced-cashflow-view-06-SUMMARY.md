---
phase: 29-cadence-toggle-synced-cashflow-view
plan: "06"
subsystem: api
tags: [events, cadence, cashflow, net-status, jest]
requires:
  - phase: 29-05
    provides: cadence card wording and synced client rendering backed by net-status contract
provides:
  - Event-occurrence inclusion gate for commitment and income rollups across weekly/monthly/yearly active periods
  - Completion-agnostic cadence aggregation using financial-item event due dates
  - Domain and API regressions preventing reversion to due-date-anchor inclusion logic
affects: [net-status-api, cadence-summary-rollups, item-detail-cashflow-cards]
tech-stack:
  added: []
  patterns:
    - Financial-item inclusion is event-driven by in-period event occurrences rather than item due-date anchors
    - Recurring and one-time summary rows are admitted only when matching active-period event evidence exists
key-files:
  created: []
  modified:
    - src/domain/items/get-item-net-status.js
    - test/domain/items/get-item-net-status.test.js
    - test/api/items-net-status.test.js
key-decisions:
  - "Query Event rows by financial item id and derive cadence inclusion from event due_date period membership."
  - "Keep one-time rows monthly-scoped by requiring a monthly-period event while leaving completion status out of inclusion."
patterns-established:
  - "Event-first rollups: summary cards trust event occurrences as source-of-truth for period inclusion."
  - "Regression lock: domain and route tests both assert event-driven inclusion parity for commitments and income."
requirements-completed: [CASH-03, VIEW-02]
duration: 5 min
completed: 2026-03-09
---

# Phase 29 Plan 06: Cadence Toggle Synced Cashflow View Summary

**Cadence rollups now include commitments and income based on in-period financial events (including incomplete events), so recurring totals and net cashflow reflect actual event occurrence timing instead of item due-date anchors.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T07:03:45Z
- **Completed:** 2026-03-09T07:09:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Reworked net-status inclusion logic to join financial items to their Event rows and admit rows only when events occur inside active weekly/monthly/yearly boundaries.
- Preserved completion-agnostic behavior by counting both pending and completed events for cadence inclusion and keeping net derived from the same included income/obligation set.
- Added domain and API regression scenarios that prove event-driven monthly carry-forward, yearly-in-month filtering, and stable contract metadata.

## Task Commits

Each task was committed atomically:

1. **Task 1: Switch cadence inclusion from due-date anchor to in-period event occurrences** - `c6c17e5` (feat)
2. **Task 2: Lock event-driven cadence behavior with domain and API regression cases** - `e4ced76` (fix)

**Plan metadata:** Pending final docs commit

## Files Created/Modified
- `src/domain/items/get-item-net-status.js` - Added event lookup by `item_id`, cadence-period event inclusion mapping, and event-driven summary row admission.
- `test/domain/items/get-item-net-status.test.js` - Added deterministic domain regressions for event-driven inclusion parity and incomplete-event handling.
- `test/api/items-net-status.test.js` - Added route-level regressions for event-occurrence cadence totals, yearly-in-month behavior, and updated one-time rule metadata assertions.

## Decisions Made
- Use Event table due dates as the period-inclusion source of truth for cadence totals instead of financial-item due-date anchors.
- Keep one-time rows aligned to monthly active-period events while recurring cadence totals remain event-driven across weekly/monthly/yearly periods.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored monthly-only gate for one-time event inclusion**
- **Found during:** Task 2 (Lock event-driven cadence behavior with domain and API regression cases)
- **Issue:** Initial event-driven refactor admitted one-time rows when events existed elsewhere in the same year, causing monthly summaries to include out-of-month one-time values.
- **Fix:** Added one-time monthly inclusion guard (`includedInCadence.monthly`) while retaining event-driven recurring cadence behavior.
- **Files modified:** `src/domain/items/get-item-net-status.js`, `test/api/items-net-status.test.js`
- **Verification:** `npm test -- test/domain/items/get-item-net-status.test.js test/api/items-net-status.test.js --runInBand`
- **Committed in:** `e4ced76` (part of task commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was required for correctness of monthly one-time rollups and kept scope inside planned event-driven inclusion work.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Net-status cadence totals now enforce event-driven inclusion for commitments and income with completion-agnostic behavior.
- Ready for plan 29-07 execution.

## Self-Check: PASSED
