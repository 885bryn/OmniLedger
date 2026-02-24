# Pitfalls Research

**Domain:** Household Asset and Commitment Tracker API (ledger-style personal finance backend)
**Researched:** 2026-02-23
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Treating `items.attributes` JSONB as an untyped junk drawer

**What goes wrong:**
Domain rules drift into ad hoc JSON keys, different item types store equivalent data under different names, and API behavior becomes inconsistent by item type.

**Why it happens:**
JSONB feels flexible in early greenfield work, so teams skip explicit per-type attribute contracts and validation layers.

**How to avoid:**
Define a strict attribute schema per `items.type` (required keys, allowed keys, value constraints), validate at API boundary, and version contracts for breaking changes.

**Warning signs:**
Frequent null checks for missing JSON keys, one-off migrations to rename JSON fields, and route logic branching on "if key exists" rather than type contract.

**Phase to address:**
Phase 1 - Domain model and validation contracts.

---

### Pitfall 2: Weak parent-child integrity for commitment linkage

**What goes wrong:**
Commitments become linked to wrong or deleted assets, orphaned child records accumulate, and net-status responses become financially misleading.

**Why it happens:**
Self-referencing schemas are implemented without strict constraints on allowed parent/child type combinations and lifecycle rules.

**How to avoid:**
Enforce FK constraints and business constraints: allowed linkage matrix (for example, `FinancialCommitment -> RealEstate|Vehicle`), clear delete behavior (`RESTRICT` or explicit archival), and integrity tests.

**Warning signs:**
Children with null or invalid `parent_item_id`, manual data fixes for orphan records, and inconsistent totals between rollup endpoints and raw rows.

**Phase to address:**
Phase 1 - Relational integrity and schema constraints.

---

### Pitfall 3: Non-atomic event completion and audit writes

**What goes wrong:**
Event completion succeeds but audit history fails (or vice versa), producing irreconcilable timeline history and broken trust in "what happened when."

**Why it happens:**
Teams implement event update and audit insert as separate operations without a database transaction boundary.

**How to avoid:**
Wrap completion workflow in a single transaction, make writes idempotent with request/event idempotency keys, and fail the entire operation if any required write fails.

**Warning signs:**
Completed events missing audit rows, duplicate completion logs from retries, and support incidents where users dispute timeline accuracy.

**Phase to address:**
Phase 2 - Transaction-safe workflow implementation.

---

### Pitfall 4: Incorrect recurring/non-recurring semantics for `prompt_next_date`

**What goes wrong:**
Clients receive wrong follow-up prompts, causing missed future payments or duplicate scheduling prompts.

**Why it happens:**
Recurring rules are inferred inconsistently from attributes, and completion logic does not centralize recurrence classification.

**How to avoid:**
Create a single recurrence policy module, persist explicit recurrence metadata, and test completion responses with a contract suite including edge cases (ad hoc one-time, paused recurring, completed final installment).

**Warning signs:**
Frequent frontend condition patches for prompt behavior, mismatched prompt behavior across event types, and bug reports around "asked me again" / "never asked me."

**Phase to address:**
Phase 2 - Business rule engine and API contract tests.

---

### Pitfall 5: N+1 query explosions in nested net-status retrieval

**What goes wrong:**
Net-status endpoints become slow as households add assets and linked commitments; p95 latency spikes and API timeouts appear in ordinary usage.

**Why it happens:**
Sequelize include trees are built naively, with per-child or per-event follow-up queries and no projection discipline.

**How to avoid:**
Design net-status query plans up front: bounded includes, selective attributes, aggregate queries for totals, and pagination/windowing for long timelines.

**Warning signs:**
Endpoint latency rising with record count, high query counts per request, and database CPU spikes tied to a single summary route.

**Phase to address:**
Phase 3 - Read model performance and query optimization.

---

### Pitfall 6: Audit history that cannot reconstruct state transitions

**What goes wrong:**
History rows exist but are too coarse (for example, "updated") to explain exact before/after values and actor intent, limiting debugging and trust.

**Why it happens:**
Audit is treated as a checkbox instead of an investigative artifact; schema lacks structured change payload and actor metadata.

**How to avoid:**
Capture immutable audit events with action type, actor, timestamp, entity version, and minimal before/after diff payload for critical fields.

**Warning signs:**
Cannot answer "who changed due date from X to Y," support relying on application logs instead of audit tables, and disputes unresolved by data.

**Phase to address:**
Phase 2 - Audit model design and compliance-grade event logging.

---

### Pitfall 7: Migration strategy that breaks UUID/ENUM/JSONB evolution

**What goes wrong:**
Later schema changes fail in shared environments, enums lock deployments, and JSONB backfills become unsafe or long-running.

**Why it happens:**
Greenfield teams optimize only for initial creation migrations and skip forward-only operational migration patterns.

