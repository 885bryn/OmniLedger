# Pitfalls Research

**Domain:** v3.0 data portability export for a live household ledger with existing auth + RBAC + admin lens modes
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH

## Suggested Milestone Phases (for mitigation mapping)

1. **Phase A - Export policy contract:** explicit actor/scope matrix, endpoint contract, and deny-by-default behavior.
2. **Phase B - Scoped data assembly:** server query builders and snapshot semantics for export payloads.
3. **Phase C - Workbook generation hardening:** XLSX schema, formatting, escaping, and corruption safeguards.
4. **Phase D - Delivery UX and transport safety:** stream/download behavior, progress UX, and secure response headers.
5. **Phase E - Verification and operational guardrails:** perf tests, security regression suite, observability, and runbooks.

## Critical Pitfalls

### Pitfall 1: Scope bleed between user scope and admin lens mode

**What goes wrong:**
Export queries accidentally run with broadened scope (or stale admin lens context), so regular users can receive cross-owner rows.

**Why it happens:**
Teams bolt export onto existing endpoints and reuse query helpers that assume UI scope state is already correct.

**How to avoid:**
Create one export authorization resolver that computes `effectiveScope` on the server from session + role + explicit lens selection, then injects it into every repository call. Forbid direct model calls inside export handlers.

**Warning signs:**
Handlers using `findAll()` without owner predicate, fallback to "all" when lens is missing, and tests that only validate positive cases.

**Phase to address:**
Phase A (policy contract) and Phase B (query implementation).

---

### Pitfall 2: Stale filter/export mismatch (UI says one scope, file contains another)

**What goes wrong:**
User applies filters in UI, clicks export, and receives stale or differently scoped data because query cache state and export request parameters diverge.

**Why it happens:**
Export action reads partial filter state (or stale React Query state) instead of a canonical, serialized filter object.

**How to avoid:**
Define a single `ExportRequest` DTO derived from URL/search state (not transient component state), include all scope and filter fields explicitly, and log the exact DTO hash with the export job.

**Warning signs:**
"Export does not match screen" bug reports, missing filters in query key, and export endpoint receiving optional params with server defaults.

**Phase to address:**
Phase A (contract) and Phase D (frontend wiring).

---

### Pitfall 3: Non-atomic multi-table reads produce mixed-time snapshots

**What goes wrong:**
Workbook contains internally inconsistent data (for example, Assets sheet reflects newer state than Event History sheet).

**Why it happens:**
Export reads each sheet from separate queries over a mutable dataset without a consistent snapshot boundary.

**How to avoid:**
Run export reads in a transaction/snapshot boundary where feasible, or stamp `exportGeneratedAt` and `dataAsOf` and query by deterministic cutoff rules. Never mix "current" and "as-of" semantics in one workbook.

**Warning signs:**
Row counts differ between repeated exports seconds apart, cross-sheet totals fail reconciliation, and flaky integration tests under concurrent writes.

**Phase to address:**
Phase B.

---

### Pitfall 4: Memory blowups and timeouts on large exports

**What goes wrong:**
Node process spikes memory or times out when generating large workbooks, degrading the live API.

**Why it happens:**
Workbook is built fully in memory and rows are expanded with N+1 relation lookups.

**How to avoid:**
Use streaming XLSX writer path for large datasets, enforce server-side page/chunk iteration, and cap max export size with explicit user messaging. Add relation prefetch strategy to avoid N+1.

**Warning signs:**
p95 export latency climbing with row count, OOM restarts, and DB query count proportional to rows.

**Phase to address:**
Phase B (query plan) and Phase C/E (streaming + perf gates).

---

### Pitfall 5: XLSX corruption from invalid worksheet names/cell values/styles

**What goes wrong:**
Generated file downloads but opens with repair warnings, missing formatting, or broken sheets.

**Why it happens:**
Unvalidated sheet names, unsupported style combinations, and ad hoc type coercion when flattening complex objects.

**How to avoid:**
Centralize workbook schema definitions: sheet names, column types, width/format presets, and per-field serializers. Add a post-generation open/parse smoke test in CI.

**Warning signs:**
Excel "repaired records" dialogs, columns shifted after opening, and inconsistent date/number rendering across locales.

**Phase to address:**
Phase C.

---

### Pitfall 6: Date/time and locale formatting drift in exported workbook

**What goes wrong:**
Users see one-day offsets, mixed date formats, or numbers treated as text.

**Why it happens:**
Mixing JS `Date` serialization, locale-formatted strings, and Excel serial dates without a clear convention.

