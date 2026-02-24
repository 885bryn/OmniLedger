# Phase 1: Domain Model Foundation - Research

**Researched:** 2026-02-23
**Domain:** Sequelize + PostgreSQL domain modeling for ledger core
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Data Rules and Validation Posture
- Use a balanced required-field posture: require core fields, keep non-critical fields optional.
- Treat user identity fields (`username`, `email`) as case-insensitive unique values.
- For `attributes` JSON, enforce minimum required keys by item type and allow additional keys.
- Reject clearly invalid domain values at model level (for example invalid dates, disallowed negative amounts).

### Item Type Semantics
- Allowed item types are fixed to roadmap types only: `RealEstate`, `Vehicle`, `FinancialCommitment`, `Subscription`.
- `FinancialCommitment` records require a parent link at creation time.
- `Subscription` is standalone by default (not required to link to a parent asset).
- If full type-specific detail is missing but minimum required keys are present, item creation is still allowed.

### Parent-Child Linkage Behavior
- A parent item may have many linked commitments.
- Parent target type for commitment links is currently allowed as any existing item type.
- Writes with missing/nonexistent parent ids are rejected (no dangling links).
- Parent deletion is blocked while linked commitments exist.

### Event and Audit Language
- Canonical event statuses in this phase: `Pending`, `Completed`.
- Completing an event requires an explicit completion timestamp.
- Minimum required `AuditLog` fields: user, action, entity, and timestamp.
- Audit action naming uses a consistent verb-style convention (for example `item.created`, `event.completed`).

### Claude's Discretion
- Exact per-type minimum attribute key list (within these locked semantics).
- Exact error message wording/shape for validation failures.
- Exact naming variant for action verbs as long as style stays consistent.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACCT-01 | User can be stored as an account with UUID id, username, email, and password hash. | UUID primary keys, case-insensitive unique identity strategy, and Sequelize model/constraint patterns are defined below. |
| ITEM-01 | User can create an item with type `RealEstate`, `Vehicle`, `FinancialCommitment`, or `Subscription`. | ENUM-backed `item_type` strategy and validation patterns are defined below. |
| ITEM-02 | User can create an item with `attributes` stored as JSONB so type-specific and custom fields can coexist. | PostgreSQL `JSONB` + Sequelize `DataTypes.JSONB` guidance and validation boundaries are defined below. |
| ITEM-03 | User can create a `FinancialCommitment` item linked to a parent asset using `parent_item_id`. | Self-referential `Items` association (`belongsTo`/`hasMany`) with `onDelete: RESTRICT` and FK integrity strategy is defined below. |
| EVNT-01 | User can store timeline events for an item with event type, due date, amount, status, and recurrence flag. | Event schema + status enum + domain validation approach are defined below. |
| DEPL-02 | User can run the API against PostgreSQL using Sequelize models for `Users`, `Items`, `Events`, and `AuditLog`. | Standard Sequelize + pg connector stack, migration approach, and model structure are defined below. |
</phase_requirements>

## Summary

Phase 1 should establish an explicit relational contract first, then model-level validation second. For this scope, Sequelize v6 with PostgreSQL is a strong fit: it natively supports UUID, ENUM, JSONB, associations, and constraint options needed for parent-child integrity and timeline events. The biggest planning risk is leaving critical guarantees only in app logic; this phase should place identity uniqueness and parent linkage guarantees at both model and database levels.

For case-insensitive uniqueness (`username`, `email`), two valid PostgreSQL patterns exist: use `CITEXT` columns (simpler query behavior, extension required) or keep text columns and enforce unique indexes on normalized values (e.g., lowercased). Given the user constraints and this phase goal, prefer one deterministic strategy now and lock it in plan tasks; changing later is migration-heavy.

For item semantics, use a strict `item_type` ENUM plus JSONB `attributes` with per-type minimum-key checks in model validators. Keep custom fields open-ended in JSONB, but enforce minimum schema shape by type. For parent-child commitments, implement self-referential `Items` association and `ON DELETE RESTRICT` so linked parents cannot be deleted while commitments exist.

