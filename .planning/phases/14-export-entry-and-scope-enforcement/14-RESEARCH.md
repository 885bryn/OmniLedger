# Phase 14: Export Entry and Scope Enforcement - Research

**Researched:** 2026-03-01
**Domain:** Export entry UX + server-authoritative RBAC scope enforcement
**Confidence:** HIGH

<user_constraints>
## User Constraints

No `CONTEXT.md` file exists for this phase, so there are no additional locked decisions beyond roadmap/requirements inputs.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UXEX-01 | App exposes an `Export Backup` action in a user-facing management surface. | Use `frontend/src/app/shell/user-switcher.tsx` as the management surface; add a global export action near identity/lens controls so scope context is visible at click time. |
| SCOP-01 | Standard users can export only records in their resolved owner scope. | Reuse `requireAuth` + `buildScopeContext` + `resolveOwnerFilter` so standard users resolve to `mode=owner` and `lensUserId=actorUserId`. |
| SCOP-02 | Admin users in all-data mode can export all eligible household records. | Reuse `req.scope.mode === "all"` behavior already enforced by `scope-context.js`; `resolveOwnerFilter(scope)` returns `null` for all-data queries. |
| SCOP-03 | Admin users in lens mode can export only records for the selected lens user. | Reuse admin-scope session state (`/auth/admin-scope`) and `resolveOwnerFilter(scope)` so lens mode resolves to `user_id = lensUserId`. |
| SCOP-04 | Export scope is derived server-side from authenticated session scope and cannot be overridden by client-provided owner identifiers. | Keep route trust boundary at `req.scope` only; ignore/strip any `user_id`, `owner_id`, `scope_mode`, `lens_user_id` from export requests. Add negative integration tests mirroring existing scope-override tests. |
</phase_requirements>

## Summary

Phase 14 should be planned as a scope-contract phase, not a workbook-format phase. The repo already has a mature scope foundation from Phases 9 and 13: `requireAuth` populates `req.actor` and `req.scope`, and `scope-context.js` centralizes mode/lens resolution plus `resolveOwnerFilter` and `canAccessOwner`. The safest plan is to wire export entry and export authorization onto this existing boundary instead of introducing any new scope model.

The frontend entry point should be global and scope-aware. `frontend/src/app/shell/user-switcher.tsx` already shows actor identity and admin lens controls; this is the best place to add `Export Backup` for UXEX-01 so users understand whether they are exporting owner, lens, or all-data context.

Primary risks for this phase are scope override bugs (BOLA/IDOR style), route-level shortcuts that bypass `req.scope`, and accidental reuse of projection/mutating read paths. Planning should therefore prioritize route/domain boundaries and a role x mode x owner test matrix before implementation details for XLSX shaping (covered in later phases).

**Primary recommendation:** Implement Phase 14 as `entry-point + scope-authoritative export contract` using existing `requireAuth`/`req.scope` plumbing, with export-specific integration tests that prove client-supplied owner hints never widen scope.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | `^5.2.1` | Authenticated export route (`GET` endpoint) | Already app standard; route/middleware pattern is established in `src/api/routes/*.routes.js`. |
| `express-session` | `^1.19.0` | Session-backed admin all/lens scope state | Existing source of truth for admin scope mode in `auth.routes.js` and `require-auth.js`. |
| `sequelize` | `^6.37.5` | Scoped data reads via `where.user_id` | Existing query layer already uses `resolveOwnerFilter(scope)` patterns in list services. |
| `react` + `@tanstack/react-query` | `^19.2.0` + `^5.90.21` | Export trigger UX and pending/error state | Existing shell/action and mutation patterns already used throughout frontend features. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `supertest` | `^7.2.2` | API integration tests for scope matrix | Use for SCOP-01..04 coverage on export endpoint behavior. |
| `jest` | `^29.7.0` | Backend test runner | Use for negative authorization regression coverage. |
| `vitest` | `^4.0.18` | Frontend interaction tests for entry action | Use for UXEX-01 presence and role/lens-aware affordance tests. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Session-derived scope (`req.scope`) | Client-submitted scope params (`scope_mode`, `owner_id`) | Rejected: violates SCOP-04 and OWASP authorization guidance; high leakage risk. |
| Global shell entry (`user-switcher`) | Per-page export buttons only | Rejected for Phase 14: weaker discoverability and easier mismatch with active admin lens context. |
| Export-specific scoped query path | Reusing `/events` list output | Rejected: `list-events` includes projection/sync side effects, not pure persisted export semantics. |

