# Phase 15: Assets and Contracts Workbook Model - Research

**Researched:** 2026-03-03
**Domain:** Export workbook read-model shaping for Assets and Financial Contracts sheets
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXPT-03 | Exported `Assets` sheet presents readable flattened columns for common asset fields and attribute values. | Build explicit Assets column spec and formatter over `Item` rows where `item_type in {RealEstate, Vehicle}`; flatten known keys (`address`, `vin`, `estimatedValue`, etc.) and preserve an overflow attributes column for non-baseline keys. |
| EXPT-04 | Exported `Financial Contracts` sheet includes contract subtype, recurrence fields, status, and linked context fields. | Build Financial Contracts spec over `Item` rows where `item_type=FinancialItem`, include subtype (`type` with attribute fallback), recurrence (`frequency`), status (`status`), due/amount context, and linked asset/parent references. |
| RELA-01 | Export sheets expose parent-child relationships between assets and linked financial commitments using stable IDs and readable reference columns. | Resolve relationship IDs from canonical fields plus compatibility attributes, include both ID and readable name/title columns, and emit explicit unresolved markers for missing targets. |
</phase_requirements>

## Summary

Phase 15 should be planned as a deterministic transformation layer on top of the Phase 14 scoped dataset contract, not as route/auth or file-download work. The backend already enforces scope and returns canonical `Item`/`Event` records from `GET /exports/backup.xlsx` (`src/domain/exports/export-scope-query.js`). The gap is workbook-model shaping: split items into Assets vs Financial Contracts, flatten fields into stable columns, resolve relationship references, and apply deterministic sorting/formatting.

The key design constraint is mixed legacy/current relationship encoding. Parent and linked asset relationships can exist in first-class columns (`parent_item_id`, `linked_asset_item_id`) and/or compatibility attributes (`attributes.parentItemId`, `attributes.linkedAssetItemId`), as proven by net-status logic/tests. If Phase 15 only reads one source, RELA-01 fidelity will regress for legacy rows. Planning should explicitly include a shared relationship resolver with precedence rules and unresolved markers.

The second risk is accidental semantic drift from timeline/list services. `list-events` mutates/derives state (`ensurePendingEventsForScope`, projections), while export should remain a faithful persisted backup model in this phase. Keep workbook shaping in `domain/exports` and reuse only pure helpers (for example, financial progress enrichment) where behavior is deterministic.

**Primary recommendation:** Implement Phase 15 as a pure, test-first export workbook-model module that consumes Phase 14 scoped rows and emits two deterministic sheet contracts (`Assets`, `Financial Contracts`) with explicit relationship resolution and stable sorting tie-breakers.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | `^5.2.1` | Existing export endpoint transport | Route already mounted and stable at `/exports/backup.xlsx`; Phase 15 should extend response model only. |
| `sequelize` | `^6.37.5` | Scoped reads of `Item` and `Event` models | Current export query and domain services already canonicalize row payloads with this stack. |
| Node.js (CommonJS) | repo standard | Workbook model transform layer | Backend domain modules in `src/domain/*` follow CommonJS + pure function style. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jest` | `^29.7.0` | Domain-level transform tests | Use for deterministic ordering, flattening, and relationship resolution assertions. |
| `supertest` | `^7.2.2` | API integration assertions for export response contract | Use to verify new workbook-model envelope remains scope-correct and stable. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Dedicated export workbook-model transformer | Reusing `list-items` payload directly | `list-items` applies UI-oriented filters/sorts and is not a sheet contract; introduces drift from export requirements. |
| Persisted export rows only | Reusing `list-events`/timeline projection to infer contract lifecycle | `list-events` has side effects and projected rows; risks non-faithful backup semantics for Phase 15. |
| Explicit column spec constants | Dynamic columns discovered from observed attributes each export | Dynamic discovery breaks determinism, diffs, and stable downstream tooling. |

**Installation:**
```bash
# Phase 15 requires no new packages.
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
|-- domain/
|   `-- exports/
|       |-- export-scope-query.js            # Existing scoped dataset source (Phase 14)
|       |-- workbook-model.js                # New orchestrator: builds Assets + Financial Contracts sheets
|       |-- workbook-columns.js              # New frozen column specs + ordering metadata
|       `-- workbook-formatters.js           # New value/relationship format helpers
`-- api/
    `-- routes/exports.routes.js             # Keep thin route; return scoped workbook model envelope

