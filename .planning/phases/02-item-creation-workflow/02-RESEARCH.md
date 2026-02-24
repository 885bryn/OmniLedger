# Phase 2: Item Creation Workflow - Research

**Researched:** 2026-02-24
**Domain:** Express POST endpoint + Sequelize create flow with type-aware attribute defaults
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Default Attribute Behavior
- Use type baseline defaults per item type (compact, usable defaults).
- Client-supplied values always override defaults; defaults only fill missing keys.
- Allow extra keys in `attributes` while still enforcing required minimum keys.
- Defaults should be structural/machine-relevant, not user-facing placeholder text.

### Create Response Shape
- Return the full created item payload on successful create.
- Return canonical persisted fields only (no expanded/derived relationship objects).
- Do not include explicit "defaults applied" metadata in the response.
- Response must include canonical persisted id and timestamps.

### Validation and Error Style
- Return field-level validation details.
- Return all validation issues found in a single response (not fail-fast first error only).
- Use distinct error categories/messages for invalid item type vs missing required keys.
- Error language should be plain and actionable.

### Parent Linking on Create
- `FinancialCommitment` requires a valid parent link at create time.
- `Subscription` parent link is optional by default.
- Nonexistent parent ids must return explicit validation errors.
- Create response returns `parent_item_id` only (no expanded parent object).

### Claude's Discretion
- Exact per-type default attribute key/value sets (within the locked behavior above).
- Exact error envelope shape and field naming conventions.
- Exact validation code taxonomy labels while preserving distinct categories.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ITEM-04 | User can create an item through `POST /items` and receive default attribute keys auto-populated based on item type. | Request contract, default-merging strategy, validation/error mapping, and persisted-response shape are defined below. |
</phase_requirements>

## Summary

Phase 2 is the first API-surface phase. The current codebase already has strong model constraints for item type, minimum attribute keys, and parent-link rules in `src/db/models/item.model.js`, but it does not yet have an HTTP app/router layer. Planning should therefore split this phase into (1) thin API bootstrap for `POST /items`, (2) domain-level default injection before model validation, and (3) deterministic error mapping from Sequelize/domain failures into actionable field-level API responses.

The key design choice is where defaults are applied. Apply defaults in a dedicated item-creation domain module before `Item.create(...)`, then run existing model validation as the hard gate. This preserves current invariants (minimum keys, amount/date checks, parent requirements), while satisfying ITEM-04 without mutating model definitions into transport-specific behavior.

For reliability and maintainability, keep parent existence check and create write in a single Sequelize transaction, and return persisted canonical fields only (`id`, `user_id`, `item_type`, `attributes`, `parent_item_id`, `created_at`, `updated_at`).

**Primary recommendation:** Plan Phase 2 as a small vertical slice: add minimal Express app + `POST /items`, route through one item-create service that merges type defaults then creates inside a transaction, and centralize Sequelize-to-API validation error translation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sequelize` | `^6.37.5` (installed) | Persistence, validation, transactions | Already used by domain models; supports model validators, managed transactions, and consistent create flow. |
| `express` | 5.x | `POST /items` HTTP endpoint | Official Express 5 docs support Promise-based handlers and standard middleware/error flow. |
| `jest` | `^29.7.0` (installed) | Route/service verification | Existing project test runner; keeps phase tests aligned with current tooling. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg` / `pg-hstore` | installed | PostgreSQL runtime compatibility | Use for PostgreSQL-backed create path in non-sqlite environments. |
| `sqlite3` | `^5.1.7` (dev) | Fast local/in-memory tests | Use for fast integration tests of API behavior in CI/local planning loops. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Domain service merges defaults | Sequelize model hooks (`beforeValidate`) | Hooks reduce call-site control and can obscure API-specific semantics; service-layer merge is clearer for this phase. |
| Unified validation taxonomy | Raw Sequelize error passthrough | Faster initially, but violates plain/actionable UX and distinct category requirement. |

