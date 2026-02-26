# Phase 10: Financial Contract-Occurrence Foundation - Research

**Researched:** 2026-02-26
**Domain:** Financial contract parent-child modeling, recurrence baseline projection, and owner-scoped event lifecycle on Express + Sequelize + React Query
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Contract creation behavior
- Use a single guided form with conditional fields, not a wizard.
- Require core save data with sensible defaults.
- Asset link should be encouraged when applicable (for example mortgage-like entries), but never hard-required.
- If no asset is linked, allow save with a soft warning and confirmation.
- One-time entries must create both parent and first occurrence immediately.

### Occurrence management flow
- Default occurrence view should prioritize upcoming/current items first.
- Keep history visible in a separate section or clearly separated grouping.
- Lock baseline behavior to compact inline row actions for common operations.
- Use status-focused occurrence edits as the default-safe interaction model.
- When a contract closes, stop generating new future projections while preserving history.

### Recurrence UX
- Use preset recurrence intervals as the primary model (no advanced custom-rule builder in this phase).
- Editing a projected future occurrence should instantiate that date as a persisted exception.
- Show recurrence state in plain language near contract context (for example, "Monthly, next on ...").

### Validation and error copy
- Show validation with inline field errors plus top summary.
- Use specific, fix-oriented messages for invalid recurrence and form issues.
- Keep policy/ownership denials in neutral policy tone.
- For risky but valid choices (like no linked asset), use warning-and-confirm rather than silent allow or hard block.

### Naming and UI clarity after model unification
- Use `FinancialItem` as the single parent financial entity.
- Treat former `FinancialCommitment` and `FinancialIncome` as subtype values of `FinancialItem`, not separate top-level models.
- UI should label the parent concept as "Financial item" for clarity.
- UI should show subtype explicitly via a visible subtype badge (Commitment/Income).
- No migration banner/modal is required; apply a seamless terminology update in-place.
- Create/edit forms should clearly ask for subtype selection (Commitment or Income).

### Claude's Discretion
- Exact field ordering, spacing, and helper-text placement.
- Visual treatment of badges/icons as long as subtype remains explicit.
- Precise grouping UI for upcoming vs history, while preserving the locked behavior above.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIN-01 | User can create a parent `FinancialItem` with `title`, `type`, `frequency`, `default_amount`, `status`, owner, and linked asset. | Add explicit parent financial contract fields (not inferred from loose JSON), preserve server-derived owner scope, and keep linked asset optional but validated when present. |
| FIN-02 | User can track child `Event` occurrences with `financial_item_id`, `due_date`, `actual_amount`, `status`, and owner scope. | Keep child rows owner-scoped through parent ownership and define deterministic occurrence read model (upcoming/history grouping) with status-driven edits. |
| FIN-03 | One-time financial creation creates parent and one child occurrence in a single backend transaction. | Use Sequelize managed transaction for create-parent + create-first-event + audit write; rollback all on any validation failure. |
| FIN-04 | Recurring contracts store recurrence rules on parent items and do not pre-generate long-horizon rows. | Store recurrence baseline on parent (preset interval model), project only near-term occurrences on read, and persist only materialized/edited exceptions. |
| FIN-06 | Closing a parent contract prevents new projected occurrences from being generated. | Enforce contract `status` gate in projection path so closed parents return history only and never produce new projected children. |
</phase_requirements>

## Summary

Phase 10 is a model-shaping phase: the repo already supports `Item` + `Event`, owner scope, and transaction-backed writes, but current financial behavior is derived from generic JSON attributes and a single pending-event sync helper. That existing approach cannot cleanly satisfy the new `FinancialItem` parent contract fields (`title`, `type`, `frequency`, `default_amount`, `status`) or recurrence baseline behavior without introducing explicit parent financial semantics.

The strongest implementation seam is to keep the current Express + Sequelize + React Query stack and evolve the domain into a true contract-aggregate pattern: parent `FinancialItem` as source of recurrence + status, child `Event` rows for persisted occurrences, and projection logic that computes upcoming occurrences without long-horizon pre-generation. This aligns with FIN-03/FIN-04 and avoids data explosion.

Frontend risk is mostly workflow and terminology drift: routing and UI still point to `items/create/wizard`, while locked decisions require a single guided form and unification language around "Financial item" with subtype badges. Plan work should explicitly sequence API/domain changes before UI terminology/form migration.