**Installation:**
```bash
# Phase 14 requires no new packages.
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
|-- api/
|   |-- routes/
|   |   `-- exports.routes.js            # New authenticated export entry route
|   `-- app.js                           # Mount exports router
`-- domain/
    `-- exports/
        `-- export-scope-query.js        # Scope-aware read contract for phase 14

frontend/src/
|-- app/shell/
|   `-- user-switcher.tsx                # Add Export Backup action
`-- features/export/
    `-- use-export-backup.ts             # Mutation/hook for trigger state
```

### Pattern 1: Session-Authoritative Scope Resolution
**What:** Derive effective export scope from authenticated session (`req.scope`) only.
**When to use:** Every export request.
**Example:**
```javascript
// Source: src/api/auth/require-auth.js + src/api/auth/scope-context.js
req.scope = buildScopeContext({
  actorUserId: actor.userId,
  actorRole: actor.role,
  sessionScope: req.session.adminScope
});

const ownerFilter = resolveOwnerFilter(req.scope); // null => all-data, string => owner/lens
```

### Pattern 2: Client Scope Inputs Are Non-Authoritative
**What:** Strip/ignore owner or scope IDs in request payload/query for export.
**When to use:** Export route handler normalization.
**Example:**
```javascript
// Source pattern: src/api/routes/items.routes.js
const payload = req.body && typeof req.body === "object" ? req.body : {};
const { user_id: _ignoredUserId, owner_id: _ignoredOwnerId, ...safePayload } = payload;

await runExport({ scope: req.scope, ...safePayload });
```

### Pattern 3: Thin Route, Scoped Domain Query
**What:** Keep route focused on auth/transport; delegate scoped data access to domain service.
**When to use:** New export endpoint.
**Example:**
```javascript
// Source pattern: src/api/routes/events.routes.js + src/domain/items/list-items.js
router.use(requireAuth);
router.get("/exports/backup.xlsx", async (req, res, next) => {
  try {
    const dataset = await exportScopeQuery({ scope: req.scope });
    res.status(200).json(dataset);
  } catch (error) {
    next(error);
  }
});
```

### Anti-Patterns to Avoid
- **Trusting `scope_mode`/`lens_user_id` from client:** breaks SCOP-04 and invites BOLA-style leaks.
- **Querying models directly in route:** bypasses centralized scope checks and increases drift.
- **Reusing timeline projection endpoints for backup source:** mixes persisted and projected semantics.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Effective export scope logic | New ad-hoc `if admin then ...` branches in export route | `buildScopeContext` + `resolveOwnerFilter` in `scope-context.js` | Existing behavior is already verified by Phase 13 regressions. |
| Session auth guard | Export-specific auth middleware copy | Existing `requireAuth` | Avoids divergence in actor/session/lens handling. |
| Ownership checks for per-record operations | Manual per-handler comparisons | Existing `canAccessOwner(scope, ownerUserId)` | Keeps deny semantics consistent across domain actions. |
| Export-entry state handling in UI | Local ad-hoc loading flags scattered in shell | React Query mutation pattern | Consistent UX state transitions and retry behavior. |

**Key insight:** Phase 14 succeeds by reusing the proven scope boundary, not by inventing new export-specific authorization logic.

## Common Pitfalls

### Pitfall 1: Scope Override via Client Params
**What goes wrong:** User/admin-lens exports can be widened with `owner_id`/`lens_user_id` in query/body.
**Why it happens:** Handler uses client params as authority instead of `req.scope`.
**How to avoid:** Ignore client owner/scope fields and resolve only from session-backed `req.scope`.
**Warning signs:** Export tests only cover happy paths; no negative override assertions.

### Pitfall 2: Lens Drift Between UI and Server
**What goes wrong:** UI shows one lens while export runs with stale/other scope.
**Why it happens:** Export action derives scope from stale client state and server route accepts it.
**How to avoid:** UI can display scope for clarity, but server must enforce session scope each request.
**Warning signs:** Bugs like "screen says lens A, file/data includes lens B".

