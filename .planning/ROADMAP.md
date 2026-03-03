# Roadmap: Household Asset & Commitment Tracker (HACT)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 shipped 2026-02-25 (details: `.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v2.0 Auth, Timeline & Data Lifecycle** - Phases 8-13 shipped 2026-03-02 with accepted tech debt (details: `.planning/milestones/v2.0-ROADMAP.md`, audit: `.planning/milestones/v2.0-MILESTONE-AUDIT.md`)
- 🚧 **v3.0 Data Portability** - Phases 14-18 in progress (roadmap defined, execution pending)

## Overview

v3.0 delivers secure, scope-correct ledger portability as downloadable `.xlsx` backups with complete cross-sheet fidelity, spreadsheet-safe sanitization, and user-visible export flow states.

## Phases

**Phase Numbering:**
- Integer phases (14, 15, 16): Planned milestone work
- Decimal phases (14.1, 14.2): Urgent insertions if needed

- [x] **Phase 14: Export Entry and Scope Enforcement** - Establish the user entry point and server-authoritative RBAC export scope. (completed 2026-03-03)
- [x] **Phase 15: Assets and Contracts Workbook Model** - Deliver readable asset and contract sheet contracts with stable relationship references. (completed 2026-03-03)
- [ ] **Phase 16: Event History and Downloadable Workbook** - Complete event sheet fidelity and stream final three-sheet workbook download.
- [ ] **Phase 17: Workbook Safety and Usability Defaults** - Apply spreadsheet-safe sanitization plus usability/date formatting defaults.
- [ ] **Phase 18: Export Feedback UX and Audit Visibility** - Finalize resilient frontend export states and audit attribution traceability.

## Phase Details

### Phase 14: Export Entry and Scope Enforcement
**Goal**: Users can start an export from the app and receive data only from their server-resolved scope.
**Depends on**: Phase 13
**Requirements**: UXEX-01, SCOP-01, SCOP-02, SCOP-03, SCOP-04
**Success Criteria** (what must be TRUE):
  1. User can find and trigger an `Export Backup` action from a management surface.
  2. Standard user export includes only records from that user's resolved owner scope.
  3. Admin in all-data mode can export all eligible household records.
  4. Admin in lens mode exports only selected-lens records, and client owner-id input cannot widen export scope.
**Plans**: 2 plans

Plans:
- [x] 14-01-PLAN.md - Establish server-authoritative export scope route and SCOP regression matrix.
- [x] 14-02-PLAN.md - Add shell Export Backup entry action with scope-aware trigger tests.

### Phase 15: Assets and Contracts Workbook Model
**Goal**: Users get readable `Assets` and `Financial Contracts` sheets with stable relationship context.
**Depends on**: Phase 14
**Requirements**: EXPT-03, EXPT-04, RELA-01
**Success Criteria** (what must be TRUE):
  1. `Assets` sheet shows flattened, human-readable columns for common fields and asset attributes.
  2. `Financial Contracts` sheet includes subtype, recurrence, status, and linked context fields.
  3. Assets and contracts expose parent-child relationship fidelity through stable IDs and readable references.
**Plans**: 2 plans

Plans:
- [x] 15-01-PLAN.md - Build deterministic Assets and Financial Contracts workbook model transforms with relationship-fidelity tests.
- [x] 15-02-PLAN.md - Wire workbook model into export route contract and extend scope-preserving API regressions.

### Phase 16: Event History and Downloadable Workbook
**Goal**: Users can download a complete workbook containing all required ledger sheets and event relationship fidelity.
**Depends on**: Phase 15
**Requirements**: EXPT-01, EXPT-02, EXPT-05, RELA-02
**Success Criteria** (what must be TRUE):
  1. User can trigger export and download a generated `.xlsx` backup file.
  2. Workbook contains `Assets`, `Financial Contracts`, and `Event History` as separate sheets.
  3. `Event History` rows include occurrence/payment lifecycle fields with stable identifiers.
  4. Event rows include references to related contract and asset records when links exist.
**Plans**: TBD

### Phase 17: Workbook Safety and Usability Defaults
**Goal**: Users receive spreadsheet-safe exports with strong default readability and deterministic date behavior.
**Depends on**: Phase 16
**Requirements**: XLSX-01, XLSX-02, SECU-01
**Success Criteria** (what must be TRUE):
  1. Every exported sheet opens with frozen headers and auto-filter enabled.
  2. Date/time columns reflect app locale/timezone preference behavior, with deterministic fallback when unavailable.
  3. Cell values that could execute spreadsheet formulas are sanitized in export output.
**Plans**: TBD

### Phase 18: Export Feedback UX and Audit Visibility
**Goal**: Users get trustworthy export feedback in-app and administrators can trace export actions by actor and lens context.
**Depends on**: Phase 17
**Requirements**: UXEX-02, SECU-02
**Success Criteria** (what must be TRUE):
  1. Export flow shows in-progress/loading state while the backup is being generated.
  2. Successful export shows clear completion feedback to the user.
  3. Failed export shows actionable failure feedback with a clear recovery path.
  4. Export actions are visible in audit history with actor and lens attribution.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. Export Entry and Scope Enforcement | 2/2 | Complete    | 2026-03-03 |
| 15. Assets and Contracts Workbook Model | 2/2 | Complete    | 2026-03-03 |
| 16. Event History and Downloadable Workbook | 0/TBD | Not started | - |
| 17. Workbook Safety and Usability Defaults | 0/TBD | Not started | - |
| 18. Export Feedback UX and Audit Visibility | 0/TBD | Not started | - |
