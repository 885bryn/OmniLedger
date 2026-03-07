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

## v3.0 Data Portability (Shipped: 2026-03-04)

**Phases completed:** 5 phases (14-18), 11 plans, 30 tasks

**Key accomplishments:**
- Delivered a full scope-authoritative export pipeline from app trigger to binary `.xlsx` download with owner/all/lens enforcement.
- Added deterministic workbook modeling across `Assets`, `Financial Contracts`, and `Event History` with stable relationship references.
- Hardened workbook safety/usability defaults with formula sanitization, deterministic date policy/fallback, and freeze/filter defaults.
- Shipped resilient export UX states with pending lock, long-running hint, dual success confirmation, and actionable failure recovery.
- Added export audit traceability and surfaced actor/lens-attributed export outcomes in the existing activity timeline.

**Known deferred checks / debt:**
- Low-risk timeline-noise risk at high export volume because global export events are merged into per-item activity feed.

---

## v4.0 Interactive Production Deployment for Ugreen NAS (Shipped: 2026-03-07)

**Delivered:** Environment-driven NAS production deployment with deterministic Portainer operations, image publish/deploy contracts, and operator runbook closure.

**Phases completed:** 5 phases (19-23), 10 plans, 27 tasks

**Key accomplishments:**
- Externalized production network, identity, and DB configuration with startup fail-fast validation and deterministic diagnostics.
- Shipped backend/frontend production container contracts with strict NAS-driven gateway routing behavior.
- Delivered Portainer-ready three-service stack wiring with GHCR publish/pull deployment flow and NAS persistence mapping.
- Published a single operator deployment runbook with explicit env-variable contract, first-time/update/rollback procedures, and gate-based verification.
- Closed DOCS-01 audit blocker by aligning backend-direct runbook commands to live backend route mounts and re-verifying milestone closure.

**Stats:**
- 62 files changed in milestone commit range (`08c757f` -> `5ac6e67`)
- 59 commits in milestone execution range
- 5 phases, 10 plans, 27 tasks
- Timeline: 2026-03-04 to 2026-03-06 (~2 days)

**Known deferred checks / debt:**
- Runtime/container/browser verification remains human-needed for phases 20-21 in live NAS Docker environment.
- Live operator drills remain human-needed for phases 22-23 to fully close runtime confidence.
- `API_URL` contract surface should be clarified/reduced to avoid compose/runbook ambiguity.

**Git range:** `08c757f` -> `5ac6e67`

**What's next:** Start next milestone discovery and define fresh requirements/roadmap with `/gsd-new-milestone`.

---
