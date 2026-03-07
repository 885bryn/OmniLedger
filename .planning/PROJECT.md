# Household Asset & Commitment Tracker (HACT)

## What This Is

HACT is a full-stack household ledger product with secure multi-user access, scope-correct export portability, deterministic workbook generation, and actor/lens-attributed audit visibility. The OmniLedger dashboard is the primary React/Tailwind interface where users review assets, obligations, timelines, exports, and operational status.

## Core Value

Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## Current State

- **Latest shipped milestone:** v4.0 Interactive Production Deployment for Ugreen NAS (2026-03-07)
- **Archive references:** `.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.0-REQUIREMENTS.md`, `.planning/milestones/v4.0-MILESTONE-AUDIT.md`
- **Completion stance:** shipped; requirements satisfied with remaining non-blocking runtime verification debt tracked in milestone audit

## Current Milestone: v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion

**Goal:** Elevate the OmniLedger dashboard with a premium, data-focused UI system that defaults to light mode, supports an explicit dark toggle, and uses MacOS-style spring motion for clearer interaction feedback.

**Target features:**
- Strict light-mode default theme system that ignores OS preference until the user explicitly toggles themes.
- High-contrast dashboard canvas, shadcn/ui Nova surfaces, crisp borders, text hierarchy, spacing, and radius tokens across the core UI shell.
- Framer Motion layout, mount/unmount, and tactile press interactions layered onto shadcn-based cards, forms, dialogs, and list items.
- A reusable layout wrapper plus exemplar shadcn-based Data Card, Form, Toast, and List Item patterns for rollout across the dashboard.

## Requirements

### Validated

- ✓ Users can manage household financial data through a secure multi-user dashboard with authenticated access and owner-scoped RBAC visibility. - v2.0
- ✓ Users can view assets, obligations, and timeline-driven financial projections in a deterministic ledger experience. - v2.0
- ✓ Users can export scope-correct workbook data with audit-attributed traceability. - v3.0
- ✓ Operators can deploy the product to Ugreen NAS through documented Portainer workflows with environment-driven production configuration. - v4.0

### Active

- [ ] Users see the OmniLedger dashboard in light mode on first render, regardless of OS or browser theme preference.
- [ ] Users can explicitly toggle between high-contrast light and dark themes, with their chosen theme persisted locally.
- [ ] Users interact with shadcn-based cards, controls, forms, and list/grid layouts that use consistent radii, generous spacing, crisp borders, and subtle light-mode elevation.
- [ ] Users see physics-based motion when records appear, disappear, or shift position so layout changes stay visually legible.
- [ ] Engineers have a reusable layout wrapper, shadcn/ui primitive patterns, theme toggle pattern, and Framer Motion examples to apply across the dashboard.

### Out of Scope

- Backend/domain model changes - this milestone is limited to frontend UI system and interaction behavior.
- OS-level theme detection or `prefers-color-scheme` listeners - strict light-mode default is a milestone constraint.
- Marketing-site redesign or brand repositioning - the dashboard should remain structured, utilitarian, and data-focused.

## Constraints

- **Stack continuity:** Node.js + Express + Sequelize + React remains baseline unless explicitly replatformed.
- **Data integrity:** UUID keys, owner-scoped RBAC behavior, and audit visibility guarantees remain mandatory.
- **Execution model:** Continue milestone/phase planning through GSD workflows with archive-first documentation hygiene.
- **Deployment target:** Ugreen NAS + Portainer remains the production operating baseline.
- **Configuration security:** Network and identity settings must be externalized via environment variables; no hardcoded values.
- **Theme behavior:** Initial render must be locked to light mode and ignore OS/browser preference until the user uses the theme toggle.
- **Visual language:** Preserve a structured, high-contrast, developer-tool dashboard aesthetic rather than a marketing-style redesign.
- **Motion model:** Layout changes should use Framer Motion spring physics instead of generic linear CSS transitions where the UI reflows.
- **UI primitives:** Use shadcn/ui Nova components from `@/components/ui` for buttons, cards, forms, dialogs, tabs, and toast surfaces instead of bespoke Tailwind primitives.

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
*Last updated: 2026-03-07 after starting milestone v4.1*