**Primary recommendation:** Implement FinancialItem contract fields and recurrence projection rules in the domain first (transactional create + status-gated projection), then migrate UI from wizard semantics to a single guided financial form that consumes those explicit contracts.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^5.2.1 | API routing and middleware boundaries | Existing protected route + scope context flow is already stable from Phases 8-9. |
| sequelize | ^6.37.5 | Model definitions, associations, and transactions | Current domain and migrations already use Sequelize patterns; managed transactions directly support FIN-03 atomicity. |
| pg / sqlite3 | ^8.13.1 / ^5.1.7 | Runtime Postgres + test SQLite compatibility | Repository actively supports both dialects; phase design must remain dual-dialect safe. |
| react + react-router-dom | ^19.2.0 / ^7.13.1 | Contract form and occurrence management surfaces | Existing route tree and feature pages already built here. |
| @tanstack/react-query | ^5.90.21 | Occurrence/item fetching and invalidation | Existing list/detail/events flows rely on query keys and invalidation roots. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jest + supertest | ^29.7.0 / ^7.2.2 | API/domain transaction and ownership regression tests | FIN-01..FIN-06 backend contract tests and denial semantics. |
| vitest + testing-library | ^4.0.18 / ^16.3.2 | Frontend guided form and grouping behavior tests | Single-form flow, warning-and-confirm UX, and upcoming/history rendering. |
| i18next + react-i18next | ^25.8.13 / ^16.5.4 | Terminology update and validation copy | "Financial item" naming, subtype labels, and fix-oriented error strings. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Explicit parent recurrence fields (preset model) | Full RFC RRULE + arbitrary custom rule builder | Over-scopes this phase and conflicts with locked decision to use preset intervals only. |
| Projection-on-read for upcoming occurrences | Pre-generate monthly/yearly rows far in advance | Violates FIN-04 and creates clean-up/race complexity for close/edit flows. |

**Installation:**
```bash
# No new mandatory packages required for baseline Phase 10.
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── domain/financial-items/         # parent contract create/update/close logic
├── domain/occurrences/             # projection + persisted occurrence operations
├── api/routes/                     # financial-item + event routes (scope-aware)
├── db/models + migrations/         # explicit financial contract fields and indexes
frontend/src/
├── pages/financial-items/          # single guided financial form and detail view
├── features/financial-items/       # subtype badge, recurrence text, warnings
└── features/events/                # upcoming/history grouped occurrence interactions
```

### Pattern 1: Contract Aggregate (Parent + Child)
**What:** Treat parent financial contract as source of truth and child events as occurrence materializations.
**When to use:** All create/edit/close paths for financial records.
**Example:**
```javascript
// Source: src/db/models/item.model.js, src/db/models/event.model.js
Item.hasMany(Event, { as: "occurrences", foreignKey: "item_id" });
Event.belongsTo(Item, { as: "item", foreignKey: "item_id" });
```

### Pattern 2: Managed Transaction for One-Time Create
**What:** Create parent + first occurrence + audit within one managed transaction.
**When to use:** FIN-03 one-time creation and any multi-write financial mutation.
**Example:**
```javascript
// Source: https://sequelize.org/docs/v6/other-topics/transactions/
await sequelize.transaction(async (transaction) => {
  const financialItem = await models.Item.create(parentPayload, { transaction });
  await models.Event.create(firstOccurrencePayload, { transaction });
  await models.AuditLog.create(auditPayload, { transaction });
  return financialItem;
});
```

### Pattern 3: Projection-on-Read With Status Gate
**What:** Persist real occurrences and compute upcoming projected occurrences only when reading.
**When to use:** `/events` and financial-item detail occurrence sections.
**Example:**
```javascript
// Source: src/domain/events/list-events.js (existing backfill seam)
if (financialItem.status !== "Closed") {
  const projected = projectNextOccurrence(financialItem.recurrence_rule, now);
  mergeProjectedIfMissing(projected, persistedEvents);
}
```

### Pattern 4: Owner Scope as Parent Constraint
**What:** Enforce ownership at parent contract boundary; children inherit owner scope via parent join.
**When to use:** Event list/update/complete and contract close operations.
**Example:**
```javascript
// Source: src/api/auth/scope-context.js, src/domain/events/list-events.js
const ownerFilter = resolveOwnerFilter(scope);
const rows = await models.Event.findAll({
  include: [{ model: models.Item, as: "item", required: true, where: ownerFilter ? { user_id: ownerFilter } : {} }],
});
```

