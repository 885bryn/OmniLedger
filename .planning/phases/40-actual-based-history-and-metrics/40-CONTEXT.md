# Phase 40: Actual-Based History and Metrics - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the completed History ledger to display actual paid amount and actual paid date (not projected values), group and sort by actual paid date, and show a directional variance badge when actual amount differs from projected. Update completion-derived tracking metrics (financial-metrics.js) to prefer actual_date over completed_at so item-level metrics reflect when payment happened rather than when the system timestamp was written. Creating or editing events, reverse flows, and broader dashboard surface rollout are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Variance badge
- Show the badge on any non-zero difference between actual_amount and projected amount — no minimum threshold.
- Do NOT show a badge when actual_amount is null (backend defaulted to projected amount = no meaningful difference).
- Directional: "Overpaid" when actual > projected, "Underpaid" when actual < projected.
- Colors: red badge for Overpaid, amber badge for Underpaid (matches existing dashboard warning vocabulary).
- Badge placement: inline with title badges, alongside the existing emerald "Paid" and amber "Manual Override" badges.
- Follow the established badge pattern: `rounded-full border border-[color]-300 bg-[color]-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color]-[level]`.

### Null actual_date fallback
- For completed events with no actual_date (legacy pre-reconciliation events), use the calendar day derived from `completed_at` timestamp as the display date and grouping key.
- Fallback chain: `actual_date` → `completed_at` (day portion) → `due_date`.
- This applies to both the History row date display and the `getHistoryMonthKey()` grouping.

### History date display
- Update date cell label from "Paid Date" to "Actual date".
- Update amount cell label from "Amount" to "Actual paid".
- Show projected values as muted secondary text below each card cell (using `muted-foreground` color):
  - Under "Actual date" cell: projected due_date prefixed with "— projected: [date]"
  - Under "Actual paid" cell: projected amount prefixed with "— projected: [amount]"
- Only show projected secondary text when actual_date or actual_amount differs from projected (i.e., when a variance badge would appear), or always — Claude's Discretion on whether to always show or only on variance.
- The "Paid on [date]" subtitle text (below the event type title) should also switch to actual_date with fallback.

### VIEW-07: completion-derived metrics
- Silent backend fix only — no new UI labels or visual changes on item detail page.
- `resolveCompletedAt()` in `src/domain/items/financial-metrics.js` should prefer `actual_date` over `completed_at`.
- `actual_date` is stored as a DATEONLY string (YYYY-MM-DD); parse it directly as a date without timezone offset.
- Affects: `trackingLastCompletedDate`, `lastPaymentDate`, `lastCollectedDate`, and the sort for `latestCompleted`.

### Claude's Discretion
- Whether projected secondary text always shows or only on variance rows.
- Exact muted-foreground styling and spacing for the projected reference lines.
- i18n key naming for new label strings ("Actual date", "Actual paid", "Overpaid", "Underpaid").
- Whether to include the projected amount/date in the variance badge tooltip or aria-label.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and requirements
- `.planning/ROADMAP.md` — Phase 40 goal, LEDGER-06/07/08 and VIEW-07 requirements, success criteria.
- `.planning/REQUIREMENTS.md` — Full requirement text for LEDGER-06, LEDGER-07, LEDGER-08, VIEW-07.
- `.planning/PROJECT.md` — Milestone v4.5 direction, shadcn-first constraint, `actual_date` vs `completed_at` semantics.
- `.planning/STATE.md` — Reconciliation invariants and accumulated decisions from phases 38 and 39.

### Prior decision continuity
- `.planning/phases/39-reconciliation-modal-and-completion-ux/39-CONTEXT.md` — Badge/dialog patterns, shadcn primitive usage, existing code integration points (reconcile-ledger-action, events-page).
- `.planning/phases/31-paid-flow-into-history/31-CONTEXT.md` — History row baseline design, grouping expectations, ledger tone.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/pages/events/events-page.tsx`: Primary change surface. Contains `getHistoryMonthKey()`, `buildHistoryGroups()`, `getCompletedDateKey()`, `resolveEventAmount()`, and all History row rendering. The History row article JSX (lines ~940–975) is where date labels, amount display, and badge placement live.
- Badge pattern established at line ~455: `rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700` — replicate with red/amber tokens.
- History card cell pattern (lines ~960–970): `<div className="rounded-2xl bg-background/70 px-3 py-2">` with `<dt>` label + `<dd>` value — add projected reference as `<p className="mt-0.5 text-xs text-muted-foreground">` below `<dd>`.
- `src/domain/items/financial-metrics.js`: `resolveCompletedAt()` at line ~68 — change to check `event.actual_date || event.actualDate` before `completed_at`. Parse DATEONLY strings as `new Date(value + 'T00:00:00')` or `value.split('-')` to avoid UTC offset shifting.

### Established Patterns
- History grouping uses `YYYY-MM-01` month keys sorted descending; within-group sort uses `compareCompletedEvents()` which compares date keys lexicographically.
- i18n keys live in `frontend/src/locales/en/common.json` and `frontend/src/locales/zh/common.json` — add new keys for updated labels and badge text in both files.
- `resolveEventAmount()` already correctly prefers `actual_amount` for completed events — amount display in History rows is already correct and does NOT need changing.

### Integration Points
- History tab grouping key change affects `getCompletedDateKey()` → `getHistoryMonthKey()` → `buildHistoryGroups()` — update `getCompletedDateKey()` to use `actual_date` first.
- `financial-metrics.js` change propagates automatically through `recalculateAndPersistFinancialProgress()` on next completion — no API contract change needed.
- Item detail page (`frontend/src/pages/items/item-detail-page.tsx`) displays `lastPaymentDate`, `lastCollectedDate`, `remainingBalance` from item attributes — these will update automatically once `financial-metrics.js` uses actual_date.

</code_context>

<specifics>
## Specific Ideas

- The variance badge should feel like a factual annotation, not an alarm — same visual weight as the amber "Manual Override" badge rather than a prominent error state.
- History row labels "Actual date" and "Actual paid" should use the same `text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground` style as existing card cell `<dt>` labels.
- The projected secondary reference lines should be clearly subordinate — smaller, muted, not bold.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 40-actual-based-history-and-metrics*
*Context gathered: 2026-03-29*
