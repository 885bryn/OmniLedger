# Architecture Research

**Domain:** HACT v3.0 Data Portability - Excel backup export in existing Node/Express + Sequelize + React stack
**Researched:** 2026-03-01
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
+------------------------------------------------------------------------------------------------------+
|                                   Frontend (React + React Query)                                    |
|  AppShell/UserSwitcher export action -> export mutation hook -> fetch(blob) -> browser download     |
+----------------------------------------------+-------------------------------------------------------+
                                               |
+----------------------------------------------v-------------------------------------------------------+
|                                       API Layer (Express)                                            |
|  requireAuth -> req.scope/req.actor -> /exports/ledger.xlsx route -> stream response                |
|  existing error envelope path retained for JSON errors                                                |
+----------------------------------------------+-------------------------------------------------------+
                                               |
+----------------------------------------------v-------------------------------------------------------+
|                           Domain Export Module (new, isolated read-model path)                       |
|  scope resolver reuse + export query service + workbook builder + stream writer + export audit       |
+----------------------------------------------+-------------------------------------------------------+
                                               |
+----------------------------------------------v-------------------------------------------------------+
|                                  Sequelize Models / PostgreSQL                                       |
|  Items (assets + financial contracts), Events (persisted history), AuditLog (actor/lens attribution)|
+------------------------------------------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `src/api/routes/exports.routes.js` **(new)** | Expose authenticated Excel download endpoint | `router.use(requireAuth)` + `GET /exports/ledger.xlsx` streaming handler |
| `src/domain/exports/export-ledger-workbook.js` **(new)** | Orchestrate scoped data read and workbook assembly | Calls query layer and workbook writer; no HTTP details |
| `src/domain/exports/export-ledger-query.js` **(new)** | Read persisted rows for export sheets | Sequelize queries with `resolveOwnerFilter(req.scope)` and soft-delete policy |
| `src/domain/exports/excel-workbook-writer.js` **(new)** | Convert rows to multi-sheet `.xlsx` stream | ExcelJS streaming workbook writer, header freeze + filters + date/amount formatting |
| `src/api/errors/http-error-mapper.js` **(modified)** | Map export errors to existing envelope conventions | Adds `mapExportError` preserving 404/422 semantics where relevant |
| `frontend/src/features/export/*` **(new)** | UI action, pending/progress/error states, download handling | React mutation + `fetch` blob + filename extraction |
| `frontend/src/lib/api-client.ts` **(modified, minimal)** | Optional transport helper for blob download | Add `apiRequestBlob` to avoid JSON parser regressions in existing calls |

## Recommended Project Structure

