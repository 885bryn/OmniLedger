# Phase 10: Financial Contract-Occurrence Foundation - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 delivers a unified financial parent model with child occurrences: users create and manage `FinancialItem` parents, view and update linked `Event` occurrences with owner scope, instantiate one-time entries as parent+first occurrence immediately, and apply recurrence baseline behavior that stops future projection when contracts close.

</domain>

<decisions>
## Implementation Decisions

### Contract creation behavior
- Use a single guided form with conditional fields, not a wizard.
- Require core save data with sensible defaults.
- Asset link should be encouraged when applicable (for example mortgage-like entries), but never hard-required.
- If no asset is linked, allow save with a soft warning and confirmation.
- One-time entries must create both parent and first occurrence immediately.

### Occurrence management flow
- Default occurrence view should prioritize upcoming/current items first.
- Keep history visible in a separate section or clearly separated grouping.
- Lock baseline behavior to compact inline row actions for common operations.
- Use status-focused occurrence edits as the default-safe interaction model.
- When a contract closes, stop generating new future projections while preserving history.

### Recurrence UX
- Use preset recurrence intervals as the primary model (no advanced custom-rule builder in this phase).
- Editing a projected future occurrence should instantiate that date as a persisted exception.
- Show recurrence state in plain language near contract context (for example, "Monthly, next on ...").

### Validation and error copy
- Show validation with inline field errors plus top summary.
- Use specific, fix-oriented messages for invalid recurrence and form issues.
- Keep policy/ownership denials in neutral policy tone.
- For risky but valid choices (like no linked asset), use warning-and-confirm rather than silent allow or hard block.

### Naming and UI clarity after model unification
- Use `FinancialItem` as the single parent financial entity.
- Treat former `FinancialCommitment` and `FinancialIncome` as subtype values of `FinancialItem`, not separate top-level models.
- UI should label the parent concept as "Financial item" for clarity.
- UI should show subtype explicitly via a visible subtype badge (Commitment/Income).
- No migration banner/modal is required; apply a seamless terminology update in-place.
- Create/edit forms should clearly ask for subtype selection (Commitment or Income).

### Claude's Discretion
- Exact field ordering, spacing, and helper-text placement.
- Visual treatment of badges/icons as long as subtype remains explicit.
- Precise grouping UI for upcoming vs history, while preserving the locked behavior above.

</decisions>

<specifics>
## Specific Ideas

- Keep users oriented during model transition: avoid UI confusion even if backend/data structures change.
- Reflect terminology consistently in UI after unification so users understand that all finance rows are Financial items with a subtype.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 10-financial-contract-occurrence-foundation*
*Context gathered: 2026-02-26*
