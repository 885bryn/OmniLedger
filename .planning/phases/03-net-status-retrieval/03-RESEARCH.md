# Phase 3: Net-Status Retrieval - Research

**Researched:** 2026-02-24
**Domain:** Express GET endpoint + Sequelize parent/child retrieval with deterministic ordering and computed summary
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Response shape
- Return a single root item object (not a generic envelope wrapper).
- Include child commitments as one-level nested entries (direct children only).
- Each child commitment uses canonical core fields: `id`, `item_type`, `attributes`, `parent_item_id`, `created_at`, `updated_at`.
- Do not include related event previews in this phase.

### Missing-data behavior
- Unknown item id returns `404`.
- Item owned by another user returns `403`.
- Requests where the target item is a commitment type (not an asset) return `422` with an actionable wrong-type category.
- Use the same issue-envelope style established in item-create errors for all net-status failure responses.

### Sorting and ordering
- Default child commitment ordering is soonest due date first (ascending), with null due dates last.
- Tie-break commitments with equal due dates by `created_at` ascending for deterministic output.
- No client-selected sort options in this phase; server uses one fixed default ordering.

### Computed summary fields
- Include a top-level `summary` object in the response.
- Provide monthly obligation total as the initial aggregate value.
- When child rows lack fields needed for aggregation, skip those rows and include an excluded-row count in summary metadata.

### Claude's Discretion
- Exact summary field names and key casing, as long as they are consistent and documented in tests.
- Precise due-date derivation rules per commitment type, provided output obeys the locked ordering and exclusion rules above.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ITEM-05 | User can request `GET /items/:id/net-status` and receive the item with attributes plus nested linked child commitments. | Endpoint contract, domain retrieval pattern, deterministic child ordering, summary calculation, and error envelope mapping are defined below. |
</phase_requirements>

## Summary

Phase 3 is a read-model endpoint over existing `Item` relationships. The project already has what this phase needs structurally: self-reference association (`childCommitments`) on `Item`, canonical item field serialization precedent from Phase 2, and centralized API error mapping middleware. Planning should focus on a thin GET route and a dedicated domain service that retrieves one root asset, loads direct child commitments, applies deterministic ordering in a dialect-safe way, and computes a summary object.

The most important planning choice is ordering implementation. Because due date is currently stored in JSON attributes (not a normalized column), and local verification uses sqlite while runtime targets PostgreSQL, DB-level JSON/date ordering can drift by dialect. The safest plan is: retrieve children, normalize/derive due date in service code, then stable-sort in JavaScript by due date asc (null last) then `created_at` asc.

Error behavior should mirror Phase 2 envelope style (`error.code`, `error.category`, `error.message`, `error.issues`) while changing status codes to the locked 404/403/422 cases for this endpoint. Keep response root as the item object itself (not wrapped), with `child_commitments` and `summary` added explicitly.

**Primary recommendation:** Plan this phase as one vertical read slice: `GET /items/:id/net-status` -> `getItemNetStatus({ itemId, actorUserId })` -> canonical response serializer + centralized net-status error mapper, with deterministic in-memory sort and summary aggregation rules locked by tests.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | `^5.2.1` (installed) | Define `GET /items/:id/net-status` route and middleware flow | Already used in `src/api/app.js`; standard route + error middleware path. |
| `sequelize` | `^6.37.5` (installed) | Parent item lookup + child retrieval via model associations/finders | Existing project ORM and association source of truth. |
| `jest` + `supertest` | `^29.7.0` + `^7.2.2` (installed) | API and domain behavior verification | Existing project test harness and route testing style. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sqlite3` | `^5.1.7` (dev) | Fast test runtime backing mocked DB module | Use for endpoint integration tests in this phase, as in Phase 2. |
| `pg` / `pg-hstore` | installed | Production/runtime PostgreSQL support | Use for real runtime behavior outside in-memory tests. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-service sort by derived due date | DB-level JSON/date ORDER BY | More complex and dialect-sensitive (sqlite vs PostgreSQL) for this project's test strategy. |
| Dedicated net-status service + serializer | Route-level inline query/shape logic | Faster initially, but weakens reuse and makes error/contract drift likely. |

**Installation:**
```bash
npm install
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
|- api/
|  |- app.js                              # mount router + centralized error middleware
|  |- routes/items.routes.js              # add GET /items/:id/net-status
|  `- errors/http-error-mapper.js         # extend with net-status error mapping
|- domain/items/
|  |- create-item.js                      # existing write-side service
|  |- item-create-errors.js               # existing error taxonomy style precedent
|  |- get-item-net-status.js              # NEW read-side service
|  `- item-net-status-errors.js           # NEW endpoint-specific domain errors
test/
|- api/items-net-status.test.js           # NEW endpoint contract/error tests
`- domain/items/get-item-net-status.test.js # NEW domain ordering/summary tests
```

