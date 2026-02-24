# Project Research Summary

**Project:** Household Asset & Commitment Tracker (HACT) API
**Domain:** Ledger-style household asset and commitment tracking backend
**Researched:** 2026-02-23
**Confidence:** MEDIUM

## Executive Summary

HACT is best implemented as an API-first modular monolith: Express 5 on Node 22, Sequelize 6, and PostgreSQL 17 with strict relational constraints and typed JSONB contracts. The product is a household ledger backend, not a full consumer-finance suite, so experts prioritize deterministic core workflows first: item/commitment modeling, parent-child linkage, event lifecycle, and auditable completion behavior.

The recommended delivery strategy is dependency-first. Start with schema and validation contracts, then implement transaction-safe domain services, then expose HTTP endpoints, and only then optimize read models and operational hardening. This sequence aligns with architecture guidance and avoids costly rework on net-status aggregation and audit semantics.

The highest risks are data-contract drift in JSONB attributes, broken parent-child integrity, and non-atomic event/audit writes. Mitigation is explicit: per-type schemas, FK + business linkage constraints, and mandatory single-transaction writes with idempotency and contract tests (especially around `prompt_next_date`). If these controls are in place early, the project can ship a reliable v1 quickly and defer high-complexity integrations safely.

## Key Findings

### Recommended Stack

`STACK.md` strongly supports a conservative, production-stable backend stack: Node.js `22.22.x` LTS, Express `5.2.1`, Sequelize `6.37.7`, PostgreSQL `17.x`, and Docker Compose v2 for local API+DB deployment. The guidance is explicit about avoiding unstable or legacy choices (Node 18, Express 4, Sequelize 7 alpha, and `sequelize.sync({ alter: true })` beyond local prototyping).

**Core technologies:**
- Node.js `22.22.x` LTS: runtime baseline with long support window and broad compatibility.
- Express `5.2.1`: HTTP and middleware ecosystem with low delivery friction.
- Sequelize `6.37.7` + `pg` `8.18.0`: ORM + driver pairing for transactions, associations, migrations.
- PostgreSQL `17.x`: ACID correctness, UUID support, strong JSONB/indexing for ledger queries.
- Docker Compose v2: reproducible local network runtime for API and Postgres.

### Expected Features

`FEATURES.md` indicates v1 should focus on a tight P1 scope: typed item CRUD, parent-child linkage, net-status aggregation, recurring/one-time event lifecycle, completion audit logging, `prompt_next_date` hints, and baseline list ergonomics (filter/sort/pagination). These are table stakes for trust and usability.

**Must have (table stakes):**
- Asset/commitment CRUD with typed categories/defaults and stable validation errors.
- Parent-child linkage for commitment context and nested net-status rollups.
- Event timeline with one-time and recurring support plus completion workflow.
- Audit history for key mutations and deterministic completion responses.
- Filtering, sorting, and pagination for real client consumption.

**Should have (competitive):**
- Commitment-aware nested net-status per asset (core differentiation).
- Action-hint responses like `prompt_next_date` to reduce client complexity.
- Typed default attributes by category and lifecycle event unification.
- Early data-model hooks for future household sharing.

**Defer (v2+):**
- External account aggregation/bank sync.
- Scenario forecasting/simulation.
- Embedded payments/autopay and heavy compliance features.

### Architecture Approach

`ARCHITECTURE.md` recommends a modular monolith with clear slices (`items`, `events`, `status`, `audit`) and a command/read split inside one service. Keep controllers thin, enforce domain rules in services, use repositories to contain Sequelize usage, and write audit entries in the same transaction as state changes.

**Major components:**
1. API interface layer (`routes/controllers/validators`) - contracts, validation, response shaping.
2. Domain services (`items/events/status/audit`) - business rules, orchestration, transaction boundaries.
3. Data layer (`models/repositories/migrations`) - persistence contracts, query control, schema evolution.
4. Runtime layer (PostgreSQL, Compose, config, logging, health checks) - operability and reproducibility.

### Critical Pitfalls

`PITFALLS.md` highlights a small set of failure modes that should drive roadmap sequencing and test strategy.

1. **Untyped JSONB attribute drift** - enforce per-type schema contracts and versioned validators.
2. **Weak parent-child integrity** - enforce FK and type linkage matrix, plus deletion policy tests.
3. **Non-atomic completion/audit writes** - require single DB transaction and idempotent completion behavior.
4. **Recurrence/prompt semantic drift** - central recurrence policy and contract tests for `prompt_next_date` scenarios.
5. **N+1 net-status read explosion** - bounded includes, projection queries, and query-count/p95 budgets.

## Implications for Roadmap