test/
|-- domain/exports/
|   `-- workbook-model.test.js               # Deterministic sheet shape and relationship fidelity tests
`-- api/
    `-- exports-backup-scope.test.js         # Extend contract assertions without weakening SCOP coverage
```

### Pattern 1: Transform After Scope, Never Before
**What:** Build workbook sheets from already scope-filtered rows returned by `exportScopeQuery`.
**When to use:** Every export request.
**Example:**
```javascript
// Source: src/domain/exports/export-scope-query.js
const scopedDataset = await exportScopeQuery({ scope: req.scope });
const workbookModel = buildWorkbookModel(scopedDataset.datasets);
```

### Pattern 2: Canonical Relationship Resolver With Legacy Fallbacks
**What:** Resolve link IDs using canonical columns first, then compatibility attributes.
**When to use:** Any parent/linked reference emitted in either sheet.
**Example:**
```javascript
// Source pattern: src/domain/items/get-item-net-status.js
function resolveParentLikeId(item) {
  return (
    item.parent_item_id ||
    item.linked_asset_item_id ||
    item.attributes?.parentItemId ||
    item.attributes?.linkedAssetItemId ||
    null
  );
}
```

### Pattern 3: Column Specs as Frozen Contracts
**What:** Keep column ordering and key selection in constants, not ad-hoc object iteration.
**When to use:** Assets and Financial Contracts sheet construction.
**Example:**
```javascript
const ASSETS_COLUMNS = Object.freeze([
  "asset_id",
  "asset_name",
  "asset_type",
  "owner_user_id",
  // ...relationship fields near identity...
  "linked_contract_ids",
  "attributes_overflow"
]);
```

### Anti-Patterns to Avoid
- **Using `Object.keys(attributes)` order as sheet schema:** insertion order can differ by record lineage and will destabilize exports.
- **Dropping unresolved links to empty strings:** violates explicitness requirement and hides relationship integrity issues.
- **Calculating sheet rows from unsorted arrays without tie-breakers:** non-deterministic outputs across equal-key rows.
- **Using timeline/projected event services for contract context:** risks side effects and non-persisted values in backup model.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scope filtering | New per-sheet owner filter logic | Existing `exportScopeQuery` + `resolveOwnerFilter` | Phase 14 already proved SCOP-01..04; duplicating logic risks leaks. |
| Financial subtype derivation | New custom subtype heuristics | Existing subtype fallback pattern (`type` then `attributes.financialSubtype`) | This is already battle-tested in list/net-status paths. |
| Relationship fallback logic | One-off per-sheet link resolvers | Shared resolver pattern from net-status compatibility handling | Prevents divergence between sheet outputs and existing relationship semantics. |
| Financial lifecycle enrichment | Recomputing metrics from scratch | `applyComputedFinancialProgress` where needed | Avoids duplicating recurring tracking math and edge-case drift. |

**Key insight:** Phase 15 is mainly about contract discipline (stable schema + deterministic transforms), not new data sources.

## Common Pitfalls

### Pitfall 1: Relationship Drift Between Canonical and Compatibility Fields
**What goes wrong:** Legacy rows linked only through attribute compatibility keys appear unlinked in export.
**Why it happens:** Export logic reads only `parent_item_id` or only `linked_asset_item_id`.
**How to avoid:** Resolve relationship IDs with explicit precedence across canonical and compatibility fields.
**Warning signs:** Net-status tests include linked rows that export sheets omit.

### Pitfall 2: Non-Deterministic Row Ordering
**What goes wrong:** Same data exports in different row order across runs.
**Why it happens:** Comparator lacks tie-breakers or sorts happen after formatting with null/marker collisions.
**How to avoid:** Apply explicit comparator chain ending with stable ID; test with tie scenarios.
**Warning signs:** Golden snapshot churn where data content is unchanged.

### Pitfall 3: Flattening That Loses Data
**What goes wrong:** Unknown attributes disappear when only fixed columns are exported.
**Why it happens:** No overflow column for non-baseline keys.
**How to avoid:** Include deterministic `attributes_overflow` (serialized sorted-key JSON/text) per row.
**Warning signs:** Round-trip comparisons show missing attribute keys.

### Pitfall 4: Ambiguous Null Presentation
**What goes wrong:** Empty cells mix true null, unresolved links, and intentionally blank values.
**Why it happens:** Direct raw null export without marker policy.
**How to avoid:** Define per-field explicit marker strategy (`N/A`, `UNLINKED`, `UNKNOWN`) and test it.
**Warning signs:** Reviewers cannot distinguish missing vs unresolved relationships.

