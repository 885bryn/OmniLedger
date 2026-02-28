# Phase 11: Timeline Projection & Asset Ledger Views - Research

**Researched:** 2026-02-27
**Domain:** Timeline projection read model, projected-exception instantiation, and asset ledger segmentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Timeline ordering
- Default sort is soonest-first so upcoming actionable entries stay at the top.
- For same-date ties, persisted rows appear before projected rows.
- Completed rows remain interleaved by chronology on the same date (no forced push to top or bottom).
- Timeline is grouped with date headers, not a flat continuous list.

### Projected vs persisted cues
- Projected rows always show an explicit `Projected` badge.
- Use subtle visual contrast between projected and persisted rows (clear but not heavy).
- Include a short inline legend near section headers to explain state labels.
- Show state markers anywhere applicable, including timeline and asset ledger surfaces.

### Projected edit behavior
- Confirmation copy must explicitly state that saving creates a persisted exception for that date.
- Use explicit primary action wording (for example, `Save exception`) rather than generic copy.
- After save, update the same row in place to reflect persisted state.
- Show an `Edited occurrence`-style indicator for rows materialized via projection edits.
- If amount and date are edited together, confirmation includes a field-level change summary (old -> new).
- On validation/server failure, show inline error plus toast.
- No success toast is required when in-place row state clearly updates.
- No direct revert-to-projected control is required in this phase.

### Asset ledger split
- Split records by status/date rules: pending and future-facing rows in Current & Upcoming; settled historical rows in Historical.
- Each section includes a compact summary header with count and total amount.
- Historical section is collapsed by default on mobile.
- Empty states use plain informative copy (no decorative or promotional tone).

### Claude's Discretion
- Exact badge/icon visual treatment and spacing as long as state distinction remains subtle and clear.
- Final microcopy wording for legends and empty states, preserving explicitness and plain tone.

### Deferred Ideas (OUT OF SCOPE)
- Add recurrence-series edit scope controls (for example, "change this occurrence" vs "change this and all future occurrences") as a separate future phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIN-05 | Editing a projected future occurrence instantiates a stored exception occurrence for that date. | Reuse/extend projected-id materialization flow (`projected-{itemId}-{YYYY-MM-DD}`) from completion path, add projected edit mutation, and persist exception metadata for UI state markers. |
| TIME-01 | User can view a unified timeline up to 3 years including paid, pending, and projected occurrences. | Replace current fixed `limit: 3` projection count with date-window projection (`today..today+3y`) and keep merged persisted+projected grouped output. |
| TIME-02 | Timeline distinguishes projected versus persisted occurrences and applies deterministic ordering. | Add explicit source/state fields in API response and deterministic comparator with persisted-before-projected tie rule on same date. |
| TIME-03 | Asset commitment view is split into `Current & Upcoming` and `Historical Ledger` sections. | Refactor asset detail commitments surface into two sections with status/date split rules, section summaries, and mobile-collapsed historical section. |
</phase_requirements>

## Summary

Phase 10 already built most of the substrate: read-time projections for recurring `FinancialItem` rows, deterministic projected IDs, persisted-over-projected dedupe for the same item/date key, and a completion flow that can materialize projected rows idempotently. The critical planning insight is that Phase 11 should not invent a new projection system; it should extend the existing `list-events` and `item-event-sync` contracts with a 3-year horizon and explicit source/state metadata.

The biggest implementation gap versus Phase 11 requirements is that timeline projection is currently bounded to 3 occurrences (`projectItemEvents(... limit: 3)`), not a 3-year window, and UI rows do not carry an explicit projected/persisted flag. A second major gap is that there is no event-edit mutation endpoint yet, so FIN-05 needs a new edit path that materializes projected rows before applying changes and marks them as edited exceptions.

For asset ledgers, current item detail shows a flat child commitments list. To satisfy TIME-03, plan for sectioning and summaries at the asset detail level using the same deterministic date/status split semantics as timeline surfaces, while preserving owner scope and existing cache invalidation behavior.