Based on combined research, the roadmap should be dependency-ordered and organized by domain boundaries, not by endpoint count.

### Phase 1: Data Contracts and Integrity Foundation
**Rationale:** Every core feature depends on stable schema semantics.
**Delivers:** UUID/ENUM/JSONB schema, `items` + self-reference constraints, migration baseline, type validators.
**Addresses:** Typed CRUD foundation, parent-child linkage prerequisites.
**Avoids:** JSONB drift, invalid link graphs, early migration fragility.

### Phase 2: Core Command Workflows (Items + Events + Audit)
**Rationale:** Write-path correctness is the trust anchor for the product.
**Delivers:** Item create/update rules, event completion logic, recurrence policy, in-transaction audit writes, `prompt_next_date` contract behavior.
**Addresses:** P1 event lifecycle, completion auditing, action hints.
**Avoids:** Partial writes, recurrence inconsistencies, unreconstructable history.

### Phase 3: API Surface and Net-Status Read Model
**Rationale:** Expose stable contracts only after command semantics are reliable.
**Delivers:** Routes/controllers/validators, list filtering/sorting/pagination, nested net-status projection and performance guardrails.
**Addresses:** Net-status endpoint, practical consumer ergonomics.
**Avoids:** Fat controllers, N+1 query blowups, opaque totals.

### Phase 4: Hardening and Operational Readiness
**Rationale:** Operational discipline prevents MVP regressions as usage grows.
**Delivers:** Integration/fault-injection/performance tests, migration rehearsals, structured logging, health checks, Docker Compose readiness.
**Addresses:** Reliability and local-network deployment requirements.
**Avoids:** Production-like migration failures, hidden latency regressions, environment mismatch issues.

### Phase 5: Post-Validation Enhancements (v1.x -> v2)
**Rationale:** Add complexity only after core behavior is validated.
**Delivers:** Webhooks/idempotency keys, sharing scopes, import/export; later external aggregation and forecasting.
**Addresses:** Differentiators beyond MVP and validated user demand.
**Avoids:** Premature expansion into compliance-heavy or low-confidence areas.

### Phase Ordering Rationale

- Schema and validation must precede domain logic because linkage and attributes define all downstream correctness.
- Command workflows must stabilize before read optimization so projections reflect true persisted behavior.
- API contracts come after service contracts to minimize churn and integration breakage.
- Hardening follows core behavior to lock reliability before scaling and extensions.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3:** Net-status projection/query design under realistic household data volume.
- **Phase 5:** Multi-user sharing authorization model and webhook/idempotency contract design.
- **Phase 5 (v2 track):** External account aggregation and compliance constraints.

Phases with standard patterns (can usually skip extra research):
- **Phase 1:** Node/Express/Sequelize/Postgres schema + migration setup is well-documented.
- **Phase 2:** Transactional service + audit pattern is established and directly supported by Sequelize/Postgres.
- **Phase 4:** Docker Compose runtime, logging, and health-check hardening follow common backend practice.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Strongly anchored in official docs and explicit version guidance. |
| Features | MEDIUM | Competitive scan is directionally strong, but mostly marketing-source derived. |
| Architecture | MEDIUM | Pattern quality is high but partly inferred from best practices and project constraints. |
| Pitfalls | MEDIUM | Risks are credible and well mapped to phases; validation still depends on implementation tests. |

**Overall confidence:** MEDIUM

### Gaps to Address

- Household/user authorization boundary is not fully specified; define tenant/ownership model before sharing features.
- Recurrence rule specification (timezone, pause/resume, final installment semantics) needs explicit contract docs.
- Performance budgets (target p95 and expected data volumes) should be set before Phase 3 query optimization.
- Migration rollout policy for enum/JSONB evolution needs concrete runbooks and rehearsal criteria.

## Sources

### Primary (HIGH confidence)
- `STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `.planning/PROJECT.md` - direct project-aligned synthesis inputs.
- Node.js release policy: https://nodejs.org/en/about/previous-releases
- Express docs/releases: https://expressjs.com/ and https://expressjs.com/2025/03/31/v5-1-latest-release.html
- Sequelize v6 docs: https://sequelize.org/docs/v6/
- PostgreSQL official docs (JSONB, UUID, constraints, locking): https://www.postgresql.org/docs/current/

### Secondary (MEDIUM confidence)
- `FEATURES.md` competitor comparisons from official product pages (Monarch, Quicken Simplifi, Rocket Money, Empower, Kubera, HomeZada).
- npm registry version checks captured in `STACK.md` (2026-02-23).

### Tertiary (LOW confidence)
- None identified; remaining uncertainty is implementation-specific rather than source-quality-specific.

---
*Research completed: 2026-02-23*
*Ready for roadmap: yes*