### Anti-Patterns to Avoid
- **JSON-only contract semantics:** Avoid burying required FIN-01 fields in ad hoc `attributes` keys with no explicit contract validation.
- **Write-time pre-generation loops:** Do not create future occurrences in bulk during create/update.
- **Status-agnostic projection:** Never project new occurrences for closed contracts.
- **Wizard lock-in:** Current `items/create/wizard` flow conflicts with locked single guided form decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-write atomic create | Manual commit/rollback orchestration across service functions | Sequelize managed transactions | Officially supported rollback/commit semantics reduce partial-write risk for FIN-03. |
| Owner-scope enforcement | Route-by-route ad hoc ownership checks | Shared `scope-context` + parent-join owner filters | Prevents policy drift and keeps 404-style denial behavior consistent. |
| Recurrence persistence model | Custom free-form rule DSL/parser in this phase | Preset frequency enum + stored recurrence metadata | Locked scope is preset intervals; custom DSL increases risk and test surface. |
| Upcoming/history grouping | Client-only ad hoc sorting in multiple pages | Shared grouping comparator and domain return shape | Prevents inconsistent ordering between dashboard/events/detail. |

**Key insight:** This phase is about durable domain contracts, not feature breadth; using explicit parent fields + managed transactions + projection-on-read avoids most rewrite risk.

## Common Pitfalls

### Pitfall 1: Partial Writes on One-Time Create
**What goes wrong:** Parent saves but first occurrence fails, leaving orphan contract state.
**Why it happens:** Parent and child writes are not wrapped in one transaction.
**How to avoid:** Use one managed transaction for parent + first event + audit.
**Warning signs:** Tests can find parent rows with no initial child after a failed create path.

### Pitfall 2: Duplicate Pending Occurrences
**What goes wrong:** Concurrent reads/writes create more than one pending occurrence for same contract date.
**Why it happens:** Projection/backfill logic runs without uniqueness guard.
**How to avoid:** Add deterministic dedupe key and DB uniqueness/index strategy for persisted occurrences.
**Warning signs:** `/events` repeated calls increase count without any user mutation.

### Pitfall 3: Date Drift Around Month Boundaries
**What goes wrong:** Monthly recurrences shift unexpectedly (e.g., Jan 31 -> Mar 3 style drift).
**Why it happens:** Naive local-time date arithmetic and timezone conversion inconsistencies.
**How to avoid:** Normalize recurrence calculations in UTC/date-only semantics and regression-test boundary dates.
**Warning signs:** Same recurrence rule yields different next dates across environments.

### Pitfall 4: Closed Contracts Still Projecting
**What goes wrong:** Future projected occurrences keep appearing after closure.
**Why it happens:** Projection code ignores parent status.
**How to avoid:** Gate projection by parent status before any recurrence computation.
**Warning signs:** Closed items still show new upcoming events on subsequent reads.

### Pitfall 5: Terminology Drift During Unification
**What goes wrong:** API/model/UI keep mixed `FinancialCommitment`/`FinancialIncome` labels as top-level concepts.
**Why it happens:** UI and route naming remain tied to legacy item-type flow.
**How to avoid:** Centralize display naming to "Financial item" + explicit subtype badge and keep transport mapping deterministic.
**Warning signs:** Screens use "commitment" as parent concept and omit subtype label.

## Code Examples

Verified patterns from official docs and repository code:

### Sequelize Managed Transaction (atomic create)
```javascript
// Source: https://sequelize.org/docs/v6/other-topics/transactions/
await sequelize.transaction(async (t) => {
  const parent = await models.Item.create(parentPayload, { transaction: t });
  await models.Event.create(firstEventPayload(parent.id), { transaction: t });
  return parent;
});
```

### Owner Scope Resolution (existing baseline)
```javascript
// Source: src/api/auth/scope-context.js
function resolveOwnerFilter(scopeInput) {
  const scope = scopeInput && typeof scopeInput === "object" ? scopeInput : {};
  if (scope.actorRole !== "admin") return scope.actorUserId || null;
  if (scope.mode === "all") return null;
  return scope.lensUserId || null;
}
```

### Existing Event Read Grouping Seam
```javascript
// Source: src/domain/events/list-events.js
const filtered = filterByRange(filterByStatus(events, query.status), query.dueFrom, query.dueTo).sort(compareEvents);
return {
  groups: groupEvents(filtered),
  total_count: filtered.length,
};
```

