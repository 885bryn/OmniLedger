---
phase: 37-exceptions-trends-and-dashboard-polish
plan: "01"
subsystem: ui
tags: [dashboard, react, vitest, i18n, right-rail, exceptions]

requires:
  - phase: 36-action-queue-and-financial-snapshot-02
    provides: reusable dashboard financial snapshot baseline and direct /items/:itemId handoff patterns
provides:
  - Dashboard body refactor with a queue-dominant 60/40 desktop hierarchy
  - Right-rail portfolio cards with overdue linked-row exception treatment
  - Calm exception notice surface powered by existing event and item query data
affects: [dashboard, phase-37-plan-02, item-detail-navigation, responsive-hierarchy]

tech-stack:
  added: []
  patterns:
    - Dashboard right rail should host supporting portfolio and exception context instead of duplicating queue rows
    - Asset exception treatment should derive from linked pending event state without expanding backend contracts

key-files:
  created:
    - frontend/src/features/dashboard/dashboard-exception-notices.tsx
  modified:
    - frontend/src/pages/dashboard/dashboard-page.tsx
    - frontend/src/__tests__/dashboard-information-architecture.test.tsx
    - frontend/src/__tests__/dashboard-financial-snapshot.test.tsx
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json

key-decisions:
  - "Removed the legacy dashboard financial snapshot surface entirely so Needs Attention remains the single primary operational list."
  - "Moved portfolio cards and the new exception notice panel into the dashboard right rail while keeping Recent Activity as a lower-priority companion section below the body."
  - "Derived overdue asset alerts from linked financial-item relationships already present on item records instead of introducing new API fields."

patterns-established:
  - "Dashboard de-duplication: when the queue already represents due work, supporting context belongs in secondary surfaces rather than another list."
  - "Portfolio cards may escalate with destructive styling and a Needs Attention badge when linked overdue rows exist."

requirements-completed: [DASH-07, DASH-09]

duration: 8 min
completed: 2026-03-13
---

# Phase 37 Plan 01: Exceptions, Trends, and Dashboard Polish Summary

**The dashboard now removes the duplicate financial snapshot list, pairs the action queue with a right-rail portfolio companion, and surfaces linked overdue/manual-override exceptions from existing data.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-13T00:52:58Z
- **Completed:** 2026-03-13T01:01:01Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added regression coverage that locks dashboard de-duplication, right-rail hierarchy, and overdue asset exception visibility.
- Rebuilt the dashboard body so `Needs Attention` stays primary while `Portfolio snapshot` and `Exceptions and notices` live together in the right rail.
- Added linked overdue treatment on portfolio cards and a calm notice panel driven entirely from existing dashboard event/item query state.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add regression guards for dashboard de-duplication and right-rail hierarchy** - `c09d201` (test)
2. **Task 2: Refactor dashboard body to 60/40 queue-plus-portfolio with exception notices** - `a096b90` (feat)

**Plan metadata:** Pending final docs commit

## Files Created/Modified
- `frontend/src/features/dashboard/dashboard-exception-notices.tsx` - New calm notice panel for overdue and manual-override signals.
- `frontend/src/pages/dashboard/dashboard-page.tsx` - Dashboard layout refactor, right-rail composition, and linked asset exception treatment.
- `frontend/src/__tests__/dashboard-information-architecture.test.tsx` - Hierarchy and overdue asset regressions.
- `frontend/src/__tests__/dashboard-financial-snapshot.test.tsx` - Guard that the old dashboard snapshot surface no longer renders.
- `frontend/src/locales/en/common.json` - English copy for new exception and portfolio states.
- `frontend/src/locales/zh/common.json` - Chinese copy for new exception and portfolio states.

## Decisions Made
- Removed the legacy dashboard financial snapshot list instead of visually hiding it so the queue remains the only operational due-work list.
- Kept Recent Activity outside the right rail and below the dashboard body so the new portfolio-plus-exceptions rail stays focused and mobile order remains queue -> portfolio -> notices -> activity.
- Used linked asset ids already present on financial items to compute overdue card escalation with no backend contract change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected regression fixtures to match real linked-asset and overdue relationships**
- **Found during:** Task 2 (Refactor dashboard body to 60/40 queue-plus-portfolio with exception notices)
- **Issue:** One new regression expected an overdue alert on an asset whose linked mock event was actually upcoming, and the portfolio-only regression fixture did not include any asset rows.
- **Fix:** Updated the tests to point the overdue assertion at the asset with the actual overdue linked row and added the matching asset fixture required for portfolio-card coverage.
- **Files modified:** `frontend/src/__tests__/dashboard-information-architecture.test.tsx`, `frontend/src/__tests__/dashboard-financial-snapshot.test.tsx`
- **Verification:** `npm --prefix frontend run test -- dashboard-information-architecture dashboard-financial-snapshot dashboard-action-queue`
- **Committed in:** `a096b90`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix kept the new regressions aligned with real dashboard data relationships and did not expand scope.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 37 Plan 01 is complete and the dashboard hierarchy is now ready for the trend-context and microcopy precision work in Plan 02.
- DASH-08 remains open for the next plan's compact trend and recent-activity polish work.

---
*Phase: 37-exceptions-trends-and-dashboard-polish*
*Completed: 2026-03-13*

## Self-Check: PASSED
- FOUND: `.planning/phases/37-exceptions-trends-and-dashboard-polish/37-exceptions-trends-and-dashboard-polish-01-SUMMARY.md`
- FOUND commit: `c09d201`
- FOUND commit: `a096b90`
