---
phase: 10-financial-contract-occurrence-foundation
plan: 04
subsystem: ui
tags: [events, recurrence, react-query, i18n, financial-item]
requires:
  - phase: 10-financial-contract-occurrence-foundation
    provides: Projection-on-read occurrence rows plus projected completion materialization from plans 10-02 and 10-03
provides:
  - Upcoming-first events view with clearly separated history section on the same surface
  - Compact inline status actions supporting complete and undo transitions with safe confirmation
  - Plain-language recurrence context in events rows and Financial item detail header
affects: [phase-11-timeline-projection, events-ui, item-detail-ui, recurrence-copy]
tech-stack:
  added: []
  patterns: [upcoming-history-sectioning, inline-status-transition-controls, recurrence-plain-language-copy]
key-files:
  created: []
  modified:
    - frontend/src/pages/events/events-page.tsx
    - frontend/src/features/events/complete-event-row-action.tsx
    - frontend/src/pages/items/item-detail-page.tsx
    - frontend/src/lib/query-keys.ts
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json
    - frontend/src/__tests__/dashboard-events-flow.test.tsx
key-decisions:
  - "Events page now queries status=all and performs UI-level split into Current/Upcoming and History sections to keep one-page workflow while exposing historical rows."
  - "Inline row actions keep confirmation dialogs but default to direct status transitions (Complete/Undo) so projected and persisted rows share one safe mutation pattern."
  - "Recurrence messaging reuses frequency+status fields with localized plain-language copy to show next-date context when available and closed-contract suppression state otherwise."
patterns-established:
  - "Scope-aware event list params are generated through typed query-key helpers to keep URLSearchParams-compatible shapes across dashboard and events pages."
  - "Events regression suite now validates post-mutation refresh state (pending -> completed) and closed-contract recurrence copy in grouped sections."
requirements-completed: [FIN-02, FIN-04, FIN-06]
duration: 6 min
completed: 2026-02-26
---

# Phase 10 Plan 04: Occurrence Management UI Behavior Summary

**Occurrence management now ships upcoming-first and history-separated event sections with inline complete/undo controls and plain-language recurrence context across events and Financial item detail surfaces.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-26T21:40:00Z
- **Completed:** 2026-02-26T21:46:23Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Reworked `/events` rendering to fetch scoped `status=all` rows, split upcoming/current vs history sections, and preserve compact per-row interaction density.
- Added inline status transitions (`Complete` / `Undo`) via the existing confirmation flow so status-first edits remain safe and consistent.
- Surfaced recurrence state as localized plain-language copy in event rows, including explicit closed-contract messaging when future projections are suppressed.
- Added Financial item detail recurrence summary copy so contract context communicates frequency and next occurrence expectations directly in the header.
- Expanded dashboard/events regression tests to lock grouped rendering, inline undo behavior, and post-mutation refresh visibility.

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement upcoming-first and history-separated occurrence sections with compact inline actions** - `037e900` (feat)
2. **Task 2: Surface recurrence plain-language state and closed-contract behavior in detail and events surfaces** - `9366522` (feat)

## Files Created/Modified

- `frontend/src/pages/events/events-page.tsx` - Added `status=all` fetch, upcoming/history grouping, recurrence badges, and inline action wiring.
- `frontend/src/features/events/complete-event-row-action.tsx` - Added dual-mode complete/undo mutation behavior with status-aware labels and confirmations.
- `frontend/src/pages/items/item-detail-page.tsx` - Added localized recurrence summary near Financial item parent context.
- `frontend/src/lib/query-keys.ts` - Added typed event-list param helper and normalized scope param return typing.
- `frontend/src/locales/en/common.json` - Added grouped-section, status-action, and recurrence copy in English.
- `frontend/src/locales/zh/common.json` - Added grouped-section, status-action, and recurrence copy in Chinese.
- `frontend/src/__tests__/dashboard-events-flow.test.tsx` - Added grouped rendering, undo action, and post-mutation refresh assertions.

## Decisions Made

- Kept both upcoming and history occurrences in one page with explicit section headers rather than route-level split to preserve operator flow speed.
- Used status-driven inline controls (`Complete`/`Undo`) instead of broader edit affordances to enforce the default-safe mutation model.
- Represented recurrence context with localized frequency text and optional next-date interpolation, falling back to closed/no-upcoming text when needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected verify command to run build script on npm prefix projects**
- **Found during:** Task 2 verification
- **Issue:** `npm --prefix frontend build` is unsupported by current npm CLI and failed before the actual build could run.
- **Fix:** Executed equivalent supported command `npm --prefix frontend run build` for verification.
- **Files modified:** None
- **Verification:** `npm --prefix frontend run build`
- **Committed in:** N/A (execution-path fix)

**2. [Rule 3 - Blocking] Fixed scoped query param typing for URLSearchParams compatibility**
- **Found during:** Task 2 verification
- **Issue:** TypeScript build failed because scoped param helpers inferred optional `lens_user_id` with `undefined`, which is incompatible with `URLSearchParams` record input.
- **Fix:** Added explicit `Record<string, string>` return types for scope/event param helpers.
- **Files modified:** `frontend/src/lib/query-keys.ts`
- **Verification:** `npm --prefix frontend run build`
- **Committed in:** `9366522`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were execution/correctness unblockers and did not change intended product scope.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Events and detail surfaces now expose the recurrence and lifecycle context needed for Phase 11 timeline projection and ledger split work.
- Closed-contract projection stop behavior is now visible in UI copy and protected by regression coverage.

---
*Phase: 10-financial-contract-occurrence-foundation*
*Completed: 2026-02-26*

## Self-Check: PASSED

- Verified file exists: `.planning/phases/10-financial-contract-occurrence-foundation/10-04-SUMMARY.md`
- Verified commits exist: `037e900`, `9366522`
