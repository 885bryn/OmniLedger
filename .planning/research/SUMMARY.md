# Project Research Summary

**Project:** Household Asset & Commitment Tracker (HACT)
**Domain:** Multi-user household asset and financial commitment ledger (v2.0 milestone)
**Researched:** 2026-02-25
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone is an architecture evolution of an existing ledger product, not a greenfield rewrite. Expert consensus across the research is to keep the current Node/Express/Sequelize/PostgreSQL monolith, then add secure identity, server-side authorization, a parent/occurrence financial model, bounded recurrence projection, and lifecycle controls (soft delete, restore, purge). The product should behave like an auditable operations system: deterministic policy decisions, predictable timeline state, and reversible user actions.

The strongest recommendation is dependency-first delivery: establish authenticated actor context and deny-by-default scoping before touching high-volume timeline features; introduce `FinancialItem` (contract) and `FinancialOccurrence` (instance) before timeline UX refactors; then activate lifecycle automation after restore and delete-intercept semantics are proven. This ordering avoids the two biggest failure classes: security bypass via legacy routes and data drift during dual-write migration.

Main risks are known and manageable: IDOR from leftover ID-based handlers, duplicate/misaligned recurrence due to weak idempotency/timezone handling, and destructive lifecycle races between restore and purge. Mitigation is explicit in research: centralized access-policy enforcement, deterministic occurrence keys with replay-safe projection tests, timezone fixtures in CI, and purge state-machine plus lock-safe batched jobs.

## Key Findings

### Recommended Stack

`STACK.md` recommends minimal-change, production-safe deltas that fit the current app shape rather than introducing new infrastructure.

**Core technologies:**
- `jsonwebtoken@9.0.3`: access/refresh token handling - replaces temporary `x-user-id` identity transport with standard bearer auth.
- `argon2@0.44.0`: password hashing - aligns with OWASP Argon2id guidance for secure credential storage.
- `rrule@2.8.1` + `luxon@3.7.2`: recurrence and timezone-safe date logic - reduces DST and projection math errors in 3-year windows.
- `pg-boss@12.13.0`: durable scheduled jobs - supports 30-day hard-delete cleanup and projection materialization on existing Postgres.
- Sequelize v6 paranoid/scopes (stay on latest v6 patch): soft-delete + owner/admin visibility model - native fit for trash/restore workflows.

**Critical version constraints:**
- Keep Sequelize on stable v6 (do not upgrade to v7 during this refactor).
- `pg-boss@12.13.0` expects Node `>=22.12` and PostgreSQL `>=13` (matches current environment).
- Apply `helmet@8.1.0` and `express-rate-limit@8.2.1` immediately when auth endpoints ship.

### Expected Features

`FEATURES.md` is clear that v2.0 acceptance depends on security and lifecycle trust, not just new screens.

**Must have (table stakes):**
- Real auth sessions and protected routes replacing actor header shim behavior.
- Backend-enforced RBAC with owner-scoped isolation and explicit, auditable admin bypass mode.
- Parent `FinancialItem` + child occurrence model with bounded recurrence projection (3-year horizon).
- Recurrence edit semantics (`this occurrence`, `this and following`, `entire series`).
- Unified timeline segmented by temporal state, plus soft-delete/restore/trash and 30-day automated purge.

**Should have (competitive):**
- Explainable authorization denials to reduce support churn.
- Persistent visual admin-mode indicator to prevent accidental cross-owner edits.
- Projection confidence states and decision lanes (upcoming/due soon/overdue/history) for timeline clarity.

**Defer (v2.1+):**
- Granular custom role matrices beyond admin/standard.
- Advanced restore conflict assistant.
- Bulk timeline operations and policy-heavy retention/legal-hold customization.

### Architecture Approach

`ARCHITECTURE.md` recommends a policy-first modular monolith. Identity is resolved once in middleware into `actorContext`; domain services enforce shared `access-policy`; timeline read model merges projected and actual data; lifecycle logic is explicit and scheduler-driven.

