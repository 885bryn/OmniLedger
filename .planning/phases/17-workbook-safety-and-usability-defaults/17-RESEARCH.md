# Phase 17: Workbook Safety and Usability Defaults - Research

**Researched:** 2026-03-03
**Domain:** XLSX export hardening (usability defaults, date/time determinism, formula-injection safety)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XLSX-01 | Each export sheet has frozen headers and auto-filter enabled by default. | Keep current `worksheet.views` + `worksheet.autoFilter` defaults in serializer and expand tests to include sparse/empty sheets and all sheet names. |
| XLSX-02 | Date/time columns use app locale/timezone preference behavior (or deterministic fallback when preference is unavailable). | Introduce explicit export date policy + formatter boundary that reads preference context, applies deterministic fallback, and marks invalid/unparseable values explicitly. |
| SECU-01 | Export output sanitizes cell values that could trigger spreadsheet formula execution. | Add centralized text-cell sanitizer for all user-provided string fields before worksheet row emission; verify trigger-prefix coverage and non-string type preservation. |
</phase_requirements>

## Summary

Phase 16 already implemented part of this phase's goal in `src/domain/exports/workbook-xlsx.js`: all sheets get frozen top-row headers and an `autoFilter` range, including header-only sheets (`A1:A1`) via `lastRow = Math.max(1, rowCount + 1)`. Tests in `test/domain/exports/workbook-xlsx.test.js` already lock this behavior. Planning should treat XLSX-01 as "protect and tighten" rather than net-new architecture.

The two real implementation deltas are date/time behavior and formula-injection hardening. Current export shaping in `src/domain/exports/workbook-model.js` + `src/domain/exports/workbook-formatters.js` stringifies many values (`formatDate` returns `YYYY-MM-DD` via `toISOString().slice(0,10)`, `formatAmount` returns fixed strings). That conflicts with the locked decision to keep safe numeric/date values native where possible. Planning should include a data-contract adjustment (value + type intent), not only patch-level string replacement.

Primary recommendation: implement a single export-cell normalization pipeline used by all sheets that (1) preserves native numeric/date types, (2) applies deterministic locale/timezone date rendering policy, and (3) sanitizes formula-triggering text values globally before XLSX serialization.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `exceljs` | `^4.4.0` (repo) | XLSX workbook/worksheet generation | Already in production path (`serializeWorkbookToXlsx`), supports frozen views, auto-filters, Date cell values, and `numFmt` styling in one library. |
| Node Intl (`Intl.DateTimeFormat`) | Runtime built-in | Locale/timezone-aware deterministic formatting | First-party API for locale/timezone formatting; supports explicit `timeZone`, locale list, and `resolvedOptions()` inspection. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Jest | `^29.7.0` (repo) | Regression and domain behavior tests | Lock sanitization, date fallback, and workbook sheet defaults in unit/integration tests. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native Date + Excel cell formatting | Pre-formatted date strings only | Easier output assertions, but loses numeric/date typing and conflicts with locked decision to keep native numeric/date cells where safe. |
| Central sanitizer in export pipeline | Per-field ad hoc escaping | Faster initially, but high miss risk and poor proof of global coverage (SECU-01). |

**Installation:**
```bash
npm install
```

## Architecture Patterns

### Recommended Project Structure
```text
src/domain/exports/
  workbook-model.js          # Sheet row projection + typed cell intent
  workbook-formatters.js     # Shared formatting + explicit markers
  workbook-safety.js         # NEW: centralized text sanitizer + value typing policy
  workbook-xlsx.js           # ExcelJS serializer + sheet defaults + column formatting

test/domain/exports/
  workbook-model.test.js
  workbook-xlsx.test.js
  workbook-safety.test.js    # NEW: focused sanitizer and trigger-prefix coverage
```

### Pattern 1: Central Cell Normalization Boundary
**What:** Introduce one function that receives projected row payloads and returns safe, typed cell values (`string | number | Date`) plus any display metadata (for example date format intent).
**When to use:** For every sheet row before `worksheet.addRow(...)`.
**Why:** Prevents drift where some sheets sanitize/format while others do not.

### Pattern 2: Policy-Driven Date/Time Formatting
**What:** Define explicit precedence for locale/timezone selection (user preference if available, otherwise deterministic fallback constants), then apply uniformly for all date/time columns.
**When to use:** In formatters/model projection, not scattered in route handlers.
**Why:** Avoids non-deterministic output based on host/server timezone.

### Pattern 3: Serializer Responsibilities Stay Narrow
**What:** Keep `workbook-xlsx.js` focused on workbook structure (sheet order, header row, freeze/filter defaults, style application), not business decisions.
**When to use:** Always; business policy belongs in model/formatter/safety layer.

### Anti-Patterns to Avoid
- **Ad hoc field-by-field sanitization:** easy to miss user-provided text in overflow/derived fields.
- **Relying on `new Date(...).toISOString().slice(0,10)` for locale behavior:** deterministic, but UTC-only and not preference-aware.
- **Converting all values to strings for convenience:** breaks locked decision on native numeric/date cells.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XLSX structure + sheet features | Manual OpenXML writer | `exceljs` workbook/worksheet API | Existing dependency already supports required features (views, autoFilter, Date cells, `numFmt`) with lower defect risk. |
| Locale/timezone date rendering | Custom token parser/formatter | `Intl.DateTimeFormat` with explicit options | Standard API with locale fallback behavior and explicit timezone control. |
| Formula-injection defense | Per-screen/per-sheet custom escaping | One export-domain sanitizer utility | Security behavior must be globally provable and testable once. |

**Key insight:** Phase 17 success is mostly about consistency guarantees; centralized policy functions reduce both security escape risk and cross-sheet drift.

## Common Pitfalls