```text
src/
|-- api/
|   |-- app.js                                # Mount export router beside existing routers
|   |-- errors/http-error-mapper.js           # Add export mapper only
|   `-- routes/
|       `-- exports.routes.js                 # GET /exports/ledger.xlsx
|-- domain/
|   `-- exports/
|       |-- export-errors.js                  # Typed categories (invalid_scope, generation_failed, etc.)
|       |-- export-ledger-query.js            # Scope-filtered read-model queries
|       |-- excel-column-specs.js             # Stable flattened columns per sheet
|       |-- excel-workbook-writer.js          # Streaming writer + worksheet UX defaults
|       `-- export-ledger-workbook.js         # Orchestrator entry point for route
`-- test/
    |-- api/exports-download.test.js          # Auth/scope/content headers/regression coverage
    `-- domain/exports/*.test.js              # Query scope and workbook shape tests

frontend/src/
|-- features/
|   `-- export/
|       |-- use-ledger-export.ts              # Export mutation hook
|       |-- export-button.tsx                 # Reusable action UI
|       `-- download-file.ts                  # Blob -> object URL helper
|-- app/shell/user-switcher.tsx               # Natural entry point for global export action
`-- lib/query-keys.ts                         # Optional export mutation key namespace
```

### Structure Rationale

- **`domain/exports/` is isolated:** prevents accidental coupling with timeline projection logic in `list-events` and minimizes blast radius.
- **Route stays thin:** auth/scope from existing `requireAuth` remains authoritative; route does not own business logic.
- **Read-model query layer is explicit:** export can include exactly persisted backup data (not projected timeline rows).
- **Frontend export feature is additive:** avoids changing dashboard/events data flows and cache partition behavior from Phase 13.

## Architectural Patterns

### Pattern 1: Scope-First Read Model for Export

**What:** Use `req.scope` -> `resolveOwnerFilter(scope)` for all export queries; never trust user-provided scope query params.
**When to use:** Every export query (assets, financial contracts, event history).
**Trade-offs:** Slightly more wiring than direct model reads, but guarantees Phase 13 lens/all/owner semantics remain consistent.

**Example:**
```javascript
// domain/exports/export-ledger-query.js
const ownerFilter = resolveOwnerFilter(scope);
const itemWhere = ownerFilter ? { user_id: ownerFilter } : {};
const items = await models.Item.findAll({ where: itemWhere });
```

### Pattern 2: Streaming Workbook Writer at HTTP Boundary

**What:** Build workbook with ExcelJS stream writer targeting `res` writable stream.
**When to use:** Download endpoint where row counts can grow and memory spikes must be avoided.
**Trade-offs:** Rows must be committed in order and are not editable afterward; this is acceptable for one-pass export generation.

**Example:**
```javascript
const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
const sheet = workbook.addWorksheet("Assets", { views: [{ state: "frozen", ySplit: 1 }] });
sheet.autoFilter = "A1:H1";
rows.forEach((row) => sheet.addRow(row).commit());
sheet.commit();
await workbook.commit();
```

### Pattern 3: Flat Column Contract with Versioned Metadata

**What:** Define stable, flattened sheet columns in one place and include an `Export_Metadata` sheet (`schema_version`, generated timestamp, scope mode).
**When to use:** Any portability artifact meant for restore/audit and cross-version resilience.
**Trade-offs:** Adds a small maintenance burden, but prevents silent downstream breakage when internal JSON fields evolve.

## Data Flow

### Request Flow

```text
[User clicks Export]
    -> frontend export action/hook
    -> GET /exports/ledger.xlsx (credentials include cookies)
    -> requireAuth resolves req.actor + req.scope
    -> export-ledger-workbook(scope)
       -> scoped queries (Items, Events, optional AuditLog attribution)
       -> workbook stream writer
    -> HTTP stream response with attachment headers
    -> browser saves file
```

### Frontend State Management

```text
AdminScopeContext/AuthContext
    -> export action reads current scope display context only (not authoritative)
    -> API enforces true scope from session
    -> mutation local state: idle -> pending -> success/error
