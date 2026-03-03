---
phase: 17-workbook-safety-and-usability-defaults
verified: 2026-03-03T22:37:59Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Open exported workbook in Excel/Sheets and confirm freeze/filter UX"
    expected: "Each sheet opens with top row frozen and active filter controls visible/usable"
    why_human: "First-open usability in real spreadsheet apps is a client UX behavior beyond static workbook parsing"
  - test: "Validate date display consistency across spreadsheet clients"
    expected: "Date columns render consistently with expected yyyy-mm-dd readability and no locale-dependent surprises"
    why_human: "Display rendering differs by spreadsheet client settings and cannot be fully proven by unit/API parsing alone"
---

# Phase 17: Workbook Safety and Usability Defaults Verification Report

**Phase Goal:** Users receive spreadsheet-safe exports with strong default readability and deterministic date behavior.
**Verified:** 2026-03-03T22:37:59Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Date/time export cells follow one locale/timezone policy with deterministic fallback | ✓ VERIFIED | `src/domain/exports/workbook-safety.js:35` resolves policy defaults; `src/domain/exports/workbook-model.js:363` applies one resolved policy; verified by `test/api/exports-backup-scope.test.js:280` and `test/api/exports-backup-scope.test.js:302` |
| 2 | Invalid/unparseable date inputs render one explicit marker across sheets | ✓ VERIFIED | `src/domain/exports/workbook-safety.js:64` emits `invalidDateMarker`; cross-sheet assertions in `test/domain/exports/workbook-model.test.js:469` and `test/domain/exports/workbook-safety.test.js:45` |
| 3 | Formula-trigger text (`=`, `+`, `-`, `@`) is apostrophe-prefixed | ✓ VERIFIED | `src/domain/exports/workbook-safety.js:8` + `src/domain/exports/workbook-safety.js:28`; projection-wide application in `src/domain/exports/workbook-model.js:258`; binary export assertions in `test/api/exports-backup-scope.test.js:345` |
| 4 | Safe numeric/date values remain typed (no blanket string coercion) | ✓ VERIFIED | Non-string no-op in `src/domain/exports/workbook-safety.js:24`; Date preservation in `src/domain/exports/workbook-safety.js:106`; serializer formats Date cells only (`src/domain/exports/workbook-xlsx.js:59`) and test confirms Date cell type (`test/domain/exports/workbook-xlsx.test.js:92`) |
| 5 | Every workbook sheet has frozen header and auto-filter defaults, including header-only sheets | ✓ VERIFIED | Defaults in `src/domain/exports/workbook-xlsx.js:45` and `src/domain/exports/workbook-xlsx.js:54`; header-only/sheet-wide assertions in `test/domain/exports/workbook-xlsx.test.js:97` and `test/api/exports-backup-scope.test.js:57` |
| 6 | Serialized workbook preserves typed values and does not undo sanitization | ✓ VERIFIED | Serializer adds rows directly from model values (`src/domain/exports/workbook-xlsx.js:79`) and only sets Date numFmt (`src/domain/exports/workbook-xlsx.js:57`); binary assertions in `test/domain/exports/workbook-xlsx.test.js:106` |
| 7 | Export route passes locale/timezone context when available, with deterministic fallback when absent | ✓ VERIFIED | Route resolves prefs from scope/actor/session/headers in `src/api/routes/exports.routes.js:117` and passes via `export_preferences` in `src/api/routes/exports.routes.js:55`; covered in API tests `test/api/exports-backup-scope.test.js:280` and `test/api/exports-backup-scope.test.js:302` |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/domain/exports/workbook-safety.js` | Central sanitizer/date policy boundary | ✓ VERIFIED | Exists, substantive implementation (117 lines), imported by model and route (`src/domain/exports/workbook-model.js:17`, `src/api/routes/exports.routes.js:8`) |
| `src/domain/exports/workbook-model.js` | Workbook projection using centralized policy | ✓ VERIFIED | Exists, substantive implementation (395 lines), wired to API route and tests (`src/api/routes/exports.routes.js:6`, `test/domain/exports/workbook-model.test.js:15`) |
| `test/domain/exports/workbook-safety.test.js` | Unit coverage for sanitizer/date policy | ✓ VERIFIED | Exists and exercises trigger prefixes, fallback policy, invalid markers, Date typing (`test/domain/exports/workbook-safety.test.js:11`) |
| `test/domain/exports/workbook-model.test.js` | Regression coverage for cross-sheet safety/policy behavior | ✓ VERIFIED | Exists and validates cross-sheet sanitization + preference/fallback date behavior (`test/domain/exports/workbook-model.test.js:392`) |
| `src/domain/exports/workbook-xlsx.js` | Serializer defaults and typed cell handling | ✓ VERIFIED | Exists, applies freeze/filter defaults + Date formatting (`src/domain/exports/workbook-xlsx.js:45`, `src/domain/exports/workbook-xlsx.js:57`) |
| `src/api/routes/exports.routes.js` | Request-context preference wiring into workbook export | ✓ VERIFIED | Exists, resolves preferences and passes to workbook model (`src/api/routes/exports.routes.js:51`) |
| `test/domain/exports/workbook-xlsx.test.js` | Serializer regression tests for usability defaults and typing | ✓ VERIFIED | Exists and asserts sheet order/defaults/Date typing (`test/domain/exports/workbook-xlsx.test.js:59`) |
| `test/api/exports-backup-scope.test.js` | E2E export assertions across scope and preference/fallback paths | ✓ VERIFIED | Exists and parses workbook bytes for usability/sanitization/date behavior (`test/api/exports-backup-scope.test.js:89`) |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/domain/exports/workbook-model.js` | `src/domain/exports/workbook-safety.js` | single normalization boundary for projected export cells | WIRED | Imports and uses `sanitizeWorkbookTextCell`, `toExportDateCell`, `resolveExportDatePolicy` (`src/domain/exports/workbook-model.js:18`, `src/domain/exports/workbook-model.js:258`, `src/domain/exports/workbook-model.js:363`) |
| `src/domain/exports/workbook-model.js` | `src/domain/exports/workbook-formatters.js` | shared enum/reference/marker behavior | WIRED | Imports and uses `formatEnumLabel`, `resolveReadableReference`, `EXPLICIT_MARKERS` in row projection (`src/domain/exports/workbook-model.js:9`, `src/domain/exports/workbook-model.js:192`) |
| `test/domain/exports/workbook-model.test.js` | `src/domain/exports/workbook-model.js` | formula/date fallback assertions | WIRED | Test imports model and asserts apostrophe prefix + invalid marker + Date behavior (`test/domain/exports/workbook-model.test.js:15`, `test/domain/exports/workbook-model.test.js:462`) |
| `src/api/routes/exports.routes.js` | `src/domain/exports/workbook-model.js` | route passes resolved date preference context | WIRED | Route resolves locale/timezone and passes as `export_preferences` to `buildWorkbookModel` (`src/api/routes/exports.routes.js:53`) |
| `src/domain/exports/workbook-xlsx.js` | `src/domain/exports/workbook-model.js` | serializer consumes typed/sanitized row values | WIRED | Contract boundary verified through route path (`src/api/routes/exports.routes.js:53` -> `src/api/routes/exports.routes.js:57`) and binary serializer tests (`test/domain/exports/workbook-xlsx.test.js:106`) |
| `test/api/exports-backup-scope.test.js` | `GET /exports/backup.xlsx` | workbook parse assertions across scope modes | WIRED | API tests validate content-disposition, sheet names, scope rows, preference/fallback dates, and sanitization (`test/api/exports-backup-scope.test.js:93`, `test/api/exports-backup-scope.test.js:323`) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| XLSX-01 | `17-02-PLAN.md` | Each export sheet has frozen headers and auto-filter enabled by default | ✓ SATISFIED | Serializer defaults in `src/domain/exports/workbook-xlsx.js:45`; tests in `test/domain/exports/workbook-xlsx.test.js:59` and `test/api/exports-backup-scope.test.js:57` |
| XLSX-02 | `17-01-PLAN.md`, `17-02-PLAN.md` | Date/time columns use app locale/timezone behavior or deterministic fallback | ✓ SATISFIED | Policy resolver in `src/domain/exports/workbook-safety.js:35`; route preference wiring in `src/api/routes/exports.routes.js:117`; tests in `test/api/exports-backup-scope.test.js:280` |
| SECU-01 | `17-01-PLAN.md`, `17-02-PLAN.md` | Export output sanitizes formula-triggering values | ✓ SATISFIED | Sanitizer in `src/domain/exports/workbook-safety.js:23`; model application in `src/domain/exports/workbook-model.js:258`; binary export assertion in `test/api/exports-backup-scope.test.js:323` |

