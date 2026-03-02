---
phase: 11-timeline-projection-asset-ledger-views
verified: 2026-02-28T02:50:01.713Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Timeline visual clarity and deterministic ordering in live UI"
    expected: "Projected and persisted badges/legend are clearly understandable, and same-date persisted rows consistently appear above projected rows in Current and History sections."
    why_human: "Visual clarity/usability quality and real browser rendering cannot be fully validated with static code inspection."
  - test: "Mobile historical-ledger collapse ergonomics"
    expected: "Historical Ledger starts collapsed on mobile, expands/collapses reliably, and remains readable with expected spacing and controls."
    why_human: "Viewport interaction feel and responsive UX quality need manual device/browser validation."
---

# Phase 11: Timeline Projection & Asset Ledger Views Verification Report

**Phase Goal:** Users can trust a unified, deterministic timeline and clearly separated current versus historical asset ledgers.
**Verified:** 2026-02-28T02:50:01.713Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | User can view a unified timeline up to 3 years showing paid, pending, and projected occurrences in deterministic order. | ✓ VERIFIED | 3-year window in `src/domain/events/list-events.js:343` + projection merge/sort in `src/domain/events/list-events.js:403`; projection bounded in `src/domain/items/item-event-sync.js:226`; regression in `test/api/events-list.test.js:357`. |
| 2 | Timeline clearly distinguishes projected occurrences from persisted occurrences. | ✓ VERIFIED | Explicit `source_state`/`is_projected` in `src/domain/events/list-events.js:178` and `src/domain/events/list-events.js:398`; UI badges/legend in `frontend/src/pages/events/events-page.tsx:310` and `frontend/src/pages/events/events-page.tsx:343`; UI regression in `frontend/src/__tests__/dashboard-events-flow.test.tsx:458`. |
| 3 | Editing a projected future occurrence instantiates a stored exception for that date and the edit appears as persisted data. | ✓ VERIFIED | Projected-id materialization + persisted save in `src/domain/events/update-event.js:215` and `src/domain/events/update-event.js:283`; exception schema in `src/db/models/event.model.js:69`; route wiring in `src/api/routes/events.routes.js:85`; API regression in `test/api/events-update.test.js:95`; UI mutation path in `frontend/src/features/events/edit-event-row-action.tsx:89`. |
| 4 | Asset financial view is split into `Current & Upcoming` and `Historical Ledger` sections with records visible in expected section. | ✓ VERIFIED | Section split logic in `frontend/src/pages/items/item-detail-page.tsx:470`; section rendering in `frontend/src/pages/items/item-detail-page.tsx:819` and `frontend/src/pages/items/item-detail-page.tsx:882`; mobile collapsed default in `frontend/src/pages/items/item-detail-page.tsx:344`; regression in `frontend/src/__tests__/item-detail-ledger.test.tsx:84`. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/domain/items/item-event-sync.js` | 3-year bounded recurring projection + materialization primitives | ✓ VERIFIED | Exists and substantive (`projectItemEvents`, `materializeItemEventForDate`), wired from `src/domain/events/list-events.js:5` and `src/domain/events/update-event.js:4`. |
| `src/domain/events/list-events.js` | Unified deterministic persisted+projected timeline DTO | ✓ VERIFIED | Exists, includes deterministic comparator and explicit source metadata, wired to `/events` route in `src/api/routes/events.routes.js:44`. |
| `test/api/events-list.test.js` | Regression coverage for horizon/ordering/source metadata | ✓ VERIFIED | Exists with targeted tests for 3-year horizon and persisted-before-projected ties (`test/api/events-list.test.js:187`, `test/api/events-list.test.js:357`). |
| `src/db/migrations/20260227120000-add-event-exception-flags.js` | Durable exception column migration | ✓ VERIFIED | Exists with `is_exception` add/remove operations (`src/db/migrations/20260227120000-add-event-exception-flags.js:5`). |
| `src/db/models/event.model.js` | Model includes exception metadata | ✓ VERIFIED | `is_exception` field defined and defaulted (`src/db/models/event.model.js:69`). |
| `src/domain/events/update-event.js` | Projected-aware update mutation with dedupe and ownership checks | ✓ VERIFIED | Implements projected parsing/materialization/transactional update; wired from API route (`src/api/routes/events.routes.js:87`). |
| `test/api/events-update.test.js` | Regression coverage for projected edit materialization/ownership/validation | ✓ VERIFIED | Exists and substantive (`test/api/events-update.test.js:95`, `test/api/events-update.test.js:144`, `test/api/events-update.test.js:172`). |
| `frontend/src/lib/date-ordering.ts` | Shared persisted-before-projected same-date comparator | ✓ VERIFIED | Comparator enforces source rank (`frontend/src/lib/date-ordering.ts:28`), consumed by events and item detail pages. |
| `frontend/src/features/events/edit-event-row-action.tsx` | Save-exception confirmation + PATCH mutation + refetch | ✓ VERIFIED | Includes projected-specific CTA and mutation path (`frontend/src/features/events/edit-event-row-action.tsx:193`, `frontend/src/features/events/edit-event-row-action.tsx:89`). |
| `frontend/src/pages/events/events-page.tsx` | Timeline badges/legend + deterministic grouped rendering | ✓ VERIFIED | Uses comparator and projected/persisted labels (`frontend/src/pages/events/events-page.tsx:9`, `frontend/src/pages/events/events-page.tsx:343`). |
| `frontend/src/pages/items/item-detail-page.tsx` | Split Current/Upcoming vs Historical ledger with summaries/collapse | ✓ VERIFIED | Implements split logic, summaries, mobile historical collapse, and state badges (`frontend/src/pages/items/item-detail-page.tsx:470`, `frontend/src/pages/items/item-detail-page.tsx:823`, `frontend/src/pages/items/item-detail-page.tsx:898`). |
| `frontend/src/lib/query-keys.ts` | Stable item-ledger query key contract | ✓ VERIFIED | `queryKeys.items.itemLedger` present (`frontend/src/lib/query-keys.ts:40`) and used in item detail page (`frontend/src/pages/items/item-detail-page.tsx:452`). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/domain/events/list-events.js` | `src/domain/items/item-event-sync.js` | Projection generation with bounded window | ✓ WIRED | `projectItemEvents` imported/used with `windowStart`/`windowEnd` in `src/domain/events/list-events.js:390`. |
| `src/domain/events/list-events.js` | `test/api/events-list.test.js` | Source metadata + deterministic ordering contract assertions | ✓ WIRED | API contract validated in `test/api/events-list.test.js:171` and `test/api/events-list.test.js:220`. |
| `src/api/routes/events.routes.js` | `src/domain/events/update-event.js` | `PATCH /events/:id` mutation path | ✓ WIRED | Route calls `updateEvent` with scope/body in `src/api/routes/events.routes.js:85`. |
| `src/domain/events/update-event.js` | `src/domain/items/item-event-sync.js` | Projected ID materialization before update | ✓ WIRED | `materializeItemEventForDate` import + invocation in `src/domain/events/update-event.js:4` and `src/domain/events/update-event.js:215`. |
| `frontend/src/features/events/edit-event-row-action.tsx` | `/events/:id` | PATCH mutation and timeline refetch | ✓ WIRED | `apiRequest(..., { method: 'PATCH' })` in `frontend/src/features/events/edit-event-row-action.tsx:89` + invalidations in `frontend/src/features/events/edit-event-row-action.tsx:99`. |
| `frontend/src/pages/events/events-page.tsx` | `frontend/src/lib/date-ordering.ts` | Shared persisted-first comparator | ✓ WIRED | `compareByNearestDue` imported and used for grouped sorting at `frontend/src/pages/events/events-page.tsx:97`. |
| `frontend/src/pages/items/item-detail-page.tsx` | `/events` | Owner-scoped ledger fetch feeding split sections | ✓ WIRED | Fetch call in `frontend/src/pages/items/item-detail-page.tsx:456` and split reducer in `frontend/src/pages/items/item-detail-page.tsx:470`. |
| `frontend/src/pages/items/item-detail-page.tsx` | `frontend/src/lib/query-keys.ts` | Stable item-ledger query key | ✓ WIRED | `queryKeys.items.itemLedger` used in query key at `frontend/src/pages/items/item-detail-page.tsx:452`. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FIN-05 | 11-02, 11-03 | Editing projected future occurrence instantiates stored exception occurrence | ✓ SATISFIED | Projected materialization + `is_exception` persistence in `src/domain/events/update-event.js:215` and `src/domain/events/update-event.js:283`; API tests in `test/api/events-update.test.js:95`. |
| TIME-01 | 11-01, 11-03 | Unified timeline up to 3 years including paid/pending/projected | ✓ SATISFIED | 3-year projection window in `src/domain/events/list-events.js:343`; timeline integration tests in `test/api/events-list.test.js:357`; UI grouped timeline in `frontend/src/pages/events/events-page.tsx:243`. |
| TIME-02 | 11-01, 11-02, 11-03, 11-04 | Distinguish projected vs persisted and deterministic ordering | ✓ SATISFIED | Deterministic source-aware comparators in `src/domain/events/list-events.js:222` and `frontend/src/lib/date-ordering.ts:22`; badges in `frontend/src/pages/events/events-page.tsx:343` and `frontend/src/pages/items/item-detail-page.tsx:844`. |
| TIME-03 | 11-04 | Asset commitment view split into Current & Upcoming / Historical Ledger | ✓ SATISFIED | Split sectioning and rendering in `frontend/src/pages/items/item-detail-page.tsx:470`, `frontend/src/pages/items/item-detail-page.tsx:821`, `frontend/src/pages/items/item-detail-page.tsx:884`; regressions in `frontend/src/__tests__/item-detail-ledger.test.tsx:84`. |
| (Orphaned check) | REQUIREMENTS.md traceability | Extra Phase 11 requirements not declared in plans | ✓ NONE | Phase 11 maps only FIN-05/TIME-01/TIME-02/TIME-03 in `.planning/REQUIREMENTS.md:88` to `.planning/REQUIREMENTS.md:92`; all are declared in phase plans. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | No TODO/FIXME/placeholder stubs or console-only implementations found in phase key implementation files | ℹ️ Info | No blocker anti-patterns detected for phase-goal paths. |

### Human Verification Required

### 1. Timeline visual clarity and deterministic ordering in live UI

**Test:** Open `/events` with a mix of same-date persisted and projected rows in both upcoming and history sections.
**Expected:** Badges and legend are understandable at a glance; persisted rows render above projected rows on same dates in both sections.
**Why human:** Perceived clarity and visual hierarchy quality require human judgment in a browser.

### 2. Mobile historical-ledger collapse ergonomics

**Test:** Open `/items/:id` commitments tab on a mobile viewport; verify Historical Ledger default and toggle behavior.
**Expected:** Historical Ledger starts collapsed, toggle expands/collapses reliably, and content remains readable.
**Why human:** Responsive interaction quality and readability cannot be fully proven from static analysis alone.

### Gaps Summary

No implementation gaps were found against declared must-haves or Phase 11 requirement IDs. All required truths, artifacts, and key links are present and wired. Remaining verification is human UX validation for visual clarity and responsive behavior.

---

_Verified: 2026-02-28T02:50:01.713Z_
_Verifier: Claude (gsd-verifier)_
