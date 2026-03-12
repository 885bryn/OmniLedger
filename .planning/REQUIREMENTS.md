# Requirements: Household Asset & Commitment Tracker (HACT)

**Defined:** 2026-03-10
**Core Value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## v1 Requirements

Requirements for milestone v4.4 Dashboard Utility Redesign with shadcn/ui.

### Dashboard Utility

- [x] **DASH-01**: User sees a dashboard organized into clear utility-first sections instead of a generic overview layout.
- [x] **DASH-02**: User sees period-aware summary cards for net cashflow, upcoming due, overdue count, and completed activity.
- [x] **DASH-03**: User sees dedicated `Needs Attention` and `Recent Activity` dashboard sections that make next actions and recent changes obvious.
- [x] **DASH-04**: User can review overdue and upcoming obligations from a dashboard action queue and jump directly into the relevant workflow.
- [x] **DASH-05**: User can scan a financial snapshot section that shows dense but readable item-level status and metadata.
- [x] **DASH-06**: User can navigate from dashboard summary and queue surfaces into `/events` and item detail pages without losing context.
- [ ] **DASH-07**: User sees exceptions and notices surfaced calmly on the dashboard when manual overrides, admin-only signals, or unusual conditions matter.
- [ ] **DASH-08**: User sees supporting trend or timeline context that helps interpret upcoming and recent activity for the active period.
- [ ] **DASH-09**: User can use the redesigned dashboard comfortably on desktop and mobile with the same information hierarchy preserved.

### Prior Milestone Coverage

- [x] **LEDGER-01**: User can switch the global Events page between `Upcoming` and `History` ledger tabs.
- [x] **LEDGER-02**: User sees pending and overdue upcoming events grouped into Overdue, This Week, Later This Month, and Future sections.
- [x] **LEDGER-03**: User sees overdue events styled as urgent and every ledger section labeled with sticky chronological headers.
- [x] **LEDGER-04**: User sees completed events in the History tab grouped by month/year in reverse chronological order.

### Event State Changes

- [x] **FLOW-02**: User can mark an upcoming event as paid directly from the Upcoming ledger.
- [x] **FLOW-03**: User sees a paid event leave the Upcoming ledger immediately and appear in completed history without a manual refresh.
- [x] **FLOW-04**: User sees the paid-event transition animated so ledger reflow remains legible during state changes.

### Historical Injection

- [x] **EVENT-01**: User can log a completed past event from the item-detail page using a dialog with date, amount, and note fields.
- [x] **EVENT-02**: User-created historical events are stored as completed materialized events with `is_manual_override = true`.
- [x] **EVENT-03**: User-created historical override events can exist before the item's normal origin boundary without being rejected by system guardrails.

### Safety & Compatibility

- [x] **SAFE-02**: System-generated projected events that fall before the item's origin boundary remain rejected.
- [x] **SAFE-03**: Existing projection logic, RBAC scoping, audit attribution, and deployment contracts remain intact while ledger and historical-injection features are added.

### Item Detail Clarity

- [x] **UX-01**: User sees the Financial Item detail tab labeled `Events` instead of `Commitments` so the tab name matches the event timeline and actions shown there.

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
| DASH-01 | Phase 35 | Complete |
| DASH-02 | Phase 35 | Complete |
| DASH-03 | Phase 35 | Complete |
| DASH-04 | Phase 36 | Complete |
| DASH-05 | Phase 36 | Complete |
| DASH-06 | Phase 36 | Complete |
| DASH-07 | Phase 37 | Planned |
| DASH-08 | Phase 37 | Planned |
| DASH-09 | Phase 37 | Planned |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-12 after closing Phase 36 action queue and financial snapshot*
