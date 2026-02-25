# Roadmap: Household Asset & Commitment Tracker (HACT) API

## Overview

This roadmap delivers HACT as a usable backend ledger in dependency order: first establish correct Sequelize/PostgreSQL domain models, then expose core item workflows, then add net-status visibility, then complete event lifecycle auditing semantics, and finally package everything for local-network runtime with Docker Compose.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Domain Model Foundation** - Establish persistent account, item, event, and audit models with required ledger relationships.
- [x] **Phase 2: Item Creation Workflow** - Deliver `POST /items` with type-aware default attributes for consistent item onboarding. (completed 2026-02-24)
- [x] **Phase 3: Net-Status Retrieval** - Deliver nested commitment visibility through `GET /items/:id/net-status`. (completed 2026-02-25)
- [x] **Phase 4: Event Completion and Audit Traceability** - Complete event lifecycle behavior including completion status, audit writes, and next-date prompting. (completed 2026-02-25)
- [x] **Phase 5: Local Deployment Runtime** - Run API and PostgreSQL together via Docker Compose on the local network. (completed 2026-02-25)

## Phase Details

### Phase 1: Domain Model Foundation
**Goal**: Users can persist the core ledger domain with UUID-backed accounts, items, events, and audit records, including parent-child commitment linkage.
**Depends on**: Nothing (first phase)
**Requirements**: ACCT-01, ITEM-01, ITEM-02, ITEM-03, EVNT-01, DEPL-02
**Success Criteria** (what must be TRUE):
  1. User account records can be created and stored with UUID id, username, email, and password hash.
  2. Users can persist items of types `RealEstate`, `Vehicle`, `FinancialCommitment`, and `Subscription` with JSONB `attributes`.
  3. Users can link `FinancialCommitment` items to parent assets via `parent_item_id` and later retrieve that relationship from stored data.
  4. Users can persist item timeline events including type, due date, amount, status, and recurrence flag.
  5. API runtime uses Sequelize models for `Users`, `Items`, `Events`, and `AuditLog` against PostgreSQL.
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md - Create migration and model invariants for Users and Items with strict parent-child linkage.
- [x] 01-02-PLAN.md - Add Events and AuditLog persistence contracts plus event/audit domain validation tests.
- [x] 01-03-PLAN.md - Wire Sequelize runtime bootstrap and verify model registration against PostgreSQL.

### Phase 2: Item Creation Workflow
**Goal**: Users can create ledger items through the API without manually supplying every type-specific field.
**Depends on**: Phase 1
**Requirements**: ITEM-04
**Success Criteria** (what must be TRUE):
  1. User can create an item through `POST /items` and receive a successful response with persisted item data.
  2. Created item responses include default attribute keys auto-populated according to the submitted item type.
**Plans**: 2 plans
Plans:
- [x] 02-01-PLAN.md - Implement domain item-create defaults, parent validation, and canonical persistence output.
- [x] 02-02-PLAN.md - Expose POST /items with centralized error mapping and endpoint integration coverage.

### Phase 3: Net-Status Retrieval
**Goal**: Users can inspect an asset and its linked commitments in one net-status response.
**Depends on**: Phase 2
**Requirements**: ITEM-05
**Success Criteria** (what must be TRUE):
  1. User can request `GET /items/:id/net-status` and receive the target item with its current attributes.
  2. Net-status response includes nested linked child commitments associated with the requested item.
**Plans**: 2 plans
Plans:
- [x] 03-01-PLAN.md - Implement net-status domain retrieval with ownership/type guards, deterministic child ordering, and summary aggregation.
- [x] 03-02-PLAN.md - Expose GET /items/:id/net-status with centralized error mapping and endpoint integration tests.

### Phase 4: Event Completion and Audit Traceability
**Goal**: Users can complete events with deterministic follow-up signaling and auditable change history.
**Depends on**: Phase 3
**Requirements**: EVNT-02, EVNT-03, AUDT-01
**Success Criteria** (what must be TRUE):
  1. User can complete an event via `PATCH /events/:id/complete`, and the event status is persisted as `Completed`.
  2. When a completed event is non-recurring, completion response includes `prompt_next_date: true`.
  3. Completing an event records an `AuditLog` entry with user id, action, and timestamp.
**Plans**: 2 plans
Plans:
- [x] 04-01-PLAN.md - Implement transactional event-completion domain service with idempotent audit writes and prompt signaling rules.
- [x] 04-02-PLAN.md - Expose PATCH /events/:id/complete with centralized error mapping and endpoint integration coverage.

### Phase 5: Local Deployment Runtime
**Goal**: Users can run the full API stack locally with one Compose workflow.
**Depends on**: Phase 4
**Requirements**: DEPL-01
**Success Criteria** (what must be TRUE):
  1. User can start API and PostgreSQL together through `docker-compose.yml`.
  2. Services are reachable on the local network after compose startup.
**Plans**: 2 plans
Plans:
- [x] 05-01-PLAN.md - Add API runtime boot primitives (server entrypoint, DB-aware startup retry/migrate, readiness health endpoint).
- [x] 05-02-PLAN.md - Deliver Docker Compose stack, env template, and single-path quickstart/troubleshooting docs for local-network runtime.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Domain Model Foundation | 3/3 | Complete | 2026-02-24 |
| 2. Item Creation Workflow | 2/2 | Complete   | 2026-02-24 |
| 3. Net-Status Retrieval | 2/2 | Complete | 2026-02-25 |
| 4. Event Completion and Audit Traceability | 2/2 | Complete   | 2026-02-25 |
| 5. Local Deployment Runtime | 2/2 | Complete | 2026-02-25 |
| 6. Full Frontend UI Stack | 1/6 | In Progress | |

### Phase 6: 6

**Goal:** Users can manage household assets, linked commitments, and event completion workflows from a responsive bilingual web UI connected to the HACT API.
**Depends on:** Phase 5
**Requirements:** None listed for this inserted UX phase
**Plans:** 6 plans

Plans:
- [x] 06-01-PLAN.md - Implement item/events domain query and mutation services plus deterministic domain regression coverage.
- [ ] 06-02-PLAN.md - Expose expanded items/events/users HTTP contracts with centralized error mapping and API integration tests.
- [ ] 06-03-PLAN.md - Bootstrap frontend workspace/runtime baseline (React + Vite + Tailwind/shadcn-compatible config), frontend entrypoint, and documented build/start commands.
- [ ] 06-04-PLAN.md - Implement app shell/routing/providers plus explicit `/users`-backed persisted user switcher, `x-user-id` API client plumbing, and bilingual runtime language switching.
- [ ] 06-05-PLAN.md - Deliver dashboard and events journeys with due-first grouping, inline completion refresh, and follow-up modal branching.
- [ ] 06-06-PLAN.md - Deliver items list/detail/create/edit/delete/activity workflows with safeguards and bilingual journey tests.
