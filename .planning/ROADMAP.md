# Roadmap: Household Asset & Commitment Tracker (HACT)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 shipped 2026-02-25 (`.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v2.0 Auth, Timeline & Data Lifecycle** - Phases 8-13 shipped 2026-03-02 (`.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-MILESTONE-AUDIT.md`)
- ✅ **v3.0 Data Portability** - Phases 14-18 shipped 2026-03-04 (`.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v3.0-MILESTONE-AUDIT.md`)
- ✅ **v4.0 Interactive Production Deployment for Ugreen NAS** - Phases 19-23 shipped 2026-03-07 (`.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.0-REQUIREMENTS.md`, `.planning/milestones/v4.0-MILESTONE-AUDIT.md`)
- ✅ **v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion** - Phases 24-26 shipped 2026-03-07 (`.planning/milestones/v4.1-ROADMAP.md`, `.planning/milestones/v4.1-REQUIREMENTS.md`, `.planning/milestones/v4.1-MILESTONE-AUDIT.md`)
- ✅ **v4.2 Cashflow Frequency Normalization & Cadence Toggle** - Phases 27-29 shipped 2026-03-10
- ✅ **v4.3 Smart Grouped Ledger & Historical Event Injection** - Phases 30-34 shipped 2026-03-10 (`.planning/milestones/v4.3-ROADMAP.md`, `.planning/milestones/v4.3-REQUIREMENTS.md`, `.planning/milestones/v4.3-MILESTONE-AUDIT.md`)
- ✅ **v4.4 Dashboard Utility Redesign with shadcn/ui** - Phases 35-37 shipped 2026-03-13 (`.planning/milestones/v4.4-ROADMAP.md`, `.planning/milestones/v4.4-REQUIREMENTS.md`, `.planning/milestones/v4.4-MILESTONE-AUDIT.md`)
- 📋 **v4.5 Financial Reconciliation Flow (Projected vs. Actuals)** - Phases 38-40 planned

## Phases

<details>
<summary>Shipped milestone history</summary>

- v1.0 MVP - Phases 1-7
- v2.0 Auth, Timeline & Data Lifecycle - Phases 8-13
- v3.0 Data Portability - Phases 14-18
- v4.0 Interactive Production Deployment for Ugreen NAS - Phases 19-23
- v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion - Phases 24-26
- v4.2 Cashflow Frequency Normalization & Cadence Toggle - Phases 27-29
- v4.3 Smart Grouped Ledger & Historical Event Injection - Phases 30-34
- v4.4 Dashboard Utility Redesign with shadcn/ui - Phases 35-37

</details>

### 📋 v4.5 Financial Reconciliation Flow (Projected vs. Actuals)

**Milestone Goal:** Turn event completion into an explicit reconciliation flow that preserves projected fields, captures actual paid values, and rolls settled actuals into history and completion-derived metrics.

**Execution Gate:** After each phase is executed, stop for manual browser testing and explicit user approval before planning or executing the next phase.

- [x] **Phase 38: Reconciliation Contract and Safe Completion API** - Add immutable projected-vs-actual event completion fields and backend-authoritative defaults, then pause for browser approval. (completed 2026-03-13)
- [ ] **Phase 39: Reconciliation Modal and Completion UX** - Replace instant Upcoming completion with a shadcn reconciliation dialog that works on desktop and mobile, then pause for browser approval.
- [ ] **Phase 40: Actual-Based History and Metrics** - Show actual-paid chronology, variance, and completion-derived actual math wherever this milestone changes settled outcomes, then pause for final browser approval.

## Phase Details

### Phase 38: Reconciliation Contract and Safe Completion API
**Goal**: Users can complete an upcoming event through a reconciliation-aware backend contract that preserves the projection and safely records actual payment data.
**Depends on**: Phase 37
**Requirements**: EVENT-05, FLOW-07, SAFE-04
**Success Criteria** (what must be TRUE):
  1. User can complete an upcoming event and the system keeps projected `amount` and `due_date` unchanged while storing nullable `actual_amount` and `actual_date` on the event.
  2. User can omit reconciliation inputs and the saved completion still resolves to projected amount and today's date from backend defaults.
  3. User can trust reconciliation completion to keep existing owner scoping, audit attribution, projected-event materialization behavior, and `completed_at` system timestamps intact.
**Manual Gate**: Stop after execution for manual browser testing and explicit approval before Phase 39 begins.
**Plans**: 2 plans

Plans:
- [ ] 38-reconciliation-contract-and-safe-completion-api-01-PLAN.md - Add reconciliation event schema + domain completion defaults while preserving safety invariants.
- [ ] 38-reconciliation-contract-and-safe-completion-api-02-PLAN.md - Wire completion API reconciliation payload contract, lock integration coverage, and run manual browser gate.

### Phase 39: Reconciliation Modal and Completion UX
**Goal**: Users can initiate reconciliation from the Upcoming ledger in a shadcn-first flow instead of instant completion.
**Depends on**: Phase 38
**Requirements**: FLOW-06, UX-02
**Success Criteria** (what must be TRUE):
  1. User can open a reconciliation dialog from an Upcoming ledger row instead of instantly marking the event complete.
  2. User can complete the reconciliation flow through shadcn dialog and input primitives that feel consistent with the current dashboard UI language.
  3. User can use the reconciliation flow on desktop and mobile without the dialog becoming unusable or obscuring the required completion controls.
**Manual Gate**: Stop after execution for manual browser testing and explicit approval before Phase 40 begins.
**Plans**: TBD

### Phase 40: Actual-Based History and Metrics
**Goal**: Users can review settled event outcomes using actual paid values, actual paid chronology, and visible variance wherever this milestone changes completion-derived math.
**Depends on**: Phase 39
**Requirements**: LEDGER-06, LEDGER-07, LEDGER-08, VIEW-07
**Success Criteria** (what must be TRUE):
  1. User sees completed History rows show actual paid amount and actual paid date instead of the original projected completion values.
  2. User sees completed History grouped and ordered by actual paid date so chronology reflects when payment happened.
  3. User sees a clear overpayment or underpayment indicator whenever actual amount differs from the projection.
  4. User can trust completion-derived tracking metrics affected by settled payments to use `actual_amount` and `actual_date` where applicable.
**Manual Gate**: Stop after execution for manual browser testing and explicit approval before milestone closeout.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 38. Reconciliation Contract and Safe Completion API | 2/2 | Complete   | 2026-03-13 |
| 39. Reconciliation Modal and Completion UX | 0/TBD | Not started | - |
| 40. Actual-Based History and Metrics | 0/TBD | Not started | - |

---
*Last updated: 2026-03-13 after creating milestone v4.5 roadmap*
