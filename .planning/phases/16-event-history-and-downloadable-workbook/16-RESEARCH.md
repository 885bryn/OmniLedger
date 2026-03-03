# Phase 16: Event History and Downloadable Workbook - Research

**Researched:** 2026-03-03
**Domain:** XLSX workbook generation + event-history sheet modeling + browser download transport
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Event row clarity
- Event rows should lead with lifecycle-stage readability (not raw system-type emphasis).
- Row density should be balanced: enough lifecycle and money context to understand status quickly without overloading each row.
- Missing lifecycle values should use explicit markers (not blank cells).
- Event History default ordering should be newest-first.

### Cross-sheet linking
- Event rows should include both stable IDs and readable reference values in separate fields.
- When a linked record cannot be resolved, keep the ID context and show an explicit `UNLINKED` marker.
- Include both contract and asset references whenever available.
- Cross-sheet reference values should match `Assets` and `Financial Contracts` sheet values exactly.

### Download experience
- Export action should show immediate inline loading state in-app.
- On success, show explicit success feedback in-app in addition to browser download behavior.
- On failure, present actionable retry guidance.
- While export is in progress, prevent duplicate export clicks.

### Workbook structure defaults
- Sheet order should be `Assets` -> `Financial Contracts` -> `Event History`.
- Sheet naming should use human-readable titles.
- All sheets should open with frozen headers and filtering enabled.
- Date/time presentation should be consistent and user-friendly across workbook sheets.

### Claude's Discretion
- Exact UX microcopy for loading/success/failure messages.
- Exact column-level field selection as long as balanced density and lifecycle readability are preserved.
- Exact visual style/details of in-app export feedback components.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXPT-01 | User can trigger a ledger backup export and download a generated `.xlsx` file from the app. | Add binary workbook serialization in backend (`exceljs`), set attachment headers in route, and change frontend export hook from JSON helper to `fetch(...).blob()` + object URL download flow. |
| EXPT-02 | Export workbook includes separate sheets for `Assets`, `Financial Contracts`, and `Event History`. | Extend workbook-domain model to emit `Event History`, then write sheets in locked order with a single serializer module that consumes existing `workbook.sheets` contracts. |
| EXPT-05 | Exported `Event History` sheet includes occurrence/payment lifecycle fields with stable identifiers. | Build deterministic event-row projection from `datasets.events.rows` with stable IDs (`event_id`, `item_id`) and lifecycle fields (`status`, `due_date`, `completed_at`, recurrence/exception flags), explicit markers for missing values, and newest-first sort comparator with ID tie-break. |
| RELA-02 | Exported event rows include references to related contract and asset records where links exist. | Resolve event -> item (`item_id`), then derive contract and asset references from item type and existing link-resolver patterns; output ID + readable label columns and preserve `UNLINKED` for missing targets. |
</phase_requirements>

## Summary

Phase 16 should be planned as two tightly coupled deliverables: (1) complete the workbook data contract by adding `Event History` rows with deterministic ordering/link fidelity, and (2) convert the current JSON export response into an actual downloadable `.xlsx` transport. Phase 15 already built stable `Assets` and `Financial Contracts` sheet contracts and route wiring (`src/domain/exports/workbook-model.js`, `src/api/routes/exports.routes.js`), so this phase should extend that same model-first pattern rather than introducing alternate data paths.

The biggest implementation pivot is transport: today `GET /exports/backup.xlsx` returns JSON and frontend calls through `apiRequest` (JSON-only parser). To meet EXPT-01, the planner should include a dedicated download client path (`fetch` + `Response.blob()` + temporary anchor/object URL) and backend response headers (`Content-Disposition` attachment). Keep scope authority unchanged by continuing to source data from `exportScopeQuery({ scope: req.scope })` only.

Event History fidelity is mostly a projection problem, not a new persistence problem. Canonical event fields already exist in export scope (`id`, `item_id`, `event_type`, `due_date`, `amount`, `status`, `is_recurring`, `is_exception`, `completed_at`, timestamps, `owner_user_id`) in `src/domain/exports/export-scope-query.js`. The phase should add a deterministic event transform that outputs lifecycle-readable columns first, includes both IDs and readable references for contract/asset links, and locks unresolved relationships with explicit markers.