**How to avoid:**
Pick one rule: store date-time cells as true date values with explicit `numFmt`; export date-only fields in one normalized representation; include timezone note in workbook metadata sheet.

**Warning signs:**
Different display between Excel desktop/web, sort order failures on date columns, and support tickets around DST/date boundaries.

**Phase to address:**
Phase C and Phase E (cross-locale test matrix).

---

### Pitfall 7: Spreadsheet formula injection through user-entered text

**What goes wrong:**
Cells beginning with formula prefixes execute when workbook is opened, creating client-side exfiltration or phishing vectors.

**Why it happens:**
Untrusted free-text fields (notes, labels, payees) are written directly to cells without sanitization policy.

**How to avoid:**
Apply output encoding/escaping policy for potentially dangerous leading characters (`=`, `+`, `-`, `@`, tabs/newlines where relevant), and treat all user text fields as untrusted in export serializer.

**Warning signs:**
Values preserved exactly from user input at cell start with formula operators, and no dedicated security tests for export content.

**Phase to address:**
Phase C (serializer policy) and Phase E (security regression).

---

### Pitfall 8: Sensitive file leakage via caching, logs, and temp artifacts

**What goes wrong:**
Backups persist in browser/proxy cache, server temp directories, or logs with data-bearing filenames and parameters.

**Why it happens:**
Download endpoint is treated like generic file download, not as sensitive personal financial data.

**How to avoid:**
Set strict response headers (`Cache-Control: no-store`, correct `Content-Type`, safe `Content-Disposition` filename), avoid disk persistence unless encrypted/ephemeral, and redact export parameters in logs.

**Warning signs:**
Export payload IDs in logs, temp files surviving process restart, and repeated download from back button without re-auth.

**Phase to address:**
Phase D and Phase E.

---

### Pitfall 9: UX ambiguity between "current view export" and "full backup export"

**What goes wrong:**
Users cannot tell whether export is filtered view, role-limited subset, or full account backup; trust declines.

**Why it happens:**
Single "Export" CTA with hidden scope rules and no summary of included data.

**How to avoid:**
Present explicit mode labels before export (`Current filters`, `All my data`, `Admin lens: selected scope`), show included sheets/row counts, and include "Scope Summary" tab inside workbook.

**Warning signs:**
Support questions about missing data, repeated re-exports with different filters, and user-created manual reconciliation steps.

**Phase to address:**
Phase D.

---

### Pitfall 10: Missing auditability of exports in a live RBAC system

**What goes wrong:**
Team cannot answer who exported what scope and when after a suspected leak or policy incident.

**Why it happens:**
Feature is shipped as "utility" without audit events, reason codes (for admin scope), or correlation IDs.

**How to avoid:**
Log immutable export audit events: actor, effective scope, filter hash, row counts, workbook id, timestamp, and outcome. Require reason metadata for admin broad-scope exports.

**Warning signs:**
Download endpoint has no structured logs, only 200/500 metrics, and no linkage between UI action and backend export execution.

**Phase to address:**
Phase A (audit contract) and Phase E (observability + incident readiness).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reuse list-page query directly for export | Fast implementation | Scope leaks and stale-filter mismatches | Never for RBAC-sensitive exports |
| Build workbook fully in memory first | Simpler coding model | OOM/timeout risk and poor scalability | Only for tiny datasets with hard row cap |
| Export with implicit server defaults for missing filters | Fewer UI params | Inconsistent "what user saw" vs "what exported" | Never |
| Skip export audit log fields until later | Faster ship | No incident forensics for leakage claims | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Express download responses | Treating export like static file endpoint | Attach security headers and auth checks per request, then stream |
| Sequelize query layer | Mixing scoped and unscoped helper calls | Require `effectiveScope` in repository APIs and test for cross-owner denial |
| React Query filter state | Export button reads stale cache/view state | Build export payload from canonical URL/filter model at click time |
| ExcelJS workbook generation | Ad hoc serializers and style assignment per callsite | Use centralized sheet schema + serializer map + workbook smoke test |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 relation loading while writing rows | DB query explosion and slow exports | Batch includes/prefetch and chunked iteration | Often visible beyond 5k-20k rows |
| Non-streaming XLSX generation | High memory and process instability | Streaming writer path + max row guardrails | Commonly painful beyond tens of MB outputs |
| Export competing with API traffic | Normal app latency spikes during exports | Concurrency limits and queue/backpressure for export jobs | Under bursty parallel exports |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Missing object-level authorization on export reads | Cross-tenant-ish data exfiltration | Deny-by-default scope resolver + negative integration tests |
| Unescaped formula-like cell values | Spreadsheet formula execution on open | Sanitize/escape dangerous leading characters in user text fields |
| Cacheable responses for sensitive exports | Leakage via browser/shared cache | `Cache-Control: no-store` and strict response handling |
| No auditable trail for admin exports | Undetectable privilege misuse | Immutable export audit events + admin reason codes |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| One generic Export button for multiple scopes | Users misunderstand what is included | Explicit export mode selector with scope summary |
| No progress/failure states on long exports | Users retry repeatedly and create duplicates | Visible progress + idempotent request handling + clear retry guidance |
| Download lacks metadata on snapshot time/scope | Workbook trust problems during reconciliation | Add "Scope Summary" sheet with actor scope, filter summary, and timestamp |

