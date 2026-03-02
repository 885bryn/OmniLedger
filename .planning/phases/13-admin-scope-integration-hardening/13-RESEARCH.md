# Phase 13: Admin Scope Integration Hardening - Research

**Researched:** 2026-03-01
**Domain:** Admin scope/lens enforcement consistency across mutation and detail drill-through flows
**Confidence:** HIGH

<user_constraints>
## User Constraints

No `*-CONTEXT.md` file exists for Phase 13.

### Locked Decisions
- None provided in a phase context file.

### Claude's Discretion
- Define the concrete hardening approach to close `AUTH-06` and `TIME-04` integration gaps while preserving existing API contracts.

### Deferred Ideas (OUT OF SCOPE)
- Existing milestone tech debt not tied to admin scope integration hardening (Phase 10/11 UX sign-off debt, LAN ops check).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-06 | Admin user can intentionally switch to all-data mode and bypass owner scope. | Mutation domains currently derive owner checks from `scope.actorUserId` (actor-only). Hardening must resolve mutation owner context from admin scope (`mode` + `lensUserId`) instead of actor identity. |
| TIME-04 | Admin can view combined data or filter dashboard/timeline through a selected user lens. | Drill-through from dashboard/timeline into item detail and net-status currently breaks on actor-only net-status ownership gates and lens-agnostic detail query keys. Hardening must preserve scope continuity in domain checks and frontend cache/query scoping. |
</phase_requirements>

## Summary

Phase 13 is a consistency hardening phase, not a new feature build. Admin scope infrastructure already exists end-to-end: server session stores admin mode/lens (`/auth/admin-scope`), `requireAuth` hydrates `req.scope`, list reads (`/items`, `/events`) use `resolveOwnerFilter(scope)`, and frontend admin controls already reset/refetch list surfaces. The remaining audit failures are concentrated in paths that still branch on actor identity (`req.actor.userId` / `scope.actorUserId`) instead of effective scope owner.

The highest-impact gaps are in mutation and net-status domain entry points. `get-item-net-status`, `update-item`, `soft-delete-item`, `restore-item`, `complete-event`, `undoEventCompletion`, and `update-event` all enforce ownership with actor-only comparisons. This blocks legitimate admin cross-owner mutations and breaks admin drill-through continuity even when scope mode/lens is set correctly. The router-level shape already passes `req.scope` in most places, so the safest plan is to centralize one "effective owner resolution" helper and migrate these domains without changing public envelopes.

Frontend drill-through has a secondary continuity risk: item detail net-status and lookup queries are keyed without lens state, unlike dashboard/events list queries. Even after backend fixes, stale cache can leak old-lens detail views. Scope-aware query keys and deterministic invalidation on admin scope transitions are required to lock behavior.

**Primary recommendation:** First introduce a single domain-safe owner resolution contract (scope -> effective owner semantics for reads/writes), then migrate all actor-only mutation/net-status pathways and add regression coverage for admin cross-owner mutate + drill-through continuity in one wave.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^5.2.1 | API routes and auth middleware composition | Existing scope/session enforcement lives at middleware + route boundary. |
| express-session | ^1.19.0 | Server-side auth + admin scope session state | `adminScope` mode/lens is already persisted in session. |
| sequelize | ^6.37.5 | Domain persistence + transactions | Mutation/audit flows already transaction-based and Sequelize-backed. |
| react + react-router-dom | ^19.2.0 / ^7.13.1 | Drill-through UI and route continuity | Item detail drill-through and admin surfaces are already React Router flows. |
| @tanstack/react-query | ^5.90.21 | Lens-scoped caching and invalidation | Existing list pages already encode lens in keys and invalidate on scope switch. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jest + supertest | ^29.7.0 / ^7.2.2 | API integration regressions for scope + mutation contracts | Required for admin cross-owner mutate and net-status continuity tests. |
| vitest + testing-library | ^4.0.18 / ^16.3.2 | Frontend behavior regressions for drill-through + cache key isolation | Required for item detail scope continuity verification. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Incremental per-domain ad hoc checks | A single shared scope-to-owner resolver in domain layer | Shared resolver is less error-prone and aligns with existing `resolveOwnerFilter` read pattern. |
| Frontend-only workaround for detail drill-through | API-side fallback exceptions for admin detail reads | UI-only fixes cannot close mutation-domain audit gap; API semantics must be corrected first. |

**Installation:**
```bash
# No new dependencies required for Phase 13 hardening.
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── api/auth/                 # scope context + request hydration
├── api/routes/               # req.scope threading into domains
├── domain/items/             # net-status and item mutations
├── domain/events/            # complete/undo/update ownership checks
└── api/errors/               # stable 404/not_found envelope mapping
frontend/src/
├── features/admin-scope/     # mode/lens source of truth
├── pages/items/              # drill-through detail queries
└── lib/query-keys.ts         # lens-aware cache partitioning
```