**Primary recommendation:** Implement Phase 16 as an additive domain transform + serializer split: keep `buildWorkbookModel()` as the source of sheet contracts (now including `Event History`), then introduce a focused XLSX writer module and binary route response consumed by a dedicated frontend download hook.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `exceljs` | `4.4.0` (latest npm at research time) | Build in-memory workbook and serialize to `.xlsx` buffer | Official docs show Node API for workbook creation, sheet views (freeze), auto-filter, and `workbook.xlsx.writeBuffer()` for binary response generation. |
| `express` | `^5.2.1` | Authenticated export route + attachment response headers | Existing route already enforces auth/scope; Express `res.attachment(filename)` sets `Content-Disposition` for download behavior. |
| Browser Fetch API | platform standard | Frontend binary download flow | `Response.blob()` is baseline and allows object-URL based downloads from authenticated requests. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jest` | `^29.7.0` | Domain/API export regression tests | Validate deterministic event sheet shape/order and scope parity after binary route change. |
| `supertest` | `^7.2.2` | HTTP-level attachment/content assertions | Validate content type/disposition and non-empty binary payload. |
| `vitest` | `^4.0.18` | Frontend export UX tests | Validate pending state, duplicate-click lock, success/failure messaging, and download trigger calls. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side `exceljs` serialization | Keep JSON-only response and generate workbook on client | Breaks backup trust boundary and duplicates workbook logic in frontend. |
| One endpoint with implicit behavior | Separate JSON metadata endpoint + binary download endpoint | Cleaner contracts but larger API surface; current phase can stay single-route if content negotiation or direct binary switch is managed carefully. |
| Dynamic event columns from raw payload | Frozen event column contract | Dynamic columns would break determinism and cross-phase compatibility. |

**Installation:**
```bash
npm install exceljs
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
|-- domain/
|   `-- exports/
|       |-- workbook-model.js            # Extend with Event History projection
|       |-- workbook-columns.js          # Add frozen EVENT_HISTORY_COLUMNS
|       |-- workbook-formatters.js       # Reuse marker/date/amount/label helpers
|       `-- workbook-xlsx.js             # New serializer: sheet contracts -> XLSX buffer
`-- api/
    `-- routes/exports.routes.js         # Return binary attachment from scoped workbook

frontend/src/
`-- features/export/
    `-- use-export-backup.ts             # Switch to blob download flow (not JSON helper)
