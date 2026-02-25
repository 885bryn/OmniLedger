---
phase: 07-milestone-gap-closure
plan: 01
subsystem: ui
tags: [react-query, user-switcher, events, regression-tests]

requires:
  - phase: 06-6
    provides: dashboard/events/items journeys, completion action UI, and actor switcher shell wiring
provides:
  - Actor switch now purges actor-sensitive cache namespaces and triggers deterministic active-query refetch
  - Event completion flow branches on prompt_next_date payload and opens follow-up modal only when true
  - Regression coverage for prompt_next_date true/false branches plus actor-switch cache-refresh lifecycle
affects: [phase-07-gap-closure, frontend-query-lifecycle, evnt-03-ux-contract]

tech-stack:
  added: []
  patterns: [actor-sensitive query root helpers, payload-driven follow-up branching, cache purge plus active refetch]

key-files:
  created:
    - frontend/src/__tests__/user-switcher-cache-refresh.test.tsx
  modified:
    - frontend/src/app/shell/user-switcher.tsx
    - frontend/src/lib/query-keys.ts
    - frontend/src/features/events/complete-event-row-action.tsx
    - frontend/src/__tests__/dashboard-events-flow.test.tsx

key-decisions:
  - "Treat dashboard/events/items as explicit actor-sensitive query roots and purge them on actor changes."
  - "Drive follow-up modal visibility strictly from completion payload prompt_next_date instead of assumed client behavior."
  - "Route schedule-next action to /items/:itemId/edit when available, otherwise /items."

patterns-established:
  - "Actor switches should remove actor-sensitive cache entries before refetch to avoid cross-user stale flashes."
  - "Completion UX branches must be validated in tests for both prompt_next_date=true and prompt_next_date=false outcomes."

requirements-completed: [EVNT-03]

duration: 5 min
completed: 2026-02-25
---

# Phase 7 Plan 01: Milestone Gap Closure Summary

**Actor switch now force-refreshes actor-bound data while event completion correctly drives prompt-next-date follow-up UX from API payload semantics.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-25T10:00:05Z
- **Completed:** 2026-02-25T10:05:59Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added explicit actor-sensitive query roots and switched actor-change handling to cancel/remove/refetch dashboard/events/items namespaces.
- Wired completion success handling to `prompt_next_date` payload and integrated the follow-up modal schedule/not-now branches with actionable navigation.
- Added regression tests covering prompt-next-date true/false behavior, `Not now` dismissal, schedule navigation, and actor-switch cache lifecycle expectations.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enforce actor-switch cache purge and deterministic refetch across actor-sensitive queries** - `2cee388` (feat)
2. **Task 2: Wire completion payload to follow-up modal behavior with explicit Not now and schedule actions** - `b265ff7` (feat)
3. **Task 3: Add regression coverage for actor-switch refresh and prompt-next-date true/false branches** - `e0a9204` (test)

## Files Created/Modified
- `frontend/src/app/shell/user-switcher.tsx` - actor switch now clears actor-sensitive caches and triggers active refetch after actor change.
- `frontend/src/lib/query-keys.ts` - centralized actor-sensitive query root list for reuse.
- `frontend/src/features/events/complete-event-row-action.tsx` - completion branch opens follow-up modal only on `prompt_next_date: true` and routes schedule action.
- `frontend/src/__tests__/dashboard-events-flow.test.tsx` - regression assertions for true/false modal behavior plus schedule navigation path.
- `frontend/src/__tests__/user-switcher-cache-refresh.test.tsx` - user-switcher regression ensuring cache lifecycle methods run for actor-sensitive roots.

## Decisions Made
- Introduced `actorSensitiveQueryRoots` as shared query-key metadata to avoid hardcoded namespace arrays in UI handlers.
- Kept completion refresh behavior unchanged for both prompt branches and layered follow-up modal behavior on top.
- Used route navigation from follow-up schedule action so the button always performs real work in v1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated stale prompt-next-date test expectation during Task 2 verification**
- **Found during:** Task 2 verification command
- **Issue:** Existing regression expected modal hidden even when `prompt_next_date: true`, causing required verification to fail.
- **Fix:** Updated dashboard events regression to assert modal visibility for true branch and preserve false-branch hidden assertion.
- **Files modified:** `frontend/src/__tests__/dashboard-events-flow.test.tsx`
- **Verification:** `npm --prefix frontend run test -- dashboard-events-flow --runInBand`
- **Committed in:** `b265ff7`

**2. [Rule 1 - Bug] Prevented actor reset to null during users loading window**
- **Found during:** Task 3 regression implementation
- **Issue:** Actor-selection effect could clear active actor while users query was loading, risking transient wrong-header fetches.
- **Fix:** Gated actor-selection effect on `usersQuery.isLoading` and kept actor selection stable until users load resolves.
- **Files modified:** `frontend/src/app/shell/user-switcher.tsx`
- **Verification:** `npm --prefix frontend run test -- dashboard-events-flow user-switcher-cache-refresh --runInBand` and `npm --prefix frontend run typecheck`
- **Committed in:** `e0a9204`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were required to satisfy plan verification and preserve correctness of actor-scoped data refresh behavior.

## Authentication Gates

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- EVNT-03 frontend wiring is now restored with executable regression protection.
- Actor-switch cross-user stale-cache blocker is addressed for dashboard/events/items namespaces.
- Ready for `07-02-PLAN.md`.

---
*Phase: 07-milestone-gap-closure*
*Completed: 2026-02-25*

## Self-Check: PASSED
- FOUND: `.planning/phases/07-milestone-gap-closure/07-01-SUMMARY.md`
- FOUND: `2cee388`
- FOUND: `b265ff7`
- FOUND: `e0a9204`
