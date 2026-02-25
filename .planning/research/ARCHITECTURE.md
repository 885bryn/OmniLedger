# Architecture Research

**Domain:** Household Asset & Commitment Tracker v2.0 architecture evolution (auth/RBAC + financial hierarchy + smart timeline + data lifecycle)
**Researched:** 2026-02-25
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```text
+---------------------------------------------------------------------------------------------------+
|                                      Client Interface (React)                                    |
|  Auth session store | route guards | timeline views (projected + actual) | item/trash workflows |
+---------------------------------------------+-----------------------------------------------------+
                                              |
+---------------------------------------------v-----------------------------------------------------+
|                                         API Layer (Express)                                      |
|  auth middleware -> policy scope middleware -> routers (items/events/timeline/auth/lifecycle)   |
|  deterministic envelope + centralized error mapper                                                |
+---------------------------------------------+-----------------------------------------------------+
                                              |
+---------------------------------------------v-----------------------------------------------------+
|                                 Domain/Application Layer                                          |
|  Access Policy | Financial Contract Service | Occurrence Service | Timeline Composer             |
|  Deletion Lifecycle Service | Audit Writer | Scheduler Orchestrator                               |
+---------------------------------------------+-----------------------------------------------------+
                                              |
+---------------------------------------------v-----------------------------------------------------+
|                                    Persistence Layer (Sequelize)                                 |
|  Users/Roles/Sessions | Items | FinancialItems | FinancialOccurrences | AuditLog                 |
|  ownership + lifecycle columns + indexed timeline reads                                           |
+---------------------------------------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `api/middleware/authenticate` **(new)** | Resolve bearer token/session into trusted actor context | Express app-level middleware before routers; populates `req.auth` |
| `api/middleware/authorize-scope` **(new)** | Convert role + optional admin actor override into query scope (`own` vs `all`) | Router-level middleware + domain policy helpers |
| `domain/security/access-policy` **(new)** | Centralize ownership and RBAC checks for all mutations/reads | Pure functions used by items/events/timeline services |
| `domain/items/*` **(modified)** | Keep item CRUD, but remove direct header-driven ownership checks | Accept `actorContext` instead of raw `actorUserId` |
| `domain/financial-contracts/*` **(new)** | Manage parent financial contract definitions and recurrence rules | Services + validators + transaction-safe writes |
| `domain/occurrences/*` **(new)** | Persist instantiated occurrences and completion/undo effects | Replaces ad-hoc `derived-*` event resolution |
| `domain/timeline/compose-timeline` **(new)** | Build 3-year timeline by merging persisted + projected rows | Deterministic projector with bounded window and filters |
| `domain/lifecycle/*` **(new + modified)** | Soft delete, restore, delete intercept, hard cleanup command | Uses explicit lifecycle metadata and scheduler entry point |

## Recommended Project Structure

```text
src/
|-- api/
|   |-- app.js                           # Register auth/scope middleware before routers
|   |-- middleware/
|   |   |-- authenticate-request.js      # Token/session -> req.auth
|   |   `-- authorize-scope.js           # RBAC + ownership scope resolution
|   `-- routes/
|       |-- auth.routes.js               # login/refresh/logout/me
|       |-- timeline.routes.js           # 3-year timeline query + projection actions
|       |-- lifecycle.routes.js          # restore/trash/force-delete endpoints
|       |-- items.routes.js              # Existing, now actorContext-based
|       `-- events.routes.js             # Existing, now occurrence-aware
|-- domain/
|   |-- security/
|   |   `-- access-policy.js             # canRead/canWrite/canAdmin checks
|   |-- financial-contracts/
|   |   |-- create-financial-item.js     # Parent contract write path
|   |   `-- update-financial-item.js     # Recurrence/projection rule updates
|   |-- occurrences/
|   |   |-- instantiate-occurrence.js    # Projected -> persisted transition
|   |   `-- complete-occurrence.js       # Completion/undo and side effects
|   |-- timeline/
|   |   `-- compose-timeline.js          # Merge actual + projected for requested range
|   `-- lifecycle/
|       |-- delete-item.js               # Intercept linked active records
|       |-- restore-item.js              # Undo soft delete consistently
|       `-- purge-expired.js             # 30-day hard cleanup command
|-- db/
|   |-- models/
|   |   |-- user.model.js                # Add role + auth metadata
|   |   |-- session.model.js             # Refresh/session persistence
|   |   |-- item.model.js                # Add lifecycle columns or paranoid mapping
|   |   |-- financial-item.model.js      # Parent contract data
|   |   `-- financial-occurrence.model.js# Child event occurrence data
|   `-- migrations/                      # Additive migrations with backfill
`-- jobs/
    `-- lifecycle-cleanup-job.js         # Scheduled purge with advisory lock
```

### Structure Rationale

- **`domain/security/`** keeps RBAC and ownership rules single-sourced so every service enforces the same policy.
- **`domain/financial-contracts/` + `domain/occurrences/`** separates recurring definition from realized history, which is required for projection and instantiation.
- **`domain/timeline/`** isolates expensive composition logic from generic event listing so 3-year range logic remains testable and bounded.
- **`jobs/`** keeps background cleanup explicit and decoupled from request handlers, while still running in the same deployable unit.

## Architectural Patterns

### Pattern 1: Actor Context Propagation (Auth + RBAC)

**What:** Build `actorContext` once in middleware (`actorId`, `role`, `scopeUserId`, `isAdminMode`) and pass it through domain services.
**When to use:** Every route that currently accepts `x-user-id` and every new timeline/lifecycle endpoint.
**Trade-offs:** Slightly larger service signatures, but removes duplicated ownership checks and prevents accidental unscoped queries.

**Example:**
```javascript
// api/routes/items.routes.js (target shape)
router.get("/items", authorizeScope("items:read"), async (req, res, next) => {
  try {
    const result = await listItems({
      actorContext: req.auth,
      search: req.query.search,
      filter: req.query.filter,
      sort: req.query.sort,
      includeDeleted: req.query.include_deleted === "true"
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
```

### Pattern 2: Contract/Occurrence Split with Lazy Instantiation

**What:** Store recurring financial definition in `FinancialItem`; generate timeline projections on read; only persist `FinancialOccurrence` when user edits/completes/skips a projected row.
**When to use:** Timeline rows beyond currently persisted events, and any projected row that needs mutation.
**Trade-offs:** More moving parts than one-table events, but avoids pre-generating thousands of rows and removes current `derived-*` id workaround.

**Example:**
```javascript
// domain/occurrences/instantiate-occurrence.js
async function instantiateOccurrence({ financialItemId, dueDate, actorContext, transaction }) {
  const existing = await models.FinancialOccurrence.findOne({
    where: { financial_item_id: financialItemId, due_date: dueDate },
    transaction
  });

  if (existing) return existing;

  return models.FinancialOccurrence.create(
    {
      financial_item_id: financialItemId,
      due_date: dueDate,
      source: "instantiated",
      status: "Pending",
      instantiated_by: actorContext.actorId
    },
    { transaction }
  );
}
```

### Pattern 3: Explicit Lifecycle State + Scheduled Purge

**What:** Represent deletion using dedicated fields (`deleted_at`, `deleted_by`, `purge_after_at`) and a daily purge job that hard-deletes expired records.
**When to use:** All mutable entities participating in timeline or ownership reads (`Items`, `FinancialItems`, `FinancialOccurrences`).
**Trade-offs:** Adds migration complexity, but simplifies filters (no JSON parsing) and makes restore/purge semantics deterministic.

## Data Flow

### Request Flow

```text
User request
  -> authenticate-request middleware
  -> authorize-scope middleware
  -> route handler
  -> domain service (policy + business rules)
  -> Sequelize transaction
  -> audit write (same transaction)
  -> deterministic envelope response
```

### State Management

```text
React auth/session state
  -> api-client attaches Authorization header
  -> React Query keys include actor scope mode
  -> cache invalidation on login/logout/admin-scope switch
```

### Key Data Flows

1. **Auth-scoped timeline read (modified):** frontend sends token -> API resolves `actorContext` -> timeline composer loads contracts within actor scope -> merges persisted occurrences and projected rows for `[today, today+3y]` -> returns grouped timeline with `source: actual|projected`.
2. **Projected row mutation (new):** user edits/completes projected row -> occurrence service instantiates row first (idempotent) -> applies mutation -> writes audit event (`occurrence.instantiated`, `occurrence.completed`) -> timeline query now returns row as actual.
3. **Delete/restore lifecycle (modified + new):** delete command checks linked active children/occurrences -> if blocked, returns conflict with dependencies; otherwise marks soft-deleted + sets purge date -> restore endpoint clears lifecycle fields -> scheduled purge removes expired soft-deleted graphs.

## New vs Modified Integration Points

| Area | New Components | Modified Existing Components |
|------|----------------|------------------------------|
| Auth + RBAC | `api/routes/auth.routes.js`, `api/middleware/authenticate-request.js`, `api/middleware/authorize-scope.js`, `domain/security/access-policy.js`, `db/models/session.model.js` | `src/api/app.js`, `src/api/routes/items.routes.js`, `src/api/routes/events.routes.js`, `frontend/src/lib/api-client.ts`, `frontend/src/app/shell/user-switcher.tsx` |
| Financial hierarchy | `domain/financial-contracts/*`, `db/models/financial-item.model.js`, `db/models/financial-occurrence.model.js` | `src/domain/items/create-item.js`, `src/domain/items/update-item.js`, `src/domain/events/complete-event.js`, `src/domain/events/list-events.js`, `src/domain/items/item-event-sync.js` |
| Smart timeline | `api/routes/timeline.routes.js`, `domain/timeline/compose-timeline.js` | `frontend/src/pages/events/events-page.tsx`, `frontend/src/pages/items/item-detail-page.tsx`, `frontend/src/lib/query-keys.ts` |
| Soft delete lifecycle | `api/routes/lifecycle.routes.js`, `domain/lifecycle/restore-item.js`, `jobs/lifecycle-cleanup-job.js` | `src/domain/items/soft-delete-item.js`, `src/domain/items/list-items.js`, `src/domain/items/get-item-net-status.js`, `src/domain/events/list-events.js` |

## Dependency-Aware Build Order

1. **Identity and policy foundation (highest dependency):** add user roles + session model + auth middleware + `actorContext` wiring in `app.js`; keep temporary compatibility for `x-user-id` in non-auth tests during transition.
2. **Centralize authorization in domain services:** update items/events services to consume policy helpers instead of direct `actorUserId` comparisons; this prevents security drift before adding new financial/timeline paths.
3. **Financial schema introduction (additive, low blast radius):** create `FinancialItems` and `FinancialOccurrences` tables plus migrations/backfill from existing `Items`/`Events`; keep old read paths working.
4. **Timeline composer + lazy instantiation:** introduce new `/timeline` read model and projected-row instantiation commands; migrate UI pages to new endpoint after parity validation.
5. **Lifecycle hardening:** move soft-delete metadata from `attributes._deleted_at` to explicit lifecycle fields, add restore endpoint, and implement delete intercept using contract/occurrence graph checks.
6. **Cleanup scheduler activation (last):** enable daily purge job guarded by Postgres advisory lock so only one app instance purges at a time; add operational metrics/logging.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Keep monolith; compute 3-year projections in-process; daily purge inside API process |
| 1k-100k users | Add indexes on `(scope_user_id, due_date, status, deleted_at)` equivalents; paginate timeline windows by month; separate read-heavy timeline query functions |
| 100k+ users | Move scheduler to dedicated worker, precompute timeline snapshots/materialized views, and split auth/session verification behind cache |

### Scaling Priorities

1. **First bottleneck:** 3-year timeline joins/projections; fix with bounded windows, covering indexes, and optional monthly snapshot table.
2. **Second bottleneck:** cleanup contention and long delete cascades; fix with batched purge and lock-safe worker isolation.

## Anti-Patterns

### Anti-Pattern 1: Header-Driven Identity in Business Logic

**What people do:** Keep reading `x-user-id` in every route/service and bolt RBAC checks on top.
**Why it's wrong:** Easy to bypass/forget ownership guards; difficult to support admin all-data mode safely.
**Do this instead:** Resolve identity once in middleware and enforce policy through shared `access-policy` functions.

### Anti-Pattern 2: Persisting All Projected Events Upfront

**What people do:** Materialize every recurrence occurrence for the full 3-year horizon.
**Why it's wrong:** Table growth, noisy audit logs, costly updates when recurrence rules change.
**Do this instead:** Project on read and instantiate only on user mutation or completion.

### Anti-Pattern 3: Soft Delete Flags Buried in JSON Attributes

**What people do:** Continue encoding lifecycle metadata in `attributes._deleted_at`.
**Why it's wrong:** Hard to index, easy to miss in joins, and restore/purge logic becomes inconsistent.
**Do this instead:** Use explicit lifecycle columns (or Sequelize paranoid with custom fields) and central lifecycle services.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| PostgreSQL | Sequelize models + migrations + advisory lock SQL for scheduler singleton | Use transaction boundaries for mutation + audit consistency |
| Browser storage (frontend) | Store auth session/refresh state and selected admin scope | Replace current actor-only local storage usage |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `api/middleware` -> `domain/security` | Direct function call with `actorContext` | Prevent route-level policy drift |
| `domain/financial-contracts` -> `domain/timeline` | Read model APIs (`listContractsForRange`) | Keep projection logic isolated from write models |
| `domain/occurrences` -> `domain/events` | Replace/bridge completion handlers | Remove `derived-*` event ID behavior progressively |
| `domain/lifecycle` -> `jobs/lifecycle-cleanup-job` | Shared purge command module | Same deletion rules for manual and scheduled purge |

## Sources

- Project baseline and milestone scope: `.planning/PROJECT.md`
- Current backend integration points: `src/api/app.js`, `src/api/routes/items.routes.js`, `src/api/routes/events.routes.js`, `src/domain/events/complete-event.js`, `src/domain/items/soft-delete-item.js`
- Current frontend integration points: `frontend/src/lib/api-client.ts`, `frontend/src/pages/events/events-page.tsx`, `frontend/src/pages/items/item-detail-page.tsx`
- Express middleware ordering and composition: https://expressjs.com/en/guide/using-middleware.html
- Sequelize transaction patterns: https://sequelize.org/docs/v6/other-topics/transactions/
- Sequelize paranoid soft-delete behavior: https://sequelize.org/docs/v6/core-concepts/paranoid/
- PostgreSQL advisory locks for singleton scheduler execution: https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS

---
*Architecture research for: HACT v2.0 auth/timeline/lifecycle milestone*
*Researched: 2026-02-25*