**Primary recommendation:** Build this phase around one shared timeline occurrence contract (with explicit `source_state`) used by both events timeline and asset ledger views, then add projected-edit materialization as a first-class event mutation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | `^5.2.1` | Timeline and occurrence mutation routes | Existing API routing/middleware baseline across all phase work. |
| `sequelize` | `^6.37.5` | Occurrence persistence, owner-scoped reads, transactions | Already used for idempotent materialization and mutation consistency. |
| `react` | `^19.2.0` | Timeline and asset ledger rendering | Existing UI foundation and component patterns already in place. |
| `@tanstack/react-query` | `^5.90.21` | Data fetching/cache invalidation for events/items | Existing query key + invalidation pattern is already consistent across dashboard/events/item detail. |
| `i18next` / `react-i18next` | `^25.8.13` / `^16.5.4` | Required labels, badges, legends, and error copy | Existing localization pattern for all user-visible timeline text. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jest` + `supertest` | `^29.7.0` / `^7.2.2` | API/domain regressions for projection and mutation flows | Backend behavior and deterministic ordering assertions. |
| `vitest` + Testing Library | `^4.0.18` / `^16.3.2` | UI behavior regressions for section split and row state cues | Frontend row labeling, mobile collapse, and mutation UX states. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending `/events` response | New dedicated `/timeline` endpoint | Cleaner long-term domain split, but adds extra migration and parity work in this phase. |
| Existing native UTC helpers | Add `rrule` + `luxon` now | Better long-range recurrence ergonomics, but introduces dependency/migration overhead mid-milestone. |

**Installation:**
```bash
# No new packages required for baseline Phase 11 implementation.
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
|- domain/
|  |- events/
|  |  |- list-events.js            # timeline read model composition
|  |  |- complete-event.js         # projected completion materialization (existing)
|  |  `- update-event.js           # NEW: projected edit -> persisted exception
|  `- items/
|     |- item-event-sync.js        # projection + materialization helpers
|     `- get-item-net-status.js    # asset ledger data split support
|- api/routes/
|  `- events.routes.js             # add edit mutation route
frontend/src/
|- pages/events/events-page.tsx    # timeline state badges/legend/deterministic sections
|- pages/items/item-detail-page.tsx# Current & Upcoming vs Historical Ledger sections
|- lib/date-ordering.ts            # shared deterministic comparator update
`- locales/*/common.json           # timeline + ledger copy additions
```

### Pattern 1: Persisted-over-projected merge by `(item_id, due_date)`
**What:** Build projected rows, then overwrite by persisted rows keyed on item/day.
**When to use:** Every timeline read where projected placeholders and stored rows can collide.
**Example:**
```javascript
// Source: src/domain/events/list-events.js
byKey.set(`${event.item_id}:${dueKey}`, event); // projected first
...
byKey.set(`${event.item_id}:${dueKey}`, event); // persisted overwrites projected
```

### Pattern 2: Projected-id materialization for safe mutation
**What:** Parse deterministic projected IDs and materialize a persisted row inside transaction before mutating.
**When to use:** Any mutation on a projected occurrence (complete now, edit in Phase 11).
**Example:**
```javascript
// Source: src/domain/events/complete-event.js
const projectedMatch = /^projected-([0-9a-f-]{36})-(\d{4}-\d{2}-\d{2})$/i.exec(eventId);
...
const materialized = await materializeItemEventForDate({ item, dueDate, models, transaction });
```

### Pattern 3: Scope-aware query composition and broad invalidation
**What:** Compose list params from admin scope and invalidate `events`, `dashboard`, and `items` roots on mutation.
**When to use:** Any event mutation that changes timeline and asset surfaces.
**Example:**
```typescript
// Source: frontend/src/features/events/complete-event-row-action.tsx
await Promise.all([
  queryClient.invalidateQueries({ queryKey: queryKeys.events.all }),
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
  queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
])
```

