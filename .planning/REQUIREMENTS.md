# Requirements: Household Asset & Commitment Tracker (HACT)

**Defined:** 2026-03-07
**Core Value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## v1 Requirements

Requirements for milestone v4.2 cashflow frequency normalization and cadence clarity.

### Cashflow Normalization

- [x] **CASH-01**: User sees per-asset obligation totals converted to the selected cadence (weekly/monthly/yearly) using each financial item's billing frequency.
- [x] **CASH-02**: User sees per-asset income totals converted to the selected cadence (weekly/monthly/yearly) using each financial item's billing frequency.
- [x] **CASH-03**: User sees per-asset net cashflow computed from cadence-normalized obligation and income totals rather than monthly-only assumptions.
- [x] **CASH-04**: User sees non-recurring (`one_time`) financial items handled with a clear, consistent rule so recurring cadence totals remain predictable.

### Cadence Controls & Clarity

- [x] **VIEW-01**: User can switch asset-summary cadence between weekly, monthly, and yearly.
- [x] **VIEW-02**: User sees obligations, income, and net cashflow cards update in sync whenever cadence changes.
- [x] **VIEW-03**: User sees summary labels/units that clearly match the selected cadence.

### Compatibility Guardrail

- [x] **SAFE-01**: User retains existing item/event workflows while only the asset-summary rollup calculations and cadence controls are changed.

## v2 Requirements

Deferred to a future milestone.

### Extended Cadence Options

- **VIEW-04**: User can view quarter-based cadence outputs.
- **VIEW-05**: User can choose independent cadence per summary card instead of one shared selector.

### Advanced Calculation Preferences

- **CASH-05**: User can choose how one-time items contribute to cadence rollups (exclude, prorate, or period-bounded include).

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full dashboard redesign | Milestone is targeted to cashflow rollup correctness and clarity only |
| Financial-item schema redesign | Existing model supports required frequency-aware calculations |
| Changes to RBAC/audit/deployment architecture | Must preserve current production guarantees |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CASH-01 | Phase 28 | Complete |
| CASH-02 | Phase 28 | Complete |
| CASH-03 | Phase 29 | Complete |
| CASH-04 | Phase 27 | Complete |
| VIEW-01 | Phase 29 | Complete |
| VIEW-02 | Phase 29 | Complete |
| VIEW-03 | Phase 29 | Complete |
| SAFE-01 | Phase 29 | Complete |

**Coverage:**
- v1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-09 after phase 29 plan 04 execution*
