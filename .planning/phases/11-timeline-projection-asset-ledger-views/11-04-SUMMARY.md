---
phase: 11-timeline-projection-asset-ledger-views
plan: 04
subsystem: ui
tags: [asset-ledger, timeline, events, mobile]

requires:
  - phase: 11-timeline-projection-asset-ledger-views
    provides: timeline source-state badges and projected/persisted event contracts
provides:
  - Asset detail commitments tab now renders occurrence-ledger sections split into Current & Upcoming and Historical Ledger.
  - Ledger sections expose compact record-count and signed-total summaries with plain empty-state copy.
  - Historical Ledger is collapsed by default on mobile while staying expanded on desktop.
affects: [item-detail-page, phase-12-lifecycle, timeline-ledger-ux]

tech-stack:
  added: []
  patterns: [owner-scoped ledger occurrence fetch, sectioned ledger summaries, mobile-first historical collapse controls]

key-files:
  created: [frontend/src/__tests__/item-detail-ledger.test.tsx, .planning/phases/11-timeline-projection-asset-ledger-views/11-04-SUMMARY.md]
  modified: [frontend/src/pages/items/item-detail-page.tsx, frontend/src/lib/query-keys.ts, frontend/src/locales/en/common.json, frontend/src/locales/zh/common.json]

key-decisions:
  - "Asset detail ledger reads owner-scoped /events rows and filters by linked financial item IDs to keep sectioning deterministic and cache-safe."
  - "Current & Upcoming classification uses status/date semantics: pending or future-facing rows stay actionable; settled past rows move to Historical Ledger."
  - "Historical Ledger defaults collapsed only on mobile viewport, with explicit toggle copy and desktop always expanded for scanability."

patterns-established:
  - "Item ledger query keys now use queryKeys.items.itemLedger(itemId, params) so occurrence fetch invalidation stays item-scoped and stable."
  - "Ledger section summaries are computed from event rows with income-positive and commitment-negative signed totals."

requirements-completed: [TIME-03, TIME-02]

duration: 7 min
completed: 2026-02-28
---

# Phase 11 Plan 04: Split Asset Ledger Views Summary

**Asset detail now renders linked financial occurrences as a split ledger with state badges, signed section totals, and mobile-collapsed historical records.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-28T02:38:16.758Z
- **Completed:** 2026-02-28T02:45:31.747Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Replaced flat linked-financial list rendering in item detail with deterministic Current & Upcoming vs Historical Ledger occurrence sections.
- Added owner-scoped occurrence fetch wiring and stable `queryKeys.items.itemLedger` contract for the ledger data path.
- Surfaced projected/persisted/edited-occurrence badges on every rendered ledger row while preserving links to parent financial item details.
- Added per-section summary context (record count + signed total), plain empty-state copy, and mobile-default historical collapse UX.
- Added dedicated regression coverage for section split logic, state markers, summary totals, mobile collapse default, and empty-state behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor asset commitments tab into split occurrence ledger sections** - `8d8c944` (feat)
2. **Task 2: Add section summaries, mobile historical collapse default, and plain empty-state copy** - `dc1ceed` (feat)

## Files Created/Modified
- `frontend/src/pages/items/item-detail-page.tsx` - Added owner-scoped ledger occurrence query, deterministic split logic, row state badges, section summaries, and mobile historical collapse behavior.
- `frontend/src/lib/query-keys.ts` - Added `queryKeys.items.itemLedger` contract for stable item-ledger occurrence fetching.
- `frontend/src/locales/en/common.json` - Added ledger section labels, summary text, collapse controls, and plain empty-state copy.
- `frontend/src/locales/zh/common.json` - Added localized ledger section labels, summary text, collapse controls, and plain empty-state copy.
- `frontend/src/__tests__/item-detail-ledger.test.tsx` - Added regression tests for split rules, mobile-collapse default, summary totals, and empty-state messaging.

## Decisions Made
- Keep ledger section split semantics aligned to timeline intent by treating pending/future rows as actionable and completed past rows as historical.
- Keep state cues consistent with events page by reusing projected/persisted/edited badge language in item-ledger rows.
- Preserve desktop scanability by keeping historical rows open on desktop while default-collapsing only on mobile.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TIME-03 split-ledger UX expectations are implemented with deterministic behavior and regression coverage.
- Deletion lifecycle and retention controls were added during the Phase 11 extension work; no standalone Phase 12 planning track is required.

## Self-Check: PASSED

- FOUND: `.planning/phases/11-timeline-projection-asset-ledger-views/11-04-SUMMARY.md`
- FOUND: `8d8c944`
- FOUND: `dc1ceed`