### Pattern 1: Single Effective Owner Resolver for Mutations
**What:** Resolve the mutation owner context from scope (`actorRole`, `mode`, `lensUserId`) once, then use it for all ownership checks.
**When to use:** Item/event mutation and net-status domain services.
**Example:**
```javascript
// Source: src/api/auth/scope-context.js + domain services (recommended extension)
const ownerFilter = resolveOwnerFilter(scope); // null | userId
// For mutation operations requiring a concrete owner id:
// - owner mode -> lens user id
// - admin all mode -> derive owner from target entity after lookup
// - standard user -> actor user id
```

### Pattern 2: Entity-First Ownership Validation in Admin All Mode
**What:** Load target entity first, then validate access under effective scope; do not pre-bind to actor id.
**When to use:** `PATCH/DELETE/RESTORE /items/:id`, `PATCH /events/:id*`, `GET /items/:id/net-status`.
**Example:**
```javascript
// Source: src/domain/items/get-item-net-status.js (current actor-only branch to replace)
const rootItem = await models.Item.findByPk(itemId);
if (!rootItem) throwNotFound(itemId);

// replace actor-only check:
// if (rootItem.user_id !== actorUserId) throwForbidden(...)
// with scope-aware check based on effective owner rules.
```

### Pattern 3: Preserve Public Not-Found Denial Contract
**What:** Keep ownership denials mapped to 404/not_found envelopes while changing internal scope resolution.
**When to use:** All hardened mutation and net-status paths.
**Example:**
```javascript
// Source: src/api/errors/http-error-mapper.js
// Keep envelope behavior:
// message: "You can only access your own records."
// category: "not_found"
// status: 404
```

### Pattern 4: Lens-Scoped Detail Query Keys
**What:** Partition item detail queries by lens scope to prevent stale drill-through cache reuse.
**When to use:** `ItemDetailPage` net-status and item lookup queries.
**Example:**
```typescript
// Source: frontend/src/pages/items/item-detail-page.tsx + frontend/src/lib/query-keys.ts
queryKey: queryKeys.items.detail(itemId) // current
// hardening target: include mode/lens dimensions in detail query keys.
```

### Anti-Patterns to Avoid
- **Actor-only ownership checks in admin-aware domains:** breaks AUTH-06 in mutation flows.
- **Mixed scope contracts across routes/domains:** route passes `req.scope`, domain still consumes `actorUserId` fallback.
- **Lens-agnostic detail cache keys:** can present stale cross-lens drill-through state.
- **Changing error envelopes while fixing scope logic:** unnecessary contract churn and regression risk.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scope decision duplication | Custom role/mode conditionals in each domain function | Shared scope resolution utility (`resolveOwnerFilter` pattern + mutation-specific extension) | Reduces drift and closes audit gap across all mutation domains consistently. |
| Per-component cache reset heuristics | Manual state reset trees for item detail | React Query lens-aware keys + targeted invalidation | Existing query infrastructure already handles admin lens transitions on list surfaces. |
| New authorization transport channel | Query/body override ownership controls | Existing session + `req.scope` contract | Prevents bypass vectors and matches current security model. |

**Key insight:** This phase should standardize one scope contract everywhere; per-endpoint patches will reintroduce the same bug class later.

## Common Pitfalls

### Pitfall 1: "Scope is passed" but not actually enforced
**What goes wrong:** Routes pass `req.scope`, but domains still resolve `ownerUserId` from actor identity.
**Why it happens:** Older domain signatures preserve `actorUserId` fallback paths.
**How to avoid:** Remove actor-only owner derivation from admin-affected domain entry points and use scope-resolved ownership exclusively.
**Warning signs:** Admin in all/lens mode still gets 404/not_found on valid cross-owner mutation targets.

### Pitfall 2: Net-status drill-through remains actor-gated
**What goes wrong:** Admin can list cross-owner data but cannot open net-status detail for selected owner context.
**Why it happens:** `items.routes` calls `getItemNetStatus({ actorUserId: req.actor.userId })` and domain compares root owner to actor.
**How to avoid:** Thread `req.scope` into net-status and enforce owner via scope rules.
**Warning signs:** Admin dashboard item click works for list, fails on `/items/:id/net-status` with ownership not_found.

### Pitfall 3: Incomplete mutation hardening (events fixed, items not or vice versa)
**What goes wrong:** Some mutation paths honor admin scope while others still deny.
**Why it happens:** Ownership logic is duplicated across item/event domains.
**How to avoid:** Plan by domain family and complete a full matrix (item update/delete/restore, event complete/undo/update, net-status).
**Warning signs:** Mixed pass/fail outcomes for same admin scope across different actions.