### Anti-Patterns to Avoid
- **Count-based projection limit for TIME-01:** Current `limit: 3` occurrences does not satisfy 3-year horizon.
- **Implicit projected-state detection in UI:** Relying on ID prefix alone is brittle; return explicit source/state fields.
- **Separate ordering logic per page:** Keep one deterministic comparator contract across timeline and ledger views.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Projected-row instantiation | New ad hoc parser/materializer | Extend `resolveTargetEvent` + `materializeItemEventForDate` path | Existing flow is transaction-safe, idempotent, and already regression-covered. |
| Deterministic ordering scattered in components | Per-component custom sorts | Shared comparator utilities (`date-ordering.ts` + domain compare functions) | Prevents ordering drift between API and UI. |
| In-place optimistic state without refetch | Manual local array surgery after edit | React Query invalidation pattern already used in completion flow | Safer for owner-scope + admin-lens consistency. |
| Ledger split heuristics only in UI | Multiple inconsistent split conditions | Centralized date/status split helper reused by events + item detail | Keeps TIME-03 semantics stable and testable. |

**Key insight:** The repo already has robust primitives for projection IDs, materialization, and merge precedence; Phase 11 should compose these primitives, not replace them.

## Common Pitfalls

### Pitfall 1: Misreading TIME-01 as "3 upcoming rows"
**What goes wrong:** Timeline appears complete in small datasets but fails requirement in real recurrence horizons.
**Why it happens:** Existing code uses `projectItemEvents(... limit: 3)` from Phase 10.
**How to avoid:** Move to date-window generation (`today` to `today + 3 years`) with explicit upper bound filtering.
**Warning signs:** Weekly recurring items only show three rows.

### Pitfall 2: No durable marker for edited exceptions
**What goes wrong:** UI cannot reliably show `Edited occurrence` after refresh.
**Why it happens:** Current `Event` schema has no explicit exception/materialization-reason field.
**How to avoid:** Add persisted exception metadata (column or deterministic derivation contract) and include it in timeline DTO.
**Warning signs:** Indicator appears immediately after save but disappears after reload.

### Pitfall 3: Tie-breaking logic diverges from user decision
**What goes wrong:** Same-date projected rows sometimes appear above persisted rows.
**Why it happens:** Current comparators use due date + updated_at + id, with no source-state precedence.
**How to avoid:** Add source rank in comparator (`persisted < projected`) before updated/id tie-breakers.
**Warning signs:** Non-deterministic ordering in same-date mixed-source groups.

### Pitfall 4: Asset ledger split implemented only by date
**What goes wrong:** Completed or settled rows surface in wrong section.
**Why it happens:** TIME-03 requires status/date rules together, not date-only bucketing.
**How to avoid:** Define one split predicate using both status and effective due/completion date semantics.
**Warning signs:** Completed future-dated exception appears in Current & Upcoming when it should be historical.

## Code Examples

Verified in-repo patterns to reuse:

### Projected merge precedence (persisted wins)
```javascript
// Source: src/domain/events/list-events.js
function mergePersistedAndProjectedEvents(persistedEvents, projectedEvents) {
  const byKey = new Map();
  projectedEvents.forEach((event) => byKey.set(`${event.item_id}:${eventDateKey(event.due_date)}`, event));
  persistedEvents.forEach((event) => byKey.set(`${event.item_id}:${eventDateKey(event.due_date)}`, event));
  return Array.from(byKey.values());
}
```

### Transactional projected materialization
```javascript
// Source: src/domain/items/item-event-sync.js
const existing = await models.Event.findOne({ where: { item_id: item.id, due_date: { [Op.gte]: start, [Op.lt]: end } }, transaction });
if (existing) return existing;
return models.Event.create({ item_id: item.id, due_date: start, status: "Pending", is_recurring: true }, { transaction });
```

