# Architecture Research

**Domain:** Household Asset & Commitment Tracker API (ledger-style household finance backend)
**Researched:** 2026-02-23
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```text
+-------------------------------------------------------------------+
|                        API Interface Layer                        |
|  Routes (Express) -> Request validation -> Response serializers    |
+-------------------------------------------------------------------+
|                       Application Core Layer                      |
|  Item Service | Event Service | Net Status Service | Audit Service |
|  Domain rules, orchestration, transactions, and policy checks      |
+-------------------------------------------------------------------+
|                      Data Access / Persistence                     |
|  Sequelize models + repositories + query builders + migrations     |
|  Items (self-reference), Events, AuditHistory, Users               |
+-------------------------------------------------------------------+
|                    Infrastructure / Runtime Layer                  |
|  PostgreSQL, Docker Compose, config, health checks, logging        |
+-------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| API Routes + Controllers | HTTP contracts, input validation, auth placeholder, status codes | Express routers/controllers per resource (`items`, `events`, `status`) |
| Item Service | Create and update assets/commitments, apply typed defaults, enforce parent-child linkage rules | Service methods with transaction boundaries and domain validation |
| Event Service | Complete/schedule events, compute next-step behavior (`prompt_next_date`) | Service logic that updates event state and emits audit records |
| Net Status Service | Build aggregate view of asset + linked commitments + event state | Read-focused service with optimized includes/joins |
| Audit Service | Immutable history records for state-changing operations | Append-only writes to `audit_history` in same transaction |
| Repositories / ORM Layer | Encapsulate Sequelize model interactions and query shape control | Model-specific repository modules and shared query helpers |
| PostgreSQL | Source of truth for relational core + JSONB typed attributes | UUID PK/FK, enum types, JSONB constraints/indexes |
| Platform Layer | Runtime wiring, containerization, configuration, observability basics | Docker Compose, `.env`, startup checks, structured logs |

## Recommended Project Structure

```text
src/
|-- app.js                     # Express app composition
|-- server.js                  # Process bootstrap
|-- config/
|   |-- env.js                 # Environment parsing and validation
|   `-- db.js                  # Sequelize initialization
|-- api/
|   |-- routes/                # Route definitions by bounded area
|   |   |-- items.routes.js
|   |   |-- events.routes.js
|   |   `-- status.routes.js
|   |-- controllers/           # HTTP adapters only
|   `-- validators/            # Request schema validation
|-- domain/
|   |-- items/                 # Item aggregates and rules
|   |-- events/                # Event lifecycle and recurrence policy
|   |-- status/                # Net-status read model logic
|   `-- audit/                 # Audit command construction
|-- data/
|   |-- models/                # Sequelize models
|   |-- repositories/          # Data access abstractions
|   `-- migrations/            # Schema evolution
|-- shared/
|   |-- errors/                # Domain and API error types
|   `-- logging/               # Request and app logging utilities
`-- tests/
    |-- unit/
    `-- integration/