## Code Examples

Verified patterns from current project code:

### Canonical Item Field Contract
```javascript
// Source: src/domain/exports/export-scope-query.js
const ITEM_FIELDS = Object.freeze([
  "id",
  "user_id",
  "item_type",
  "title",
  "type",
  "frequency",
  "default_amount",
  "status",
  "linked_asset_item_id",
  "attributes",
  "parent_item_id",
  "created_at",
  "updated_at"
]);
```

### Relationship Compatibility Fallback
```javascript
// Source: src/domain/items/get-item-net-status.js
if (typeof item.parent_item_id === "string" && item.parent_item_id.length > 0) {
  return item.parent_item_id;
}

if (typeof item.linked_asset_item_id === "string" && item.linked_asset_item_id.length > 0) {
  return item.linked_asset_item_id;
}
```

### Scope-Authoritative Export Entry
```javascript
// Source: src/api/routes/exports.routes.js
router.get("/exports/backup.xlsx", async (req, res, next) => {
  const scopedDataset = await exportScopeQuery({ scope: req.scope });
  res.status(200).json(scopedDataset);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Export endpoint absent | Scoped export JSON contract via `GET /exports/backup.xlsx` | Phase 14 (2026-03-03) | Phase 15 can focus purely on workbook-model shaping. |
| Mixed legacy financial item modeling | Unified `FinancialItem` with explicit `type/frequency/status` plus compatibility attrs | Migration + v2.0 hardening | Export model must support both canonical and compatibility link sources. |
| UI-oriented item/event views for display | Dedicated export domain path for backup scope | Phase 14 | Reduces risk of projection side effects in backup data. |

**Deprecated/outdated:**
- Treating client scope hints as authoritative in export flows.
- Assuming relationship IDs exist only in one field family (canonical columns only).

## Open Questions

1. **Phase-15 response envelope shape**
   - What we know: Phase 14 returns `{ export, datasets: { items, events } }` and frontend currently only checks `export.format`.
   - What's unclear: Whether to replace `datasets` with workbook-centric structure now or add workbook model alongside existing datasets.
   - Recommendation: Additive contract in Phase 15 (keep existing `datasets`, add `workbook`/`sheets`) to avoid unnecessary regression risk before Phase 16 download work.

2. **Contract lifecycle context source for "next due date" ordering**
   - What we know: Contracts carry `attributes.dueDate` and events table has persisted due dates; timeline services also project future rows.
   - What's unclear: Whether next due date in Financial Contracts should come strictly from contract attributes or from persisted event rows.
   - Recommendation: Use persisted contract-centric value first (attribute/canonical), optionally enrich from persisted events only; do not use projected events in Phase 15.

## Sources

### Primary (HIGH confidence)
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/phases/15-assets-and-contracts-workbook-model/15-CONTEXT.md` - locked decisions, ordering, formatting, and explicit marker constraints.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/REQUIREMENTS.md` - EXPT-03, EXPT-04, RELA-01 definitions.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/STATE.md` - Phase 14 completion context and locked endpoint contract continuity.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/exports/export-scope-query.js` - current scoped export dataset source and canonical field set.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/db/models/item.model.js` - authoritative item types/subtypes/frequency/status and associations.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/get-item-net-status.js` - relationship compatibility fallbacks and deterministic tie-breaking patterns.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/list-items.js` - subtype fallbacks and sorting/filtering comparator patterns.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/financial-metrics.js` - derived lifecycle metric computation for recurring contracts.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/items-create.test.js` - linked asset validation and compatibility attribute persistence behavior.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/items-net-status.test.js` - parent/linked fidelity and compatibility-link inclusion expectations.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/exports-backup-scope.test.js` - scope contract and non-authoritative client override protections.

### Secondary (MEDIUM confidence)
- None required; phase scope is primarily repository- and requirement-driven.

### Tertiary (LOW confidence)
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/research/ARCHITECTURE.md` - useful directional notes, but contains outdated route naming (`/exports/ledger.xlsx`) and should not be treated as source of truth.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools/versions and patterns verified directly in repo manifests and implementation.
- Architecture: HIGH - recommendations derive from existing Phase 14 export path and proven domain patterns.
- Pitfalls: HIGH - each pitfall corresponds to observed model/test behavior in current codebase.

**Research date:** 2026-03-03
**Valid until:** 2026-04-02