**Primary recommendation:** Plan this phase around migration-first schema contracts (UUID, ENUM, JSONB, FK + RESTRICT, unique identity) and then implement matching Sequelize model validations to enforce domain semantics before queries hit the DB.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sequelize` | v6 (stable docs track) | ORM models, validations, associations, migrations | Officially supports UUID/ENUM/JSONB, FK options, and PostgreSQL dialect behavior needed for this phase. |
| `pg` | current compatible with Node runtime | PostgreSQL connector used by Sequelize | Sequelize PostgreSQL dialect depends on `pg`; this is the documented connector path. |
| `pg-hstore` | current | Required companion for Sequelize PostgreSQL support | Sequelize docs explicitly note it as necessary alongside `pg`. |
| `sequelize-cli` | v6-compatible | Migration generation/execution | Enables repeatable DB state for schema-first domain foundation. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostgreSQL `citext` extension | PG current | Case-insensitive identity columns | Use when you want DB-native case-insensitive uniqueness and comparisons for username/email. |
| Built-in validator.js via Sequelize | bundled | Field and model-level validation primitives | Use for format checks (`isEmail`, `isUUID`, `min`, custom validators). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `CITEXT` columns for identity | Lowercasing in app + unique index strategy | Avoids extension dependency, but query and normalization rules become easier to drift across code paths. |
| ENUM for item/event statuses | Plain text + validator | More flexible but weaker DB-level guarantee; higher risk of invalid persisted states. |

**Installation:**
```bash
npm install sequelize pg pg-hstore
npm install --save-dev sequelize-cli
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/
│   ├── models/            # Sequelize model definitions and associations
│   ├── migrations/        # Schema contracts (tables, enums, indexes, FKs)
│   └── index.js           # Sequelize init + model registry
├── domain/
│   ├── items/             # Type-specific attribute minimum-key rules
│   └── events/            # Event status and completion invariants
└── api/
    └── ...               # Later phases consume persisted models