```

### Structure Rationale

- **`api/`** isolates protocol concerns so business logic is reusable and testable.
- **`domain/`** is the true ownership boundary for rules like typed defaults, parent-child constraints, and event completion behavior.
- **`data/`** decouples persistence concerns (Sequelize, query shape, migration evolution) from domain decisions.
- **`shared/`** centralizes cross-cutting error/log behavior to keep domain modules focused.

## Architectural Patterns

### Pattern 1: Modular Monolith with Domain Slices

**What:** One deployable API process, but organized into explicit domain modules (`items`, `events`, `status`, `audit`) with clear ownership.
**When to use:** Greenfield phase with a single team and tightly coupled workflows.
**Trade-offs:** Fast to ship and refactor early; requires discipline to avoid cross-module leakage.

**Example:**
```javascript
// api/controllers/events.controller.js
async function completeEvent(req, res, next) {
  try {
    const result = await eventService.complete({
      eventId: req.params.id,
      actorUserId: req.user?.id,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
```

### Pattern 2: Command + Read Model Split (inside monolith)

**What:** Keep mutation flows (commands) separate from aggregate-heavy read flows (`net-status`) to optimize each independently.
**When to use:** API has a few write operations but richer summary/read responses.
**Trade-offs:** Slightly more code paths, but better query performance control and clearer test scope.

**Example:**
```javascript
// domain/status/netStatus.service.js
async function getNetStatus(itemId) {
  const itemTree = await itemRepository.fetchItemWithChildren(itemId);
  return netStatusProjector.toResponse(itemTree);
}
```

### Pattern 3: Transactional Outbox-Ready Audit Trail

**What:** Treat every state-changing command as a transaction that writes both business state and immutable audit row.
**When to use:** Traceability is core value and future integrations may consume change events.
**Trade-offs:** More strict write path, but avoids missing or inconsistent history.

## Data Flow

### Request Flow

```text
Client request
  -> Express route
  -> Validator
  -> Controller
  -> Domain service
  -> Repository/Sequelize
  -> PostgreSQL transaction commit
  -> Response DTO
  -> Client response
```

### Key Data Flows

1. **Item creation with defaults:** request enters `items` controller -> item service applies type template defaults into `attributes` JSONB -> repository writes item and optional parent link -> audit service appends `item_created` entry -> created item response.
2. **Net-status retrieval:** request enters `status` controller -> net status service loads root item plus linked commitments/events via optimized include tree -> projection computes balances and upcoming actions -> nested response returned.
3. **Event completion workflow:** request enters `events` controller -> event service marks completion and evaluates recurrence flag -> audit row written in same transaction -> response includes `prompt_next_date: true` for non-recurring events.

### Internal Boundary Communication

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API -> Domain | Direct function calls (DTO input/output) | Keep HTTP objects out of domain layer |
| Domain -> Data | Repository interfaces | Prevent raw Sequelize usage from spreading |
| Domain command -> Audit | In-transaction service call | Guarantees history consistency with write success |
| Status module -> Item/Event data | Read repository/query model | Avoid command side effects in read path |

## Suggested Build Order (Roadmap Implications)

1. **Data foundation first:** define schema, enums, UUID keys, self-references, and migrations before endpoint logic; all higher layers depend on stable model contracts.
2. **Core domain write path second:** implement `Item Service` and `Event Service` business rules (typed defaults, completion logic, parent-child validation) with unit tests.
3. **Audit wiring third:** make audit append mandatory in every mutating transaction before exposing endpoints to avoid retrofitting history.
4. **HTTP surface fourth:** add controllers/routes/validators once service contracts are stable, minimizing churn in API layer.
5. **Read model fifth:** implement `Net Status Service` and query optimization after core writes exist, so projections mirror real persisted behavior.
6. **Cross-cutting hardening sixth:** add error mapping, logging, health checks, and integration tests across key flows.
7. **Containerization and dev runtime last in MVP path:** finalize Docker Compose and bootstrapping once app startup and migrations are deterministic.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k households | Single API container + single PostgreSQL instance, simple indexes, synchronous audit writes |
| 1k-100k households | Add read indexes for `parent_item_id`, `type`, event due dates, pagination on net-status, connection pooling tuning |
| 100k+ households | Consider read replicas, materialized summary views, background jobs for projections, and selective module extraction |

### Scaling Priorities

1. **First bottleneck:** net-status nested queries; fix with targeted indexes, read-model projection tables, and response pagination.
2. **Second bottleneck:** event timeline write/read contention; fix with partitioning by date and queue-backed async secondary processing.

## Anti-Patterns

### Anti-Pattern 1: Fat Controllers

**What people do:** Put domain decisions in route handlers.
**Why it's wrong:** Validation, business rules, and persistence become tangled and untestable.
**Do this instead:** Keep controllers thin and move decisions into domain services.

### Anti-Pattern 2: Unconstrained JSONB Attributes

**What people do:** Treat `attributes` JSONB as schema-free dumping ground.
**Why it's wrong:** Data quality drifts, net-status logic becomes brittle, migrations become expensive.
**Do this instead:** Enforce per-type attribute templates and validation in the domain layer.

### Anti-Pattern 3: Audit Outside Transaction

**What people do:** Write business state first and best-effort audit later.
**Why it's wrong:** Lost history on partial failures, violating traceability guarantees.
**Do this instead:** Write audit rows in the same transaction as the state change.

## Sources

- Project context and constraints: `.planning/PROJECT.md`
- Express architecture guidance (official): https://expressjs.com/
- Sequelize model/query architecture docs (official): https://sequelize.org/docs/v6/
- PostgreSQL JSONB and indexing docs (official): https://www.postgresql.org/docs/current/datatype-json.html

---
*Architecture research for: Household Asset & Commitment Tracker API*
*Researched: 2026-02-23*