### Pitfall 1: Sanitizing Too Late or Too Narrowly
**What goes wrong:** Some text paths (for example `attributes_overflow`, fallback labels, titles) bypass sanitization.
**Why it happens:** Sanitization is done at selected call sites rather than at a mandatory boundary.
**How to avoid:** Make row emission pass through one sanitizer that handles every string cell.
**Warning signs:** New columns added without corresponding sanitizer/test updates.

### Pitfall 2: Timezone Drift by Runtime Environment
**What goes wrong:** Same data exports differently between local/dev/prod because host timezone differs.
**Why it happens:** Formatter uses implicit runtime defaults instead of explicit timezone.
**How to avoid:** Resolve timezone once from user preference or deterministic fallback, pass it explicitly to formatter.
**Warning signs:** Snapshot/date tests pass only on one machine or fail around midnight UTC offsets.

### Pitfall 3: Breaking Existing Contract Assumptions
**What goes wrong:** Changing to native date/number cells causes assertion churn and potential downstream parsing surprises.
**Why it happens:** Current tests and model heavily assume string output.
**How to avoid:** Plan a staged migration: adjust tests first around typed behavior expectations, then refactor model/serializer.
**Warning signs:** Large unrelated test failures after seemingly small formatter changes.

### Pitfall 4: Over-Sanitizing Non-Text Fields
**What goes wrong:** Apostrophe-prefix applied to number/date fields, degrading usability and violating locked decision.
**Why it happens:** Sanitizer runs without type discrimination.
**How to avoid:** Sanitize only strings; preserve `number` and `Date` values.
**Warning signs:** Excel displays green "number stored as text" indicators for numeric columns.

## Code Examples

Verified patterns from current code and official docs:

### Frozen headers + auto-filter defaults (existing repo pattern)
```javascript
function applySheetDefaults(worksheet, columnCount, rowCount) {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  if (columnCount <= 0) return;

  const lastColumn = toColumnLetter(columnCount);
  const lastRow = Math.max(1, rowCount + 1);
  worksheet.autoFilter = `A1:${lastColumn}${lastRow}`;
}
```
Source: `src/domain/exports/workbook-xlsx.js`

### ExcelJS date and number format support (official)
```javascript
worksheet.getCell('A1').value = new Date(2017, 2, 15);
worksheet.getCell('A1').numFmt = 'dd/mm/yyyy';
```
Source: https://raw.githubusercontent.com/exceljs/exceljs/master/README.md

### Locale/timezone-aware deterministic formatting (JS standard)
```javascript
const formatter = new Intl.DateTimeFormat(locale, {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const rendered = formatter.format(new Date(input));
```
Source: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat

### Formula-injection trigger character policy (security reference)
```text
Treat leading '=', '+', '-', '@' as formula-triggering.
For text cells starting with those prefixes, prepend apostrophe.
```
Source: https://owasp.org/www-community/attacks/CSV_Injection

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON envelope export route | XLSX attachment bytes generated by serializer | Phase 16 | Workbook behavior now controlled in export domain code and testable through parsed workbook output. |
| Implicit sheet UX defaults | Explicit freeze/filter defaults in serializer | Phase 16 | XLSX-01 mostly in place; phase needs guardrails and broader regression coverage. |
| ISO-like date strings (`toISOString().slice(0,10)`) in model | Pending locale/timezone policy required by XLSX-02 | Phase 17 target | Requires contract and formatter changes to satisfy preference + deterministic fallback requirements. |

**Deprecated/outdated for this phase:**
- String-only date handling as the default representation for all date columns.
- Sheet-specific sanitization logic.

## Open Questions

1. **Where do locale/timezone preferences come from in backend export context?**
   - What we know: current backend auth/scope context exposes actor/scope but no locale/timezone fields.
   - What's unclear: whether preference exists in DB/session and is simply not wired, or must be added.
   - Recommendation: define a small resolver API (for example `resolveExportDatePreferences(req)`), with deterministic fallback constants committed in code.

2. **Should date columns be exported as native Date cells with `numFmt`, localized strings, or hybrid by column type?**
   - What we know: locked decisions require native numeric/date preservation where safe.
   - What's unclear: exact compatibility expectations for downstream imports/re-parsing by users.
   - Recommendation: default to native Date cells + explicit `numFmt` where possible; use explicit marker strings only for invalid/unparseable values.

3. **Is apostrophe-only sanitization sufficient for all target spreadsheet apps?**
   - What we know: user decision explicitly locks apostrophe prefix for trigger characters `= + - @`.
   - What's unclear: whether additional leading characters (`\t`, `\r`, `\n`) should be handled despite lock.
   - Recommendation: implement exactly locked policy now; document potential hardening follow-up for broader trigger sets if required.

## Sources

### Primary (HIGH confidence)
- Repository code: `src/domain/exports/workbook-xlsx.js`, `src/domain/exports/workbook-model.js`, `src/domain/exports/workbook-formatters.js`
- Repository tests: `test/domain/exports/workbook-xlsx.test.js`, `test/domain/exports/workbook-model.test.js`
- ExcelJS official README: https://raw.githubusercontent.com/exceljs/exceljs/master/README.md

### Secondary (MEDIUM confidence)
- MDN Intl.DateTimeFormat: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat
- MDN Date.toISOString: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString

### Tertiary (LOW confidence)
- OWASP CSV Injection guidance (CSV-focused, applied by analogy to spreadsheet formula-trigger risk in exports): https://owasp.org/www-community/attacks/CSV_Injection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing dependency and in-repo usage are clear.
- Architecture: HIGH - current module boundaries and tests make migration path concrete.
- Pitfalls: MEDIUM - security nuances across spreadsheet apps vary; core trigger-policy is user-locked.

**Research date:** 2026-03-03
**Valid until:** 2026-04-02