**Major components:**
1. API middleware and routes - authenticate request, authorize scope, expose auth/timeline/lifecycle endpoints.
2. Domain services - `security`, `financial-contracts`, `occurrences`, `timeline`, and `lifecycle` each own one business concern.
3. Persistence and jobs - additive migrations for new models/lifecycle columns plus scheduled cleanup job with advisory-lock singleton behavior.

### Critical Pitfalls

`PITFALLS.md` identifies recurring failure modes that should directly drive roadmap gates:

1. **Legacy endpoint scope bypass (IDOR):** old ID-based handlers remain reachable - prevent by enforcing one mandatory policy layer and negative cross-user tests on every route.
2. **Dual-write ledger drift during model migration:** old/new write paths diverge - prevent with expand-migrate-contract sequencing, idempotent write-through adapters, and parity SLO checks before cutover.
3. **Non-idempotent recurrence projection:** retries create duplicate future rows - prevent with deterministic occurrence keys, uniqueness constraints, and replay tests.
4. **Timezone/DST recurrence drift:** due dates move unexpectedly - prevent with explicit timezone intent, `timestamptz` storage, and DST/leap/month-end fixtures.
5. **Restore/purge lifecycle races:** 30-day purge removes still-restorable data - prevent with purge eligibility states, batched `SKIP LOCKED` execution, and concurrent restore-vs-purge tests.

## Implications for Roadmap

Based on all four research outputs, the roadmap should use five dependency-locked phases.

### Phase 1: Identity and Policy Foundation
**Rationale:** Every later feature depends on trusted actor context and deny-by-default data scope.
**Delivers:** Auth/session endpoints, token validation, role model, `actorContext`, shared access-policy, route-level scope middleware.
**Addresses:** Auth, RBAC, owner isolation, admin bypass preconditions.
**Avoids:** Pitfall 1 (scope bypass), Pitfall 2 (coarse role-only checks).

### Phase 2: Financial Model Expansion with Compatibility Guardrails
**Rationale:** Timeline and recurrence are unreliable until contract/occurrence entities exist and legacy parity is maintained.
**Delivers:** `FinancialItem` and `FinancialOccurrence` schema/services, additive migrations/backfill, dual-write compatibility layer, parity reports.
**Addresses:** Parent/occurrence feature baseline and migration safety.
**Uses:** Sequelize v6 migrations/scopes and Postgres indexing strategy.
**Avoids:** Pitfall 3 (ledger drift), Pitfall 10 (migration lock pressure).

### Phase 3: Projection Engine and Timeline Behavior
**Rationale:** Only after policy and data shape are stable should the 3-year timeline be composed and exposed.
**Delivers:** `rrule` + `luxon` projection service, lazy instantiation flow, timeline API/read model, series edit semantics, timeline state labels.
**Addresses:** Smart timeline and recurrence workflows.
**Implements:** `domain/timeline`, `domain/occurrences`, `api/routes/timeline.routes.js`.
**Avoids:** Pitfall 4 (duplicate projection), Pitfall 5 (timezone drift), Pitfall 6 and 9 (state/exception ambiguity).

### Phase 4: Lifecycle Controls and Retention Automation
**Rationale:** Delete behavior must be safe and reversible before hard cleanup is enabled.
**Delivers:** Delete intercepts, trash/restore endpoints, explicit lifecycle columns, purge state machine, scheduled 30-day cleanup job.
**Addresses:** Soft delete, restore, linked-record protections, retention requirements.
**Uses:** Sequelize paranoid/lifecycle scopes + `pg-boss` scheduler.
**Avoids:** Pitfall 7 (graph inconsistency), Pitfall 8 (premature destructive purge).

