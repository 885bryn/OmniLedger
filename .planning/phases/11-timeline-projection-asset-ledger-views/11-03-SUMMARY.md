---
phase: 11-timeline-projection-asset-ledger-views
plan: 03
subsystem: ui
tags: [timeline, projected-state, exceptions, events]

requires:
  - phase: 11-timeline-projection-asset-ledger-views
    provides: projected edit mutation persistence contract and explicit source-state event payloads
provides:
  - Timeline rows now show explicit projected versus persisted badges with section legends and persisted-first same-date ordering.
  - Projected occurrence edits now use a save-exception confirmation flow with inline change summaries.
  - Edited exceptions render in-place as persisted rows with durable edited-occurrence indicators after refetch.
affects: [phase-11-plan-04, events-page, timeline-ux]

tech-stack:
  added: []
  patterns: [shared source-state comparator tie-break, projected edit confirmation UX, query invalidation-driven in-place mutation refresh]

key-files:
  created: [frontend/src/features/events/edit-event-row-action.tsx, .planning/phases/11-timeline-projection-asset-ledger-views/11-03-SUMMARY.md]
  modified: [frontend/src/lib/date-ordering.ts, frontend/src/pages/events/events-page.tsx, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json, frontend/src/__tests__/dashboard-events-flow.test.tsx]

key-decisions:
  - "Timeline rows render both source-state badges and section legends so projected/persisted meaning stays explicit without redesigning grouped chronology."
  - "Projected row edits use a dedicated Save exception CTA and explain persisted exception creation before mutation commit."
  - "Edited occurrence success is communicated through in-place refetch state (`is_exception`) rather than an extra success toast."

patterns-established:
  - "Events page uses isProjectedEvent() fallback logic (source_state -> is_projected -> id prefix) to keep source-state rendering resilient across mixed payloads."
  - "Edit mutation surfaces validation/policy failures inline while preserving existing global safety-toast behavior for policy denials."

requirements-completed: [TIME-01, TIME-02, FIN-05]

duration: 6 min
completed: 2026-02-28
---

# Phase 11 Plan 03: Timeline State Cues and Projected Edit UX Summary

**Events timeline now displays explicit projected/persisted state markers with persisted-first same-date ordering, and projected row edits persist through a Save exception flow that returns as in-place Edited occurrence state.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-28T01:30:57Z
- **Completed:** 2026-02-28T01:37:18Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added projected/persisted row badges plus inline legends on both Current & Upcoming and History sections.
- Updated shared due-date comparator to keep persisted rows ahead of projected rows for same-date ties.
- Implemented row-level projected edit confirmation with Save exception CTA and date/amount change summary (`old -> new`).
- Added edited-occurrence indicator rendering for persisted exception rows and expanded timeline regression coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add explicit projected/persisted timeline cues with deterministic same-date ordering** - `c1fab08` (feat)
2. **Task 2: Deliver projected edit confirmation flow with in-place exception persistence feedback** - `acbed4a` (feat)

## Files Created/Modified
- `frontend/src/lib/date-ordering.ts` - Added persisted-before-projected tie-break ranking in shared nearest-due comparator.
- `frontend/src/pages/events/events-page.tsx` - Rendered source-state badges/legend, integrated row edit action, and surfaced edited-occurrence markers.
- `frontend/src/features/events/edit-event-row-action.tsx` - Added projected-aware edit confirmation dialog and PATCH mutation invalidation flow.
- `frontend/src/locales/en/common.json` - Added timeline state legend and projected edit UX copy.
- `frontend/src/locales/zh/common.json` - Added localized projected/persisted legend and projected edit confirmation copy.
- `frontend/src/__tests__/dashboard-events-flow.test.tsx` - Added regressions for legend/order guarantees and projected edit exception UX behavior.

## Decisions Made
- Kept timeline grouped-by-date structure and injected state clarity via badges + legend instead of introducing a new flat layout.
- Used explicit Save exception CTA only for projected rows while keeping persisted-row edits on Save changes wording.
- Kept edit success feedback state-driven (refetch + Edited occurrence marker) and reserved toast channel for policy-denial safety signals.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected frontend build command invocation during task verification**
- **Found during:** Task 2 verification
- **Issue:** `npm --prefix frontend build` is not a valid npm invocation and exited before build execution.
- **Fix:** Re-ran verification using `npm --prefix frontend run build`.
- **Files modified:** None (command-only correction)
- **Verification:** `npm --prefix frontend test -- src/__tests__/dashboard-events-flow.test.tsx && npm --prefix frontend run build`
- **Committed in:** N/A (no code change)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Verification flow remained complete; no scope creep and no implementation changes required.

## Issues Encountered
- Initial verification command used invalid npm subcommand form for build; reran with `npm run build` form and completed successfully.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Timeline state communication and projected edit exception UX are in place and regression-covered.
- Phase 11-04 can now focus on asset ledger section split (Current & Upcoming vs Historical) without timeline source-state ambiguity.

## Self-Check: PASSED

- FOUND: `.planning/phases/11-timeline-projection-asset-ledger-views/11-03-SUMMARY.md`
- FOUND: `c1fab08`
- FOUND: `acbed4a`
