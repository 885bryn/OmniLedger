# Phase 9: RBAC Scope & Admin Safety Mode - Research

**Researched:** 2026-02-25
**Domain:** Server-enforced RBAC scope, admin lens UX, and audit attribution across Express + Sequelize + React Query
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Admin mode entry and safety signaling
- One specific user account is designated as admin and receives global visibility immediately on login.
- Admin scope state is always visible with a persistent top warning banner.
- Exiting admin mode requires explicit confirmation.
- Mutation context in admin mode must show both acting user and selected lens user.

### User lens behavior
- Default admin lens is `All users` on login.
- Lens filtering must apply across Dashboard, Items, and Events surfaces.
- Admin can switch between `All users` and a specific-user lens.
- Lens switch performs a hard reset + refetch to avoid cross-user state leakage.
- Mutation actions in admin mode must show a target-user chip.

### Ownership denial behavior
- Standard user direct access to another user's resource should return 404-style not-found behavior.
- Blocked writes should show both inline and toast policy errors.
- Ownership error copy should be plain/direct (user can only access own records).
- If selected admin lens target becomes invalid, block writes until a valid lens is reselected.

### Audit attribution visibility
- Attribution is required for Create, Complete/Undo, Delete/Restore, and Update actions.
- Activity/history rows should display `Actor + Lens` tuple.
- Admin safety attribution should appear in three places: top banner, mutation buttons, and confirmation dialogs.
- Attribution should remain visible indefinitely in retained in-app history.

### Claude's Discretion
- Exact visual styling of banner/chip/dialog components while preserving required content.
- Exact wording details for direct ownership denial copy, as long as meaning remains plain and explicit.
- Exact placement hierarchy of attribution metadata in dense activity rows.

### Deferred Ideas (OUT OF SCOPE)
- None - discussion stayed within Phase 9 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-04 | Each user has role `user` (default) or `admin` (elevated), enforced server-side. | Add role column/model field, include role in session resolution, and enforce role checks in middleware/domain scope resolver. |
| AUTH-05 | Standard users can only read and mutate records they own. | Replace mixed 403/owner checks with unified owner-scope guard returning 404-style for foreign reads/writes. |
| AUTH-06 | Admin user can intentionally switch to all-data mode and bypass owner scope. | Add explicit admin scope state + mode toggle API/UI; default all-data on login; require explicit confirm to exit mode. |
| AUTH-07 | System records acting user for create, complete, restore, and delete actions in audit-visible history. | Extend audit shape from single `user_id` to actor+lens attribution tuple and surface it in activity responses/UI. |
| AUTH-08 | Admin mode displays persistent safeguards, including visible mode state and action attribution context. | Add persistent shell banner + mutation chips + confirmation copy carrying Actor/Lens tuple. |
| TIME-04 | Admin can view combined data or filter dashboard/timeline through a selected user lens. | Add lens-aware query parameters and React Query key scoping; hard reset/refetch on lens change to prevent cross-user leaks. |
</phase_requirements>

## Summary

Phase 9 is mostly a cross-cutting authorization and UX safety phase, not a greenfield build. The codebase already has session identity (`req.session.userId -> req.actor.userId`) and owner scoping patterns in domain services, but it does not yet have roles, admin mode state, or lens-aware attribution. The largest planning risk is inconsistent scope logic across handlers unless scope is centralized and threaded end-to-end.

The current backend has two critical gaps to close early in planning: (1) create-item currently trusts request payload for `user_id` because `POST /items` forwards `req.body` directly to domain create; and (2) ownership denial semantics currently use `403 forbidden` in multiple flows, while this phase requires 404-style not-found for foreign access. Both impact API contracts and test baselines.

Frontend already has a stable shell identity component and actor-sensitive query roots, which provides a good seam for admin safety mode UI and lens resets. There is no toast system yet, so the plan must include a lightweight toast mechanism or equivalent to satisfy “inline + toast” policy errors.

