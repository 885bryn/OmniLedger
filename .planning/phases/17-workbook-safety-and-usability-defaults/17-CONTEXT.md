# Phase 17: Workbook Safety and Usability Defaults - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver spreadsheet-safe export defaults and first-open usability behavior for all workbook sheets. This phase defines sanitization behavior, date/time presentation with deterministic fallback, and consistent sheet usability defaults (frozen headers + filters) without adding new export capabilities.

</domain>

<decisions>
## Implementation Decisions

### Formula sanitization policy
- If a text cell starts with spreadsheet-trigger characters (`=`, `+`, `-`, `@`), sanitize by prefixing an apostrophe.
- Apply sanitization to all user-provided text fields across all workbook sheets.
- Prioritize safety over visual parity whenever they conflict.
- Keep already-safe numeric/date fields as native values (do not stringify all cells).

### Date/time localization rules
- When user locale/timezone preference exists, exported date/time values should honor that preference.
- When preference is unavailable, apply one deterministic fallback behavior everywhere.
- Date/time presentation should be uniform across all sheets.
- Invalid/unparseable date values should use explicit markers (not ambiguous blanks).

### Freeze/filter consistency
- Apply frozen headers and auto-filters identically on all exported sheets.
- Keep freeze/filter defaults enabled regardless of sheet row count.
- For header-only sheets (zero data rows), preserve visible headers with filter-ready behavior.
- Enforce best-effort consistency in export settings across spreadsheet apps; minor app-specific rendering differences are acceptable.

### Claude's Discretion
- Exact fallback date format string and locale/timezone precedence details, as long as fallback remains deterministic and uniform.
- Exact marker text for invalid/unparseable date values, as long as markers are explicit and consistent.
- Exact user-text field detection rules, as long as sanitization coverage remains global for user-provided text.

</decisions>

<specifics>
## Specific Ideas

- Strong preference for predictable first-open behavior across all sheets, including sparse or empty outputs.
- Explicit safety intent: values should never execute formulas when opened in spreadsheet software.
- Safety should not degrade numeric/date cell typing where values are already safe.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 17-workbook-safety-and-usability-defaults*
*Context gathered: 2026-03-03*
