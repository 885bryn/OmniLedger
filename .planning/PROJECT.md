# Household Asset & Commitment Tracker (HACT)

## What This Is

HACT is a full-stack household ledger product with secure multi-user access, scope-correct export portability, deterministic workbook generation, and actor/lens-attributed audit visibility.

## Core Value

Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## Current State

- **Latest shipped milestone:** v4.0 Interactive Production Deployment for Ugreen NAS (2026-03-07)
- **Archive references:** `.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.0-REQUIREMENTS.md`, `.planning/milestones/v4.0-MILESTONE-AUDIT.md`
- **Completion stance:** shipped; requirements satisfied with remaining non-blocking runtime verification debt tracked in milestone audit

## Next Milestone Goals

- Define next milestone scope through fresh requirements and roadmap planning.
- Decide whether to prioritize operational hardening (HTTPS/TLS, runtime verification debt closure) or product-surface enhancements.
- Keep deployability and audit traceability as non-negotiable release constraints.

## Constraints

- **Stack continuity:** Node.js + Express + Sequelize + React remains baseline unless explicitly replatformed.
- **Data integrity:** UUID keys, owner-scoped RBAC behavior, and audit visibility guarantees remain mandatory.
- **Execution model:** Continue milestone/phase planning through GSD workflows with archive-first documentation hygiene.
- **Deployment target:** Ugreen NAS + Portainer remains the production operating baseline.
- **Configuration security:** Network and identity settings must be externalized via environment variables; no hardcoded values.

<details>
<summary>Archived Prior Milestone Snapshot (v4.0 In-Progress Framing)</summary>

## Current Milestone: v4.0 Interactive Production Deployment for Ugreen NAS

**Goal:** Make House ERP portable and secure for self-hosted Ugreen NAS deployment through Portainer with environment-driven production configuration.

**Target features:**
- Environment variable architecture across frontend and backend for NAS network and identity configuration.
- Production containerization with `Dockerfile.prod` for backend and multi-stage `Dockerfile.prod` for frontend.
- Nginx gateway routing that uses `NAS_STATIC_IP` to direct API traffic without CORS conflicts.
- Portainer-ready `docker-compose.prod.yml` defining frontend/backend/postgres and host env mappings.
- PostgreSQL persistence mapped to `/volume1/docker/house-erp/db-data` on the NAS host.

</details>

---
*Last updated: 2026-03-07 after completing milestone v4.0*