**Primary recommendation:** Implement a single `scope context` contract (actor role + mode + lens) at the API boundary first, then thread it through all list/detail/mutation/audit paths and only then build admin UX affordances.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^5.2.1 | API routing/middleware | Existing API foundation and auth boundary already centered on Express middleware. |
| sequelize | ^6.37.5 | ORM + transactions + associations | Existing domain layer and migrations already use Sequelize models/transactions. |
| express-session | ^1.19.0 | Server session identity | Current auth architecture depends on session cookie identity. |
| connect-session-sequelize | ^8.0.5 | Durable session store | Already adopted in Phase 8 for server-managed auth state. |
| react + react-router-dom | ^19.2.0 / ^7.13.1 | App shell and route UX | Existing UI and protected route patterns are established here. |
| @tanstack/react-query | ^5.90.21 | Data fetching/cache invalidation | Current dashboard/items/events surfaces and invalidation flow depend on it. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + testing-library | ^4.0.18 + ^16.3.2 | Frontend behavior tests | Admin mode banner/lens/reset and attribution rendering regressions. |
| jest + supertest | ^29.7.0 + ^7.2.2 | API/domain integration tests | RBAC enforcement, 404-denial behavior, and audit attribution contract tests. |
| i18next + react-i18next | ^25.8.13 + ^16.5.4 | Localized policy/safety copy | New banner/chip/dialog copy and denial text in EN/ZH. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing session-based scope state | JWT + stateless role claims | Conflicts with current server-session architecture and adds unnecessary migration risk in this phase. |
| Sequelize model-level ad hoc checks | DB row-level security | Strong long-term option, but out of current project architecture and too large for this phase scope. |

**Installation:**
```bash
# No new core libraries required for baseline Phase 9 implementation.
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── api/auth/                 # session identity + scope resolution middleware
├── api/routes/               # scope-aware route handlers (items/events/users/auth)
├── api/errors/               # consistent 404-style ownership denial mapping
├── domain/*                  # business operations with explicit scope input
├── db/models + migrations/   # role + audit attribution schema
frontend/src/
├── app/shell/                # persistent admin safety banner + lens controls
├── features/admin-scope/     # mode toggle, lens picker, attribution chips
├── pages/{dashboard,events,items}/ # scope-aware queries and denial UX
└── lib/query-keys.ts         # lens-aware query keys + reset utilities
```

### Pattern 1: Centralized Scope Context at API Boundary
**What:** Build one request-scope object in auth middleware (actor id, role, mode, lens user id), then pass that object to all domain operations.
**When to use:** Every protected route in items/events/users and future phase routes.
**Example:**
```javascript
// Source: src/api/auth/require-auth.js, src/api/routes/items.routes.js
req.scope = {
  actorUserId: sessionUser.id,
  actorRole: sessionUser.role,
  mode: sessionUser.role === 'admin' ? resolvedMode : 'owner',
  lensUserId: resolvedLensUserId,
}

await listItems({ scope: req.scope, ...query })
```

### Pattern 2: Domain-Layer Scope Predicate, Not Route-Level Inline Checks
**What:** Domain functions resolve effective owner filter from scope (owner-only vs all-users vs specific-lens) and use it consistently for reads and writes.
**When to use:** `listItems`, `listEvents`, `getItemNetStatus`, `updateItem`, `softDeleteItem`, `getItemActivity`, `completeEvent`, `undoEventCompletion`, `createItem`.
**Example:**
```javascript
// Source: src/domain/items/list-items.js, src/domain/events/list-events.js
const ownerFilter = resolveOwnerFilter(scope)
const rows = await models.Item.findAll({ where: ownerFilter })
```

### Pattern 3: 404-Style Ownership Denial Normalization
**What:** Treat foreign-owned resource access as not-found for standard users; preserve policy detail only in internal logs/test metadata.
**When to use:** Direct item/event detail and mutation endpoints.
**Example:**
```javascript
// Source: src/api/errors/http-error-mapper.js + domain error categories
if (isForeignOwned && scope.actorRole !== 'admin') {
  throwNotFound(resourceId)
}
```

