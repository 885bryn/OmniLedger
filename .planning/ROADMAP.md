# Roadmap: Household Asset & Commitment Tracker (HACT)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 shipped 2026-02-25 (details: `.planning/milestones/v1.0-ROADMAP.md`)
- ⚠ **v2.0 Auth, Timeline & Data Lifecycle** - Core phases 8-12 complete; gap-closure phase 13 added from milestone audit.

## Overview

v2.0 delivers secure multi-user operation, contract-and-occurrence financial modeling, a smarter timeline experience, and controlled data lifecycle behavior. Work is sequenced dependency-first so identity and authorization guardrails exist before projection-heavy timeline and retention automation features.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 8: Auth Sessions & Protected Access** - Replace actor shim with secure sign-in and gated access. (completed 2026-02-25)
- [x] **Phase 9: RBAC Scope & Admin Safety Mode** - Enforce ownership boundaries with explicit admin all-data controls. (completed 2026-02-26)
- [x] **Phase 10: Financial Contract-Occurrence Foundation** - Establish parent contracts and child occurrence persistence rules. (completed 2026-02-26)
- [x] **Phase 11: Timeline Projection & Asset Ledger Views** - Deliver projected-versus-persisted timeline and split asset ledger UX, plus lifecycle controls merged from the planned Phase 12 scope. (completed 2026-02-28)
- [x] **Phase 12: Deletion Lifecycle & Retention Controls** - Scope delivered during Phase 11 extension work; retained here for traceability. (completed 2026-02-28)
- [ ] **Phase 13: Admin Scope Integration Hardening** - Close audit gaps on admin scope/lens mutation and drill-through consistency.

## Phase Details

### Phase 8: Auth Sessions & Protected Access
**Goal**: Users can securely authenticate and only access the app/API through authenticated sessions.
**Depends on**: Phase 7
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User can register and sign in with valid credentials, and invalid credential attempts are safely rejected.
  2. User can access protected frontend and API routes only while authenticated; unauthenticated access is blocked.
  3. Authorization no longer accepts client-selected `x-user-id` identity and derives actor identity from authenticated session context.
**Plans**: 6

### Phase 9: RBAC Scope & Admin Safety Mode
**Goal**: Users operate within enforced ownership scope while admins can intentionally and safely enter all-data mode.
**Depends on**: Phase 8
**Requirements**: AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, TIME-04
**Success Criteria** (what must be TRUE):
  1. Standard users can only view and mutate records they own across dashboard, timeline, and asset workflows.
  2. Admin user can intentionally switch between owner-scoped and all-data mode, including a selected user lens for dashboard/timeline views.
  3. Admin mode shows persistent safeguards, including visible mode state and clear action-attribution context.
  4. Create, complete, restore, and delete actions are audit-visible with the acting user recorded.
**Plans**: 7 plans
Plans:
- [x] 09-01-PLAN.md - Add server-enforced role model and role-aware request scope foundation. (completed 2026-02-26)
- [ ] 09-02-PLAN.md - Enforce owner-only read/write boundaries with 404-style foreign access denials.
- [ ] 09-03-PLAN.md - Implement server-enforced admin mode/lens APIs and unified scope-filter routing.
- [ ] 09-04-PLAN.md - Add persistent shell safety banner and explicit admin-mode exit confirmation.
- [x] 09-05-PLAN.md - Expand audit history to actor+lens attribution including restore-category visibility coverage. (completed 2026-02-26)
- [ ] 09-06-PLAN.md - Build frontend admin lens controls with hard reset and refetch across read surfaces.
- [ ] 09-07-PLAN.md - Add mutation attribution chips plus dual inline and toast policy-denial safety feedback.

### Phase 10: Financial Contract-Occurrence Foundation
**Goal**: Users can manage financial parent contracts with correctly scoped child occurrences and recurrence baseline behavior.
**Depends on**: Phase 9
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-06
**Success Criteria** (what must be TRUE):
  1. User can create a parent `FinancialItem` with required contract fields, owner scope, and linked asset context.
  2. User can view and manage child `Event` occurrences linked to the parent contract with due date, amount, status, and owner scope.
  3. Creating a one-time financial record results in both parent contract and first occurrence being present immediately.
  4. Recurring contracts follow stored recurrence rules without pre-generating long-horizon rows, and closed contracts stop generating new projected occurrences.
