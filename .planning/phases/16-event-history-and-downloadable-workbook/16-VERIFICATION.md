---
phase: 16-event-history-and-downloadable-workbook
verified: 2026-03-03T20:55:41Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Real browser download flow and UX feedback"
    expected: "Clicking Export Backup downloads an .xlsx file with a timestamped filename while pending/success/error messages are readable in UI."
    why_human: "Automated tests validate fetch/blob mechanics and text assertions, but cannot fully validate real browser download manager behavior and final UX clarity across environments."
---

# Phase 16: Event History and Downloadable Workbook Verification Report

**Phase Goal:** Users can download a complete workbook containing all required ledger sheets and event relationship fidelity.
**Verified:** 2026-03-03T20:55:41Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Workbook model includes an `Event History` sheet in addition to `Assets` and `Financial Contracts`. | ✓ VERIFIED | `buildWorkbookModel()` returns all three sheets in `src/domain/exports/workbook-model.js:346`, `src/domain/exports/workbook-model.js:357`; test asserts exact sheet set in `test/domain/exports/workbook-model.test.js:260`. |
| 2 | Event rows are newest-first with lifecycle-readable markers for missing values. | ✓ VERIFIED | Newest-first comparator in `src/domain/exports/workbook-model.js:159`; marker projection via `toExplicitMarker`/`formatDate` in `src/domain/exports/workbook-model.js:187`; assertions in `test/domain/exports/workbook-model.test.js:264`, `test/domain/exports/workbook-model.test.js:376`. |
| 3 | Event rows include stable IDs and readable contract/asset references, with unresolved links preserved as explicit markers (`UNLINKED` semantics). | ✓ VERIFIED | Reference resolution in `src/domain/exports/workbook-model.js:122`; ID/title projection in `src/domain/exports/workbook-model.js:197`; unresolved assertions in `test/domain/exports/workbook-model.test.js:344`, `test/domain/exports/workbook-model.test.js:385`. |
| 4 | `GET /exports/backup.xlsx` returns a downloadable `.xlsx` attachment instead of JSON workbook payload. | ✓ VERIFIED | Route sets XLSX content type + attachment + buffer in `src/api/routes/exports.routes.js:57`; integration asserts `content-type` and `content-disposition` in `test/api/exports-backup-scope.test.js:45`. |
| 5 | Downloaded workbook contains `Assets`, `Financial Contracts`, and `Event History` in locked order. | ✓ VERIFIED | Serializer lock via `SHEET_ORDER` in `src/domain/exports/workbook-xlsx.js:5`; tests assert workbook sheet names in `test/domain/exports/workbook-xlsx.test.js:44` and `test/api/exports-backup-scope.test.js:61`. |
| 6 | Generated sheets include frozen headers and active auto-filter defaults. | ✓ VERIFIED | Defaults applied in `src/domain/exports/workbook-xlsx.js:43`; serializer assertions in `test/domain/exports/workbook-xlsx.test.js:88`. |
| 7 | Frontend export trigger performs credentialed binary fetch and browser blob download for `.xlsx`. | ✓ VERIFIED | Fetch + blob + object URL flow in `frontend/src/features/export/use-export-backup.ts:44`; UI test asserts endpoint contract and URL lifecycle in `frontend/src/__tests__/user-switcher-export-action.test.tsx:115`, `frontend/src/__tests__/user-switcher-export-action.test.tsx:121`. |
| 8 | Export action enters pending state and blocks duplicate clicks until request completion. | ✓ VERIFIED | Button disabled when pending in `frontend/src/app/shell/user-switcher.tsx:87`; test locks duplicate-click prevention in `frontend/src/__tests__/user-switcher-export-action.test.tsx:144`. |
| 9 | UI surfaces explicit success and actionable retry guidance on failure. | ✓ VERIFIED | Success/error status rendering in `frontend/src/app/shell/user-switcher.tsx:117`; text contracts in `frontend/src/locales/en/common.json:8` and `frontend/src/locales/en/common.json:9`; failure assertion in `frontend/src/__tests__/user-switcher-export-action.test.tsx:162`. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/domain/exports/workbook-columns.js` | Frozen `Event History` column contract | ✓ VERIFIED | Exists, substantive schema present, consumed by model (`src/domain/exports/workbook-model.js:6`). |
| `src/domain/exports/workbook-model.js` | Deterministic Event History projection + lifecycle/reference fidelity | ✓ VERIFIED | Exists, substantive transforms/sort/reference logic, invoked by route (`src/api/routes/exports.routes.js:50`) and covered by tests. |
| `test/domain/exports/workbook-model.test.js` | Regression coverage for Event History ordering/markers/relationships | ✓ VERIFIED | Exists, substantive assertions across schema/sort/markers/references (`test/domain/exports/workbook-model.test.js:264`). |
| `src/domain/exports/workbook-xlsx.js` | Serializer to ExcelJS workbook binary | ✓ VERIFIED | Exists, substantive sheet-order/defaults serialization, wired into route (`src/api/routes/exports.routes.js:51`). |
| `src/api/routes/exports.routes.js` | Binary attachment response for backup export using scoped data | ✓ VERIFIED | Exists, substantive auth/scope/model/serialize/attachment flow, wired into app router (`src/api/app.js:179`). |
| `test/domain/exports/workbook-xlsx.test.js` | Serializer sheet-order/header/filter tests | ✓ VERIFIED | Exists, substantive XLSX parse assertions (`test/domain/exports/workbook-xlsx.test.js:44`, `test/domain/exports/workbook-xlsx.test.js:89`). |
| `test/api/exports-backup-scope.test.js` | API attachment + workbook content + scope regressions | ✓ VERIFIED | Exists, substantive owner/all/lens and override resistance checks (`test/api/exports-backup-scope.test.js:190`). |
| `frontend/src/features/export/use-export-backup.ts` | Binary download mutation with cleanup | ✓ VERIFIED | Exists, substantive fetch/blob/content-disposition parse/download cleanup (`frontend/src/features/export/use-export-backup.ts:53`). |
| `frontend/src/app/shell/user-switcher.tsx` | Export trigger wiring and feedback UI | ✓ VERIFIED | Exists, substantive pending lock, trigger call, success/error rendering (`frontend/src/app/shell/user-switcher.tsx:90`). |
| `frontend/src/__tests__/user-switcher-export-action.test.tsx` | Frontend regressions for download/pending/error/admin parity | ✓ VERIFIED | Exists, substantive behavior tests for standard/admin flows and pending lock (`frontend/src/__tests__/user-switcher-export-action.test.tsx:166`). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/domain/exports/workbook-model.js` | `src/domain/exports/workbook-columns.js` | column-driven Event History projection | ✓ WIRED | Imports and projects `EVENT_HISTORY_COLUMNS` (`src/domain/exports/workbook-model.js:6`, `src/domain/exports/workbook-model.js:187`). |
| `src/domain/exports/workbook-model.js` | `src/domain/exports/workbook-formatters.js` | explicit marker/date/reference helpers | ✓ WIRED | Uses `toExplicitMarker`, `formatDate`, `resolveReadableReference` (`src/domain/exports/workbook-model.js:12`, `src/domain/exports/workbook-model.js:133`). |
| `test/domain/exports/workbook-model.test.js` | `src/domain/exports/workbook-model.js` | Event History and unresolved-link assertions | ✓ WIRED | Imports `buildWorkbookModel` and asserts Event History output (`test/domain/exports/workbook-model.test.js:15`, `test/domain/exports/workbook-model.test.js:258`). |
| `src/api/routes/exports.routes.js` | `src/domain/exports/export-scope-query.js` | session-scope derived export dataset | ✓ WIRED | Calls `exportScopeQuery({ scope: req.scope })` (`src/api/routes/exports.routes.js:46`). |
| `src/api/routes/exports.routes.js` | `src/domain/exports/workbook-xlsx.js` | serialize workbook model to XLSX buffer | ✓ WIRED | Imports and awaits `serializeWorkbookToXlsx` (`src/api/routes/exports.routes.js:7`, `src/api/routes/exports.routes.js:51`). |
| `test/api/exports-backup-scope.test.js` | `GET /exports/backup.xlsx` | attachment/content-type and workbook assertions | ✓ WIRED | Validates content headers and sheet names from response payload (`test/api/exports-backup-scope.test.js:45`, `test/api/exports-backup-scope.test.js:61`). |
| `frontend/src/features/export/use-export-backup.ts` | `/exports/backup.xlsx` | credentialed GET + blob download | ✓ WIRED | Calls endpoint with `credentials: 'include'`, then `response.blob()` (`frontend/src/features/export/use-export-backup.ts:44`, `frontend/src/features/export/use-export-backup.ts:53`). |
| `frontend/src/app/shell/user-switcher.tsx` | `frontend/src/features/export/use-export-backup.ts` | pending/disabled state and trigger wiring | ✓ WIRED | Uses `triggerExport` + `isPending`/status flags (`frontend/src/app/shell/user-switcher.tsx:18`, `frontend/src/app/shell/user-switcher.tsx:87`). |
| `frontend/src/__tests__/user-switcher-export-action.test.tsx` | `frontend/src/app/shell/user-switcher.tsx` | UI-level export flow assertions | ✓ WIRED | Renders `UserSwitcher` and verifies `Export Backup` / `Exporting...` flow (`frontend/src/__tests__/user-switcher-export-action.test.tsx:9`, `frontend/src/__tests__/user-switcher-export-action.test.tsx:144`). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| EXPT-01 | `16-02-PLAN.md`, `16-03-PLAN.md` | User can trigger export and download generated `.xlsx` from app. | ✓ SATISFIED | Backend attachment route (`src/api/routes/exports.routes.js:42`) + frontend blob download trigger (`frontend/src/features/export/use-export-backup.ts:44`) + passing API/UI tests. |
| EXPT-02 | `16-01-PLAN.md`, `16-02-PLAN.md` | Workbook includes separate `Assets`, `Financial Contracts`, `Event History` sheets. | ✓ SATISFIED | Model emits three sheets (`src/domain/exports/workbook-model.js:346`), serializer preserves locked order (`src/domain/exports/workbook-xlsx.js:5`), tests assert order (`test/domain/exports/workbook-xlsx.test.js:44`). |
| EXPT-05 | `16-01-PLAN.md` | Event History includes lifecycle fields with stable identifiers. | ✓ SATISFIED | Event projection fields include status/dates/amount + event/item IDs (`src/domain/exports/workbook-model.js:188`), locked by model tests (`test/domain/exports/workbook-model.test.js:334`). |
| RELA-02 | `16-01-PLAN.md` | Event rows include related contract/asset references when links exist. | ✓ SATISFIED | Relationship resolution and readable references in `src/domain/exports/workbook-model.js:122`, verified by contract/asset assertions in `test/domain/exports/workbook-model.test.js:359`. |

Orphaned requirements check: `REQUIREMENTS.md` maps Phase 16 to exactly `EXPT-01`, `EXPT-02`, `EXPT-05`, `RELA-02` (`.planning/REQUIREMENTS.md:69`, `.planning/REQUIREMENTS.md:79`), and all are declared in phase plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None | - | No TODO/FIXME/placeholder stubs or console-only implementations found in phase artifacts | - | No blocker anti-patterns detected |

### Human Verification Required

### 1. Real browser download flow and UX feedback

**Test:** In a real browser session, click `Export Backup` from the shell while authenticated as (a) standard user and (b) admin lens/all mode.
**Expected:** A timestamped `.xlsx` file downloads via browser download manager, button shows pending lock during request, and success/failure messages are clear and actionable.
**Why human:** Automated tests confirm fetch/blob behavior and text contracts, but cannot fully validate browser-managed file download UX and cross-environment visual clarity.

### Gaps Summary

No implementation gaps found in automated verification. Phase goal appears achieved in code and tests; one human UX/download confirmation remains.

---

_Verified: 2026-03-03T20:55:41Z_
_Verifier: Claude (gsd-verifier)_
