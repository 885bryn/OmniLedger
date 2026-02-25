# Pitfalls Research

**Domain:** Existing household ledger app upgrade (auth + RBAC, financial contract/occurrence refactor, smart timeline, soft-delete lifecycle)
**Researched:** 2026-02-25
**Confidence:** MEDIUM-HIGH

## Suggested Milestone Phases

1. **Phase A - Auth and authorization foundation:** identity, session/token flow, role model, ownership policy enforcement.
2. **Phase B - Financial model expand + compatibility:** introduce `FinancialItem` parent contracts and child occurrences without breaking old reads/writes.
3. **Phase C - Projection and timeline behavior:** recurrence projection, exceptions, timeline UX/read models.
4. **Phase D - Soft-delete and retention lifecycle:** reversible delete, restore, linked-record intercepts, 30-day purge.
5. **Phase E - Cutover hardening:** data backfill finalization, legacy endpoint retirement, monitoring and incident playbooks.

## Critical Pitfalls

### Pitfall 1: Auth added, but legacy ID-based endpoints still bypass ownership

**What goes wrong:**
Some old routes still trust path/body IDs and return or mutate another user's records (classic horizontal privilege escalation).

**Why it happens:**
Existing codebase often has direct repository calls (for example `findByPk(id)`) added before auth existed; teams secure new routes but miss old ones.

**How to avoid:**
Implement one mandatory server-side policy layer for every data access (`actor -> allowed scope -> query filter`), and require all repositories to accept scope criteria. Add negative integration tests that attempt cross-user UUID access on every route.

**Warning signs:**
Handlers resolving entities by bare ID without `user_id` predicate, "403 in UI but curl can still access" bugs, authorization checks only in controllers.

**Phase to address:**
Phase A (define and enforce deny-by-default ownership checks).

---

### Pitfall 2: Role-only RBAC creates "admin or nothing" behavior

**What goes wrong:**
Permissions become too coarse; either data is overexposed in admin-like roles or legitimate workflows are blocked for regular users.

**Why it happens:**
Teams model authorization as role checks only, ignoring object relationships (owner, linked asset, household boundary).

**How to avoid:**
Use RBAC + relationship rules: role decides capability class, object ownership decides record-level access. Encode a policy matrix and test it as a table-driven suite (`role x action x resource_owner`).

**Warning signs:**
Conditionals like `if (isAdmin) allowAll else deny`, repeated ad hoc exceptions in route handlers, frequent hotfixes for permission edge cases.

**Phase to address:**
Phase A (policy model) and Phase E (policy regression suite before cutover).

---

### Pitfall 3: Dual-write period causes ledger drift between legacy item rows and new contract/occurrence model

**What goes wrong:**
Totals diverge because writes land in old shape on some paths and new shape on others; timeline and balances disagree.

**Why it happens:**
Refactor is introduced in-place without explicit compatibility strategy (expand-migrate-contract), and clients are switched incrementally.

**How to avoid:**
Introduce new tables/columns first, write-through adapter with idempotency keys, and parity checks that compare old/new computed totals per asset. Keep read-path feature flags and only cut over when parity SLO is met.

**Warning signs:**
Different totals between old and new endpoints, manual one-off SQL corrections, inability to explain balance mismatches from audit trail.

**Phase to address:**
Phase B (expand + dual-write guardrails) and Phase E (final contract cutover).

---

### Pitfall 4: Recurrence projection is not idempotent, creating duplicate future occurrences

**What goes wrong:**
Background jobs or repeated API calls project the same future occurrences multiple times, inflating upcoming obligations and timeline noise.

**Why it happens:**
Projection engine lacks stable natural key (contract + due date + sequence/rrule fingerprint) and safe upsert rules.

**How to avoid:**
Define deterministic occurrence identity, enforce unique constraint on projected rows, and make projection job upsert-only. Add replay tests that run projection N times and assert constant row count.

**Warning signs:**
Occurrence count increases after rerunning projection, duplicate due dates for same contract, scheduler retries correlate with record spikes.

