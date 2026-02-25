# Household Asset & Commitment Tracker (HACT)

## What This Is

HACT is a full-stack household ledger app with a Node/Express/Sequelize API and a React web UI. It models owned assets (real estate and vehicles), linked commitments and income rows (recurring or one-time), and timeline events such as payments and maintenance. Users can switch actors, review dashboard/event queues, manage items end-to-end, and complete or undo event actions with audit history.

## Core Value

Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## Current State

- **Shipped version:** v1.0 MVP (2026-02-25)
- **Release scope:** 7 phases, 19 plans, and full backend + frontend household ledger workflows
- **Operational note:** Deferred manual verification debt remains for second-device LAN confirmation and selected UX sign-off checks

## Current Milestone: v2.0 Auth, Timeline & Data Lifecycle

**Goal:** Introduce secure multi-user operations, financial parent/occurrence modeling, timeline-driven workflows, and enterprise-grade data lifecycle controls.

**Target features:**
- Multi-user authentication with role-based access control, per-user data isolation, and admin all-data mode.
- Financial parent contract model (`FinancialItem`) with child event occurrence model, recurrence projection, and projection instantiation edits.
- Smart timeline and asset-view refactor for current/upcoming versus historical ledgers.
- Soft delete, restore/trash workflows, delete intercept for linked records, and 30-day hard cleanup.

## Requirements

### Validated

- ✓ Item creation endpoint supports `POST /items` with type-aware defaults and actionable validation feedback (ITEM-04) — Phase 2
- ✓ Node.js + Express + Sequelize + PostgreSQL API for household asset and commitment tracking is implemented and locally runnable — Phases 1-5
- ✓ Users, assets/items, events, and audit history are modeled with UUID keys and required relationships, including parent-child linkage — Phase 1
- ✓ Core net-status retrieval, event completion, and audit logging workflows are implemented with deterministic API contracts — Phases 3-4
- ✓ Local-network deployment via Docker Compose for API + PostgreSQL is implemented and documented — Phase 5
- ✓ Responsive bilingual frontend for dashboard/events/items journeys is implemented and wired to live API contracts — Phase 6

### Active

- [ ] Implement authentication, RBAC data scoping, and admin visibility controls.
- [ ] Refactor financial data model to parent contracts with child occurrences and recurrence/projection logic.
- [ ] Deliver smart timeline UX and asset financial section split (current/upcoming vs historical).
- [ ] Implement soft delete/restore lifecycle including delete intercept and 30-day cleanup automation.

### Out of Scope

- Authentication/session implementation details beyond user schema — not specified in this initialization scope.
- Production cloud deployment and CI/CD — current deployment requirement is local docker-compose hosting.

## Context

- Product is a greenfield API-first system named Household Asset & Commitment Tracker (HACT).
- Data model centers on `items` as a unified ledger object with typed metadata in `attributes` JSONB and self-references for linked commitments.
- Key domain categories include assets (`RealEstate`, `Vehicle`) and obligations/income (`FinancialCommitment`, `FinancialIncome`) with timeline events and history.
- Critical workflow behavior: completing non-recurring events must return `prompt_next_date: true` so clients can trigger follow-up scheduling UX.
- Deliverables explicitly requested: Sequelize model files, Express route controllers for specified business logic, and Docker setup.

## Constraints

- **Tech stack**: Node.js + Express + Sequelize + PostgreSQL — required to match requested implementation stack.
- **Data shape**: UUID keys, ENUMs, JSONB attributes, and self-referencing foreign keys — required for domain consistency and typed linkage.
- **Deployment**: Docker Compose for app + DB on local network — required for reproducible local hosting.
- **Scope**: API-first backend deliverables only — keeps initialization focused on core ledger behavior.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use `items` as the core ledger table with `type` enum and `attributes` JSONB | Supports both standardized and extensible fields per asset/commitment type without schema churn | — Pending |
| Use `parent_item_id` self-reference for commitment-to-asset linkage | Enables explicit ownership context (e.g., mortgage linked to property) and nested net-status responses | — Pending |
| Treat event completion as both state change and audit event | Preserves operational history and traceability for household actions | — Pending |
| Return `prompt_next_date: true` on completed non-recurring events | Encodes frontend interaction hint in API response for smooth follow-up workflow | — Pending |
| Use domain-level item creation defaults and validation taxonomy, then map to centralized HTTP 422 envelopes | Keeps business invariants transport-agnostic and provides deterministic client correction loops | Adopted in Phase 2 |
| Return canonical persisted item fields directly from create service and `POST /items` | Preserves stable API contract without derived relation payload drift | Adopted in Phase 2 |
| Build a responsive bilingual React shell around the API using a `/users`-driven actor context | Enables end-to-end household workflows while preserving deterministic API contracts and temporary `x-user-id` transport | Adopted in Phase 6 |
| Treat event undo as first-class workflow (`/events/:id/undo-complete`) that reverses totals and restores pending state | Prevents accidental completion drift and keeps financial rollups/audit history trustworthy | Adopted in Phase 6 |

---
*Last updated: 2026-02-25 after milestone v2.0 initialization*
