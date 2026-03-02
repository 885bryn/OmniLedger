# Milestones

## v1.0 MVP (Shipped: 2026-02-25)

**Phases completed:** 7 phases, 19 plans, 50 tasks

**Key accomplishments:**
- Established the full backend domain and API contract for users, items, events, net-status, completion, and audit history.
- Delivered local runtime operations with Docker Compose, migration-on-boot startup, and readiness health checks.
- Shipped a responsive bilingual frontend for dashboard, events, and complete item journeys.
- Closed milestone integration gaps by wiring actor-switch cache refresh and `prompt_next_date` follow-up UX behavior.
- Backfilled missing phase verification artifacts and consolidated milestone audit traceability for v1.0 closure.

**Known deferred checks:**
- Second-device LAN curl verification for Phase 05.
- Responsive shell/journey manual sign-off for Phase 06.
- Completion/follow-up confirm UX clarity sign-off for Phase 06.

---

## v2.0 Auth, Timeline & Data Lifecycle (Shipped: 2026-03-02)

**Phases completed:** 6 phases (8-13), 31 plans, 62 tasks

**Key accomplishments:**
- Replaced client actor shims with session-authenticated routes and protected frontend navigation.
- Enforced RBAC scope with admin all-data/lens controls and persistent safety attribution signals.
- Refactored financial modeling into FinancialItem parent contracts plus child Event occurrences with projection materialization.
- Delivered 3-year deterministic projected/persisted timeline behavior and split asset ledger views.
- Integrated deletion lifecycle scope via Phase 11 extension and tracked merge acceptance with explicit lifecycle notes.
- Closed admin cross-owner mutation and drill-through consistency gaps in Phase 13 with backend+frontend regressions.

**Known deferred checks / debt:**
- Item detail ledger invalidation continuity after event mutation (`itemLedger` refresh path).
- Human UX sign-off debt in Phases 10 and 11.
- Deferred second-device LAN verification.

---