### Shared event list params by lens scope
```typescript
// Source: frontend/src/lib/query-keys.ts
export function eventListParams(scope: LensScope, status: 'all' | 'pending' | 'completed' = 'all') {
  return { status, ...lensScopeToParams(scope) }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generated/managed one-off pending rows only | Projection-on-read with deterministic projected IDs | Phase 10 | Enables lazy materialization and avoids pre-generating long-horizon rows. |
| Projection count bound (`3`) | Needs 3-year date-window bound for Phase 11 | Pending in Phase 11 | Core gap for TIME-01 compliance. |
| UI split by temporal section only (events page) | Needs explicit projected/persisted state cues + ledger split semantics | Pending in Phase 11 | Core gap for TIME-02 and TIME-03 compliance. |
| Projected completion materialization only | Needs projected edit materialization for exceptions | Pending in Phase 11 | Core gap for FIN-05 compliance. |

**Deprecated/outdated for this phase:**
- `projectItemEvents(... limit: 3)` as the primary horizon control.
- UI contracts that infer projected state from ID shape without explicit DTO fields.

## Open Questions

1. **Should the 3-year timeline be strictly forward-looking (`today..today+3y`) or include historical rows in same endpoint with bounded future projection?**
   - What we know: Current events page already mixes upcoming + history, and user decisions require chronology interleaving.
   - What's unclear: Hard historical lower bound for unified timeline response.
   - Recommendation: Keep history included (no new lower bound), cap projected generation to `today+3y`.

2. **What durable field will encode "edited exception" for persisted rows?**
   - What we know: Schema currently lacks explicit exception metadata.
   - What's unclear: Whether to add a boolean (`is_exception`) or richer metadata (`materialized_reason`, `source_projection_key`).
   - Recommendation: Add a minimal explicit field now (`is_exception` + optional `exception_notes` later) to satisfy UI indicator deterministically.

3. **Do asset ledger sections operate on event occurrences only, or on commitments plus derived lifecycle state?**
   - What we know: TIME-03 and context language reference records with pending/settled semantics, which aligns with occurrences.
   - What's unclear: Whether product expects contract rows or event rows in the split ledger.
   - Recommendation: Base split on occurrences for determinism and requirement alignment, while preserving links back to parent financial item.

## Sources

### Primary (HIGH confidence)
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/phases/11-timeline-projection-asset-ledger-views/11-CONTEXT.md` - Locked decisions, discretion, and deferred scope.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/REQUIREMENTS.md` - FIN-05, TIME-01, TIME-02, TIME-03 requirement definitions.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/STATE.md` - Phase 10 completion context and prior decisions.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/events/list-events.js` - Current projection, merge, sorting, and grouping behavior.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/item-event-sync.js` - Projection horizon logic and materialization primitives.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/events/complete-event.js` - Projected-id mutation materialization and idempotency pattern.
- `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/pages/events/events-page.tsx` - Current timeline UI sectioning and data usage.
- `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/pages/items/item-detail-page.tsx` - Current asset commitments view baseline for ledger split.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/events-list.test.js` - Regression coverage for deterministic ordering and projection behavior.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/events-complete.test.js` - Regression coverage for projected completion materialization.

### Secondary (MEDIUM confidence)
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/phases/10-financial-contract-occurrence-foundation/10-04-SUMMARY.md` - Established frontend timeline patterns carried into Phase 11.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/phases/10-financial-contract-occurrence-foundation/10-05-SUMMARY.md` - Persisted-over-projected lifecycle decision and visibility regressions.

### Tertiary (LOW confidence)
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/research/ARCHITECTURE.md` and `C:/Users/bryan/Documents/Opencode/House ERP/.planning/research/STACK.md` - Earlier roadmap-level recommendations; useful direction but partially superseded by implemented Phase 8-10 code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and libraries verified from current `package.json` files.
- Architecture: HIGH - based on implemented domain/routes/frontend code and regression tests.
- Pitfalls: HIGH - directly derived from current requirement gaps and existing tests/logic.

**Research date:** 2026-02-27
**Valid until:** 2026-03-29
