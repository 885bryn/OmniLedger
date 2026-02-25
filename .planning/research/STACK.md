# Stack Research

**Domain:** Stack deltas for HACT v2.0 milestone (auth/RBAC, financial hierarchy + recurrence, smart timeline, soft delete lifecycle)
**Researched:** 2026-02-25
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `jsonwebtoken` | 9.0.3 | Access/refresh token signing + verification | Fits current Express API style and lets you move off temporary `x-user-id` transport with minimal architecture churn. |
| `argon2` | 0.44.0 | Password hashing (`argon2id`) | OWASP recommends Argon2id for password storage; this package supports Argon2id and Node 18+ with prebuilt binaries. |
| `rrule` | 2.8.1 | Recurrence rule parsing/generation for projected occurrences | Encodes recurrence behavior explicitly (FREQ/INTERVAL/BYDAY/COUNT/UNTIL), which is safer than ad hoc date math in services. |
| `luxon` | 3.7.2 | Timezone-safe date math for 3-year timeline windows and recurrence boundaries | Reduces DST/offset bugs in projection and UI grouping compared with native `Date` arithmetic. |
| `pg-boss` | 12.13.0 | Durable background jobs for 30-day hard-delete cleanup and projection materialization | Uses existing PostgreSQL infra, supports cron scheduling, retries, and exactly-once semantics without adding Redis. |
| Sequelize v6 paranoid + scopes (existing `sequelize`) | 6.37.x (stay on latest v6 patch) | Soft-delete + owner/admin visibility model | Native paranoid semantics (`deletedAt`, `restore`) and scopes line up with restore/trash workflows and owner-scoped reads. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `helmet` | 8.1.0 | Security headers | Required once auth is introduced; apply globally in `src/api/app.js`. |
| `express-rate-limit` | 8.2.1 | Brute-force/throttle controls | Required on `/auth/login`, `/auth/refresh`, and reset endpoints if added. |
| `pino` + `pino-http` | 10.3.1 / 11.0.0 | Structured security/audit logging | Optional but strongly recommended for auth events, restore/hard-delete jobs, and admin bypass traceability. |
| `@tanstack/react-virtual` | 3.13.19 | Virtualized rendering for long timeline lists | Optional for frontend if 3-year timeline causes client render lag on lower-end devices. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `sequelize-cli` (existing) | Schema/migration management | Keep migration-first flow for new auth/RBAC, financial hierarchy, and soft-delete columns. |
| Job worker bootstrap in `src/scripts/startup.js` | Start/stop background workers with API runtime | Keep worker registration centralized so local Docker behavior matches milestone behavior. |

## Required vs Optional Deltas

**Required now (milestone scope):**
- `jsonwebtoken`, `argon2`, `rrule`, `luxon`, `pg-boss`, `helmet`, `express-rate-limit`.
- Sequelize model/migration changes for paranoid soft delete, owner scope, admin bypass queries, and financial parent/occurrence schema.

**Optional now (add only if needed):**
- `pino` + `pino-http` for richer auditability.
- `@tanstack/react-virtual` for timeline performance if real datasets show UI jank.

## Integration Points (Current Architecture)

- `src/api/app.js`: add `helmet()` and auth rate limiters; keep CORS header allow-list synchronized with `Authorization` header.
- `src/api/routes/items.routes.js` and `src/api/routes/events.routes.js`: replace `x-user-id` reads with auth middleware context (e.g., `req.auth.userId`, `req.auth.role`).
- `src/db/models/user.model.js`: add role field(s), password policy metadata as needed, and token/session revocation relation if refresh tokens are persisted.
- `src/db/models/item.model.js` and `src/db/models/event.model.js`: enable `paranoid: true`, add owner/admin scopes, and support parent FinancialItem + child occurrence relations.
- `src/domain/events/*` and new recurrence services: use `rrule` + `luxon` for projection, instantiation edits, and deterministic timeline slicing.
- `src/scripts/startup.js`: initialize `pg-boss`, register cleanup/materialization workers, and ensure graceful shutdown.

## Migration Impact

- Add auth schema: roles, token/session storage (if using refresh-token rotation), and indexes for login lookups.
- Refactor financial data shape: parent FinancialItem table/model semantics + child Event occurrence records; backfill existing one-off/recurring events.
- Add soft-delete columns/indexes (`deleted_at`) and partial indexes for hot queries (active rows vs deleted rows).
- Add job tables managed by `pg-boss` in Postgres and seed schedules for 30-day hard cleanup.
- Update API contracts: swap actor header model (`x-user-id`) to bearer token auth, preserving admin all-data behavior explicitly.

## Security Defaults (Set Immediately)