**Phase to address:**
Phase C (projection engine + uniqueness constraints).

---

### Pitfall 5: DST/timezone ambiguity shifts due dates in projected timeline

**What goes wrong:**
Monthly/weekly recurrences appear one day early/late around DST boundaries or when server/client timezones differ.

**Why it happens:**
Mixing local `timestamp without time zone` assumptions with UTC conversions and inconsistent recurrence library semantics.

**How to avoid:**
Store schedule intent as explicit timezone + local wall-clock rule, store occurrence instants as `timestamptz`, and use a single recurrence engine contract. Add timezone test vectors (DST start/end, leap day, month-end) in CI.

**Warning signs:**
"Due date moved overnight" reports, inconsistent results between local dev and Docker, date-only fields silently interpreted in server timezone.

**Phase to address:**
Phase C (time model + recurrence tests).

---

### Pitfall 6: Editing one projected occurrence accidentally mutates the parent contract rule

**What goes wrong:**
Single-instance adjustments (skip, amount tweak, reschedule) alter future schedule globally and corrupt expected recurrence behavior.

**Why it happens:**
Exception model is missing or under-specified; system treats all occurrence edits as parent updates.

**How to avoid:**
Separate parent rule updates from occurrence exceptions (`override`, `skip`, `detach`) with explicit commands and audit events. Enforce immutable occurrence lineage fields and exception precedence rules.

**Warning signs:**
User edits one date and multiple future dates change, unclear audit logs for whether parent vs child was changed, support cannot replay schedule state.

**Phase to address:**
Phase C (exception semantics and audit contract).

---

### Pitfall 7: Soft-delete hides rows but does not enforce relational lifecycle

**What goes wrong:**
Deleted parents still have active children, restore fails, and users see missing/ghost records in rollups.

**Why it happens:**
Paranoid delete is enabled per model, but cross-entity delete policy (restrict/cascade/archive) is not designed end-to-end.

**How to avoid:**
Define lifecycle matrix per relationship (contract -> occurrences, item -> events, item -> audit refs), require delete intercept checks, and implement deterministic restore ordering. Add integration tests for delete/restore graph integrity.

**Warning signs:**
Restore endpoint returning FK/conflict errors, orphan occurrences with soft-deleted parent, timeline showing children of deleted items.

**Phase to address:**
Phase D (lifecycle policy + delete intercept implementation).

---

### Pitfall 8: 30-day purge job hard-deletes records still needed for compliance or restore

**What goes wrong:**
Cleanup permanently removes data still referenced by audit/business workflows or racing with restore requests.

**Why it happens:**
Purge job keyed only on `deleted_at < now - 30 days`, without hold states, referential checks, or concurrency control.

**How to avoid:**
Implement purge eligibility state machine (`deleted`, `pending_purge`, `on_hold`, `purged`), run purge in small transactional batches with `SKIP LOCKED`, and keep immutable purge audit entries. Add chaos test with concurrent restore vs purge.

**Warning signs:**
Intermittent restore "not found" after being visible in trash, broken foreign keys in historical reports, cleanup job lock contention spikes.

**Phase to address:**
Phase D (purge mechanics) and Phase E (operational runbook + alerting).

---

### Pitfall 9: Timeline UX merges historical and projected rows without source semantics

**What goes wrong:**
Users cannot distinguish planned vs executed vs deleted states; edits happen on the wrong row type, causing trust loss.

**Why it happens:**
UI and API collapse multiple state machines into one list without explicit `entry_kind` and action affordance rules.

**How to avoid:**
Return normalized timeline entries with explicit source/status (`projected`, `scheduled`, `completed`, `deleted`, `restored`) and allowed actions per state. Add contract tests and UX acceptance scenarios for mixed-state timelines.

**Warning signs:**
Buttons disabled/enabled inconsistently across similar rows, user confusion between "upcoming" and "history", frequent support tickets on accidental edits.

