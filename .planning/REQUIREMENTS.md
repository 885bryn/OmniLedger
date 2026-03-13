# Requirements: Household Asset & Commitment Tracker (HACT)

**Defined:** 2026-03-13
**Core Value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## v1 Requirements

Requirements for milestone v4.5 Financial Reconciliation Flow (Projected vs. Actuals).

### Reconciliation Contract

- [x] **EVENT-05**: User can complete an upcoming event while the system preserves projected `amount` and `due_date` and stores nullable `actual_amount` and `actual_date` on the event record.
- [ ] **FLOW-06**: User can open a reconciliation dialog from the Upcoming ledger instead of instantly completing the event.
- [x] **FLOW-07**: User can submit actual amount paid and date paid from the reconciliation dialog, with server-side defaults to projected amount and today's date when values are omitted.
- [x] **SAFE-04**: Existing RBAC scoping, projected-event materialization, audit attribution, and `completed_at` system timestamps remain intact while reconciliation fields are added.

### History and Variance Visibility

- [ ] **LEDGER-06**: User sees completed History rows display actual paid amount and actual paid date instead of the original projection.
- [ ] **LEDGER-07**: User sees completed History grouped and ordered by actual paid date so reconciled chronology reflects when payment happened.
- [ ] **LEDGER-08**: User sees an explicit overpayment or underpayment badge when actual amount differs from the projected amount.

### Completion-Derived Metrics

- [ ] **VIEW-07**: User can trust completion-derived tracking metrics that depend on settled payments to use actual paid amount and actual paid date rather than projected values.

### UI Consistency

- [ ] **UX-02**: User sees the reconciliation flow built with shadcn dialog, input, and badge primitives that remain usable on desktop and mobile.

## v2 Requirements

Deferred to a future milestone.

### Progress and Reconciliation

- **VIEW-06**: User can see completed/total obligation and income progress for the selected cadence period, based on completed events vs total due events in-period.
- **FLOW-05**: User can reconcile multiple historical events in one bulk logging workflow.

### Ledger Enhancements

- **LEDGER-05**: User can filter or search the History ledger by item, date range, or note text.
- **EVENT-04**: User can edit or reverse a manually injected historical event from the UI.

### Surface Rollout

- **DASH-10**: User can review actual paid values and variance indicators in dashboard and item-detail completed surfaces beyond the Events ledger.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bulk reconciliation across multiple events | This milestone is scoped to the one-event Upcoming ledger completion flow |
| History search, filtering, edit, or reversal tooling | Keep the milestone focused on projected-vs-actual completion and display first |
| Replacing `completed_at` with a business paid-date field | `completed_at` should remain the system/audit timestamp while `actual_date` carries business meaning |
| Full dashboard and item-detail redesign around variance | Only completion-derived metrics roll forward now; broader surface rollout is deferred |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EVENT-05 | Phase 38 | Complete |
| FLOW-06 | Phase 39 | Pending |
| FLOW-07 | Phase 38 | Complete |
| SAFE-04 | Phase 38 | Complete |
| LEDGER-06 | Phase 40 | Pending |
| LEDGER-07 | Phase 40 | Pending |
| LEDGER-08 | Phase 40 | Pending |
| VIEW-07 | Phase 40 | Pending |
| UX-02 | Phase 39 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after roadmap creation for milestone v4.5*
