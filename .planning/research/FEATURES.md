# Feature Research

**Domain:** Household-finance ledger data portability export (HACT v3.0)
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users now expect from serious finance exports. Missing these makes export feel unsafe or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-click full export from a predictable place | Consumer finance apps expose export in obvious account/settings locations | LOW | Add a single primary export action in Settings/Data with clear ownership and scope messaging |
| Spreadsheet-compatible output with stable columns | Most products export CSV/Excel so users can open in Excel/Sheets immediately | MEDIUM | v3.0 target should be one `.xlsx` workbook with multiple sheets and fixed headers; avoid breaking column names between patch releases |
| Scope-aware export (self only vs admin all-data/lens) | Multi-user ledgers require access boundaries that match in-app RBAC | HIGH | Enforce scope server-side per request; never trust client-selected owner IDs (BOLA risk) |
| Export subsets by user-visible filters (date/account/entity) | Productized tools support partial exports to avoid noise and giant files | MEDIUM | Start with date range + entity selection (Assets/Contracts/Events); preserve filter criteria in workbook metadata tab |
| Large-export guardrails and predictable limits | Real ledgers can be large; mature tools either limit or guide chunked export | MEDIUM | Cap row volume per sheet and fail with actionable guidance; do not silently truncate |
| Clear job feedback and resilient failure UX | Users need to know if export is in progress, complete, or failed | MEDIUM | Show spinner/state text + retry path + supportable error code; include timeout-safe server behavior |
| Usability defaults in workbook | Users expect exports to be readable without manual cleanup | LOW | Freeze header row, apply auto-filter, use ISO/locale-consistent date columns, keep IDs for re-import traceability |
| Availability independent of active trial/subscription status (policy permitting) | Finance users expect continued access to their own data | LOW | If product policy allows, keep self-service export available after billing changes; otherwise state policy explicitly |

### Differentiators (Competitive Advantage)

Features that make HACT export feel deliberate, trustworthy, and enterprise-ready.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Provenance sheet (`Export Info`) | Increases trust by documenting generated-at time, actor, active lens, timezone, and applied filters | LOW | Add a first worksheet with machine-readable metadata so support and audits can reconstruct context |
| Audit event for each export request/download | Security teams can trace who exported what scope and when | MEDIUM | Log requested scope, resolved scope, row counts, and status; redact file path/token details |
| Async export mode with secure short-lived download link | Handles larger exports without request timeouts and avoids tying up web workers | HIGH | Keep synchronous path for small files, switch to job queue for large datasets, expire links quickly |
| Optional dual-format package (`.xlsx` + normalized `.csv`) | Serves analysts and migration workflows without changing main UX | MEDIUM | Keep `.xlsx` as primary UX, add advanced toggle for zipped CSV set only if requested |
| Schema versioning inside workbook | Enables safe evolution and easier future import tooling | LOW | Include `schema_version` and column dictionary sheet; reduces downstream parsing breakage |

### Anti-Features (Commonly Requested, Often Problematic)

Items that look attractive but should stay out of v3.0 to prevent scope and risk blowups.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| "Export everything forever" in one synchronous HTTP response | Feels simple to users and PMs | Timeouts, memory spikes, and poor reliability at larger data sizes | Keep bounded synchronous export and add async job mode for big datasets |
| Ad-hoc custom report builder in export milestone | Teams want total flexibility | Turns portability milestone into BI/reporting product | Ship fixed portability schema now; defer report designer to later analytics milestone |
| Client-side RBAC for export eligibility | Faster frontend iteration | Easily bypassed via API calls; high data-leak risk | Always resolve and enforce scope server-side, mirror only for UI affordance |
| Formula-rich cells in exported financial fields | "Nicer" spreadsheets and quick totals | Increases CSV/Excel formula-injection surface for untrusted text fields | Export values as plain text/numbers only; let users add formulas locally |
| Automatic cross-user merge exports by default in admin mode | Admin convenience | Easy privacy mistakes and accidental over-export | Require explicit scope selection and confirmation for all-data exports |
| In-milestone encrypted-password workbook workflow | Security theater request | Weak/fragile UX and support burden; not true transport or storage security | Use authenticated download + short TTL links + audit logs |

## Feature Dependencies

```text
Server-authenticated identity
    -> RBAC policy resolution (user, admin, admin lens)
        -> Export scope resolver (self/all-data/lens)
            -> Query builders for Assets, Contracts, Events
                -> Workbook generator (.xlsx sheets + formatting)
                    -> Stream/download delivery + UX states

Scope resolver
    -> Export audit logging
        -> Admin safeguard UX (explicit mode + confirmation)

Row-limit and timeout controls
    -> Error taxonomy (too_large, timeout, partial_not_allowed)
        -> Retry guidance in frontend
```

