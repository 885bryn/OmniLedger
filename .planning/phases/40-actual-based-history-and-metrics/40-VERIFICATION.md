---
phase: 40-actual-based-history-and-metrics
verified: 2026-03-30T18:00:00Z
status: passed
score: 6/6 must-haves verified
human_verification:
  - test: "History tab visual confirmation for overpaid/underpaid and projected reference lines"
    expected: "Variance badges and projected reference lines appear correctly for reconciled history rows"
    why_human: "Visual hierarchy and badge readability require browser confirmation"
---

# Phase 40: Actual-Based History and Metrics Verification Report

**Phase Goal:** Users can review settled event outcomes using actual paid values, actual paid chronology, and visible variance wherever this milestone changes completion-derived math.
**Verified:** 2026-03-30T18:00:00Z
**Status:** passed
**Re-verification:** Yes - checkpoint issues were fixed and regression coverage was added.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | History chronology uses actual paid date first. | ✓ VERIFIED | Date key resolution now prioritizes `actual_date` in `frontend/src/pages/events/events-page.tsx:239` and display fallback uses `actual_date -> completed_at -> due_date` in `frontend/src/pages/events/events-page.tsx:244`. |
| 2 | Completed rows show actual paid amount and actual paid date labels. | ✓ VERIFIED | History card labels render via `events.historyCard.actualDate` and `events.historyCard.actualPaid` in `frontend/src/pages/events/events-page.tsx:1019` and `frontend/src/pages/events/events-page.tsx:1024`. |
| 3 | Overpaid/underpaid variance badges show when actual differs from projection. | ✓ VERIFIED | Variance helper computes over/under state in `frontend/src/pages/events/events-page.tsx:193` and badge rendering uses `events.varianceBadge.*` in `frontend/src/pages/events/events-page.tsx:999`. |
| 4 | Projected reference lines remain visible for variance rows after reconciliation transition. | ✓ VERIFIED | Variance rows render projected date/amount references in `frontend/src/pages/events/events-page.tsx:1021` and `frontend/src/pages/events/events-page.tsx:1026`; optimistic transition keeps projected amount while storing `actual_amount` separately in `frontend/src/pages/events/events-page.tsx:685` and `frontend/src/pages/events/events-page.tsx:686`. |
| 5 | Completion-derived metrics use `actual_date` and preserve DATEONLY semantics. | ✓ VERIFIED | Metrics resolver prefers `actual_date` and parses with `Date.UTC` in `src/domain/items/financial-metrics.js:71` and `src/domain/items/financial-metrics.js:79`; derived tracking dates flow to `lastPaymentDate` in `src/domain/items/financial-metrics.js:174`. |
| 6 | Requirements LEDGER-06/07/08 and VIEW-07 are fully traceable and complete. | ✓ VERIFIED | All four requirement IDs are marked complete in `.planning/REQUIREMENTS.md:68`, `.planning/REQUIREMENTS.md:69`, `.planning/REQUIREMENTS.md:70`, `.planning/REQUIREMENTS.md:71`. |

**Score:** 6/6 must-haves verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/domain/items/financial-metrics.js` | Actual-date-first completion-derived metric logic | ✓ VERIFIED | `resolveCompletedAt` prefers `actual_date` with DATEONLY-safe parsing and drives last-completed metrics. |
| `test/domain/items/financial-metrics.test.js` | Focused coverage for actual-date precedence/date-only stability | ✓ VERIFIED | 7/7 tests pass including DATEONLY no-shift behavior. |
| `frontend/src/pages/events/events-page.tsx` | History rendering for actual chronology and variance context | ✓ VERIFIED | Implements actual labels, variance badges, and projected references with stable optimistic state behavior. |
| `frontend/src/__tests__/events-ledger-page.test.tsx` | Ledger regressions for reconcile-to-history variance visibility | ✓ VERIFIED | Includes overpaid and projected-reference assertions; test file passes. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LEDGER-06 | 40-02 | History rows display actual paid amount/date | ✓ SATISFIED | Labels and value surfaces in `frontend/src/pages/events/events-page.tsx:1019` and `frontend/src/pages/events/events-page.tsx:1024`. |
| LEDGER-07 | 40-02 | History grouped/ordered by actual paid chronology | ✓ SATISFIED | Ordering key now resolves with `actual_date` priority in `frontend/src/pages/events/events-page.tsx:239`. |
| LEDGER-08 | 40-02 | Explicit overpaid/underpaid badge when amounts differ | ✓ SATISFIED | Variance computation and badge rendering in `frontend/src/pages/events/events-page.tsx:193` and `frontend/src/pages/events/events-page.tsx:999`. |
| VIEW-07 | 40-01 | Completion-derived metrics use actual paid amount/date | ✓ SATISFIED | Actual-date-first metric logic in `src/domain/items/financial-metrics.js:66` and `src/domain/items/financial-metrics.js:174`; covered by `test/domain/items/financial-metrics.test.js`. |

Plan-frontmatter requirement IDs found: VIEW-07, LEDGER-06, LEDGER-07, LEDGER-08.
Phase-40 requirements mapped in `.planning/REQUIREMENTS.md`: LEDGER-06, LEDGER-07, LEDGER-08, VIEW-07.
Orphaned requirements: none.

### Regression Gate

- Initial prior-phase regression run surfaced 2 failures (date expectation drift and brittle today-prefill expectation).
- Applied targeted test hardening/fixes and re-ran regression suites.
- Final regression gate status: **PASS**
  - `npm test -- test/api/events-complete.test.js test/domain/events/complete-event.test.js --runInBand`
  - `npm --prefix frontend test -- src/__tests__/events-ledger-page.test.tsx src/__tests__/dashboard-events-flow.test.tsx src/__tests__/reconcile-ledger-action.test.tsx`

### Human Verification

### 1. History variance UI checkpoint (resolved)

**Test:** Validate overpaid row visibility and projected reference lines in History after reconciliation.
**Expected:** Overpaid/underpaid badges and projected references remain visible in settled rows.
**Why human:** Visual badge semantics and row readability are best confirmed in-browser.
**Result:** Initially failed from optimistic state overwrite, then fixed in code/tests; follow-up checks passed.

### Gaps Summary

No remaining implementation gaps found for Phase 40.

---

_Verified: 2026-03-30T18:00:00Z_
_Verifier: OpenCode (inline fallback verification)_