### Pattern 4: Lens Switch Hard Reset + Refetch
**What:** On admin lens/mode change, clear actor-sensitive cache and refetch all affected surfaces.
**When to use:** User switches lens or toggles mode.
**Example:**
```typescript
// Source: frontend/src/lib/query-keys.ts + frontend/src/app/shell/user-switcher.tsx
queryClient.clear() // or targeted remove for actorSensitiveQueryRoots
navigate(currentRoute, { replace: true })
```

### Anti-Patterns to Avoid
- **Route-only RBAC checks:** Causes inconsistent behavior and missed paths; keep scope checks in domain layer too.
- **Client-supplied ownership/actor fields:** `createItem` currently trusts payload `user_id`; this must be server-derived.
- **Mixed 403/404 policy semantics:** Breaks user decision and leaks ownership existence signal.
- **UI-only admin mode:** Must be server-enforced; client mode alone is unsafe.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Actor identity propagation | Custom headers or localStorage actor shims | Existing session middleware + server scope context | Already proven in Phase 8; avoids impersonation vectors. |
| Cross-page cache invalidation for lens switches | Manual per-component state resets | React Query global cache clear/invalidate rooted by `queryKeys` | Existing invalidation approach is already used and testable. |
| Audit attribution rendering strings | Ad hoc concatenated strings in each component | Shared tuple formatter (`Actor: ... | Lens: ...`) and reusable chip/banner components | Prevents drift between banner/buttons/dialogs/activity rows. |
| Authorization branching in SQL strings | Raw query fragments per endpoint | Shared scope resolver feeding Sequelize `where` clauses | Reduces policy bugs and keeps behavior deterministic. |

**Key insight:** The phase is mostly consistency engineering; centralized scope contracts prevent policy drift and reduce future rework.

## Common Pitfalls

### Pitfall 1: Payload Ownership Injection on Create
**What goes wrong:** A user creates records for another user by passing `user_id` in request body.
**Why it happens:** `POST /items` currently forwards `req.body` directly to `createItem` which validates `user_id` from payload.
**How to avoid:** Replace input contract to accept server scope and inject owner id from scope, never request payload.
**Warning signs:** Integration test can create item under foreign `user_id` while authenticated as different user.

### Pitfall 2: Policy Leakage Through 403
**What goes wrong:** Standard user can infer resource existence via forbidden responses.
**Why it happens:** Multiple domain errors currently map foreign ownership to `FORBIDDEN -> 403`.
**How to avoid:** Normalize ownership-denial path to not-found semantics for standard-user direct access.
**Warning signs:** Tests for foreign item/event access still assert 403.

### Pitfall 3: Lens/Mode State Leakage Across Queries
**What goes wrong:** Admin sees stale data from previous lens after switching users.
**Why it happens:** Query keys currently do not encode lens/mode and rely on shared roots.
**How to avoid:** Include lens/mode in query key params and hard reset + refetch on lens change.
**Warning signs:** Switching lens shows mixed item/event sets without network refetch.

### Pitfall 4: Attribution Incomplete Across Write Paths
**What goes wrong:** Some actions show actor, others do not; activity rows lose lens context.
**Why it happens:** Audit schema currently records only `user_id` and action/entity/timestamp.
**How to avoid:** Expand audit shape for actor+lens tuple and ensure every write action records both.
**Warning signs:** Activity row cannot answer “who acted as whom” for admin writes.

### Pitfall 5: Missing Toast Infrastructure for Policy Errors
**What goes wrong:** Requirement asks inline + toast, but app has only inline error surfaces.
**Why it happens:** No existing toast/notification utility in frontend.
**How to avoid:** Add small shared toast system and map policy errors to both field/dialog and global toast.
**Warning signs:** Only inline message appears on blocked write.

## Code Examples

Verified patterns from current codebase sources:

### Session Actor Boundary (existing baseline)
```javascript
// Source: src/api/auth/require-auth.js
const sessionUserId = req.session && req.session.userId
if (!sessionUserId) return res.status(401).json({ error: { code: 'authentication_required' } })
req.actor = { userId: sessionUserId }
```