**Plans**: 4 plans
Plans:
- [x] 10-01-PLAN.md - Add explicit FinancialItem parent contract schema and transactional one-time parent+occurrence create path. (completed 2026-02-26)
- [x] 10-02-PLAN.md - Implement owner-scoped occurrence projection/read model with close-status gating and projected exception materialization. (completed 2026-02-26)
- [x] 10-03-PLAN.md - Replace wizard with single guided Financial item form and terminology/subtype UX unification. (completed 2026-02-26)
- [x] 10-04-PLAN.md - Deliver upcoming/history occurrence management UI with inline status actions and recurrence state visibility. (completed 2026-02-26)

### Phase 11: Timeline Projection & Asset Ledger Views
**Goal**: Users can trust a unified, deterministic timeline and clearly separated current versus historical asset ledgers.
**Depends on**: Phase 10
**Requirements**: FIN-05, TIME-01, TIME-02, TIME-03
**Success Criteria** (what must be TRUE):
  1. User can view a unified timeline up to 3 years showing paid, pending, and projected occurrences in deterministic order.
  2. Timeline clearly distinguishes projected occurrences from persisted occurrences.
  3. Editing a projected future occurrence instantiates a stored exception for that date and the edit appears as persisted data.
  4. Asset detail commitments/income view shows one row per linked financial item, and financial item detail view shows present/history occurrence timelines with per-occurrence edit support.
**Plans**: 4 plans
Plans:
- [x] 11-01-PLAN.md - Extend timeline read model to 3-year projection window with explicit persisted/projected ordering contract. (completed 2026-02-28)
- [x] 11-02-PLAN.md - Add projected occurrence edit mutation that materializes and persists date-specific exception rows. (completed 2026-02-28)
- [x] 11-03-PLAN.md - Implement timeline state cues and save-exception UX for projected edits with in-place persisted indicators. (completed 2026-02-28)
- [x] 11-04-PLAN.md - Split asset detail financial ledger into Current & Upcoming versus Historical sections with summaries and mobile collapse. (completed 2026-02-28)

### Phase 12: Deletion Lifecycle & Retention Controls
**Goal**: Users can safely delete and restore data with guarded linked-record behavior and predictable retention cleanup.
**Depends on**: Phase 11
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05
**Success Criteria** (what must be TRUE):
  1. Deleting assets, financial parents, or occurrences moves them to soft-deleted state and hides them from default views.
  2. User can open Trash to review soft-deleted records and restore eligible records.
  3. Deleting an asset with linked financial records presents intercept options to either trash active links or preserve them as closed historical records.
  4. Records remain restorable before 30 days and are permanently removed only after exceeding the 30-day retention window.
  5. Restore and purge actions are audit-visible and still enforce ownership/RBAC policy.
**Plans**: 0 standalone (implemented in Phase 11 extension)

### Phase 13: Admin Scope Integration Hardening
**Goal**: Ensure admin all-data/lens behavior remains consistent across mutations and detail drill-through flows.
**Depends on**: Phase 12
**Requirements**: AUTH-06, TIME-04
**Gap Closure**: Closes gaps from `.planning/v2.0-MILESTONE-AUDIT.md` (admin mutation scope consistency, admin drill-through continuity)
**Success Criteria** (what must be TRUE):
  1. Admin all-data/lens mode can mutate eligible cross-owner records using consistent scope resolution.
  2. Dashboard/timeline/admin lens drill-through into item detail and net-status preserves admin scope continuity.
  3. Regression coverage locks admin scope behavior for read + mutate + drill-through flows.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 8. Auth Sessions & Protected Access | 6/6 | Complete    | 2026-02-25 |
| 9. RBAC Scope & Admin Safety Mode | 13/13 | Complete | 2026-02-26 |
| 10. Financial Contract-Occurrence Foundation | 5/5 | Complete   | 2026-02-26 |
| 11. Timeline Projection & Asset Ledger Views | 4/4 (+extension work) | Complete   | 2026-02-28 |
| 12. Deletion Lifecycle & Retention Controls | Integrated in Phase 11 | Complete | 2026-02-28 |
| 13. Admin Scope Integration Hardening | 0/TBD | Not started | - |
