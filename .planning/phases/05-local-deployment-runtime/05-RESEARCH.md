# Phase 5: Local Deployment Runtime - Research

**Researched:** 2026-02-25
**Domain:** Docker Compose local runtime for Express + Sequelize + PostgreSQL with migration-on-boot and readiness signaling
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Compose service contract
- API default host port is `8080`.
- PostgreSQL default host port is `5433`.
- Compose uses fixed/predictable service names (for example, `api`, `db`).
- API is LAN-reachable by default (not localhost-only).

### Startup workflow UX
- Primary startup command is `docker compose up -d`.
- First boot auto-runs migrations.
- Canonical stop command is `docker compose down`.
- Documentation provides a single quickstart path.

### Env/config behavior
- Commit a `.env.example` with required variables and safe placeholders.
- Local developers copy `.env.example` to `.env`.
- Compose-provided environment values are the runtime source of truth.
- Docs explicitly list sensitive placeholders (DB password, JWT secret, etc.) even for local use.

### Readiness and failure signals
- Include healthchecks for both API and DB services.
- API should wait/retry until DB is ready (not fail-fast).
- Health verification guidance uses `docker compose ps` plus API health endpoint checks.
- Quickstart includes top 3 troubleshooting fixes: port conflicts, missing/invalid env values, delayed DB readiness.

### Claude's Discretion
- Exact healthcheck intervals/timeouts/retry counts.
- Exact env variable naming for compose-specific convenience vars when equivalent options exist.
- Exact wording/format of quickstart and troubleshooting sections.

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPL-01 | User can run API and PostgreSQL together with `docker-compose.yml` for local network hosting. | Compose architecture, migration-on-start pattern, healthcheck contract, env model, and quickstart/troubleshooting guidance below directly define implementation and verification for this runtime requirement. |
</phase_requirements>

## Summary

Phase 5 is primarily an operations/runtime integration phase, not a domain logic phase. The current codebase has ORM models, migrations, and API routes, but is missing deployment runtime primitives: there is no `docker-compose.yml`, no Docker image build/runtime definition, no API process entrypoint (`listen`), and no health endpoint. Planning should focus on closing those runtime gaps with a deterministic two-service Compose contract (`api`, `db`) and one quickstart flow.

The highest-risk implementation detail is migration-on-boot correctness against PostgreSQL. The repo's `src/db/config/config.cjs` defines only sqlite `development` and `test`, so naive `npx sequelize-cli db:migrate` in the API container will target sqlite, not Compose PostgreSQL. The safest phase-scoped strategy is to run migrations with an explicit URL (`npx sequelize-cli db:migrate --url "$DATABASE_URL"`) in API startup, with retry/backoff until DB is reachable.

A second planning hotspot is readiness behavior: Compose startup order alone is insufficient because containers can be running before services are actually ready. Use DB and API healthchecks plus API-side wait/retry so first boot is resilient. Keep verification and troubleshooting explicit in docs to satisfy DEPL-01 UX expectations.

**Primary recommendation:** Implement a single Compose workflow with `api` + `db`, explicit env contract via `.env.example`, API startup script that retries DB and runs `sequelize-cli db:migrate --url "$DATABASE_URL"` before starting the server, and healthchecks validated by `docker compose ps` plus API `/health`.

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|--------------|---------|---------|--------------|
| Docker Compose CLI | v2 (current stable plugin) | One-command local orchestration for API + DB | Official Compose flow supports dependency/health orchestration, service DNS, and `up`/`down` workflow required by locked decisions. |
| PostgreSQL Docker image | `postgres:17` (or pinned `17.x`) | Local runtime database service | Aligns with project PostgreSQL target and existing Sequelize models/migrations. |
| Node.js Docker image | `node:22` (or pinned `22.x` variant) | Runtime for existing Express/Sequelize code | Aligns with project stack baseline and package compatibility. |
| Sequelize CLI | `^6.6.2` (installed) | Migration execution during API boot | Existing project toolchain already configured via `.sequelizerc`; supports `db:migrate` and `--url` runtime targeting. |

### Supporting
| Library/Tool | Version | Purpose | When to Use |
|--------------|---------|---------|-------------|
| `pg_isready` (in postgres image) | bundled | DB healthcheck probe | Use as DB healthcheck command in Compose. |
| Docker healthcheck (`services.healthcheck`) | Compose spec | Service readiness signal | Use for both `db` and `api` to make status visible and scriptable. |
| `depends_on` long syntax with `condition: service_healthy` | Compose spec | Delay dependent creation until dependency healthy | Use to reduce startup race windows (while still keeping API retry logic). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| API startup migration command (`sequelize-cli db:migrate --url`) | Separate one-off `migrate` Compose service | Cleaner separation, but adds extra command path and weakens locked "single quickstart" expectation unless carefully wrapped. |
| API wait/retry loop + DB healthcheck | Rely only on `depends_on` | Simpler YAML, but less resilient to transient DB delays/restarts after startup. |
| Add postgres `production` block in `config.cjs` | Use CLI `--url` to bypass env/profile mismatch | Config block is valid but broader refactor; `--url` is phase-focused and directly documented by Sequelize CLI. |