Requirement ID cross-reference (plans vs `REQUIREMENTS.md`):
- Declared in phase plans: `XLSX-01`, `XLSX-02`, `SECU-01`
- Mapped to Phase 17 in `.planning/REQUIREMENTS.md`: `XLSX-01`, `XLSX-02`, `SECU-01`
- Orphaned requirement IDs for Phase 17: none

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None | - | No TODO/FIXME/placeholder/stub implementations detected in phase key files | - | No blocker or warning anti-patterns found |

### Human Verification Required

### 1. Spreadsheet App First-Open Usability

**Test:** Generate `/exports/backup.xlsx` from the app and open in Excel Desktop and Google Sheets.
**Expected:** `Assets`, `Financial Contracts`, and `Event History` each open with row 1 frozen and filter controls active.
**Why human:** Spreadsheet client UX behavior must be confirmed in real viewers, not only workbook parsing.

### 2. Cross-Client Date Rendering Sanity

**Test:** Export with and without timezone headers, then open in at least two spreadsheet clients.
**Expected:** Dates remain deterministic and readable (`yyyy-mm-dd` style) without formula-like coercion or locale surprises.
**Why human:** Final rendering and locale presentation depend on client settings outside test runtime.

### Gaps Summary

No code gaps found. All must-have truths, artifacts, key links, and requirement IDs are satisfied in code and automated tests. Remaining work is human validation of spreadsheet-client display behavior.

---

_Verified: 2026-03-03T22:37:59Z_
_Verifier: Claude (gsd-verifier)_
