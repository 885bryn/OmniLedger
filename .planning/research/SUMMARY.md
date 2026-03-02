# Project Research Summary

**Project:** Household Asset & Commitment Tracker (HACT)
**Domain:** Secure, RBAC-aware household-finance data portability export (v3.0 milestone)
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone is a portability release for an existing product, not a platform rewrite. The recommended path is to add a dedicated server-side export flow that generates multi-sheet `.xlsx` backups (Assets, Financial Contracts, Event History) from persisted ledger data, scoped by existing auth/session RBAC semantics (`user`, `admin all-data`, `admin lens`). Experts converge on preserving the current Node/Express/Sequelize/React architecture and adding focused capabilities: Excel workbook generation, secure stream delivery, export audit events, and clear frontend download states.

The strongest implementation pattern is scope-first and contract-first. Resolve effective scope only on the server (`req.scope`), then execute explicit scoped export queries, then stream workbook output with stable schema/version metadata and usability defaults (frozen headers, filters, deterministic date formats). This keeps backup artifacts faithful and supportable while avoiding projection-side effects from timeline endpoints.

Primary risks are scope leakage, stale UI/export mismatches, mixed-time snapshots, and large-export reliability failures. The mitigation strategy is explicit and actionable: central scope resolver + negative RBAC tests, canonical export DTO tied to URL/filter state, snapshot/cutoff semantics across all sheets, streaming writer with row/time guardrails, formula-injection sanitization, and immutable audit logging for every export event.

## Key Findings

### Recommended Stack

`STACK.md` recommends minimal, high-leverage additions to the existing stack for v3.0 export delivery.

**Core technologies:**
- `exceljs@4.4.0`: server-side multi-sheet workbook generation and stream writing - best fit for styled, readable exports without introducing new infra.
- `content-disposition@1.0.1`: safe RFC-compliant attachment filename handling - avoids Unicode/escaping bugs in download headers.
- Node.js built-ins (`stream`, `Intl.DateTimeFormat`) on Node 22.x: backpressure-safe delivery and locale/timezone-aware formatting - keeps implementation lightweight and deterministic.

**Stack additions and version constraints:**
- Required v3.0 additions: `exceljs@4.4.0`, `content-disposition@1.0.1`.
- Optional addition: `luxon@3.7.2` if explicit timezone conversion is needed beyond `Intl` behavior.
- Keep export path server-side; avoid client-side XLSX generation, temp-file download pipelines, and queue/object-store complexity in v3.0.

### Expected Features

`FEATURES.md` sets clear scope boundaries for portability-first delivery.

**Must have (table stakes):**
- One obvious export entry point with clear included-data messaging.
- Server-enforced scope-correct export (standard user, admin all-data, admin lens) with no client-authoritative scope.
- Multi-sheet `.xlsx` output with stable column contract and schema/version marker.
- Date/entity filters, workbook readability defaults, explicit row/time guardrails, and non-silent failures.
- Frontend loading/success/retry states and export audit events (actor, scope, filters, outcome).

**Should have (differentiators):**
- `Export Info`/provenance metadata sheet (actor, lens, timezone, filters, timestamp).
- Strong audit traceability with resolved scope and row counts.

**Defer (v3.1+ / v4+):**
- Async export jobs with short-lived links (v3.1 once baseline is stable).
- Optional zipped CSV companion package and saved presets (v3.1).
- Report builder, formula authoring, scheduled third-party exports, and import/restore round-trip tooling (v4+).

### Architecture Approach

`ARCHITECTURE.md` recommends an additive export module integrated into the existing monolith, with strict boundaries between route, query, and workbook responsibilities.

**Major components:**
1. API route layer (`src/api/routes/exports.routes.js`) - authenticated `/exports/ledger.xlsx` stream endpoint with safe response headers and existing error envelope.
2. Domain export module (`src/domain/exports/*`) - scope-aware query service, workbook orchestrator, typed export errors, and centralized column/schema definitions.
3. Frontend export feature (`frontend/src/features/export/*`) - blob download mutation, UX states, and entry point near user/lens context.

**Architecture integration points:**
- Mount export router in `src/api/app.js`; extend `src/api/errors/http-error-mapper.js` for export error taxonomy.
- Reuse existing `requireAuth` + `req.scope` trust boundary; do not trust client scope params.
- Query persisted models (`Item`, `Event`, optional `AuditLog`) via export-specific scoped read model; do not reuse projection-oriented `/events` behavior.
- Stream workbook to `res` with `Content-Type`, `Content-Disposition`, and `Cache-Control: no-store`.

### Critical Pitfalls

`PITFALLS.md` identifies concrete failure modes that should gate phase completion.

1. **Scope bleed across user/admin/lens contexts** - prevent with a single server-side `effectiveScope` resolver and mandatory scoped repository APIs.
2. **Filter/view mismatch in exports** - prevent with canonical `ExportRequest` DTO sourced from URL/filter state and logged filter hash.
3. **Mixed-time snapshots across sheets** - prevent with transaction/cutoff strategy (`dataAsOf`) and deterministic cross-sheet semantics.
4. **Memory/timeouts on large exports** - prevent with streaming writer, chunked reads, relation prefetching, and explicit row/time caps.
5. **XLSX/security defects (corruption, date drift, formula injection, cache leakage)** - prevent with schema-driven serializers, locale/timezone test matrix, dangerous-prefix sanitization, and strict no-store/secure header policy.

## Implications for Roadmap

Based on combined research, the v3.0 roadmap should use five dependency-ordered phases focused on secure portability scope boundaries.