**How to avoid:**
Adopt expand-migrate-contract, treat ENUM updates as explicit migration events, add backfill scripts with chunking, and test migrations against realistic seed volume in Dockerized environments.

**Warning signs:**
Hotfix SQL applied manually, failed deployments on enum changes, and long lock times during backfills.

**Phase to address:**
Phase 4 - Operational hardening and migration discipline.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store new type fields directly in JSONB without schema update | Faster feature shipping | Contract drift and brittle route logic | MVP spike only, must be converted in next phase |
| Soft-delete parent items without child policy | Easy archival | Orphaned commitments and broken rollups | Never |
| Compute net totals in application loops | Quick implementation | High latency and scaling bottlenecks | Very small local demos only |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Docker Compose (API + Postgres) | Using host-specific DB assumptions and local-only connection strings | Run API against compose network aliases and environment-driven config from day one |
| Frontend consumers of completion endpoint | Coupling UI logic to inferred recurrence behavior | Use explicit `prompt_next_date` contract and contract tests |
| Sequelize migrations | Auto-generated migrations accepted without review | Review DDL for locks, FK behavior, enum changes, and rollback/forward compatibility |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Deep eager-loading for item -> children -> events | Slow net-status and memory spikes | Separate summary read models from detail reads | Noticeable around 100s of items with long event histories |
| Unindexed JSONB filter usage | Sequential scans and unstable latency | Add targeted GIN/BTREE indexes for actual query patterns | Usually at 50k+ events/items depending on host size |
| Sorting and filtering timelines in Node.js | CPU-heavy API containers | Push filtering/ordering/aggregation into SQL with indexes | Early, even in small households with long history |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Missing ownership scoping on item/event queries | Cross-household data exposure | Enforce user/household scope in every repository query and test for IDOR patterns |
| Returning raw audit payloads with sensitive details | Unnecessary data leakage in clients/logs | Define audit DTOs and redact sensitive fields at serialization boundary |
| Trusting client-supplied UUID relationships blindly | Link tampering and data integrity abuse | Validate parent ownership and allowed type graph server-side before writes |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Net status endpoint returns opaque totals without lineage | Users cannot trust numbers | Return totals plus contributing child commitment summaries |
| Event completion response omits next-step context | Users miss follow-up actions | Keep explicit `prompt_next_date` plus reason metadata |
| Inconsistent terminology across item types | Confusing API integration for clients | Standardize response vocabulary and enum naming conventions |

## "Looks Done But Isn't" Checklist

- [ ] **Item creation:** Typed defaults applied per `type` and validated against schema; verify with contract tests for each supported type.
- [ ] **Parent-child linkage:** Invalid parent types rejected and deletion policy enforced; verify with DB constraint tests.
- [ ] **Event completion:** Update and audit write are atomic; verify by fault-injection test that partial success cannot persist.
- [ ] **Net status:** Response includes nested commitments and stays performant; verify p95 latency budget with seeded realistic data.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| JSONB contract drift | MEDIUM | Freeze writes for affected types, map old keys to canonical schema, run backfill, add schema validator gate |
| Broken parent-child integrity | HIGH | Identify orphan/invalid links, reconcile from audit history, apply corrective migration, add constraints/tests |
| Partial event/audit writes | HIGH | Reconcile via audit gap detection job, reapply missing rows from idempotency logs, release transactional fix |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| JSONB contract drift | Phase 1 - Domain model and validation contracts | Type-specific schema tests fail on unknown/missing keys |
| Parent-child integrity gaps | Phase 1 - Relational integrity and schema constraints | FK + business constraint test suite blocks invalid linkage |
| Non-atomic completion/audit | Phase 2 - Transaction-safe workflow implementation | Fault-injection test proves no partial writes |
| Recurrence/prompt semantics drift | Phase 2 - Business rule engine and API contract tests | Contract tests assert `prompt_next_date` behavior by scenario |
| N+1 net-status performance | Phase 3 - Read model performance and query optimization | Query-count and p95 latency budgets enforced in CI |
| Weak audit reconstruction | Phase 2 - Audit model design | Replay test can reconstruct critical field history |
| Migration fragility (UUID/ENUM/JSONB) | Phase 4 - Operational hardening | Migration rehearsal on seeded database passes without manual SQL |

## Sources

- PostgreSQL JSONB docs (indexing and query behavior): https://www.postgresql.org/docs/current/datatype-json.html
- PostgreSQL constraints and foreign keys: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL explicit locking behavior (migration risk context): https://www.postgresql.org/docs/current/explicit-locking.html
- Sequelize transactions: https://sequelize.org/docs/v6/other-topics/transactions/
- Sequelize associations (self-referential modeling patterns): https://sequelize.org/docs/v6/core-concepts/assocs/

---
*Pitfalls research for: Household Asset and Commitment Tracker API*
*Researched: 2026-02-23*
