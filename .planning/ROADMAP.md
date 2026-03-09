# Roadmap: Household Asset & Commitment Tracker (HACT)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 shipped 2026-02-25 (`.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v2.0 Auth, Timeline & Data Lifecycle** - Phases 8-13 shipped 2026-03-02 (`.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-MILESTONE-AUDIT.md`)
- ✅ **v3.0 Data Portability** - Phases 14-18 shipped 2026-03-04 (`.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v3.0-MILESTONE-AUDIT.md`)
- ✅ **v4.0 Interactive Production Deployment for Ugreen NAS** - Phases 19-23 shipped 2026-03-07 (`.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.0-REQUIREMENTS.md`, `.planning/milestones/v4.0-MILESTONE-AUDIT.md`)
- ✅ **v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion** - Phases 24-26 shipped 2026-03-07 (`.planning/milestones/v4.1-ROADMAP.md`, `.planning/milestones/v4.1-REQUIREMENTS.md`, `.planning/milestones/v4.1-MILESTONE-AUDIT.md`)
- 🚧 **v4.2 Cashflow Frequency Normalization & Cadence Toggle** - Phases 27-29 (planned)

## Phases

<details>
<summary>Shipped milestone history</summary>

- v1.0 MVP - Phases 1-7
- v2.0 Auth, Timeline & Data Lifecycle - Phases 8-13
- v3.0 Data Portability - Phases 14-18
- v4.0 Interactive Production Deployment for Ugreen NAS - Phases 19-23
- v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion - Phases 24-26

</details>

### 🚧 v4.2 Cashflow Frequency Normalization & Cadence Toggle (In Progress)

**Milestone Goal:** Make per-asset cashflow rollups mathematically correct across billing frequencies and user-selectable cadence views while preserving existing RBAC/audit/deployment guarantees.

- [x] **Phase 27: Frequency Rule Contract** - Establish predictable normalization rules, including one-time handling, without changing non-summary workflows. (completed 2026-03-08)
- [x] **Phase 28: Cadence-Normalized Totals** - Deliver cadence-correct obligation and income totals for weekly, monthly, and yearly views. (completed 2026-03-08)
- [x] **Phase 29: Cadence Toggle & Synced Cashflow View** - Add cadence switching with synchronized cards, clear units, and net cashflow derived from normalized totals. (completed 2026-03-08)

## Phase Details

### Phase 27: Frequency Rule Contract
**Goal**: Users get predictable summary behavior for recurring and one-time financial items before cadence-view expansion.
**Depends on**: Phase 26
**Requirements**: CASH-04
**Success Criteria** (what must be TRUE):
  1. User sees one-time obligations and income handled by one consistent summary rule instead of ad-hoc behavior.
  2. User sees the same one-time handling outcome anywhere the asset summary is rendered.
  3. User can still use existing item and event workflows without new required steps or broken paths.
**Plans**: 3 plans
Plans:
- [x] 27-01-PLAN.md - Lock backend one-time monthly period contract and net-status metadata
- [x] 27-02-PLAN.md - Surface period-aware summary wording and one-time rule hint in item detail UI
- [x] 27-03-PLAN.md - Close one-time future-month leakage in monthly obligations with regression tests

### Phase 28: Cadence-Normalized Totals
**Goal**: Users can trust that obligation and income rollups reflect each item's billing frequency in the selected cadence.
**Depends on**: Phase 27
**Requirements**: CASH-01, CASH-02
**Success Criteria** (what must be TRUE):
  1. User sees obligation totals change correctly between weekly, monthly, and yearly views for mixed-frequency data.
  2. User sees income totals change correctly between weekly, monthly, and yearly views for mixed-frequency data.
  3. User sees equivalent values remain mathematically consistent when switching cadence (for example, weekly x 52 aligns with yearly expectations).
**Plans**: 2 plans
Plans:
- [x] 28-01-PLAN.md - Implement recurring cadence-normalized totals contract and one-time separation in net-status summary
- [x] 28-02-PLAN.md - Add API regression coverage for mixed-frequency cadence normalization and equivalence guarantees

### Phase 29: Cadence Toggle & Synced Cashflow View
**Goal**: Users can switch cadence and immediately read synchronized obligation, income, and net cashflow values with clear units and no workflow regressions.
**Depends on**: Phase 28
**Requirements**: CASH-03, VIEW-01, VIEW-02, VIEW-03, SAFE-01
**Success Criteria** (what must be TRUE):
  1. User can switch cadence on the asset summary between weekly, monthly, and yearly.
  2. User sees obligation, income, and net cashflow cards update together after each cadence change.
  3. User sees summary labels and units that clearly match the active cadence.
  4. User sees net cashflow always equal cadence-normalized income minus cadence-normalized obligations.
  5. User can continue existing item/event workflows and audit-visible behaviors with no RBAC or deployment-contract regressions.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 27. Frequency Rule Contract | 3/3 | Complete    | 2026-03-08 |
| 28. Cadence-Normalized Totals | 2/2 | Complete    | 2026-03-08 |
| 29. Cadence Toggle & Synced Cashflow View | 3/3 | Complete   | 2026-03-09 |

---
*Last updated: 2026-03-09 after re-executing phase 29 plan 02*