### Existing Frontend Form Seam Needing Single-Form Migration
```tsx
// Source: frontend/src/pages/items/item-create-wizard-page.tsx
const [step, setStep] = useState(1)
// Phase 10 locked decision: replace wizard progression with one guided conditional form.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Financial rows as distinct top-level `item_type` values (`FinancialCommitment`/`FinancialIncome`) | Parent concept must unify as `FinancialItem` with explicit subtype | Phase 10 decisions (2026-02-26) | Requires contract-level naming + subtype mapping in API/UI. |
| Event creation via `syncItemEvent` single-pending backfill | Recurrence baseline projection + persisted occurrences split | Phase 10 target | Supports FIN-04 no long-horizon pre-generation. |
| Optional parent link for commitments via `parent_item_id` | Linked asset remains optional but encouraged with warning-and-confirm | Phase 10 decisions (2026-02-26) | UX and validation must support safe no-asset create path. |

**Deprecated/outdated:**
- Multi-step wizard as the default creation flow for financial records.
- Treating commitment/income as parent entity names in UI copy.

## Open Questions

1. **Where to persist new FIN-01 contract fields?**
   - What we know: FIN-01 requires explicit fields and phase decisions require unified parent concept.
   - What's unclear: Dedicated new columns vs normalized JSON-with-schema enforcement strategy.
   - Recommendation: Prefer explicit columns (or strongly validated typed sub-object) for `title/type/frequency/default_amount/status` to reduce query and validation ambiguity.

2. **What projection horizon should Phase 10 expose for upcoming events?**
   - What we know: FIN-04 forbids long-horizon pre-generation, and locked UX needs upcoming/history grouping.
   - What's unclear: Exact window (next occurrence only vs bounded near-term range).
   - Recommendation: Start with deterministic bounded projection (e.g., next occurrence or short window) and keep horizon configurable for Phase 11 expansion.

3. **How should persisted exceptions be represented before FIN-05 ships in Phase 11?**
   - What we know: Context requires editing a projected future occurrence to instantiate a persisted exception.
   - What's unclear: Whether exception metadata lands fully in Phase 10 or partially scaffolded.
   - Recommendation: Add minimal exception-ready schema hooks now (source marker / derived key) without full Phase 11 editing workflow.

## Sources

### Primary (HIGH confidence)
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/phases/10-financial-contract-occurrence-foundation/10-CONTEXT.md` - Locked decisions and scope constraints.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/REQUIREMENTS.md` - FIN requirement definitions and phase mapping.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/STATE.md` - Prior phase decisions affecting ownership and audit model.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/create-item.js` - Existing create + transaction + owner scope seam.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/item-event-sync.js` - Current pending-event sync/backfill behavior.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/events/list-events.js` - Current grouped event read and scope filtering.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/events/complete-event.js` - Current status mutations and audit attribution pattern.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/db/models/item.model.js` - Current item typing and parent association baseline.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/db/models/event.model.js` - Current child occurrence schema.
- `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/pages/items/item-create-wizard-page.tsx` - Existing wizard flow requiring migration.
- `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/pages/events/events-page.tsx` - Existing grouped occurrence rendering seam.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/items-create.test.js` - Existing create/event contract baselines.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/events-list.test.js` - Existing grouped event retrieval and filter baselines.

### Secondary (MEDIUM confidence)
- https://sequelize.org/docs/v6/other-topics/transactions/ - Managed transaction behavior and rollback guarantees (last updated Apr 25, 2025).
- https://sequelize.org/docs/v6/core-concepts/assocs/ - Association design and FK ownership patterns (last updated Apr 25, 2025).
- https://sequelize.org/docs/v6/core-concepts/validations-and-constraints/ - Validation/constraint responsibilities and model validation behavior (last updated Apr 25, 2025).

### Tertiary (LOW confidence)
- https://github.com/jkbrzt/rrule - Recurrence-rule ecosystem reference (useful conceptually, but optional for this preset-interval phase and latest release appears older).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly grounded in repository manifests and existing architecture.
- Architecture: HIGH - recommendations map to current domain seams plus official Sequelize transaction/association guidance.
- Pitfalls: MEDIUM - strongly evidence-backed in current code, with some forward-looking recurrence edge cases needing phase execution validation.

**Research date:** 2026-02-26
**Valid until:** 2026-03-28