- Access token short TTL (for example 10-15 min), refresh token rotation, and server-side revocation on logout/password change.
- Pin JWT verification algorithms explicitly and validate `iss`/`aud`/`exp`; never accept `alg` from client input.
- Hash passwords with `argon2id` and tuned cost params; rehash on login when params change.
- Apply IP + account-aware throttling for auth endpoints (`express-rate-limit`).
- Default all data reads to owner scope; admin bypass must be explicit and auditable in logs.

## Installation

```bash
# Required additions
npm install jsonwebtoken@9.0.3 argon2@0.44.0 rrule@2.8.1 luxon@3.7.2 pg-boss@12.13.0 helmet@8.1.0 express-rate-limit@8.2.1

# Optional additions
npm install pino@10.3.1 pino-http@11.0.0
npm install --prefix frontend @tanstack/react-virtual@3.13.19
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `argon2` | Node `crypto.scrypt` (built-in) | Use if native addon constraints block `argon2` in a specific runtime image; still memory-hard and avoids extra dependency. |
| `pg-boss` | `node-cron` + direct SQL deletes | Use only for single-process dev setups where missed jobs/retries are acceptable. |
| Service-level owner scopes in Sequelize | PostgreSQL RLS policies | Use RLS later when you need DB-enforced tenant isolation across multiple services/reporting paths. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Redis/BullMQ for this milestone | Adds new infra solely for cleanup/projection jobs; current stack already has PostgreSQL and Node 22. | `pg-boss` on existing Postgres. |
| External IdP/OAuth platform right now (Auth0/Keycloak/etc.) | Over-scopes milestone and introduces tenant/app registration overhead before core auth+RBAC stabilizes. | Local JWT auth with strong defaults; revisit SSO later. |
| Policy engine frameworks (CASL/Oso) for initial RBAC | Current requirements are simple (`owner` scope + `admin` bypass); policy engine adds indirection early. | Explicit role checks + query scopes. |
| Ad hoc recurrence math with native `Date` only | High DST/timezone bug risk in 3-year timeline projection and instantiation edits. | `rrule` + `luxon`. |
| Sequelize v7 alpha migration now | v7 is not the stable line; avoid concurrent ORM-upgrade risk during domain refactor. | Stay on latest Sequelize v6 patch. |

## Stack Patterns by Variant

**If timeline density remains moderate (<~5k visible rows per view):**
- Keep current React rendering model.
- Use backend paging/windowed endpoints only.

**If timeline density is high (multi-year, many occurrences per asset):**
- Add `@tanstack/react-virtual` in frontend lists.
- Keep backend projection windowed and indexed by owner/date/deleted status.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `pg-boss@12.13.0` | Node `>=22.12`, PostgreSQL `>=13` | Matches current Docker image (`node:22`) and Postgres 17 compose setup. |
| `argon2@0.44.0` | Node `>=18` | Compatible with current Node 22 runtime; includes prebuilt binaries for common OS targets. |
| `jsonwebtoken@9.0.3` | Node/Express current majors | Stable and widely adopted for bearer token flows. |
| Sequelize v6 paranoid/scopes | PostgreSQL current versions | Supports soft-delete and scoped querying without stack switch. |

## Sources

- https://sequelize.org/docs/v6/core-concepts/paranoid/ - paranoid soft-delete + restore semantics (HIGH)
- https://sequelize.org/docs/v6/other-topics/scopes/ - default/override scopes for owner/admin visibility (HIGH)
- https://expressjs.com/en/advanced/best-practice-security.html - Express security baseline, Helmet and brute-force mitigation guidance (HIGH)
- https://helmetjs.github.io/ - default security headers and config behavior (HIGH)
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html - Argon2id recommendation and tuning guidance (HIGH)
- https://www.npmjs.com/package/argon2 - Node package behavior, Argon2id default, Node support (MEDIUM)
- https://www.npmjs.com/package/jsonwebtoken - JWT implementation details and verification options (MEDIUM)
- https://www.rfc-editor.org/rfc/rfc7519 - JWT claim and validation standard (HIGH)
- https://www.npmjs.com/package/pg-boss - Postgres-backed queue features, requirements, scheduling/retries (MEDIUM)
- https://github.com/jkbrzt/rrule - RFC 5545 recurrence support and timezone caveats (MEDIUM)
- https://www.postgresql.org/docs/current/indexes-partial.html - partial index patterns for active/deleted query performance (HIGH)
- https://www.postgresql.org/docs/current/ddl-rowsecurity.html - RLS capability/tradeoff reference for later phase consideration (HIGH)
- npm versions verified via `npm view` on 2026-02-25: `jsonwebtoken`, `argon2`, `helmet`, `express-rate-limit`, `rrule`, `luxon`, `pg-boss`, `@tanstack/react-virtual`, `pino`, `pino-http` (HIGH)

---
*Stack research for: HACT v2.0 milestone stack deltas*
*Researched: 2026-02-25*