### Pattern 1: Service-First Read Flow
**What:** Route delegates to `getItemNetStatus`, route does no business branching.
**When to use:** All `/items/:id/net-status` requests.
**Why:** Preserves the project's existing thin-route pattern from `POST /items`.

### Pattern 2: Two-Step Retrieval With Explicit Ownership Guard
**What:**
1) fetch target item by id,
2) enforce owner check,
3) reject commitment root type,
4) fetch direct children (`parent_item_id = root.id`).
**When to use:** Every valid id request.
**Why:** Produces distinct 404 vs 403 vs 422 behavior exactly as locked.

### Pattern 3: Deterministic Child Ordering in Domain Layer
**What:** Derive `dueDateKey` per child, then sort by `(dueDateKey asc, null last, created_at asc)`.
**When to use:** Always before response serialization.
**Why:** Stable output and deterministic tests regardless of DB dialect quirks.

### Pattern 4: Canonical Serialization + Explicit Additions
**What:** Serialize root and children using canonical fields; append `child_commitments` and `summary` only.
**When to use:** On successful response payload construction.
**Why:** Keeps contract tight and aligned with Phase 2 canonical field approach.

### Anti-Patterns to Avoid
- **Sorting in SQL using dialect-specific JSON/date expressions first:** likely to break sqlite-backed tests.
- **Using include-level where that implicitly forces inner join:** can accidentally turn "root exists with zero children" into false negatives.
- **Returning ORM instances directly:** leaks non-canonical fields (`dataValues`, relation metadata).
- **Collapsing all read failures into 404:** violates locked 403 and wrong-type 422 semantics.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP pipeline | Custom request parser/router shell | Existing Express router + middleware chain | Project already uses this pattern and tests it with Supertest. |
| ORM relation hydration | Manual SQL string joins | Sequelize finders + associations (`parent_item_id`) | Lower maintenance and consistent model constraints. |
| Error envelope scattering | Per-route ad-hoc JSON error bodies | Centralized error mapper pattern in `src/api/errors/http-error-mapper.js` | Keeps API contract consistent across phases. |
| Sorting utility package for small fixed rule set | Third-party comparator DSL | Small local comparator function | Simpler, explicit, and directly testable for locked order semantics. |

**Key insight:** This phase is mostly contract orchestration over existing models, not a schema phase; avoid introducing new persistence primitives unless tests prove a hard need.

## Common Pitfalls

### Pitfall 1: 404 and 403 become indistinguishable
**What goes wrong:** Requests for another user's item return 404 instead of 403.
**Why it happens:** Query filters by both `id` and `user_id` in one step, losing ownership distinction.
**How to avoid:** Lookup by `id` first, then ownership check second.
**Warning signs:** No test can prove 403 branch for existing foreign-owned row.

### Pitfall 2: Wrong-type checks happen too late
**What goes wrong:** Commitment root requests succeed or return generic errors.
**Why it happens:** Service loads children before validating root type.
**How to avoid:** Validate root `item_type` immediately after root fetch.
**Warning signs:** `FinancialCommitment` ids produce 200 with empty children.

### Pitfall 3: Null due dates sort first
**What goes wrong:** Missing due dates appear at top of `child_commitments`.
**Why it happens:** Default lexical/date sort without null handling.
**How to avoid:** Comparator explicitly treats null due date as last.
**Warning signs:** Tests with mixed due dates fail nondeterministically.

### Pitfall 4: Summary totals silently include bad amounts
**What goes wrong:** Non-numeric `attributes.amount` pollutes `monthly_obligation_total`.
**Why it happens:** Numeric coercion without validation/exclusion tracking.
**How to avoid:** Parse strictly, skip invalid rows, increment excluded-row count.
**Warning signs:** Total differs from manually computed valid amounts.