### Pitfall 4: Cache bleed across lens transitions in detail views
**What goes wrong:** Item detail shows stale data after lens switch.
**Why it happens:** Detail query keys are not lens-scoped.
**How to avoid:** Add scope dimensions to detail query keys and invalidate on admin scope changes.
**Warning signs:** No network call on lens switch for same detail route, but rendered owner context changes.

## Code Examples

Verified patterns from current codebase:

### Existing Read-Scope Contract
```javascript
// Source: src/domain/items/list-items.js:56, src/domain/events/list-events.js:105
const ownerFilter = resolveOwnerFilter(scope);
if (ownerFilter) {
  where.user_id = ownerFilter;
}
```

### Existing Actor-Only Net-Status Gap
```javascript
// Source: src/api/routes/items.routes.js:63-66, src/domain/items/get-item-net-status.js:270-279
const netStatus = await getItemNetStatus({
  itemId: req.params.id,
  actorUserId: req.actor.userId,
});

if (rootItem.user_id !== actorUserId) {
  throwForbidden(itemId, actorUserId);
}
```

### Existing Actor-Only Mutation Gap
```javascript
// Source: src/domain/events/complete-event.js:113-118, 221; src/domain/items/update-item.js:245
function resolveOwnerUserId(input) {
  const scopeActorUserId = normalizeActorUserId(scope.actorUserId);
  return scopeActorUserId || normalizeActorUserId(payload.actorUserId);
}
```

### Existing Frontend Lens-Scoped List Pattern
```typescript
// Source: frontend/src/lib/query-keys.ts:32, frontend/src/pages/dashboard/dashboard-page.tsx
queryKeys.dashboard.lens({ mode, lensUserId })
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Owner-only actor checks across all reads/writes | Scope-aware reads via `resolveOwnerFilter(scope)` but actor-only writes remain in several domains | Phase 9 + follow-up | Read-path TIME-04 mostly works; mutation continuity remains broken. |
| Admin mode/lens as frontend-only concern | Session-backed admin scope (`/auth/admin-scope`) + `req.scope` hydration | Phase 9 | Reliable source exists; hardening now needs complete domain adoption. |
| Single-context admin banner dependency | Banner lens sourced from `AdminScopeContext` | Phase 9 plan 13 | UI safety signal continuity improved; backend mutation/detail continuity still missing. |

**Deprecated/outdated:**
- Treating `scope.actorUserId` as sufficient owner context for admin mutation paths.

## Open Questions

1. **Admin all-mode mutation rule for create flows**
   - What we know: Existing create semantics derive owner from `scope.actorUserId`; audit gap centers on cross-owner mutation consistency.
   - What's unclear: In all-mode, should create require explicit owner lens selection or infer from linked parent owner only?
   - Recommendation: Keep current create safety posture for Phase 13 unless audit requires expansion; focus hardening on existing-target mutations + drill-through continuity first.

2. **Scope contract for all mode on direct detail endpoints**
   - What we know: `resolveOwnerFilter(scope)` returns `null` for admin all mode reads.
   - What's unclear: Whether direct `GET /items/:id/net-status` in all mode should always permit any owner or still require intermediate lens in UI.
   - Recommendation: Align with current all-data read semantics (permit), and keep attribution/audit visibility for admin safeguards.

## Sources

### Primary (HIGH confidence)
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/v2.0-MILESTONE-AUDIT.md` - exact integration gap statements for `AUTH-06`, `TIME-04`.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/ROADMAP.md` - Phase 13 goal and success criteria.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/REQUIREMENTS.md` - requirement status and traceability (`AUTH-06`, `TIME-04` pending).
- `C:/Users/bryan/Documents/Opencode/House ERP/src/api/auth/scope-context.js` - canonical scope and owner-filter logic.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/api/auth/require-auth.js` - `req.scope` hydration behavior.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/get-item-net-status.js` - actor-only ownership enforcement in net-status.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/update-item.js` - actor-only item mutation ownership checks.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/soft-delete-item.js` - actor-only delete ownership checks.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/restore-item.js` - actor-only restore ownership checks.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/events/complete-event.js` - actor-only event complete/undo ownership checks.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/events/update-event.js` - actor-only event edit ownership checks.
- `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/pages/items/item-detail-page.tsx` - drill-through query key and net-status request behavior.
- `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/lib/query-keys.ts` - existing lens-aware query patterns on list surfaces.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/admin-scope-lens.test.js` - existing admin read/lens baseline coverage.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/events-complete.test.js` - mutation contract coverage baseline (non-admin-focused).

### Secondary (MEDIUM confidence)
- None. Current gap closure is fully derivable from repository and audit artifacts.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - sourced directly from repository manifests and active code paths.
- Architecture: HIGH - recommendations are direct extensions of existing `req.scope` + `resolveOwnerFilter` patterns.
- Pitfalls: HIGH - each pitfall maps to concrete files currently exhibiting the behavior.

**Research date:** 2026-03-01
**Valid until:** 2026-03-31