### Phase 5: Cutover Hardening and Legacy Retirement
**Rationale:** Production cutover should happen only after parity, policy, and lifecycle tests pass under realistic load.
**Delivers:** Feature-flag cutover, legacy endpoint removal, policy regression suite, replay/chaos tests, observability and incident playbooks.
**Addresses:** Stability and confidence to deprecate transitional compatibility paths.
**Avoids:** Regressions across all prior pitfalls during final switch-over.

### Phase Ordering Rationale

- Auth and policy first because every repository query and mutation requires trusted scope.
- Financial contract/occurrence split before timeline because projection quality depends on canonical model boundaries.
- Lifecycle automation after restore semantics because purge without lifecycle integrity is irreversible risk.
- Hardening last to validate parity and operational safety before retiring legacy paths.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Backfill and dual-write strategy at production-like volume (lock budgets, chunking, rollback envelopes).
- **Phase 3:** Recurrence semantics edge cases (`this and following` splits, timezone intent contract, projection/read performance budgets).
- **Phase 4:** Purge eligibility policy (holds, legal/audit constraints) and restore-vs-purge concurrency behavior.

Phases with standard patterns (skip extra research-phase):
- **Phase 1:** JWT auth middleware, RBAC scope middleware, and rate-limited auth endpoints are well documented.
- **Phase 5:** Regression test gating, feature-flag cutover, and monitoring runbooks follow established delivery practices.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Strong official-source backing (Express, Sequelize, OWASP, Postgres) and version checks completed. |
| Features | MEDIUM | Core feature dependencies are clear, but some differentiators are benchmarked from product behavior and need real-user validation. |
| Architecture | MEDIUM | Recommended patterns align with codebase structure, but full performance impact depends on implementation details. |
| Pitfalls | MEDIUM-HIGH | Risks are concrete, phase-mapped, and testable; residual uncertainty is mostly operational execution quality. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Define canonical admin-mode UX and audit requirements (reason codes, timeout, visibility boundaries) before Phase 1 implementation completes.
- Finalize recurrence exception contract (`override`, `skip`, `detach`) and timeline DTO action rules before Phase 3 API freeze.
- Set measurable SLOs for parity, query latency, and purge throughput before Phase 5 cutover sign-off.
- Confirm compliance/data-retention constraints that may require `on_hold` purge states beyond default 30-day policy.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md`, `.planning/research/FEATURES.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md`, `.planning/PROJECT.md` - direct milestone-aligned synthesis inputs.
- Sequelize docs (paranoid, scopes, transactions): https://sequelize.org/docs/v6/core-concepts/paranoid/ ; https://sequelize.org/docs/v6/other-topics/scopes/ ; https://sequelize.org/docs/v6/other-topics/transactions/
- PostgreSQL docs (RLS, partial indexes, datetime, advisory locks): https://www.postgresql.org/docs/current/ddl-rowsecurity.html ; https://www.postgresql.org/docs/current/indexes-partial.html ; https://www.postgresql.org/docs/current/datatype-datetime.html ; https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS
- Express and Helmet security guidance: https://expressjs.com/en/advanced/best-practice-security.html ; https://helmetjs.github.io/
- OWASP authorization/password guidance: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html ; https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### Secondary (MEDIUM confidence)
- RFC references and library docs for recurrence/JWT semantics: https://www.rfc-editor.org/rfc/rfc5545 ; https://www.rfc-editor.org/rfc/rfc7519 ; https://github.com/jkbrzt/rrule ; https://www.npmjs.com/package/jsonwebtoken ; https://www.npmjs.com/package/pg-boss
- Product-behavior comparators (calendar/trash lifecycle patterns): https://developers.google.com/calendar/api/guides/recurringevents ; https://support.google.com/calendar/answer/37115 ; https://support.google.com/drive/answer/2375102 ; https://support.google.com/mail/answer/7401 ; https://docs.github.com/en/repositories/creating-and-managing-repositories/restoring-a-deleted-repository

### Tertiary (LOW confidence)
- Product marketing references for finance UX positioning: https://www.quicken.com/products/simplifi/ (directional only).

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