### Phase 1: Export Policy and Scope Contract
**Rationale:** Everything depends on deny-by-default scope correctness and explicit export contract semantics.
**Delivers:** Effective scope resolver, export DTO contract, route auth contract, error code taxonomy, audit event schema.
**Addresses:** Table-stakes RBAC-correct export and clear UX scope messaging.
**Avoids:** Scope bleed, stale filter mismatch, and missing auditability pitfalls.

### Phase 2: Scoped Data Assembly and Snapshot Semantics
**Rationale:** Data fidelity must be solved before workbook formatting and UI polish.
**Delivers:** Export query layer for Assets/Contracts/Events, deterministic filters, snapshot/cutoff model, row-limit strategy.
**Implements:** `export-ledger-query` + scope-first read model.
**Avoids:** Mixed-time workbook inconsistencies, N+1 query growth, and leakage from unscoped reads.

### Phase 3: Workbook Contract and Stream Delivery
**Rationale:** Once datasets are correct, define the stable portability artifact and transport behavior.
**Delivers:** Excel schema/column specs, metadata sheet, streaming workbook writer, download headers (`content-disposition`, `no-store`).
**Uses:** `exceljs@4.4.0`, `content-disposition@1.0.1`, Node stream primitives.
**Avoids:** In-memory blowups, XLSX corruption, date/locale drift, and cache leakage.

### Phase 4: Frontend Export UX and Guardrails
**Rationale:** Users need trustworthy feedback and explicit scope visibility for safe adoption.
**Delivers:** Export action in global scope context, loading/success/retry states, error-code-aware messaging, scope summary UX.
**Addresses:** One-click export discoverability and resilient failure handling.
**Avoids:** UX ambiguity between current-view vs full-backup semantics and duplicate retry churn.

### Phase 5: Verification and Operational Readiness
**Rationale:** Portability is a trust feature; release requires hard security/performance evidence.
**Delivers:** RBAC negative test matrix, workbook open/parse CI smoke checks, locale/timezone fixtures, load budgets, logging/redaction checks, runbooks.
**Addresses:** Release confidence for sensitive export workflows.
**Avoids:** Late-stage security regressions and incident-response blind spots.

### Phase Ordering Rationale

- Policy/contract first, because every later query and UI path depends on authoritative scope and filter semantics.
- Data assembly before workbook/UI, because portability quality is determined by dataset correctness, not formatting.
- Streaming transport before UX polish, because guardrails and headers are core safety controls.
- Verification last as a release gate across security, fidelity, and operational stability.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Snapshot strategy in PostgreSQL/Sequelize under concurrent writes; finalize `dataAsOf` and consistency rules.
- **Phase 3:** Large dataset thresholds for switching synchronous vs async path and exact stream memory/latency budgets.
- **Phase 5:** Security test fixtures for formula injection and log-redaction verification in production-like environments.

Phases with standard patterns (can likely skip extra research-phase):
- **Phase 1:** Session-auth RBAC scope enforcement and export route authorization patterns are well established.
- **Phase 4:** Blob-download UX with mutation state handling follows established frontend patterns in current stack.

### Recommended v3.0 Scope Boundaries

- **In scope:** synchronous server-side `.xlsx` export with scoped datasets (Assets, Contracts, Events), filters (date/entity), workbook metadata/versioning, secure headers, audit events, and robust frontend states.
- **Conditionally in scope:** locale/timezone enhancement via headers and optional `luxon` conversion if deterministic user-timezone rendering is required.
- **Out of scope:** async job system as default path, report-builder customization, formula-authored spreadsheets, scheduled integrations, and import/restore workflows.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Backed by official docs and version checks; additions are narrow and compatible with current Node/Express baseline. |
| Features | MEDIUM-HIGH | Strong table-stakes and dependency mapping; some differentiators still need product validation after v3.0 launch. |
| Architecture | HIGH | Directly aligned to existing codebase boundaries with explicit integration points and build order. |
| Pitfalls | MEDIUM-HIGH | Risks are concrete, phase-mapped, and testable; uncertainty remains around scale thresholds and snapshot implementation detail. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Define exact snapshot contract (`transaction snapshot` vs `cutoff timestamp`) before Phase 2 implementation starts.
- Set explicit v3.0 limits (max rows, max duration, concurrent exports) and criteria for v3.1 async handoff.
- Confirm admin broad-scope export governance (reason codes/approval policy) before production rollout.
- Finalize canonical date/time representation policy for each sheet column and verify across Excel desktop/web locale variants.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md`, `.planning/research/FEATURES.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/PROJECT.md` - direct v3.0 synthesis inputs.
- ExcelJS docs/README: https://github.com/exceljs/exceljs - streaming writer, formatting, worksheet UX features.
- Express API docs: https://expressjs.com/en/api.html - attachment/download response behavior.
- OWASP API Security and authorization guidance: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ ; https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/ ; https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

### Secondary (MEDIUM confidence)
- `content-disposition` docs: https://github.com/jshttp/content-disposition - RFC-safe filename handling.
- MDN date/cache references: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat ; https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
- Finance export comparators: https://help.monarchmoney.com/hc/en-us/articles/15526600975764-Downloading-Transaction-or-Account-History ; https://support.simplifi.quicken.com/en/articles/3404263-how-to-export-transactions-from-quicken-simplifi

### Tertiary (LOW confidence)
- Alternative XLSX ecosystem positioning for tradeoff context: https://docs.sheetjs.com/docs/ ; https://github.com/dtjohnson/xlsx-populate

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