**Installation:**
```bash
npm install
```

## Architecture Patterns

### Recommended Project Structure
```text
.
|- docker-compose.yml                 # NEW two-service local runtime (api, db)
|- Dockerfile                         # NEW API image build/runtime definition
|- .env.example                       # NEW committed env contract with placeholders
|- src/
|  |- api/
|  |  |- app.js                       # existing express app wiring
|  |  `- server.js                    # NEW process entrypoint (listen on 0.0.0.0)
|  |- scripts/
|  |  `- startup.js|startup.sh        # NEW wait/retry + migrate + start sequence
|  `- ...
`- README.md (or project docs path)   # NEW single quickstart + troubleshooting
```

### Pattern 1: Deterministic Compose Service Contract
**What:** Define fixed service names (`api`, `db`), fixed host ports (`8080`, `5433`), and stable container port mapping (`db` internal `5432`).
**When to use:** Entire phase runtime setup.
**Why:** Locked decisions require predictable service names, ports, and repeatable onboarding.

### Pattern 2: API Boot Sequence = Wait/Retry -> Migrate -> Start Server
**What:** API entrypoint script retries DB connection/migration command until success, then starts HTTP server.
**When to use:** Every `docker compose up -d` run.
**Why:** Compose can start containers before DB is truly ready; retry loop prevents fail-fast startup.

### Pattern 3: Explicit Runtime Env Contract
**What:** Commit `.env.example`; require local `.env`; pass env through Compose as source of truth.
**When to use:** All local runtime configuration.
**Why:** Locked decisions require explicit required variables and sensitive placeholders while keeping secrets out of git.

### Pattern 4: Health-Visible Runtime
**What:** Add DB healthcheck (`pg_isready`) and API healthcheck (`/health` endpoint), then verify using `docker compose ps` and HTTP check.
**When to use:** Startup verification and troubleshooting.
**Why:** Locked decisions explicitly require healthchecks plus operator-facing verification flow.

### Anti-Patterns to Avoid
- **Running API with no `listen` entrypoint:** container runs but no externally reachable API.
- **Relying on sqlite defaults during container migration:** creates false "migrated" success against wrong database target.
- **Binding API port to `127.0.0.1` in Compose:** violates LAN-reachable requirement.
- **Using `sequelize.sync()` for schema initialization:** bypasses migration history and deterministic schema state.
- **Skipping `.env.example` or omitting sensitive placeholders:** breaks onboarding and locked env-contract expectations.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service orchestration | Custom shell supervisor for multi-service lifecycle | Docker Compose (`docker compose up -d` / `down`) | Compose already provides dependency graph, networking, restart semantics, and operational UX. |
| DB readiness detection | Ad-hoc sleep timers only | `pg_isready` healthcheck + retry loop | Sleep-only approaches are flaky across machines and DB startup variance. |
| Schema bootstrapping | Custom SQL bootstrap scripts in startup | Existing Sequelize migrations via `sequelize-cli db:migrate` | Migrations are already project standard and preserve schema traceability. |
| Host-to-service discovery | Hardcoded container IPs | Compose service DNS names (`db`) | IPs are ephemeral; service names are stable by design. |

**Key insight:** This phase should compose existing application pieces into a reliable local runtime contract, not invent new infrastructure primitives.

## Common Pitfalls

### Pitfall 1: Migration target mismatch (sqlite vs postgres)
**What goes wrong:** Startup logs show migration success but schema is not present in Compose Postgres.
**Why it happens:** `src/db/config/config.cjs` `development` profile points to sqlite; migration command runs without explicit URL.
**How to avoid:** Run migration with explicit connection URL (`--url "$DATABASE_URL"`) or add a dedicated postgres profile and use it consistently.
**Warning signs:** API fails on missing tables while migration command exits zero.

### Pitfall 2: API starts before DB is ready
**What goes wrong:** API container exits/restarts repeatedly on first boot.
**Why it happens:** Compose starts containers in order but readiness lags actual DB availability unless health conditions + retries are used.
**How to avoid:** Combine DB healthcheck, `depends_on: condition: service_healthy`, and API retry loop before running migrations/server.
**Warning signs:** Connection refused/timeouts in early API logs right after `up -d`.

### Pitfall 3: LAN unreachable despite published port
**What goes wrong:** API works on host localhost but not from other devices.
**Why it happens:** App listens on loopback inside container or host port bound to localhost-only.
**How to avoid:** Ensure API server binds `0.0.0.0` and avoid localhost-only host binding in Compose.
**Warning signs:** `curl localhost:8080` works on host, but `http://<host-lan-ip>:8080` fails from another device.

