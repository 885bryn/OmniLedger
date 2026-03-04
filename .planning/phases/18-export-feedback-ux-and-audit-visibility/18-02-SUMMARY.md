---
phase: 18-export-feedback-ux-and-audit-visibility
plan: 02
subsystem: api
tags: [audit-log, exports, scope-attribution, activity-timeline, react]
requires:
  - phase: 17-workbook-safety-and-usability-defaults
    provides: XLSX export route and owner/admin scope enforcement
  - phase: 18-export-feedback-ux-and-audit-visibility
    provides: inline export feedback UX and existing activity timeline surface
provides:
  - Export route audit persistence for both succeeded and failed backup attempts
  - Scope-aware activity feed rows that include export actions with actor/lens attribution
  - Timeline rendering of export outcomes with readable labels and stable actor/lens IDs
affects: [secu-02, audit-visibility, item-activity-contract, export-feedback]
tech-stack:
  added: []
  patterns: [scope-derived audit attribution, merged activity-feed ordering, readable-plus-stable attribution tuple]
key-files:
  created: [.planning/phases/18-export-feedback-ux-and-audit-visibility/18-02-SUMMARY.md]
  modified:
    - src/api/routes/exports.routes.js
    - src/domain/items/get-item-activity.js
    - src/api/routes/items.routes.js
    - test/api/exports-backup-scope.test.js
    - frontend/src/lib/api-client.ts
    - frontend/src/features/audit/item-activity-timeline.tsx
    - frontend/src/__tests__/item-activity-attribution.test.tsx
key-decisions:
  - "Persist export outcome in verb-style `action` values (`export.backup.succeeded` and `export.backup.failed`) instead of introducing a new DB column."
  - "Treat all-data exports as `lens_user_id: null` while exposing explicit `All users` labeling through activity payload and UI."
  - "Merge export audit rows into existing `/items/:id/activity` feed by current scope so no export-only audit surface is introduced."
patterns-established:
  - "Export route writes one audit row per attempt from `req.scope` attribution before response completion/error handoff."
  - "Activity rows now carry both readable labels (`actor_label`, `lens_label`) and stable IDs (`actor_user_id`, `lens_user_id`)."
requirements-completed: [SECU-02]
duration: 7 min
completed: 2026-03-04
---

# Phase 18 Plan 02: Persist export success/failure audits and expose actor/lens-attributed export rows in existing activity history Summary

**Export attempts are now fully traceable end-to-end: the API logs success and failure outcomes with scope attribution, and the existing activity timeline renders those rows with explicit outcome text plus readable and stable actor/lens context.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-04T00:05:55Z
- **Completed:** 2026-03-04T00:13:05Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added export-route audit persistence that writes `export.backup.succeeded` and `export.backup.failed` with actor/lens attribution derived from `req.scope`.
- Extended item activity query contract to include scope-relevant export rows, preserving deterministic ordering and ownership/scope enforcement.
- Updated timeline rendering/tests to display export outcomes and attribution tuples with readable labels and stable ID context, including explicit all-data lens labeling.

## Task Commits

Each task was committed atomically:

1. **Task 1: Persist export audit rows for success and failure outcomes in export route** - `6481fef` (feat)
2. **Task 2: Extend existing activity query contract to surface relevant export audit entries** - `3b9461e` (feat)
3. **Task 3: Render export audit outcomes and attribution tuple in existing activity timeline** - `0234649` (feat)

**Plan metadata:** pending

## Files Created/Modified
- `src/api/routes/exports.routes.js` - writes export audit rows in both success and failure paths using scope-derived actor/lens attribution.
- `src/domain/items/get-item-activity.js` - merges export audit rows into activity payload with deterministic ordering and readable label fields.
- `src/api/routes/items.routes.js` - passes `req.scope` into activity query so admin/owner lens behavior is preserved.
- `test/api/exports-backup-scope.test.js` - locks success/failure export audit writes and activity visibility for owner and all-data admin contexts.
- `frontend/src/lib/api-client.ts` - extends transport typing with `actor_label`, `lens_label`, and `all_data` lens attribution state.
- `frontend/src/features/audit/item-activity-timeline.tsx` - renders export outcome text and readable/stable attribution tuple details in the existing timeline UI.
- `frontend/src/__tests__/item-activity-attribution.test.tsx` - verifies attributed, all-data, and legacy tuple rendering plus export outcome visibility.

## Decisions Made
- Used existing `AuditLog` action taxonomy to encode export outcome instead of adding schema fields.
- Kept all-data lens ID semantics as `null` while adding explicit human label `All users` for attribution clarity.
- Kept audit visibility within existing item activity surface and merged export rows by scope relevance rather than creating a new endpoint/page.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved admin all-data access in activity ownership checks**
- **Found during:** Task 2 (activity query contract extension)
- **Issue:** Initial scope normalization for `getItemActivity` dropped `actorRole`, causing `canAccessOwner` to treat admin-all requests as standard-user requests and return 404.
- **Fix:** Included `actorRole` in normalized scope context before ownership checks.
- **Files modified:** `src/domain/items/get-item-activity.js`
- **Verification:** `npm test -- test/api/exports-backup-scope.test.js --runInBand`
- **Committed in:** `3b9461e` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was required to preserve existing admin scope protections while adding export-row visibility; no scope creep.

## Issues Encountered

None.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 18 now satisfies both UXEX-02 (plan 01) and SECU-02 (plan 02) with export feedback and audit traceability fully wired.
- No blockers identified; phase is ready for closeout/transition.

---
*Phase: 18-export-feedback-ux-and-audit-visibility*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: `.planning/phases/18-export-feedback-ux-and-audit-visibility/18-02-SUMMARY.md`
- FOUND commits: `6481fef`, `3b9461e`, `0234649`
