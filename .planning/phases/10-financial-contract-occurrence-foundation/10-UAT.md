---
status: complete
phase: 10-financial-contract-occurrence-foundation
source: 10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md, 10-04-SUMMARY.md, 10-05-SUMMARY.md
started: 2026-02-27T00:24:50.463Z
updated: 2026-02-27T00:36:49.464Z
---

## Current Test

[testing complete]

## Tests

### 1. Linked Financial commitment create visibility
expected: Creating a linked recurring Financial item (Commitment subtype) shows it in Items > Commitments, under the linked parent item's Commitments section, and on its own detail page with non-zero amount, frequency, and due date.
result: pass

### 2. Events completion flow without follow-up modal
expected: Completing a current occurrence only shows the confirmation prompt, then moves the row to history with Undo available; no "schedule next date" modal appears.
result: pass

### 3. Dashboard upcoming amount is outflows only
expected: Dashboard "Upcoming amount" sums only payable commitments/outflows and excludes incomes entirely.
result: pass

### 4. Income amount sign visibility in non-detail pages
expected: Income amounts are shown with a leading + in non-detail UI surfaces (Items list, Events rows, Dashboard event rows).
result: pass

### 5. Technical ID fields hidden from user-facing attribute lists
expected: User-facing attribute displays do not show raw ID fields (for example parentItemId/linkedAssetItemId UUID-like values), while meaningful fields like financialSubtype remain visible.
result: pass

### 6. Parent delete shows linked commitment selection
expected: Deleting a parent asset presents linked commitments with checkboxes so the user can choose which linked commitments to delete together.
result: pass

### 7. Parent delete cascades only selected linked commitments
expected: Confirming parent delete soft-deletes the parent and only the selected linked commitments, and they appear in Items > Deleted.
result: pass

### 8. Parent restore also restores cascade-deleted linked commitments
expected: Restoring a deleted parent also restores linked commitments that were deleted together, and they reappear in commitments views and parent commitment detail.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