### Pitfall 4: Healthcheck depends on unavailable tooling
**What goes wrong:** API healthcheck always unhealthy even though app responds.
**Why it happens:** Healthcheck uses `curl`/`wget` that is not installed in the chosen runtime image.
**How to avoid:** Install required probe tool in image or use a Node-based probe command.
**Warning signs:** Healthcheck command "not found" in container inspect/logs.

### Pitfall 5: `docker compose down` unexpectedly removes expected data
**What goes wrong:** Developers lose DB state between runs.
**Why it happens:** Using anonymous volumes or `down -v` without clear docs.
**How to avoid:** Use named volume for DB data and document difference between `down` and `down -v`.
**Warning signs:** Fresh empty database after routine restart.

## Code Examples

Verified patterns from official sources and current repo constraints:

### Compose dependency + DB healthcheck
```yaml
# Source: https://docs.docker.com/compose/how-tos/startup-order/
services:
  api:
    depends_on:
      db:
        condition: service_healthy
  db:
    image: postgres:17
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 12
```

### Migration-on-boot with explicit database URL
```bash
# Source: https://sequelize.org/docs/v6/other-topics/migrations/#configuration-connection-string
npx sequelize-cli db:migrate --url "$DATABASE_URL"
node src/api/server.js
```

### Compose network naming for service-to-service DB host
```env
# Source: https://docs.docker.com/compose/how-tos/networking/
DB_HOST=db
DB_PORT=5432
DB_NAME=hact_dev
DB_USER=postgres
DB_PASSWORD=change_me
```

### Canonical startup and stop commands
```bash
# Sources:
# - https://docs.docker.com/reference/cli/docker/compose/up/
# - https://docs.docker.com/reference/cli/docker/compose/down/
docker compose up -d
docker compose down
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Local sqlite-focused development defaults (`DB_DIALECT` fallback) | Containerized local runtime with PostgreSQL service and explicit runtime env | Phase 5 scope | Aligns local behavior with deployment requirement and reduces dialect drift risk. |
| Domain/API features validated mainly through test harness | End-to-end service runtime validation through Compose and healthchecks | Phase 5 scope | Adds operational confidence that stack actually boots together for users. |
| Manual ad-hoc environment setup | `.env.example` + documented copy-to-`.env` workflow | Phase 5 scope | Consistent onboarding and fewer configuration errors. |

**Deprecated/outdated:**
- Assuming startup order alone guarantees service readiness.
- Running migrations without explicit target in this repo's current config layout.

## Open Questions

1. **Where should the canonical quickstart live (new `README.md` vs existing docs path)?**
   - What we know: repo currently has no README, but locked decisions require one quickstart path.
   - What's unclear: preferred docs home for user-facing runtime instructions.
   - Recommendation: create root `README.md` with a short Phase 5 quickstart section and troubleshooting.

2. **API health endpoint depth: liveness-only or DB-readiness-aware?**
   - What we know: locked decisions require API health endpoint checks and API retry-until-DB-ready behavior.
   - What's unclear: whether `/health` should include DB check each request or only process liveness once startup succeeds.
   - Recommendation: return readiness-aware health (DB connectivity check) to keep `docker compose ps` + endpoint checks meaningful.

## Sources

### Primary (HIGH confidence)
- `package.json` - installed runtime/test dependencies and current scripts.
- `src/config/database.js` - runtime env vars, postgres/sqlite selection behavior, default host/port values.
- `src/db/config/config.cjs` - sequelize-cli env profiles (sqlite-only in `development`/`test`).
- `.sequelizerc` - sequelize-cli path wiring.
- `src/api/app.js` - current API wiring confirms no server listener and no health route.
- https://docs.docker.com/compose/how-tos/startup-order/ - readiness vs startup order, `depends_on` conditions, health-gated startup.
- https://docs.docker.com/reference/compose-file/services/#healthcheck - healthcheck syntax and behavior.
- https://docs.docker.com/compose/how-tos/networking/ - default network, service-name DNS, host vs container port semantics.
- https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/ - `environment`/`env_file` usage and precedence context.
- https://docs.docker.com/reference/cli/docker/compose/up/ - `up -d` behavior.
- https://docs.docker.com/reference/cli/docker/compose/down/ - `down` behavior and volume/network implications.
- https://sequelize.org/docs/v6/other-topics/migrations/ - migration commands and `--url` connection-string flow.

### Secondary (MEDIUM confidence)
- https://hub.docker.com/_/postgres - official image env variables and initialization behavior (`POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`).
- `.planning/REQUIREMENTS.md` - requirement DEPL-01 scope and local-network deployment boundary.
- `.planning/STATE.md` - project phase positioning and prior architectural decisions that affect runtime entrypoint expectations.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - driven by current repo dependencies plus official Docker/Sequelize docs.
- Architecture: HIGH - based on explicit locked decisions and concrete codebase gaps (missing compose/docker/server/health runtime pieces).
- Pitfalls: HIGH - directly derived from current config mismatch and official Compose readiness behavior.

**Research date:** 2026-02-25
**Valid until:** 2026-03-27
