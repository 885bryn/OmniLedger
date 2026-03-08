---
phase: 27-frequency-rule-contract
plan: "03"
subsystem: api
tags: [cashflow, one_time, active_period, regression]

requires:
  - phase: 27-frequency-rule-contract
    provides: One-time monthly inclusion contract and summary metadata from plans 27-01 and 27-02
provides:
  - Explicit active-month containment helper for one-time summary inclusion checks
  - Regression coverage for March summary excluding May one-time obligations while keeping in-period inclusion
affects: [28-cadence-normalized-totals, item-net-status]

tech-stack:
  added: []
  patterns: [active-month containment helper, fixed-time API regression for period leaks]

key-files:
  created: []
  modified:
    - src/domain/items/get-item-net-status.js
    - test/api/items-net-status.test.js

key-decisions:
  - "One-time due-date inclusion now requires both inclusive day-bound checks and explicit active month/year alignment."
  - "Cross-period regression uses a fixed March system clock so May leakage remains reproducible and protected over time."

patterns-established:
  - "One-time period gates should use active-period helper functions instead of inline date comparisons."
  - "Regression tests for period contracts should freeze system time to avoid calendar drift."

requirements-completed: [CASH-04]

duration: 3 min
completed: 2026-03-08
---

# Phase 27 Plan 03: Frequency Rule Contract Summary

**Monthly net-status summaries now strictly exclude future-month one-time obligations until their due month while preserving in-period one-time inclusion and recurring baseline behavior.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T00:55:05Z
- **Completed:** 2026-03-08T00:58:18Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Hardened one-time inclusion logic in net-status so active-period checks require full monthly containment (inclusive day bounds plus matching year/month).
- Added focused API regression coverage for the reported leak scenario where a May one-time obligation must not affect March summary totals.
- Paired exclusion regression with a positive in-period one-time control to validate both sides of the period contract in one scenario.

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix one-time active-period gate for future-month exclusion** - `1f8d71b` (fix)
2. **Task 2: Add focused regression tests for cross-period one-time behavior** - `516c96a` (test)

## Files Created/Modified

- `src/domain/items/get-item-net-status.js` - Added reusable active-month containment helper and stricter one-time gate conditions.
- `test/api/items-net-status.test.js` - Added fixed-March regression test proving May one-time exclusion and March one-time inclusion.

## Decisions Made

- Used an explicit helper for one-time active-period membership to keep month/year/day containment logic centralized and less error-prone.
- Froze system time inside the regression test to keep March/May behavior deterministic regardless of when the suite runs.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 27 now has leak coverage for future-month one-time exclusion and is ready to feed cadence-normalized totals work in Phase 28.
- No blockers found for moving to the next plan/phase sequence.

---
*Phase: 27-frequency-rule-contract*
*Completed: 2026-03-08*

## Self-Check: PASSED

- FOUND: `.planning/phases/27-frequency-rule-contract/27-frequency-rule-contract-03-SUMMARY.md`
- FOUND: `1f8d71b`
- FOUND: `516c96a`