### Domain Owner Filter (existing baseline)
```javascript
// Source: src/domain/items/list-items.js
await models.Item.findAll({
  where: {
    user_id: query.actorUserId,
  },
})
```

### Existing Actor-Sensitive Cache Roots (frontend seam)
```typescript
// Source: frontend/src/lib/query-keys.ts
export const actorSensitiveQueryRoots = [queryKeys.dashboard.all, queryKeys.events.all, queryKeys.items.all] as const
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-selected actor shim (`x-user-id`) | Session-derived actor (`req.session.userId -> req.actor.userId`) | Phase 8 (2026-02-25) | Solid server-trusted identity base for RBAC. |
| Shell actor switcher semantics | Session identity + logout control | Phase 8 (2026-02-25) | Clear place to add admin mode/lens controls without reviving impersonation shim. |
| Single-user owner filters only | Next step: role-aware scope resolver with optional admin lens | Phase 9 (planned) | Enables TIME-04 and admin safe all-data workflows. |

**Deprecated/outdated:**
- Client-controlled actor transport (headers/payload ownership) for authorization decisions.

## Open Questions

1. **How is the single admin account designated?**
   - What we know: Exactly one account must be admin and receive global visibility on login.
   - What's unclear: Source of truth (migration seed, env-configured email, or DB toggle workflow).
   - Recommendation: Use DB `role` column with migration-backed deterministic assignment (env email at bootstrap for non-test, direct fixture setup in tests).

2. **Where does admin mode/lens state live server-side?**
   - What we know: Admin can intentionally switch modes; default is all-users; exit requires confirmation.
   - What's unclear: Session-backed server state vs query-param-per-request mode.
   - Recommendation: Store mode/lens in session for enforcement consistency; allow explicit API endpoint to mutate state with confirmation token/flag.

3. **How should 404-style denial be represented in error envelopes?**
   - What we know: UX wants plain direct policy wording and 404-style behavior for foreign direct access.
   - What's unclear: Keep category as `not_found` everywhere or preserve internal `forbidden` category under 404 status.
   - Recommendation: Public envelope should be `not_found` style; keep richer internal reason in logs/tests only.

## Sources

### Primary (HIGH confidence)
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/phases/09-rbac-scope-admin-safety-mode/09-CONTEXT.md` - Locked Phase 9 decisions and constraints.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/REQUIREMENTS.md` - Requirement IDs and exact acceptance target.
- `C:/Users/bryan/Documents/Opencode/House ERP/.planning/STATE.md` - Prior phase decisions and continuity context.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/api/auth/require-auth.js` - Current session actor boundary.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/api/routes/items.routes.js` - Route-to-domain actor propagation; create route gap.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/domain/items/create-item.js` - Current payload-driven owner assignment requirement (`user_id`).
- `C:/Users/bryan/Documents/Opencode/House ERP/src/api/errors/http-error-mapper.js` - Current 403/404 category mapping.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/db/models/user.model.js` - Current user schema lacks role.
- `C:/Users/bryan/Documents/Opencode/House ERP/src/db/models/audit-log.model.js` - Current audit schema is actor-only (`user_id`).
- `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/app/shell/user-switcher.tsx` - Existing shell identity seam.
- `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/lib/query-keys.ts` - Existing actor-sensitive query roots.
- `C:/Users/bryan/Documents/Opencode/House ERP/test/api/*.test.js` and `C:/Users/bryan/Documents/Opencode/House ERP/frontend/src/__tests__/*.test.tsx` - Existing contract baselines.

### Secondary (MEDIUM confidence)
- None needed; phase planning is fully constrained by repository state and locked decisions.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions and usage are directly from repository manifests and code.
- Architecture: HIGH - recommendations map directly to established patterns in current code.
- Pitfalls: HIGH - each pitfall is tied to concrete existing code/tests.

**Research date:** 2026-02-25
**Valid until:** 2026-03-27