### Pitfall 3: Reusing Non-Export Read Paths
**What goes wrong:** Export source includes projected/mutated event rows not intended for backup baseline.
**Why it happens:** Team reuses list endpoints/services that include side effects.
**How to avoid:** Keep dedicated export query path over persisted records with explicit scope filter.
**Warning signs:** Export row counts differ unexpectedly from persisted history expectations.

## Code Examples

Verified patterns from current project code:

### Authenticated Scope Injection
```javascript
// Source: src/api/auth/require-auth.js
req.actor = { userId: actor.userId, role: actor.role };
req.scope = buildScopeContext({
  actorUserId: actor.userId,
  actorRole: actor.role,
  sessionScope: req.session.adminScope
});
```

### Scope-Filtered Query Construction
```javascript
// Source: src/domain/items/list-items.js
const ownerFilter = resolveOwnerFilter(scope);
const where = {};
if (ownerFilter) {
  where.user_id = ownerFilter;
}
const rows = await models.Item.findAll({ where });
```

### Existing Negative Override Test Pattern
```javascript
// Source: test/api/admin-scope-lens.test.js
const listWithOverride = await agent
  .get("/items")
  .query({ mode: "all", lens_user_id: outsider.id });

expect(listWithOverride.body.total_count).toBe(1);
expect(listWithOverride.body.items[0].user_id).toBe(owner.id);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Endpoint-level ownership checks and scattered role logic | Centralized scope context (`buildScopeContext`, `resolveOwnerFilter`, `canAccessOwner`) | v2.0 Phases 9 and 13 | Enables consistent user/admin all/admin lens enforcement across routes. |
| Client hint fields could influence reads if not sanitized | Routes treat client ownership fields as non-authoritative and pass `scope` to domain services | Hardened by recent scope integration work | Directly supports SCOP-04 for export feature rollout. |

**Deprecated/outdated:**
- Client-authoritative scope selection for protected data reads.
- New route-specific scope logic that bypasses `requireAuth`/`scope-context.js`.

## Open Questions

1. **Final export endpoint contract in Phase 14**
   - What we know: Research docs use both `/exports/ledger.xlsx` and `/exports/backup.xlsx` naming.
   - What's unclear: Which path and content type must be locked in Phase 14 vs deferred to Phase 16.
   - Recommendation: Lock one stable path now (prefer `/exports/backup.xlsx` to match UX label) and keep response contract backward-compatible.

2. **Phase-14 response payload depth**
   - What we know: Phase 14 goal emphasizes scope enforcement and entry point; workbook fidelity is Phase 15/16.
   - What's unclear: Whether Phase 14 should return a minimal stub/download shell vs preliminary scoped dataset.
   - Recommendation: Plan minimal export contract that proves SCOP matrix first; defer heavy workbook shaping to downstream phases.

## Sources

### Primary (HIGH confidence)
- `src/api/auth/require-auth.js` - authoritative session -> actor/scope injection.
- `src/api/auth/scope-context.js` - canonical scope normalization and owner filter resolution.
- `src/api/routes/items.routes.js` - pattern for ignoring client `user_id` and passing `scope` to domain.
- `src/domain/items/list-items.js` - canonical `resolveOwnerFilter` query pattern.
- `src/api/routes/auth.routes.js` - admin all/lens session contract and validations.
- `test/api/admin-scope-lens.test.js` - proven all/lens/override-negative behavior matrix.
- `frontend/src/app/shell/user-switcher.tsx` - existing management surface with actor/lens controls.

### Secondary (MEDIUM confidence)
- OWASP API Security Top 10 (API1:2023 BOLA): https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- Express 5 API (routing/middleware reference): https://expressjs.com/en/api.html

### Tertiary (LOW confidence)
- `.planning/research/ARCHITECTURE.md` - prior project synthesis with route-path naming inconsistency (`ledger.xlsx` vs backup naming in stack notes).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly verified in repo `package.json` files and existing route/test patterns.
- Architecture: HIGH - based on implemented auth/scope boundary and prior hardened integration tests.
- Pitfalls: MEDIUM-HIGH - strong OWASP alignment and project evidence; endpoint naming still needs lock.

**Research date:** 2026-03-01
**Valid until:** 2026-03-31