**Installation:**
```bash
npm install express
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
|- api/
|  |- app.js                    # express app, middleware, router mount
|  |- routes/items.routes.js    # POST /items route
|  |- errors/http-error-mapper.js
|- domain/items/
|  |- default-attributes.js     # per-type baseline defaults map
|  |- create-item.js            # merge defaults + parent check + Item.create
|- db/
|  `- index.js                  # existing sequelize/models bootstrap
test/
|- api/items-create.test.js     # endpoint behavior and error envelope tests
```

### Pattern 1: Defaults-Then-Validate
**What:** Build `attributes = { ...defaultsByType[item_type], ...clientAttributes }`, then call `Item.create`.
**When to use:** Every item-create request.
**Why:** Guarantees user override precedence while preserving minimum-key validation.

### Pattern 2: Transaction-Bound Parent Validation
**What:** For `FinancialCommitment`, verify parent exists and create item inside one managed transaction.
**When to use:** Any create path that depends on parent integrity.
**Why:** Avoids race windows between parent check and insert.

### Pattern 3: Central Error Translation Middleware
**What:** Convert domain + Sequelize errors into one API envelope with field-level details and stable categories.
**When to use:** All item-create failures.
**Why:** Meets requirement for actionable, non-fail-fast validation feedback.

### Anti-Patterns to Avoid
- **Controller-heavy business logic:** keep merge rules and parent checks out of route handlers.
- **Fail-fast validation response:** do not stop at first issue when multiple fields are invalid.
- **Leaking ORM internals:** do not expose raw Sequelize error text as public contract.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction safety | Custom begin/commit wrappers | `sequelize.transaction(async (t) => ...)` | Official managed transaction behavior is simpler and safer. |
| Validation engine | Separate ad-hoc schema walker for model rules | Existing `Item` validators + small pre-checks | Prevents duplicated rule drift across layers. |
| Parent integrity | Best-effort checks without DB-backed FK semantics | Existing FK + transaction + explicit existence query | Handles both UX-friendly validation and DB truth. |
| HTTP parsing | Custom request body parser | `express.json()` | Built-in middleware is documented and battle-tested. |

**Key insight:** This phase should compose existing guarantees (model + FK) rather than introducing a parallel validation or persistence path.

## Common Pitfalls

### Pitfall 1: Defaults overwrite user intent
**What goes wrong:** Client-provided `attributes` values are replaced by template defaults.
**Why it happens:** Merge order is inverted.
**How to avoid:** Always spread defaults first, then client attributes.
**Warning signs:** Tests show submitted value changed in persisted response.

### Pitfall 2: `FinancialCommitment` returns generic FK failure only
**What goes wrong:** Nonexistent parent yields opaque DB error instead of actionable field message.
**Why it happens:** No explicit parent existence validation before insert.
**How to avoid:** Pre-check parent id in service and map to `parent_item_id` field-level issue.
**Warning signs:** 500/constraint-style text appears for user mistakes.

### Pitfall 3: Validation response is first-error-only
**What goes wrong:** Users fix one field at a time through multiple requests.
**Why it happens:** Error mapper exits after first Sequelize error item.
**How to avoid:** Aggregate all `ValidationErrorItem`s into a single response payload.
**Warning signs:** Error body contains one issue while request has several invalid fields.

### Pitfall 4: Response includes derived/expanded objects
**What goes wrong:** API returns `parentItem` object or non-canonical fields.
**Why it happens:** Response serializer reuses model instance with eager-loaded relations.
**How to avoid:** Explicitly serialize canonical persisted columns only.
**Warning signs:** Response shape drifts between creates based on include/query path.

## Code Examples

Verified patterns from official docs and current project:

### Express route + async error propagation
```javascript
// Source: https://expressjs.com/en/guide/error-handling.html
router.post('/items', async (req, res, next) => {
  try {
    const created = await createItem(req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});
```

### Managed transaction for parent check + create
```javascript
// Source: https://sequelize.org/docs/v6/other-topics/transactions/
const created = await sequelize.transaction(async (transaction) => {
  if (input.item_type === 'FinancialCommitment') {
    const parent = await models.Item.findByPk(input.parent_item_id, { transaction });
    if (!parent) {
      throw new Error('parent_item_id does not reference an existing item');
    }
  }

  return models.Item.create(input, { transaction });
});
```

### Existing minimum-key validation contract
```javascript
// Source: src/db/models/item.model.js
const requiredKeys = minimumAttributeKeys[this.item_type] || [];
const missing = requiredKeys.filter((key) => value[key] === undefined || value[key] === null || value[key] === "");
if (missing.length > 0) {
  throw new Error(`attributes missing minimum keys: ${missing.join(", ")}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-form create payloads requiring full client field knowledge | Type-template defaults + client override merge | Common API ergonomics pattern in modern CRUD services | Faster onboarding, fewer client retries, still keeps domain invariants. |
| ORM error passthrough | Structured API error envelope with field issues | Current API reliability best practice | Better correction loops and stable client behavior. |
| Multi-step create without transaction | Transaction-bound validation + create | Mature Sequelize guidance | Reduces race-condition and partial-failure risk. |

**Deprecated/outdated:**
- Returning unstructured string errors for validation-heavy create endpoints.

## Open Questions

1. **Per-type default value set granularity**
   - What we know: defaults must be compact, machine-relevant, and fill missing keys only.
   - What's unclear: exact optional keys (beyond required minimum keys) for each type.
   - Recommendation: lock a minimal default map first (required keys + 1-2 operational keys), expand in later phases only if needed.

2. **Error envelope schema naming**
   - What we know: must provide field-level details and distinct categories.
   - What's unclear: final envelope names (`code`, `category`, `issues`, etc.).
   - Recommendation: choose one stable envelope in this phase and reuse for later phases to avoid contract churn.

## Sources

### Primary (HIGH confidence)
- https://expressjs.com/en/guide/routing.html - route handler and router patterns.
- https://expressjs.com/en/guide/error-handling.html - async error behavior and error middleware semantics.
- https://expressjs.com/en/5x/api.html - `express.json()` and request validation caution for untrusted `req.body`.
- https://sequelize.org/docs/v6/core-concepts/validations-and-constraints/ - validation lifecycle and constraint behavior.
- https://sequelize.org/docs/v6/other-topics/transactions/ - managed transaction pattern.
- `src/db/models/item.model.js` - current item invariants that Phase 2 must preserve.
- `src/domain/items/minimum-attribute-keys.js` - required minimum-key map currently enforced.

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` - project-level modular monolith and service boundary recommendations.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - based on installed dependencies plus official Express/Sequelize docs.
- Architecture: HIGH - directly grounded in current code layout and Phase 1 runtime decisions.
- Pitfalls: HIGH - derived from locked decisions and existing model behavior.

**Research date:** 2026-02-24
**Valid until:** 2026-03-26