### Dependency Notes

- **RBAC before export queries:** query predicates must be derived from resolved server scope, not UI input.
- **Scope resolver before workbook generation:** row content and sheet counts depend on finalized scope and filters.
- **Guardrails before polish:** enforce row/time limits before adding advanced formatting to avoid fragile behavior.
- **Audit logging in same flow:** export actions are sensitive and should emit auditable events from day one.
- **Error taxonomy before frontend copy:** actionable UX requires stable backend error codes.

## MVP Definition

### Launch With (v3.0)

Minimum viable portability release for this milestone.

- [ ] Single export entry point in HACT UI with clear "what is included" copy
- [ ] Server-side RBAC-aware scope resolution for user, admin all-data, and admin lens modes
- [ ] Multi-sheet `.xlsx` export for Assets, Financial Contracts, and Event History with readable flattened columns
- [ ] Date and entity filters (at minimum), plus deterministic column order and schema version marker
- [ ] Workbook usability defaults (frozen header row, auto-filter, consistent date formatting)
- [ ] Export guardrails (row/time limits) with explicit non-silent failure messages
- [ ] Frontend loading, success, and retry/error states tied to backend error codes
- [ ] Export audit events capturing actor, scope, filters, and result status

### Add After Validation (v3.1)

Valuable enhancements after baseline export reliability is proven.

- [ ] Async export jobs with short-lived download URLs for larger datasets
- [ ] Optional zipped CSV companion package for power users
- [ ] Saved export presets (for frequent accountant/audit handoffs)

### Future Consideration (v4+)

Intentionally deferred to avoid scope creep in a portability milestone.

- [ ] Custom column builder and formula/report authoring UX
- [ ] Automated scheduled exports to third-party destinations
- [ ] One-click import/restore from exported workbook (requires strict round-trip contract and migration tooling)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| RBAC-aware scope-correct export | HIGH | HIGH | P1 |
| Multi-sheet `.xlsx` with stable schema | HIGH | MEDIUM | P1 |
| Filtered export controls (date/entity) | HIGH | MEDIUM | P1 |
| Workbook readability defaults | MEDIUM | LOW | P1 |
| Guardrails + actionable failure UX | HIGH | MEDIUM | P1 |
| Export audit trail | HIGH | MEDIUM | P1 |
| Async large-export workflow | MEDIUM | HIGH | P2 |
| Optional zipped CSV companion | MEDIUM | MEDIUM | P2 |
| Custom report builder | LOW (for portability goal) | HIGH | P3 |

**Priority key:**
- P1: Must-have for v3.0 acceptance
- P2: Strong follow-up once v3.0 proves stable
- P3: Explicitly out-of-scope for this milestone

## Competitor Feature Analysis

| Feature | Monarch Money | Quicken Simplifi | Our Approach |
|---------|---------------|------------------|--------------|
| Where export lives | Export available in account edit and Settings > Data | Export from Transactions view (selection based) and report export paths | Keep one obvious export entry, plus scoped filter controls |
| Export format posture | CSV for transactions/balances; guidance around file handling | CSV export for transactions/reports; web-first behavior | Primary `.xlsx` for backup readability, optional CSV later |
| Scale handling | Documented transaction limits and recommendations for smaller chunks | Manual selection/filtering and known date-range constraints | Explicit row/time limits, deterministic failures, async mode in follow-up |
| Portability promise | States full history download availability in settings context | Emphasizes portability but with format/platform limitations | Make scope and limitations explicit in product copy and audit logs |

## Sources

- Monarch Money Help, "Downloading Transaction or Account History" (updated 2025-10-19): https://help.monarchmoney.com/hc/en-us/articles/15526600975764-Downloading-Transaction-or-Account-History (HIGH)
- Quicken Simplifi Help, "How to Export Transactions from Quicken Simplifi" (updated 2026 week-of fetch): https://support.simplifi.quicken.com/en/articles/3404263-how-to-export-transactions-from-quicken-simplifi (HIGH)
- Firefly III Docs, "Exporting data" (2026-02-26): https://docs.firefly-iii.org/tutorials/firefly-iii/exporting-data/ (MEDIUM)
- OWASP API Security Top 10 2023, API1 Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/ (HIGH)
- OWASP API Security Top 10 2023, API4 Unrestricted Resource Consumption: https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/ (HIGH)
- OWASP, CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection (HIGH)
- Microsoft Support, "Excel specifications and limits" (current): https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3 (HIGH)

---
*Feature research for: HACT v3.0 data portability export*
*Researched: 2026-03-01*
