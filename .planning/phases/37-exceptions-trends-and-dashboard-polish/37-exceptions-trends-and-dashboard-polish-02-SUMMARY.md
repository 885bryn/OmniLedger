---
phase: 37-exceptions-trends-and-dashboard-polish
plan: "02"
subsystem: ui
tags: [dashboard, react, vitest, i18n, recent-activity, trend-strip]

requires:
  - phase: 37-exceptions-trends-and-dashboard-polish-01
    provides: deduplicated dashboard hierarchy with right-rail portfolio and exception surfaces
provides:
  - Compact audit-log Recent Activity presentation with reduced visual weight
  - Active-period trend strip derived from existing pending and completed event datasets
  - Locked dashboard summary microcopy regressions that preserve exact date-boundary wording
affects: [dashboard, dashboard-copy, responsive-hierarchy, phase-closeout]

tech-stack:
  added: []
  patterns:
    - Recent Activity should stay readable but visually subordinate to Needs Attention through denser audit-log styling
    - Supporting trend context should be computed from existing dashboard event datasets instead of new backend contracts

key-files:
  created:
    - frontend/src/features/dashboard/dashboard-activity-trend-strip.tsx
  modified:
    - frontend/src/pages/dashboard/dashboard-page.tsx
    - frontend/src/features/dashboard/dashboard-recent-activity.tsx
    - frontend/src/features/dashboard/dashboard-action-queue.tsx
    - frontend/src/__tests__/dashboard-information-architecture.test.tsx
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json

key-decisions:
  - "Kept Recent Activity as a compact audit log with lower-contrast density so the dashboard queue remains the dominant operational surface."
  - "Derived the new activity trend strip from existing pending and completed event collections rather than expanding dashboard API contracts."
  - "Preserved Current position support copy verbatim, including exact date-boundary phrasing, and locked it with literal regression coverage."

patterns-established:
  - "Dashboard support context belongs in narrow, information-dense companions instead of full-height competing panels."
  - "Summary precision copy should be protected by literal UI regressions when wording carries financial boundary meaning."

requirements-completed: [DASH-08, DASH-09]

duration: 16 min
completed: 2026-03-13
---

# Phase 37 Plan 02: Exceptions, Trends, and Dashboard Polish Summary

**The dashboard now presents Recent Activity as a compact audit log, adds an active-period trend strip from existing event data, and keeps Current position copy locked to exact date-boundary wording.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-13T01:08:12Z
- **Completed:** 2026-03-13T01:24:54Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added regressions that fail on compact-activity drift, missing trend context, or simplified Current position support copy.
- Refactored dashboard composition so Recent Activity reads as a secondary audit-log surface and introduced a lightweight trend strip using existing dashboard datasets.
- Applied a final crowding fix that reduced queue density pressure and preserved the intended hierarchy before browser approval.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add polish regressions for compact activity, trend context, and locked summary microcopy** - `66a08c5` (test)
2. **Task 2: Implement compact audit-log activity and supporting trend strip** - `42ee591` (feat)
3. **Task 2 follow-up: Ease dashboard rail crowding and upcoming queue depth before approval** - `c223577` (fix)

**Plan metadata:** Pending final docs commit

## Files Created/Modified
- `frontend/src/features/dashboard/dashboard-activity-trend-strip.tsx` - New compact trend/timeline companion for active-period context.
- `frontend/src/features/dashboard/dashboard-recent-activity.tsx` - Recent Activity restyled into a denser audit-log presentation.
- `frontend/src/pages/dashboard/dashboard-page.tsx` - Dashboard wiring for the new trend strip and compact activity placement.
- `frontend/src/features/dashboard/dashboard-action-queue.tsx` - Follow-up queue density adjustments to protect hierarchy and balance.
- `frontend/src/__tests__/dashboard-information-architecture.test.tsx` - Literal regressions for trend context, compact activity profile, and exact summary microcopy.
- `frontend/src/locales/en/common.json` - English copy for the trend strip and follow-up queue wording.
- `frontend/src/locales/zh/common.json` - Chinese copy for the trend strip and follow-up queue wording.

## Decisions Made
- Kept Recent Activity intentionally compact and low-contrast so `Needs Attention` remains the primary task surface.
- Used existing pending/completed dashboard event datasets to build trend context without changing backend contracts.
- Treated exact Current position wording as product contract copy and locked full date-boundary phrases in tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reduced dashboard crowding after the initial trend-strip rollout**
- **Found during:** Task 2 (Implement compact audit-log activity and supporting trend strip)
- **Issue:** The first implementation left the queue and supporting surfaces feeling too crowded, weakening the intended hierarchy at tighter widths before final browser sign-off.
- **Fix:** Tightened queue depth and supporting layout spacing, updated supporting copy, and extended regressions to protect the calmer hierarchy.
- **Files modified:** `frontend/src/features/dashboard/dashboard-action-queue.tsx`, `frontend/src/pages/dashboard/dashboard-page.tsx`, `frontend/src/__tests__/dashboard-information-architecture.test.tsx`, `frontend/src/locales/en/common.json`, `frontend/src/locales/zh/common.json`
- **Verification:** `npm --prefix frontend run test -- dashboard-information-architecture dashboard-action-queue` and browser approval at the final checkpoint.
- **Committed in:** `c223577`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The follow-up stayed inside phase scope and improved hierarchy clarity without expanding contracts or features.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 37 is complete and the dashboard redesign now includes exceptions, trend context, and responsive polish with preserved precision copy.
- v4.4 is ready for milestone closeout or whatever follow-on dashboard work the roadmap selects next.

---
*Phase: 37-exceptions-trends-and-dashboard-polish*
*Completed: 2026-03-13*

## Self-Check: PASSED
- FOUND: `.planning/phases/37-exceptions-trends-and-dashboard-polish/37-exceptions-trends-and-dashboard-polish-02-SUMMARY.md`
- FOUND commit: `66a08c5`
- FOUND commit: `42ee591`
- FOUND commit: `c223577`