```

### Pattern 1: Scope First, Then Workbook Projection, Then Serialization
**What:** Keep trusted scoping isolated to `exportScopeQuery`; all workbook steps consume only scoped rows.
**When to use:** Every export request.
**Example:**
```javascript
// Source: src/api/routes/exports.routes.js + src/domain/exports/export-scope-query.js
const scopedDataset = await exportScopeQuery({ scope: req.scope });
const workbookModel = buildWorkbookModel(scopedDataset.datasets);
const xlsxBuffer = await serializeWorkbookToXlsx(workbookModel);
```

### Pattern 2: Event-to-Contract/Asset Resolver with Explicit Unresolved Semantics
**What:** Resolve event links by traversing event `item_id` to item row, then deriving contract/asset refs with ID + readable values.
**When to use:** Building each `Event History` row.
**Example:**
```javascript
const eventItem = itemById.get(event.item_id) || null;
// If event item is financial, contract_id is item.id and linked asset comes from linked_asset_item_id fallback chain.
// If linked record missing, keep ID and label as UNLINKED.
```

### Pattern 3: Deterministic Newest-First Event Ordering with Stable Tie-Break
**What:** Sort Event History by newest lifecycle date first (recommend due/completed key policy), then stable ID.
**When to use:** Before projecting `Event History` rows.
**Example:**
```javascript
events.sort((a, b) => {
  const timeDiff = toComparableTime(b.due_date) - toComparableTime(a.due_date);
  if (timeDiff !== 0) return timeDiff;
  return String(a.id).localeCompare(String(b.id));
});
```

### Anti-Patterns to Avoid
- **Binary response through JSON helper:** current `apiRequest` assumes JSON and will silently return `null` for non-JSON success.
- **Relationship labels computed from different sources than sheet contracts:** violates requirement that reference values match `Assets`/`Financial Contracts` exactly.
- **Dropping unresolved links to blank values:** must preserve ID context with explicit `UNLINKED` marker.
- **Unstable event sorting (no tie-break):** causes flaky exports and difficult regression assertions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XLSX ZIP packaging | Custom OpenXML XML generator | `exceljs` workbook API + `writeBuffer()` | OpenXML edge cases are large; library already handles workbook packaging. |
| Download header crafting | Manual `Content-Disposition` string assembly everywhere | `res.attachment(filename)` + explicit `res.type(...)` | Express provides attachment semantics consistently. |
| Event lifecycle marker policies | Per-column ad hoc null handling | Existing `toExplicitMarker` + `EXPLICIT_MARKERS` helpers | Keeps marker semantics consistent with Phase 15 (`N/A`, `UNLINKED`). |
| Relationship fallback rules | New one-off link heuristics | Existing resolver precedence style used in workbook model/net-status | Prevents link drift between sheets. |

**Key insight:** The hard part is not writing bytes; it is preserving deterministic, relationship-faithful contracts while switching transport from JSON to binary.

## Common Pitfalls

### Pitfall 1: Route Contract Breakage During JSON -> Binary Shift
**What goes wrong:** Existing tests/clients expecting JSON body fail or appear to succeed without download.
**Why it happens:** `apiRequest` parses only JSON and current route/test suite asserts `response.body.workbook`.
**How to avoid:** Plan explicit migration: update frontend hook and API tests in same wave; if needed, add temporary dual-mode behavior gated by `Accept`.
**Warning signs:** Frontend shows success text but no file downloaded.

### Pitfall 2: Event Rows Lose Contract/Asset Fidelity
**What goes wrong:** Event rows show only `item_id` with no aligned sheet references.
**Why it happens:** Resolver does not map financial-item links through existing asset/contract logic.
**How to avoid:** Build event resolver against same item index and readable reference rules used by existing sheets.
**Warning signs:** Event rows reference IDs that are present in other sheets but labels are `N/A`.

### Pitfall 3: Newest-First Requirement Implemented Ambiguously
**What goes wrong:** Team disagrees whether newest means `due_date`, `completed_at`, or `updated_at`.
**Why it happens:** Requirement is directional but not mathematically explicit.
**How to avoid:** Lock one comparator policy in code/tests and document it in column spec comments/tests.
**Warning signs:** Test fixtures pass locally but reviewers reorder rows manually in expected outputs.

### Pitfall 4: Cross-Sheet Label Drift
**What goes wrong:** Event reference labels differ from corresponding labels in `Assets` / `Financial Contracts`.
**Why it happens:** Separate formatting logic or fallback chain for event sheet.
**How to avoid:** Reuse shared formatter + reference resolver helpers and/or reference already projected workbook rows by ID.
**Warning signs:** Same ID has two different titles across sheets in one workbook.

## Code Examples

Verified patterns from current code and official docs:

### Current Export Scope Event Canonical Fields
```javascript
// Source: src/domain/exports/export-scope-query.js
const EVENT_FIELDS = Object.freeze([
  "id", "item_id", "event_type", "due_date", "amount", "status",
  "is_recurring", "is_exception", "completed_at", "created_at", "updated_at"
]);
```

### Current Route Composition Point for Workbook + Scope
```javascript
// Source: src/api/routes/exports.routes.js
const scopedDataset = await exportScopeQuery({ scope: req.scope });
const workbook = buildWorkbookModel(scopedDataset.datasets);
```

### ExcelJS Buffer Serialization for HTTP Response
```javascript
// Source: https://github.com/exceljs/exceljs (README, Writing XLSX)
const buffer = await workbook.xlsx.writeBuffer();
```

### Express Attachment Header for Browser Download Prompt
```javascript
// Source: https://expressjs.com/en/api.html#res.attachment
res.attachment("hact-backup-2026-03-03.xlsx");
```

### Browser Fetch Binary Read
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Response/blob
const response = await fetch(url, { credentials: "include" });
const blob = await response.blob();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No export route | Scoped JSON export contract at `GET /exports/backup.xlsx` | Phase 14 | Scope and RBAC guarantees already regression-locked. |
| Two workbook sheets only | `Assets` + `Financial Contracts` deterministic contracts | Phase 15 | Event sheet can be added using same frozen-column/read-model pattern. |
| Frontend export as JSON mutation | Still JSON-only via `apiRequest` | Current pre-Phase 16 | Must change for real file download behavior. |

**Deprecated/outdated for this phase:**
- Treating `/exports/backup.xlsx` as JSON-only endpoint.
- Building event references without shared relationship resolver semantics.

## Open Questions

1. **Comparator definition for "newest-first" Event History**
   - What we know: Context locks newest-first ordering.
   - What's unclear: Primary sort field (`due_date` vs `completed_at` vs composite).
   - Recommendation: Use explicit composite comparator (`primary lifecycle date`, then `updated_at`, then `event_id`) and lock with tests.

2. **Binary migration strategy for existing JSON assertions**
   - What we know: API and frontend tests currently assert JSON response envelopes.
   - What's unclear: Whether to do hard cut to binary in Phase 16 or short dual-mode transition.
   - Recommendation: Prefer hard cut in Phase 16 with coordinated test updates unless planner decides temporary Accept-based compatibility is needed to reduce risk.

3. **Event relationship shape for non-financial event items**
   - What we know: Events point to generic `item_id`; tests already create events on assets.
   - What's unclear: Exact column values when event is directly on an asset (no contract).
   - Recommendation: Define explicit row rules for each item class and marker outputs, then lock fixtures for both paths.

## Sources

### Primary (HIGH confidence)
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/phases/16-event-history-and-downloadable-workbook/16-CONTEXT.md` - locked decisions and out-of-scope constraints.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/REQUIREMENTS.md` - EXPT-01, EXPT-02, EXPT-05, RELA-02 requirement definitions.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/STATE.md` - phase continuity and prior architectural decisions.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/api/routes/exports.routes.js` - current route contract and workbook composition entrypoint.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/exports/export-scope-query.js` - canonical export fields for items/events.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/exports/workbook-model.js` - deterministic sheet transform patterns and relationship resolver precedent.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/exports/workbook-columns.js` - frozen column contract approach.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/exports/workbook-formatters.js` - explicit marker/date/amount formatting policy.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/domain/exports/workbook-model.test.js` - deterministic ordering and marker fidelity assertions.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/exports-backup-scope.test.js` - scope and route contract regression matrix.
- `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/features/export/use-export-backup.ts` - current JSON-only frontend export behavior.
- `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/app/shell/user-switcher.tsx` - existing pending/success/error UX hooks and duplicate-click prevention.
- `https://github.com/exceljs/exceljs` - workbook creation, freeze panes, auto-filter, and `xlsx.writeBuffer()` APIs.
- `https://expressjs.com/en/api.html#res.attachment` - attachment header behavior for download responses.
- `https://developer.mozilla.org/en-US/docs/Web/API/Response/blob` - browser binary response handling.

### Secondary (MEDIUM confidence)
- `npm view exceljs version` (local npm registry query) - latest version observed as `4.4.0` at research time.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - stack recommendations are directly validated in current repo and official API docs.
- Architecture: HIGH - approach extends already implemented/export-tested Phase 14-15 patterns.
- Pitfalls: HIGH - all pitfalls map to concrete current-code constraints (JSON transport assumptions, resolver behavior, deterministic tests).

**Research date:** 2026-03-03
**Valid until:** 2026-04-02