```

### Key Data Flows

1. **Export in admin all-data mode:** session scope is `mode=all`; query layer uses `ownerFilter=null`; workbook includes all owners.
2. **Export in admin owner-lens mode:** session scope is `mode=owner,lensUserId=X`; query layer filters `user_id=X`; no cross-lens leakage.
3. **Export for standard user:** scope forced to actor owner; query params like `scope_mode=all` are ignored; result remains owner-only.

## New vs Modified Integration Points

| Layer | New Components | Modified Components |
|------|----------------|---------------------|
| API route layer | `src/api/routes/exports.routes.js` | `src/api/app.js` (mount router), `src/api/errors/http-error-mapper.js` (export mapper) |
| Domain services | `src/domain/exports/export-ledger-workbook.js`, `src/domain/exports/export-ledger-query.js`, `src/domain/exports/excel-workbook-writer.js`, `src/domain/exports/export-errors.js` | none required in `domain/items` or `domain/events` if export stays isolated |
| Query/data layer | Export-specific scoped queries across `models.Item`, `models.Event`, optional `models.AuditLog` | none (reuse existing models only) |
| Frontend UI/actions | `frontend/src/features/export/use-ledger-export.ts`, `frontend/src/features/export/export-button.tsx`, `frontend/src/features/export/download-file.ts` | `frontend/src/app/shell/user-switcher.tsx` (entry point), optional `frontend/src/lib/api-client.ts` blob helper |
| Tests/regressions | `test/api/exports-download.test.js`, `test/domain/exports/*`, `frontend/src/__tests__/export-action.test.tsx` | existing admin-scope tests extended with export assertions |

## Integration Points (explicit)

### API Route Contract

| Route | Method | Auth | Response | Notes |
|------|--------|------|----------|-------|
| `/exports/ledger.xlsx` | `GET` | `requireAuth` required | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` stream | `Content-Disposition: attachment; filename="hact-ledger-YYYY-MM-DD.xlsx"` |

### Domain Service Boundaries

| Service | Input | Output | Communicates With |
|---------|-------|--------|-------------------|
| `exportLedgerWorkbook` | `{ scope, now, localeHint }` | writes stream + metadata | `exportLedgerQuery`, `excelWorkbookWriter` |
| `exportLedgerQuery` | `{ scope }` | `{ assets, financialContracts, events }` | Sequelize `models` + `resolveOwnerFilter(scope)` |
| `excelWorkbookWriter` | `{ stream, datasets, formatting }` | committed workbook stream | ExcelJS writer only |

### Frontend Entry Points

| Entry point | Why here | Trigger |
|------------|----------|---------|
| `frontend/src/app/shell/user-switcher.tsx` | Global, always visible where scope context already lives | Export button near identity/lens controls |
| optional secondary CTA on `frontend/src/pages/dashboard/dashboard-page.tsx` | Discoverability for non-admin users | Same hook, no duplicated logic |

## Dependency-Aware Build Order

1. **Export domain skeleton first (no HTTP/UI):** add `domain/exports` query + workbook writer + unit tests.
2. **Add API route + streaming headers:** mount router in `src/api/app.js`, add endpoint integration tests for auth and file headers.
3. **RBAC regression hardening:** add tests for user/admin all/admin lens export counts; ensure out-of-scope leakage never occurs.
4. **Frontend action integration:** add export hook/button in `user-switcher`; keep existing query/cache behavior unchanged.
5. **UX polish + i18n + failure states:** disabled state during download, retry messaging, toast/inline errors.
6. **Performance and edge-case pass:** large dataset stream test, aborted client handling, filename/date formatting checks.

Dependency chain: `domain queries -> workbook writer -> API route -> RBAC tests -> frontend action`.

## Security and RBAC Notes

- Preserve existing trust boundary: only `req.scope` from `requireAuth` is authoritative.
- Keep non-leaky policy posture: ownership denials should not expose foreign owner IDs.
- Do not reuse `list-events` for backup export because it materializes projections and can mutate state (`ensurePendingEventsForScope`); export must be read-only over persisted rows.
- Consider spreadsheet formula-injection hardening for text cells that can start with `= + - @` when opened in Excel.
- Auditability: write an `AuditLog` action like `export.generated` with `actor_user_id` and `lens_user_id` for parity with Phase 13 attribution model.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | On-demand synchronous stream in request is sufficient |
| 1k-100k users | Add paged DB reads and row-by-row stream commit; enforce server timeout budget |
| 100k+ users | Move to async export job + object storage link while preserving same scope query contracts |

### Scaling Priorities

1. **First bottleneck:** DB read volume for full-history events; solve with scoped indexes and chunked reads.
2. **Second bottleneck:** concurrent export CPU/IO pressure; solve with concurrency caps or queued job mode.

## Anti-Patterns

### Anti-Pattern 1: Reusing Timeline Projection Endpoint for Backup Export

**What people do:** Export from `/events` grouped timeline output.
**Why it's wrong:** Includes projected/derived rows and side effects from sync logic, so backup is not faithful.
**Do this instead:** Use dedicated persisted-export query layer.

### Anti-Pattern 2: Trusting Client Scope Query Params for Export

**What people do:** Accept `scope_mode` and `lens_user_id` from URL as authority.
**Why it's wrong:** Bypasses Phase 13 safety model and enables privilege drift.
**Do this instead:** Resolve scope exclusively from authenticated session (`req.scope`).

### Anti-Pattern 3: Buffering Whole Workbook In Memory

**What people do:** Build workbook fully then `writeBuffer()` for response.
**Why it's wrong:** Memory spikes and poor resilience as data grows.
**Do this instead:** Stream workbook directly to response and commit rows incrementally.

## Sources

- Project context: `.planning/PROJECT.md`, `.planning/milestones/v2.0-ROADMAP.md`, `.planning/STATE.md`
- Current architecture references: `src/api/app.js`, `src/api/auth/require-auth.js`, `src/api/auth/scope-context.js`, `src/api/routes/items.routes.js`, `src/api/routes/events.routes.js`, `src/domain/events/list-events.js`, `frontend/src/app/shell/user-switcher.tsx`, `frontend/src/lib/query-keys.ts`
- ExcelJS README (streaming writer, worksheet views, autoFilter): https://github.com/exceljs/exceljs
- SheetJS Node docs (installation/channel caveats, updated 2024-10-11): https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
- OWASP CSV/Formula Injection guidance: https://owasp.org/www-community/attacks/CSV_Injection

---
*Architecture research for: HACT v3.0 Data Portability export*
*Researched: 2026-03-01*
