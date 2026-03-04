# Household Asset & Commitment Tracker (HACT)

## What This Is

HACT is a full-stack household ledger product with secure multi-user access, scope-correct export portability, deterministic workbook generation, and actor/lens-attributed audit visibility.

## Core Value

Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## Current State

- **Latest shipped milestone:** v3.0 Data Portability (2026-03-04)
- **Archive references:** `.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v3.0-REQUIREMENTS.md`, `.planning/milestones/v3.0-MILESTONE-AUDIT.md`
- **Completion stance:** shipped; no blocker gaps, with one low-risk deferred UX-noise item in activity timeline context

## Current Milestone: v4.0 Interactive Production Deployment for Ugreen NAS

**Goal:** Make House ERP portable and secure for self-hosted Ugreen NAS deployment through Portainer with environment-driven production configuration.

**Target features:**
- Environment variable architecture across frontend and backend for NAS network and identity configuration.
- Production containerization with `Dockerfile.prod` for backend and multi-stage `Dockerfile.prod` for frontend.
- Nginx gateway routing that uses `NAS_STATIC_IP` to direct API traffic without CORS conflicts.
- Portainer-ready `docker-compose.prod.yml` defining frontend/backend/postgres and host env mappings.
- PostgreSQL persistence mapped to `/volume1/docker/house-erp/db-data` on the NAS host.

## Constraints

- **Stack continuity:** Node.js + Express + Sequelize + React remains baseline unless explicitly replatformed.
- **Data integrity:** UUID keys, owner-scoped RBAC behavior, and audit visibility guarantees remain mandatory.
- **Execution model:** Continue milestone/phase planning through GSD workflows with archive-first documentation hygiene.
- **Deployment target:** Ugreen NAS + Portainer stack deployment is the production path for this milestone.
- **Configuration security:** Network and identity settings must be externalized via environment variables; no hardcoded values.

<details>
<summary>Archived Prior Milestone Snapshot</summary>

Previous in-progress v3 kickoff context and interim planning notes were superseded at v3.0 completion.
See milestone archives and phase summaries for implementation history.

</details>

---
*Last updated: 2026-03-04 after starting milestone v4.0*