**Phase to address:**
Phase C (timeline API shape) and Phase D (deleted/restored state surfacing).

---

### Pitfall 10: Partial migration deployment causes downtime due to locking/backfill pressure

**What goes wrong:**
DDL/backfill blocks hot tables; API latency spikes or writes fail during migration windows.

**Why it happens:**
Large schema/data changes are applied as one migration with full-table rewrites and no chunking or rehearsal.

**How to avoid:**
Use expand-migrate-contract, `NOT VALID` constraints where appropriate, chunked backfills, and rehearsal on production-like volume. Gate release on measured lock duration and rollback/cutover plan.

**Warning signs:**
Migration runtime unpredictability, long-running table locks, emergency manual SQL during rollout.

**Phase to address:**
Phase B (migration design) and Phase E (cutover rehearsal sign-off).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep using `x-user-id` as effective auth for old routes | Fast compatibility | Silent auth bypass and inconsistent trust model | Never once real auth ships |
| Compute timeline by merging raw arrays in Node | Fast implementation | Unstable ordering, poor pagination, CPU hotspots | Temporary for low-volume local testing only |
| Soft-delete without restore integration tests | Faster delivery | Trash becomes one-way delete in practice | Never |
| One-shot backfill SQL for all historical rows | Quick migration | Lock contention, hard rollback, data drift risk | Only on tiny datasets with verified downtime window |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Existing frontend actor switcher and new auth session | Keeping dual identity sources (`x-user-id` + JWT/session) active without precedence rules | Define one canonical actor source and reject mismatched headers/tokens in middleware |
| Sequelize paranoid models with legacy raw SQL | Assuming all queries respect soft-delete filters | Audit all raw queries and explicitly add `deleted_at` predicates or `paranoid` options as needed |
| Recurrence library integration | Assuming RFC behavior equals library behavior by default | Lock down recurrence semantics with golden tests and document known deviations |
| Migration scripts and running API | Deploying DDL that app code cannot tolerate mid-rollout | Use compatibility layers and feature flags so old and new code can run safely during transition |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Timeline query does per-item occurrence expansion in request path | p95 spikes on dashboard/timeline | Precompute/project occurrences asynchronously and query indexed materialized shape | Usually visible by 5k-20k occurrences |
| Missing partial indexes for active (non-deleted) rows | Trash-enabled queries get slower after soft-delete launch | Add partial indexes aligned to `deleted_at IS NULL` and timeline filters | Early, often within first month of retained deletes |
| Purge job scans full tables daily | Cleanup job slow, lock contention at night | Batch by indexed `deleted_at`, `LIMIT`, and lock-safe worker strategy | Breaks as soon as deleted rows reach high tens of thousands |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Authorization checks only in UI or route decorators | Direct API abuse and IDOR | Enforce server-side object-level policy in repository/service layer with deny-by-default |
| Admin all-data mode reused for support tooling without audit | Silent overreach and privacy exposure | Time-bound admin elevation, mandatory reason code, immutable audit trail |
| Tokens/sessions not invalidated on role change | Stale privileges remain active | Version auth context and force re-auth/token refresh on privilege updates |
| Exposing deleted records via debug/admin endpoints unintentionally | Data leakage beyond lifecycle intent | Separate privileged endpoints, strict scopes, and response DTO redaction |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Trash state not visible in timeline context | Users think data vanished | Show deleted/restored events in history with clear badges and timestamps |
| Recurrence exceptions hidden behind generic "edited" label | Users cannot trust future schedule | Display exception reason and parent/child linkage for changed occurrences |
| Upcoming vs historical split inconsistent across asset page and timeline | Perceived bugs and duplicate work | Use one shared timeline classification rule and expose it in API metadata |

## "Looks Done But Isn't" Checklist

