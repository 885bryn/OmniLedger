# Phase 27: Frequency Rule Contract - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Define a single, predictable summary rule for recurring and one-time financial items so asset-level obligation, income, and net cashflow rollups are mathematically clear before cadence switching is introduced in later phases.

</domain>

<decisions>
## Implementation Decisions

### One-time item rule
- One-time commitments and one-time income use the same policy.
- One-time values count once by due period, not as always-on totals and not as blanket prorated values.
- One-time values outside the active period are excluded from summary totals.
- Show a visible rule hint so users understand one-time period behavior.

### Reference window contract
- Use a monthly baseline for this phase's summary contract.
- Period boundaries are calendar-based, not rolling windows.
- Boundary dates are inclusive (start/end dates count as inside period).
- Show active period context in the summary area so users know what totals represent.

### Edge-case semantics
- Overdue items are included when their due date is in the active period.
- Future-dated items outside active period are excluded until they enter period.
- Zero/null/malformed amounts are excluded from totals with clear guardrail behavior.
- Edge-case handling remains symmetric between obligations and income.

### User-facing wording
- Labels should explicitly include period context (for example, monthly obligations).
- Helper text tone should be educational but concise.
- When wording tradeoffs appear, prioritize readability while preserving correctness.
- Net cashflow should explicitly indicate it is derived from normalized income minus obligations.

### Claude's Discretion
- Exact phrasing and placement of helper text, as long as period inclusion rules remain explicit.
- Exact empty/fallback copy for excluded invalid amounts, as long as totals stay mathematically consistent.

</decisions>

<specifics>
## Specific Ideas

- The user wants to eliminate current confusion where yearly values appear as if they are monthly.
- The summary contract must make mixed-frequency data trustworthy before cadence toggles are added.
- All three rollup fields (obligations, income, net cashflow) should feel tied to one coherent rule set.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 27-frequency-rule-contract*
*Context gathered: 2026-03-07*
