# Stack Research

**Domain:** Household asset and financial commitment tracking API (Node/Express/Sequelize/PostgreSQL)
**Researched:** 2026-02-23
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Node.js | 22.22.x LTS | Runtime for API services | 2025-standard baseline for production Node APIs: long support window, broad package compatibility, stable async/perf behavior for API workloads. | HIGH |
| Express | 5.2.1 | HTTP framework and middleware pipeline | Express 5 is now default and keeps the largest ecosystem for API middleware, docs, and hiring familiarity while staying unopinionated. | HIGH |
| Sequelize | 6.37.7 | ORM for models, associations, transactions, and migrations | v6 is the stable Sequelize line; it maps well to relational domain rules (FKs, constraints, transactions) required for household ledger integrity. | HIGH |
| PostgreSQL | 17.8 (target major 17) | Primary relational database | Best fit for financial-style data correctness (ACID), JSONB for typed attributes, UUID native type, and robust indexing for ledger/event queries. | HIGH |
| Docker Compose | v2 (use current stable plugin) | Local-network deployment for API + DB | Matches project constraint directly; gives reproducible local environments and one-command startup for API + Postgres. | MEDIUM |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `pg` | 8.18.0 | PostgreSQL driver used by Sequelize | Always with Sequelize + Postgres; required for pooling and dialect features. | HIGH |
| `sequelize-cli` | 6.6.5 | Migration and model scaffolding CLI | Use for team-consistent migration workflow (`db:migrate`, undo, seed in dev). | HIGH |
| `umzug` | 3.8.2 | Programmatic migration runner | Use when you want migrations executed in app bootstrapping/ops scripts instead of only CLI. | MEDIUM |
| `zod` | 4.3.6 | Request/response schema validation | Use at API boundaries to enforce typed payloads before hitting business logic. | HIGH |
| `pino` + `pino-http` | 10.3.1 / 11.0.0 | Structured JSON logging | Use for correlation IDs, latency, and audit-friendly logs in local and production-like runs. | HIGH |
| `helmet` | 8.1.0 | Secure HTTP headers | Use by default for API hardening (especially if any browser clients hit the API). | HIGH |
| `cors` | 2.8.6 | Cross-origin policy control | Use when frontend clients call API from separate host/port. | HIGH |
| `express-rate-limit` | 8.2.1 | Basic abuse protection | Use on auth-like or write-heavy endpoints to reduce accidental/hostile request bursts. | HIGH |
| `dotenv` | 17.3.1 | Environment variable loading | Use only in local/dev startup; production should inject env vars via runtime. | HIGH |
| `vitest` + `supertest` | 4.0.18 / 7.2.2 | API and integration test stack | Use for route-level and DB-backed integration tests around net-status and event completion flows. | HIGH |

### Development Tools

| Tool | Purpose | Notes | Confidence |
|------|---------|-------|------------|
| ESLint (`eslint` 10.0.2) | Code quality and consistency | Enforce async error handling, import hygiene, and unsafe-any guards early. | HIGH |
| Prettier (`prettier` 3.8.1) | Formatting consistency | Keep migration/model/controller diffs clean for roadmap-phase velocity. | HIGH |
| Swagger UI (`swagger-ui-express` 5.0.1) | Interactive API docs | Use if roadmap includes external consumers or contract-first collaboration. | MEDIUM |

## Installation