## "Looks Done But Isn't" Checklist

- [ ] **RBAC isolation:** Cross-owner negative tests exist for user and admin-lens paths; verify guessed UUIDs never broaden export scope.
- [ ] **Filter fidelity:** Export payload includes every active filter/scope field; verify exported row counts match on-screen query for "current view" mode.
- [ ] **Snapshot consistency:** Multi-sheet workbook uses one data cutoff strategy; verify cross-sheet reconciliation checks pass.
- [ ] **XLSX safety:** Sheet names/types/styles are schema-driven; verify generated file opens without Excel repair warnings.
- [ ] **Date integrity:** Date/time columns sort correctly and match expected day across locale/timezone fixtures.
- [ ] **Injection defense:** User text cells are sanitized for formula execution prefixes; verify security tests with malicious fixtures pass.
- [ ] **Transport security:** Download responses are non-cacheable and sanitized; verify no sensitive temp files/log artifacts remain.
- [ ] **Auditability:** Every export emits structured audit event with actor, scope, filter hash, and outcome.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Scope leak in export | HIGH | Disable endpoint, rotate affected sessions, identify impacted exports from audit/logs, patch scope resolver, add regression suite |
| Corrupted or inconsistent workbook output | MEDIUM | Roll back to prior export schema version, regenerate affected exports, add CI open/parse verification |
| Export-induced performance incident | MEDIUM-HIGH | Rate-limit/queue exports, switch to streaming path, profile query plan, deploy row caps until fixed |
| Stale-filter mismatch complaints | MEDIUM | Patch canonical export DTO flow, add filter hash in workbook metadata, add end-to-end "screen vs export" tests |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Scope bleed in admin/user exports | Phase A + B | Matrix tests for role x lens x ownership with negative assertions |
| Stale UI filters in exported file | Phase A + D | E2E tests compare active filter state to export request payload + row set |
| Mixed-time data across sheets | Phase B | Concurrency test proves deterministic snapshot/cutoff behavior |
| Memory/timeouts on large exports | Phase B + C + E | Load test at target row volumes with p95 latency and memory budgets |
| XLSX corruption/format breakage | Phase C | CI opens generated workbook and validates expected sheet schema |
| Date/locale drift | Phase C + E | Locale/timezone fixture suite passes for date formatting and ordering |
| Formula injection risk | Phase C + E | Security fixtures confirm dangerous prefixes are neutralized |
| Cache/log/temp leakage | Phase D + E | Header tests + artifact scans + log redaction checks |
| UX scope confusion | Phase D | Usability acceptance checks for explicit mode labels and summary tab |
| Missing export audit trail | Phase A + E | Audit event contract test and dashboard/alert checks |

## Sources

- Internal project context: `.planning/PROJECT.md` (v3.0 goal and constraints) - HIGH
- Internal v2.0 debt context: `.planning/milestones/v2.0-MILESTONE-AUDIT.md` (noted stale refresh/invalidation debt) - HIGH
- OWASP Authorization Cheat Sheet (deny-by-default, per-request auth checks): https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html - HIGH
- OWASP IDOR Prevention Cheat Sheet (object-level access enforcement): https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html - HIGH
- OWASP CSV/Formula Injection guidance (spreadsheet formula execution risk): https://owasp.org/www-community/attacks/CSV_Injection - MEDIUM
- ExcelJS README/docs (streaming writer behavior and worksheet features): https://github.com/exceljs/exceljs - MEDIUM
- Microsoft Excel specifications and limits (row/column/cell/style limits): https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3 - HIGH
- MDN Cache-Control reference (`no-store` semantics for sensitive responses): https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control - MEDIUM

---
*Pitfalls research for: HACT v3.0 secure RBAC-aware XLSX backup export milestone*
*Researched: 2026-03-01*
