# Requirements: Household Asset & Commitment Tracker (HACT)

**Defined:** 2026-02-25
**Core Value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## v2.0 Requirements

### Authentication & RBAC

- [x] **AUTH-01**: User can register and sign in with secure credential handling.
- [x] **AUTH-02**: Authenticated session is required for protected API and frontend routes.
- [x] **AUTH-03**: API no longer accepts actor identity via client-selected `x-user-id` shim for authorization.
- [x] **AUTH-04**: Each user has role `user` (default) or `admin` (elevated), enforced server-side.
- [x] **AUTH-05**: Standard users can only read and mutate records they own.
- [x] **AUTH-06**: Admin user can intentionally switch to all-data mode and bypass owner scope.
- [x] **AUTH-07**: System records acting user for create, complete, restore, and delete actions in audit-visible history.
- [x] **AUTH-08**: Admin mode displays persistent safeguards, including visible mode state and action attribution context.

### Financial Contract & Occurrence Model

- [x] **FIN-01**: User can create a parent `FinancialItem` with `title`, `type`, `frequency`, `default_amount`, `status`, owner, and linked asset.
- [x] **FIN-02**: User can track child `Event` occurrences with `financial_item_id`, `due_date`, `actual_amount`, `status`, and owner scope.
- [x] **FIN-03**: One-time financial creation creates parent and one child occurrence in a single backend transaction.
- [x] **FIN-04**: Recurring contracts store recurrence rules on parent items and do not pre-generate long-horizon rows.
- [ ] **FIN-05**: Editing a projected future occurrence instantiates a stored exception occurrence for that date.
- [x] **FIN-06**: Closing a parent contract prevents new projected occurrences from being generated.

### Timeline & Asset UX

- [ ] **TIME-01**: User can view a unified timeline up to 3 years including paid, pending, and projected occurrences.
- [ ] **TIME-02**: Timeline distinguishes projected versus persisted occurrences and applies deterministic ordering.
- [ ] **TIME-03**: Asset commitment view is split into `Current & Upcoming` and `Historical Ledger` sections.
- [x] **TIME-04**: Admin can view combined data or filter dashboard/timeline through a selected user lens.

### Deletion Lifecycle & Retention

- [ ] **LIFE-01**: Assets, financial parents, and occurrences support soft delete via `deleted_at` and are hidden from default views.
- [ ] **LIFE-02**: User can view soft-deleted records in Trash and restore them.
- [ ] **LIFE-03**: Deleting an asset with linked financial records prompts intercept options to trash active links or keep them as closed historical records.
- [ ] **LIFE-04**: Backend scheduler permanently deletes records only when `deleted_at` is older than 30 days.
- [ ] **LIFE-05**: Restore and purge actions are audit-visible and enforce ownership/RBAC policy.

## Future Requirements (Deferred)

### Roles & Governance

- **ROLE-01**: User can manage granular/custom role matrices beyond admin and standard user.

### Restore Experience

- **REST-01**: User receives advanced restore conflict assistance for relink/merge options.

### Timeline Operations

- **BULK-01**: User can perform guarded bulk timeline actions (bulk complete/reschedule/archive).

### Retention Controls

- **RETN-01**: Admin can apply legal hold or custom retention windows beyond default 30-day purge.

## Out of Scope

| Feature | Reason |
|---------|--------|
| External OAuth/SSO providers | Not required to satisfy current auth and RBAC goals. |
| Organization billing and tenant management | Separate product concern outside household ledger scope. |
| Predictive timeline anomaly scoring | Not required for baseline timeline and recurrence reliability. |
| Unlimited recurrence materialization | Contradicts bounded projection requirement and increases operational risk. |

## Traceability

Traceability for milestone v2.0 is mapped to Phases 8-12.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 8 | Complete |
| AUTH-02 | Phase 8 | Complete |
| AUTH-03 | Phase 8 | Complete |
| AUTH-04 | Phase 9 | Complete |
| AUTH-05 | Phase 9 | Complete |
| AUTH-06 | Phase 9 | Complete |
| AUTH-07 | Phase 9 | Complete |
| AUTH-08 | Phase 9 | Complete |
| FIN-01 | Phase 10 | Complete |
| FIN-02 | Phase 10 | Complete |
| FIN-03 | Phase 10 | Complete |
| FIN-04 | Phase 10 | Complete |
| FIN-05 | Phase 11 | Pending |
| FIN-06 | Phase 10 | Complete |
| TIME-01 | Phase 11 | Pending |
| TIME-02 | Phase 11 | Pending |
| TIME-03 | Phase 11 | Pending |
| TIME-04 | Phase 9 | Complete |
| LIFE-01 | Phase 12 | Pending |
| LIFE-02 | Phase 12 | Pending |
| LIFE-03 | Phase 12 | Pending |
| LIFE-04 | Phase 12 | Pending |
| LIFE-05 | Phase 12 | Pending |

**Coverage:**
- v2.0 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after milestone v2.0 roadmap mapping*
