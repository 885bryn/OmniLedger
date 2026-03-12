---
phase: 36-action-queue-and-financial-snapshot
plan: 01
subsystem: ui
tags: [dashboard, react, vitest, i18n, queue]

# Dependency graph
requires:
  - phase: 35-dashboard-information-architecture
    provides: dashboard shell hierarchy, monthly summary-card contracts, and existing /events and item-detail pathways
provides:
  - urgency-first dashboard action queue split into Overdue and Upcoming sections with section counts
  - deterministic queue ordering (oldest overdue first, nearest upcoming first) with a strict 14-day upcoming scope
  - overdue age-bucket labels (1-7d, 8-30d, 30+d) and direct handoff links into /events and /items/:itemId
affects: [phase-36-plan-02-financial-snapshot, dashboard-triage-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [dashboard queue section contracts, day-bucket urgency labeling, dashboard row link handoff with return state]

key-files:
  created: [frontend/src/features/dashboard/dashboard-action-queue.tsx, frontend/src/__tests__/dashboard-action-queue.test.tsx]
  modified: [frontend/src/pages/dashboard/dashboard-page.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json, frontend/src/__tests__/dashboard-information-architecture.test.tsx]

key-decisions:
  - "Implemented queue ordering from calendar-day offsets so overdue and upcoming sections stay deterministic across timezone boundaries."
  - "Kept queue handoff inside existing workflows by linking rows to /events and /items/:itemId with preserved return state instead of adding new write actions."

patterns-established:
  - "Dashboard queue rows should be rendered in explicit overdue/upcoming sections with independent counts and fixed sorting rules."
  - "Upcoming dashboard triage is intentionally horizon-bound (14 days) to reduce noise while preserving /events as the full ledger continuation path."

requirements-completed: [DASH-04, DASH-06]

# Metrics
duration: 5 min
completed: 2026-03-12
---

# Phase 36 Plan 01: Action Queue and Financial Snapshot Summary

**Dashboard triage now ships as a dedicated action queue with overdue-first urgency ordering, explicit age buckets, and a 14-day upcoming horizon that routes directly into existing event and item workflows.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T00:59:52Z
- **Completed:** 2026-03-12T01:05:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added a focused queue regression suite before refactor work to lock section split, ordering, age buckets, and workflow link expectations.
- Replaced the generic Needs Attention list with a dedicated `DashboardActionQueue` component wired into the dashboard body.
- Enforced locked queue behavior: Overdue first (oldest overdue first), Upcoming second (nearest due first, due within 14 days only).
- Added explicit overdue age-band labels (`1-7d`, `8-30d`, `30+d`) for scanability under heavy overdue volume.
- Updated English and Chinese locale copy for upcoming section and age-bucket labels.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add queue-focused frontend regressions before queue refactor** - `81b76fc` (test)
2. **Task 2: Implement the urgency-first dashboard action queue** - `26a17ef` (feat)

## Files Created/Modified
- `frontend/src/__tests__/dashboard-action-queue.test.tsx` - New regression suite for queue sectioning, sorting, 14-day horizon, and route handoffs.
- `frontend/src/features/dashboard/dashboard-action-queue.tsx` - Dedicated queue component with overdue/upcoming sections, counts, ordering, and age buckets.
- `frontend/src/pages/dashboard/dashboard-page.tsx` - Replaces old attention component usage with queue wiring and queue-specific labels.
- `frontend/src/locales/en/common.json` - Adds queue-specific copy for upcoming section and age-bucket labels.
- `frontend/src/locales/zh/common.json` - Adds parallel Chinese queue copy.
- `frontend/src/__tests__/dashboard-information-architecture.test.tsx` - Updates dashboard architecture regressions to the queue-section contract.

## Decisions Made
- Used deterministic day-offset classification for queue rows so overdue and upcoming sections remain stable at calendar-day boundaries.
- Kept all triage actions within existing contracts by linking rows to existing `/events` and `/items/:itemId` workflows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated architecture regressions to match the new queue model**
- **Found during:** Task 2 (Implementation verification)
- **Issue:** Existing `dashboard-information-architecture` tests still asserted filter-tab and preview-cap behavior from the old generic list and blocked required verification.
- **Fix:** Replaced outdated assertions with queue-section assertions aligned to the locked Overdue/Upcoming + 14-day horizon behavior.
- **Files modified:** `frontend/src/__tests__/dashboard-information-architecture.test.tsx`
- **Verification:** `npm --prefix frontend run test -- dashboard-action-queue dashboard-information-architecture`
- **Committed in:** `26a17ef` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The deviation was required to keep the verification suite aligned with the intentional queue refactor; no scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Queue contracts for DASH-04 and DASH-06 are in place and regression-locked.
- Plan 02 can focus on the financial snapshot expansion on top of this queue foundation.

---
*Phase: 36-action-queue-and-financial-snapshot*
*Completed: 2026-03-12*

## Self-Check: PASSED

- Verified `.planning/phases/36-action-queue-and-financial-snapshot/36-action-queue-and-financial-snapshot-01-SUMMARY.md` exists.
- Verified task commits `81b76fc` and `26a17ef` exist in repository history.
