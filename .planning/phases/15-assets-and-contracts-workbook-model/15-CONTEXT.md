# Phase 15: Assets and Contracts Workbook Model - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver readable `Assets` and `Financial Contracts` export sheets with stable relationship context, including parent-child fidelity and cross-sheet linkage clarity.

This phase defines sheet structure, ordering, and value presentation for these two sheets only. Workbook download mechanics, event-history sheet fidelity, and richer UX feedback remain in later phases.

</domain>

<decisions>
## Implementation Decisions

### Column design
- Use a comprehensive baseline column set for `Assets`, including identity, ownership, lifecycle, and common attribute fields.
- In `Financial Contracts`, include both core contract fields and derived lifecycle/status context together for single-row readability.
- Flatten long/freeform attributes as: common top keys as dedicated columns plus one overflow raw JSON/text column.
- Keep column order strictly stable and deterministic across exports.

### Relationship columns
- Represent parent-child fidelity with both stable IDs and readable name/title columns.
- Represent contract-asset linkage in both directions where applicable (contracts reference assets, assets reference linked contracts).
- For missing/unresolved relationships, use explicit unresolved markers instead of ambiguous blanks.
- Place relationship columns near identity columns to improve initial scan comprehension.

### Row ordering rules
- `Assets` default order: asset type first, then name/title.
- `Financial Contracts` default order: status first, then next due date.
- Tie-breakers use stable IDs for deterministic ordering.
- When tradeoffs appear, prioritize machine-stable determinism over ad-hoc readability changes.

### Value formatting rules
- Show enum-like values (status/type/frequency) as human-readable labels.
- Represent empty/null values with explicit markers (for example, `N/A`) rather than silent blanks.
- Format money/numeric amounts with fixed two-decimal precision.
- Prefer ISO-like stable date/time representation for consistent sorting and comparison.

### Claude's Discretion
- Exact final column names and casing conventions, as long as they remain human-readable and stable.
- Exact unresolved marker strings per field (for example, `N/A`, `UNLINKED`, `UNKNOWN`) while preserving explicitness.

</decisions>

<specifics>
## Specific Ideas

- Emphasis on deterministic exports for repeat diffing and downstream tooling.
- Human readability is expected, but not at the expense of ordering/shape stability.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 15-assets-and-contracts-workbook-model*
*Context gathered: 2026-03-03*
