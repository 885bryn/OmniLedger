# Household Asset & Commitment Tracker (HACT) API

## What This Is

HACT is a backend API for tracking household assets and related financial commitments in one connected ledger. It models owned assets (like real estate and vehicles), recurring and one-time commitments linked to those assets, and timeline events such as payments and maintenance. It is built for users who want a single operational record of what they own, what they owe, and what needs action next.

## Core Value

Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## Requirements

### Validated

- ✓ Item creation endpoint supports `POST /items` with type-aware defaults and actionable validation feedback (ITEM-04) — Phase 2

### Active

- [ ] Implement a Node.js + Express + Sequelize + PostgreSQL API for household asset and commitment tracking.
- [ ] Model users, assets/items, events, and audit history with UUID keys and required relationships, including parent-child item linkage.
- [ ] Implement core endpoints for net-status retrieval with nested child commitments, and event completion with audit logging and frontend prompt hinting.
- [ ] Provide local-network development deployment using Docker Compose for API + PostgreSQL.

### Out of Scope

- Frontend UI or mobile app — current deliverable is API and infrastructure only.
- Authentication/session implementation details beyond user schema — not specified in this initialization scope.
- Production cloud deployment and CI/CD — current deployment requirement is local docker-compose hosting.

## Context

- Product is a greenfield API-first system named Household Asset & Commitment Tracker (HACT).
- Data model centers on `items` as a unified ledger object with typed metadata in `attributes` JSONB and self-references for linked commitments.
- Key domain categories include assets (`RealEstate`, `Vehicle`) and obligations (`FinancialCommitment`, `Subscription`) with timeline events and history.
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

---
*Last updated: 2026-02-24 after Phase 2*
