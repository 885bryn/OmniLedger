# Requirements: Household Asset & Commitment Tracker (HACT)

**Defined:** 2026-03-10
**Core Value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## v1 Requirements

Requirements for milestone v4.3 Smart Grouped Ledger & Historical Event Injection.

### Ledger Experience

- [x] **LEDGER-01**: User can switch the global Events page between `Upcoming` and `History` ledger tabs.
- [x] **LEDGER-02**: User sees pending and overdue upcoming events grouped into Overdue, This Week, Later This Month, and Future sections.
- [x] **LEDGER-03**: User sees overdue events styled as urgent and every ledger section labeled with sticky chronological headers.
- [ ] **LEDGER-04**: User sees completed events in the History tab grouped by month/year in reverse chronological order.

### Event State Changes

- [ ] **FLOW-02**: User can mark an upcoming event as paid directly from the Upcoming ledger.
- [ ] **FLOW-03**: User sees a paid event leave the Upcoming ledger immediately and appear in completed history without a manual refresh.
- [ ] **FLOW-04**: User sees the paid-event transition animated so ledger reflow remains legible during state changes.

### Historical Injection

- [ ] **EVENT-01**: User can log a completed past event from the item-detail page using a dialog with date, amount, and note fields.
- [ ] **EVENT-02**: User-created historical events are stored as completed materialized events with `is_manual_override = true`.
- [ ] **EVENT-03**: User-created historical override events can exist before the item's normal origin boundary without being rejected by system guardrails.

### Safety & Compatibility

- [ ] **SAFE-02**: System-generated projected events that fall before the item's origin boundary remain rejected.
- [ ] **SAFE-03**: Existing projection logic, RBAC scoping, audit attribution, and deployment contracts remain intact while ledger and historical-injection features are added.

## v2 Requirements

Deferred to a future milestone.

### Progress and Reconciliation

- **VIEW-06**: User can see completed/total obligation and income progress for the selected cadence period, based on completed events vs total due events in-period.
- **FLOW-05**: User can reconcile multiple historical events in one bulk logging workflow.

### Ledger Enhancements

- **LEDGER-05**: User can filter or search the History ledger by item, date range, or note text.
- **EVENT-04**: User can edit or reverse a manually injected historical event from the UI.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Bulk import of historical events | Milestone is scoped to one-off in-product historical injection |
| Progress meters on cadence summary cards | Keep follow-on summary visualization separate from ledger foundation work |
| Reworking RBAC, audit model, or deployment flow | Existing security and production contracts must remain stable |
| Full event editing/reconciliation suite | Initial milestone focuses on mark-paid and log-past-event flows only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LEDGER-01 | Phase 30 | Complete |
| LEDGER-02 | Phase 30 | Complete |
| LEDGER-03 | Phase 30 | Complete |
| FLOW-02 | Phase 31 | Pending |
| FLOW-03 | Phase 31 | Pending |
| FLOW-04 | Phase 31 | Pending |
| LEDGER-04 | Phase 31 | Pending |
| SAFE-02 | Phase 32 | Pending |
| EVENT-02 | Phase 32 | Pending |
| EVENT-03 | Phase 32 | Pending |
| EVENT-01 | Phase 33 | Pending |
| SAFE-03 | Phase 33 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after creating milestone v4.3 roadmap*