### Pitfall 5: Error envelope drifts from Phase 2 style
**What goes wrong:** Net-status failures return plain `{ message }` or different shape.
**Why it happens:** Endpoint handles errors inline and bypasses mapper.
**How to avoid:** Add net-status domain errors and map centrally alongside item-create errors.
**Warning signs:** 422 body has no `category` or `issues` array.

## Code Examples

Verified patterns from official docs and current project:

### Route parameter access for item id
```javascript
// Source: https://expressjs.com/en/guide/routing.html
router.get('/items/:id/net-status', async (req, res, next) => {
  try {
    const result = await getItemNetStatus({
      itemId: req.params.id,
      actorUserId: req.header('x-user-id')
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
```

### Sequelize top-level ordering supports direction tokens including NULL rules
```javascript
// Source: https://sequelize.org/docs/v6/core-concepts/model-querying-basics/#ordering
const rows = await models.Item.findAll({
  where: { parent_item_id: parentId },
  order: [['created_at', 'ASC']]
});
```

### Existing centralized error mapping precedent
```javascript
// Source: src/api/errors/http-error-mapper.js
function mapItemCreateError(error) {
  if (!(error instanceof ItemCreateValidationError)) {
    return null;
  }
  return {
    status: 422,
    body: {
      error: {
        code: 'item_create_validation_failed',
        category: error.category,
        issues: error.issues
      }
    }
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic list endpoints requiring multiple client calls to compose parent/children | Purpose-built read-model endpoint returning root + direct commitments | Common API design for UX-oriented retrieval | Reduces client round trips and enforces one deterministic server contract. |
| Ad-hoc JSON response shapes per route | Canonical persisted fields plus narrowly scoped additions | Phase 2 established canonical item response policy | Better testability and lower contract drift. |
| Per-route custom error bodies | Central mapper + domain error taxonomy | Phase 2 introduced category-based envelope | Easier client-side handling and consistency across endpoints. |

**Deprecated/outdated:**
- Returning raw ORM instances or stack-shaped errors from API routes.

## Open Questions

1. **Actor identity transport for ownership check (`403`)**
   - What we know: locked behavior requires distinguishing unknown id (`404`) from foreign-owned item (`403`).
   - What's unclear: where caller identity comes from in this pre-auth codebase.
   - Recommendation: use one temporary, explicit transport (for example `x-user-id` header) in this phase and keep it isolated so Phase 4+ auth can replace it without domain logic rewrite.

2. **Monthly obligation interpretation in absence of recurrence schema on items**
   - What we know: summary must include a monthly obligation total and exclude rows missing required aggregate fields.
   - What's unclear: whether non-monthly obligations should be normalized by cadence now.
   - Recommendation: in Phase 3, compute `monthly_obligation_total` as sum of valid numeric commitment amounts and record exclusions; defer cadence normalization until recurrence metadata is formalized.

## Sources

### Primary (HIGH confidence)
- `src/db/models/item.model.js` - self-referential item association (`childCommitments`) and canonical item columns.
- `src/domain/items/create-item.js` - canonical serialization pattern and service-layer validation precedent.
- `src/api/errors/http-error-mapper.js` - established issue-envelope mapping style.
- `src/api/routes/items.routes.js` - current thin-route/service delegation pattern.
- `test/api/items-create.test.js` - expected error/body contract style and integration test structure.
- https://expressjs.com/en/guide/routing.html - route params and router patterns.
- https://sequelize.org/docs/v6/advanced-association-concepts/eager-loading/ - association loading behavior and include caveats.
- https://sequelize.org/docs/v6/core-concepts/model-querying-basics/ - order semantics and direction whitelist (`ASC`, `NULLS LAST`, etc.).

### Secondary (MEDIUM confidence)
- `.planning/phases/03-net-status-retrieval/03-CONTEXT.md` - locked phase decisions and scope boundaries.
- `.planning/STATE.md` - previous phase architecture and current project posture.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly grounded in installed dependencies and existing code paths.
- Architecture: HIGH - built on current route/service/error-mapper patterns already in repo.
- Pitfalls: HIGH - derived from locked decisions plus known sqlite/postgres ordering mismatch risks.

**Research date:** 2026-02-24
**Valid until:** 2026-03-26