```

### Pattern 1: Migration-First Domain Contract
**What:** Define schema constraints in migrations before writing business behavior.
**When to use:** Always for persistence-critical phase foundations.

### Pattern 2: Dual-Layer Validation (Model + DB Constraints)
**What:** Use Sequelize validators for domain semantics and SQL constraints for storage integrity.
**When to use:** Required for malformed values and referential safety.

### Pattern 3: Explicit Self-Reference for Parent-Child Commitments
**What:** Model `Items` self-association for `parent_item_id` with one parent to many child commitments.
**When to use:** When commitments must be linked and retrievable as children of an asset.

### Anti-Patterns to Avoid
- **Only app-level integrity:** Do not rely on controller/service checks alone for parent existence or uniqueness.
- **Unbounded item type strings:** Avoid plain text item type without ENUM or equivalent strict validation.
- **No index on parent FK:** Parent-child retrieval becomes expensive and brittle at scale.
- **Sync-based production schema changes:** Avoid `sync({ alter: true })`; use migrations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Case-insensitive uniqueness | Custom per-endpoint lowercasing discipline only | PostgreSQL `CITEXT` or DB-backed normalized unique index strategy | DB-level enforcement prevents drift and race-condition duplicates. |
| Parent-child referential integrity | Manual existence checks with nullable free-form parent IDs | FK constraints + Sequelize associations (`belongsTo`/`hasMany`) | SQL guarantees no dangling links and enforces delete behavior. |
| JSON document querying behavior | Stringified JSON blobs | PostgreSQL `JSONB` via `DataTypes.JSONB` | JSONB supports structured querying and indexing strategies. |
| Status/state validation | Ad-hoc string checks scattered across services | `DataTypes.ENUM` + model validators | Centralizes rules and prevents invalid persisted states. |

**Key insight:** In this phase, correctness comes from schema contracts plus model invariants; custom logic-only enforcement is fragile and expensive to fix later.

## Common Pitfalls

### Pitfall 1: Case-Insensitive Uniqueness Is Only Half-Enforced
**What goes wrong:** `username`/`email` appear unique in app code but duplicate by case variant in DB.
**Why it happens:** Teams add `unique: true` on `STRING` but do not use case-insensitive strategy.
**How to avoid:** Choose one strategy now (`CITEXT` or normalized unique index) and enforce in migration.

### Pitfall 2: Commitment Parent Rules Not Encoded in Validation
**What goes wrong:** `FinancialCommitment` records are created without valid `parent_item_id`.
**Why it happens:** Association exists, but type-conditional requiredness is not validated.
**How to avoid:** Model-level validator: if `item_type` is `FinancialCommitment`, require `parent_item_id`.

### Pitfall 3: Incorrect Delete Semantics Break Integrity
**What goes wrong:** Deleting parent item silently detaches or removes linked commitments.
**Why it happens:** Default association delete behavior (`SET NULL`) left unchanged.
**How to avoid:** Explicitly set `onDelete: 'RESTRICT'` for `parent_item_id` association.

### Pitfall 4: JSONB Without Minimum Schema Guarantees
**What goes wrong:** `attributes` stores arbitrarily shaped data missing required keys.
**Why it happens:** JSONB flexibility treated as no-schema storage.
**How to avoid:** Per-type minimum-key validator map plus allow additional keys.

## Code Examples

### UUID Primary Keys
```javascript
// Source: https://sequelize.org/docs/v6/core-concepts/model-basics/
id: {
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey: true,
}
```

### ENUM and JSONB Columns
```javascript
// Source: https://sequelize.org/docs/v6/other-topics/other-data-types/
item_type: {
  type: DataTypes.ENUM('RealEstate', 'Vehicle', 'FinancialCommitment', 'Subscription'),
  allowNull: false,
},
attributes: {
  type: DataTypes.JSONB,
  allowNull: false,
  defaultValue: {},
}
```

### Foreign Key Constraint with Restrictive Delete
```javascript
// Source: https://sequelize.org/docs/v6/core-concepts/assocs/
Item.belongsTo(Item, {
  foreignKey: { name: 'parent_item_id', allowNull: true, type: DataTypes.UUID },
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sync({ alter: true })` for evolving schema | Migration-driven schema evolution | Established Sequelize best-practice in v6 docs | Safer, reviewable schema history and rollback path. |
| Free-form status strings in app code | ENUM-backed status + model validation | Common ORM/domain-hardening practice | Better data quality and lower runtime branching. |
| Lowercase comparisons scattered in queries | DB-backed case-insensitive identity strategy (`CITEXT` or normalized index) | Mature PostgreSQL practices | Consistent uniqueness and simpler query semantics. |

**Deprecated/outdated:**
- Destructive `sync({ force: true })` or `sync({ alter: true })` for persistent environments: migrations are recommended instead.

## Open Questions

1. **Case-insensitive identity implementation choice**
   - What we know: requirement is case-insensitive uniqueness for `username` and `email`.
   - What's unclear: whether project prefers `CITEXT` extension or normalized `TEXT` strategy.
   - Recommendation: choose now in planning wave 0; both are valid, but switching later is costly.

2. **Minimum attribute keys per item type**
   - What we know: this is explicitly in Claude's discretion and must be enforced.
   - What's unclear: exact key lists for each of the four item types.
   - Recommendation: define compact minimum maps in first implementation task and keep extensible extras.

## Sources

### Primary (HIGH confidence)
- https://sequelize.org/docs/v6/core-concepts/model-basics/ - UUID types/defaults, model definitions, sync guidance
- https://sequelize.org/docs/v6/core-concepts/validations-and-constraints/ - model/attribute validation behavior, unique/null constraints
- https://sequelize.org/docs/v6/core-concepts/assocs/ - FK semantics, `onDelete`/`onUpdate`, self-association patterns
- https://sequelize.org/docs/v6/other-topics/other-data-types/ - ENUM and JSONB usage in PostgreSQL
- https://sequelize.org/docs/v6/other-topics/dialect-specific-things/#postgresql - PostgreSQL connector expectations (`pg`, `pg-hstore`)
- https://sequelize.org/docs/v6/other-topics/migrations/ - migration-first workflow and transaction-safe migrations
- https://sequelize.org/docs/v6/other-topics/indexes/ - model index declarations
- https://www.postgresql.org/docs/current/citext.html - `citext` behavior and caveats for case-insensitive text

### Secondary (MEDIUM confidence)
- None.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - directly supported by Sequelize and PostgreSQL official docs.
- Architecture: HIGH - patterns map directly to documented migration, association, and validation features.
- Pitfalls: HIGH - derived from documented defaults (`SET NULL`, sync caveats, validation/constraint split).

**Research date:** 2026-02-23
**Valid until:** 2026-03-25