- [ ] **Authorization:** Every read/write route has a failing cross-user test; verify no endpoint succeeds with guessed UUIDs from another user.
- [ ] **RBAC:** Permission matrix tests cover role x action x resource owner permutations; verify deny-by-default path.
- [ ] **Financial refactor:** Old and new read models are in parity for seeded historical data; verify dual-write idempotency under retries.
- [ ] **Recurrence:** Replaying projection job does not change row counts or duplicate keys; verify DST and month-end fixtures.
- [ ] **Timeline:** API returns explicit `entry_kind` and allowed actions; verify mixed projected/completed/deleted rendering.
- [ ] **Soft delete:** Delete intercept blocks unsafe graph deletes; verify restore order for parent/child records.
- [ ] **Retention purge:** Concurrent restore/purge test cannot lose restorable data; verify purge audit records are immutable.
- [ ] **Migration:** Rehearsal on production-like volume passes lock/latency thresholds; verify rollback and feature-flag cutback path.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cross-user data exposure via missed scope check | HIGH | Disable affected endpoints, rotate sessions/tokens, run access log impact analysis, patch policy layer, add regression tests |
| Ledger drift during dual-write migration | HIGH | Freeze mutating writes, run reconciliation job per contract, backfill canonical rows, replay missed events from audit log |
| Duplicate projected occurrences | MEDIUM | Deduplicate by deterministic key, rebuild projection window, add unique constraint + idempotent upsert |
| Broken restore/purge race | HIGH | Stop purge workers, recover from backups/audit snapshots, re-link dependent rows, deploy purge state-machine fix |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Legacy endpoints bypass ownership (IDOR) | Phase A | Automated negative tests fail for cross-user UUID access on all routes |
| Role-only RBAC over/under grants access | Phase A and Phase E | Policy matrix test suite passes and no ad hoc allowlist logic remains |
| Dual-write ledger drift in refactor | Phase B and Phase E | Old/new totals parity report remains within defined SLO before cutover |
| Non-idempotent recurrence projection duplicates rows | Phase C | Repeated projection replay test keeps occurrence count stable |
| DST/timezone due-date drift | Phase C | Timezone edge-case fixtures (DST, month-end, leap-day) pass in CI |
| Occurrence edit mutates parent schedule unintentionally | Phase C | Command tests prove single-instance exception does not alter parent rule |
| Soft-delete without lifecycle integrity | Phase D | Delete/restore graph tests maintain referential and visibility consistency |
| 30-day purge removes still-restorable data | Phase D and Phase E | Concurrent restore-vs-purge test and purge audit validation pass |
| Timeline conflates projected/historical/deleted states | Phase C and Phase D | Contract tests assert `entry_kind` + allowed actions for each state |
| Migration lock/backfill outages | Phase B and Phase E | Rehearsal metrics meet lock and latency budgets; rollback drill succeeds |

## Sources

- OWASP Authorization Cheat Sheet (deny-by-default, per-request object checks): https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- Sequelize transactions (atomic write workflows): https://sequelize.org/docs/v6/other-topics/transactions/
- Sequelize optimistic locking (concurrent edit conflict handling): https://sequelize.org/docs/v6/other-topics/optimistic-locking/
- Sequelize paranoid soft-delete behavior (query semantics, restore, `force` delete): https://sequelize.org/docs/v6/core-concepts/paranoid/
- Sequelize scopes (default scope behavior and override caveats): https://sequelize.org/docs/v6/other-topics/scopes/
- PostgreSQL row-level security (defense in depth for row isolation): https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- PostgreSQL partial indexes (active-row query performance with soft delete): https://www.postgresql.org/docs/current/indexes-partial.html
- PostgreSQL date/time and timezone behavior (UTC storage, timezone conversion semantics): https://www.postgresql.org/docs/current/datatype-datetime.html
- RFC 5545 iCalendar recurrence model (RRULE/EXDATE/recurrence baseline semantics): https://www.rfc-editor.org/rfc/rfc5545
- rrule.js docs (notable RFC behavior differences and timezone caveats): https://github.com/jkbrzt/rrule

---
*Pitfalls research for: HACT v2.0 auth, financial hierarchy, smart timeline, and delete lifecycle milestone*
*Researched: 2026-02-25*
