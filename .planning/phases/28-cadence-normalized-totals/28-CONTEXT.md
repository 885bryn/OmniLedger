# Phase 28: Cadence-Normalized Totals - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver cadence-correct obligation and income rollups for weekly, monthly, and yearly views using each recurring item's billing frequency, while preserving the Phase 27 one-time inclusion contract.

</domain>

<decisions>
## Implementation Decisions

### Conversion contract
- Use a yearly baseline as the source of truth for normalization, then derive monthly and weekly outputs from that baseline.
- Treat recurring cadence factors as strict constants: 52 weeks per year and 12 months per year.
- If recurring frequency is missing or invalid at summary time, exclude the row and increment exclusion metadata instead of defaulting silently.
- Return all cadence totals in one payload for both obligations and income.

### Rounding and consistency
- Keep full precision during item-level conversion and round only final cadence totals.
- Emit normalized obligation and income totals at 2 decimal places.
- Use bankers rounding (round half to even) for half-cent boundaries.
- Treat cross-cadence equivalence checks as valid within a 0.01 tolerance.

### One-time handling in normalized summaries
- Preserve the Phase 27 rule: one-time items contribute only when due date is inside the active monthly period.
- Keep active-period boundaries inclusive (start and end dates included).
- Do not treat one-time values as recurring cadence amounts.
- Expose one-time impact as a separate period-bounded field rather than blending into recurring normalized totals.
- Keep explicit one-time rule and active-period metadata in summary output.

### Validation examples and coverage
- Use a mixed-frequency acceptance mix containing monthly obligation(s), weekly obligation(s), yearly obligation(s), and recurring income in one asset.
- Include invalid/zero/malformed amount rows in regression coverage and verify exclusion behavior.
- Enforce equivalence assertions for both monthly<->yearly and weekly<->yearly relationships using agreed tolerance.
- Anchor this phase's confidence in backend API contract tests first.

### Claude's Discretion
- Exact naming of cadence-total fields and one-time separate field, as long as semantics above remain explicit.
- Exact internal conversion helper structure and test fixture shape, as long as the locked contract is preserved.

</decisions>

<specifics>
## Specific Ideas

- Keep recurring run-rate totals mathematically trustworthy when users compare cadence views.
- Avoid silent fallback behavior that could hide bad frequency data.
- Prepare payload contract so Phase 29 cadence toggle can switch views without recalculation ambiguity.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 28-cadence-normalized-totals*
*Context gathered: 2026-03-07*