```bash
# Core
npm install express@5.2.1 sequelize@6.37.7 pg@8.18.0 zod@4.3.6 pino@10.3.1 pino-http@11.0.0 helmet@8.1.0 cors@2.8.6 express-rate-limit@8.2.1 dotenv@17.3.1

# Supporting (optional but recommended)
npm install umzug@3.8.2

# Dev dependencies
npm install -D sequelize-cli@6.6.5 vitest@4.0.18 supertest@7.2.2 eslint@10.0.2 prettier@3.8.1
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative | Why Not as Default Here | Confidence |
|-------------|-------------|--------------------------|--------------------------|------------|
| Express 5.2.1 | Fastify 5.x | If throughput per core is top priority and team accepts ecosystem shift | Constraint explicitly names Express; Fastify changes middleware conventions and roadmap complexity. | HIGH |
| Sequelize 6.37.7 | Prisma 6.x | If greenfield can change ORM and prefers schema-first DX | Constraint explicitly names Sequelize; switching ORM breaks requested deliverables and model style. | HIGH |
| PostgreSQL 17 | MySQL 8.4 | If org already standardized on MySQL tooling/ops | Postgres is stronger default for JSONB + complex relational queries + domain audit trails. | HIGH |
| `sequelize-cli` + migrations | `sequelize.sync()`-driven schema changes | Only for throwaway prototypes | Sync-based schema drift is risky for repeatable environments and auditability. | HIGH |

## What NOT to Use

| Avoid | Why | Use Instead | Confidence |
|-------|-----|-------------|------------|
| Node.js 18.x for new builds | EOL in 2025; shorter security runway for a new codebase | Node.js 22 LTS baseline (or 24 LTS for late-2025+ starts) | HIGH |
| Express 4.x on greenfield | Express 5 is default and reduces future migration work | Express 5.2.1 | HIGH |
| `@sequelize/core` 7 alpha in production | v7 remains pre-release (`alpha`), so API and behavior can shift | Sequelize 6.37.7 stable | HIGH |
| `sequelize.sync({ alter: true })` outside local prototyping | Non-deterministic schema evolution and poor rollback story | Versioned migrations (`sequelize-cli`/`umzug`) | HIGH |
| PostgreSQL `json` for queryable attributes | Slower processing and weaker indexing vs `jsonb` | PostgreSQL `jsonb` + GIN/expression indexes | HIGH |
| UUID generation via legacy app-only libraries by default | Extra dependency and inconsistent key strategy across services | PostgreSQL native UUID type/functions and/or `crypto.randomUUID()` | MEDIUM |

## Stack Patterns by Variant

**If MVP is local-network only (current milestone):**
- Use single Express service + single PostgreSQL container.
- Keep migrations explicit (manual `db:migrate` in startup docs) to avoid silent schema side effects.
- Prefer synchronous request/transaction flow; defer queues.

**If reminders/audit jobs become asynchronous:**
- Add `pg-boss@12.13.0` for Postgres-backed jobs.
- Keep job payloads small and idempotent; write audit events in same transaction boundary where possible.

## Version Compatibility

| Package A | Compatible With | Notes | Confidence |
|-----------|-----------------|-------|------------|
| Node.js 22.22.x | Express 5.2.1 | Express 5 is current default and widely deployed on current LTS Node lines. | HIGH |
| Node.js 22.22.x | `pg` 8.18.0 | node-postgres docs explicitly track support for Node 18/20/22/24. | HIGH |
| Sequelize 6.37.7 | `pg` 8.18.0 | Standard Sequelize+Postgres pairing for v6 production apps. | MEDIUM |
| PostgreSQL 17.x | Sequelize 6.37.7 | Supported in real-world usage; keep integration tests around enums/JSONB/indexes. | MEDIUM |

## Sources

- https://nodejs.org/en/about/previous-releases - Node release status/LTS guidance (HIGH)
- https://expressjs.com/ - Express 5.2.1 current and v5 default note (HIGH)
- https://expressjs.com/2025/03/31/v5-1-latest-release.html - Express v5 default + LTS direction (HIGH)
- https://sequelize.org/docs/v6/ - Sequelize v6 marked stable (HIGH)
- https://github.com/sequelize/sequelize/releases - v6 latest stable vs v7 alpha pre-release (HIGH)
- https://sequelize.org/docs/v6/other-topics/migrations/ - Sequelize migration/CLI guidance (HIGH)
- https://www.postgresql.org/support/versioning/ - Postgres supported majors and current minors (HIGH)
- https://www.postgresql.org/docs/current/datatype-json.html - `jsonb` performance/indexing rationale (HIGH)
- https://www.postgresql.org/docs/current/datatype-uuid.html - Native UUID type and generation support (HIGH)
- https://node-postgres.com/ - `pg` capabilities and Node compatibility statement (HIGH)
- npm registry versions checked via `npm view` on 2026-02-23 for all listed npm packages (MEDIUM)

---
*Stack research for: Household Asset & Commitment Tracker API*
*Researched: 2026-02-23*
