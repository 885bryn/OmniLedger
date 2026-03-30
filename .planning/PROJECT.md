# Household Asset & Commitment Tracker (HACT)

## What This Is

HACT is a full-stack household ledger product with secure multi-user access, scope-correct export portability, deterministic workbook generation, and actor/lens-attributed audit visibility. The OmniLedger dashboard is the primary React/Tailwind interface where users review assets, obligations, timelines, exports, and operational status.

## Core Value

Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## Current State

- **Latest shipped milestone:** v4.5 Financial Reconciliation Flow (Projected vs. Actuals) (2026-03-30)
- **Archive references:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.1-ROADMAP.md`, `.planning/milestones/v4.3-ROADMAP.md`, `.planning/milestones/v4.4-ROADMAP.md`, `.planning/milestones/v4.5-ROADMAP.md`, `.planning/milestones/v4.5-REQUIREMENTS.md`, `.planning/milestones/v4.5-MILESTONE-AUDIT.md`
- **Completion stance:** v4.5 is archived; next milestone discovery and requirements definition are the active planning focus.

## Current State Details

- The product now combines a grouped events ledger, historical event injection, cadence-aware item detail summaries, and an information-dense dashboard that supports direct triage from the main surface.
- Frontend utility work now centers on shared shadcn/ui primitives, spring motion, and dashboard-first workflows rather than isolated overview widgets.
- Known follow-up debt remains mostly in planning/verification artifacts: missing Phase 35 verification, stale Phase 36 verification markdown, and manual dashboard comfort sign-off for DASH-09.

## Most Recent Milestone: v4.5 Financial Reconciliation Flow (Projected vs. Actuals)

**Goal:** Turn event completion into an explicit reconciliation step that preserves projections, captures actual paid values, and makes variance visible in History.

**Target features:**
- Add nullable `actual_amount` and `actual_date` fields to events while preserving projected `amount` and `due_date`.
- Replace Upcoming ledger instant-complete behavior with a shadcn-based reconciliation modal that prefills actuals and submits the updated completion payload.
- Show completed History rows using actual paid amount/date plus visible over/under variance against the projection.

## Next Milestone Goals

- Extend actual/variance visibility beyond Events History into dashboard and deeper item-detail completed surfaces.
- Add month-rollover freshness behavior (local-midnight refresh) so open dashboards stay temporally accurate.
- Define whether to prioritize history filtering/edit/reversal tools or bulk historical reconciliation workflows next.

## Requirements

### Validated

- ✓ Users can manage household financial data through a secure multi-user dashboard with authenticated access and owner-scoped RBAC visibility. - v2.0
- ✓ Users can view assets, obligations, and timeline-driven financial projections in a deterministic ledger experience. - v2.0
- ✓ Users can export scope-correct workbook data with audit-attributed traceability. - v3.0
- ✓ Operators can deploy the product to Ugreen NAS through documented Portainer workflows with environment-driven production configuration. - v4.0
- ✓ Users see the OmniLedger dashboard in light mode on first render, regardless of OS or browser theme preference. - v4.1
- ✓ Users can explicitly toggle between high-contrast light and dark themes, with their chosen theme persisted locally. - v4.1
- ✓ Users interact with consistent shadcn-based cards, controls, forms, and list/grid layouts using shared spacing, radii, and contrast tokens. - v4.1
- ✓ Users see shared spring motion during add/remove/reflow interactions so dense layout changes stay legible. - v4.1
- ✓ Engineers have reusable theme, shadcn surface, and Framer Motion patterns for continued dashboard rollout. - v4.1
- ✓ Users can review pending and overdue events in a grouped ledger with separate Upcoming and History views. - v4.3
- ✓ Users can mark projected upcoming events as paid and immediately see them leave Upcoming and appear in completed history. - v4.3
- ✓ Users can log a completed historical event from item detail even when the event predates the system-generated origin boundary. - v4.3
- ✓ Users can trust that system-generated pre-origin events remain blocked unless the event was explicitly created as a manual override. - v4.3
- ✓ Users can operate from a dashboard that surfaces month-bounded summaries, urgent event triage, direct item drill-in, and supporting exception/trend context. - v4.4
- ✓ Users can reconcile an upcoming event before completion by confirming actual amount paid and date paid without losing the original projection. - Validated in Phase 39: Reconciliation Modal and Completion UX
- ✓ Users can rely on backend-authoritative defaults so omitted reconciliation inputs fall back to projected amount and today's date. - Validated in Phase 38: Reconciliation Contract and Safe Completion API
- ✓ Users can review completed History rows using actual paid values and immediately see overpayment or underpayment variance against the projection. - Validated in Phase 40: Actual-Based History and Metrics

### Active

- [ ] Users can see actual/variance context beyond Events History (dashboard and deeper item-detail surfaces) in a follow-on milestone.

### Out of Scope

- Bulk reconciliation or CSV backfill tooling - this milestone is scoped to one-event reconciliation from the existing Upcoming ledger.
- History filtering, edit/reverse flows, and dashboard month-rollover refresh - keep focus on the projected-vs-actual completion path first.
- Dashboard and item-detail rollout of new actual/variance presentation beyond completion-derived metrics - defer until the ledger contract settles.
- RBAC, audit attribution, and deployment contract redesign - current security and ops guarantees must remain intact.

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

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Preserve projected fields and add actual reconciliation fields | The product needs projected-vs-actual comparison, not destructive overwrites of the forecast. | ✓ Implemented in phases 38-39 |
| Treat `actual_date` as the business paid date and keep `completed_at` as the system completion timestamp | Users need reconciliation history that reflects when payment happened, while audit/system timing stays intact. | ✓ Implemented in phase 38 |
| Use shadcn primitives for the reconciliation modal and variance badge | Matches the current frontend direction and avoids introducing another dialog/badge pattern mid-stream. | ✓ Implemented in phase 39 |

<details>
<summary>Archived Prior Milestone Snapshot (v4.3 In-Progress Framing)</summary>

## Current Milestone: v4.3 Smart Grouped Ledger & Historical Event Injection

**Goal:** Turn the events experience into a usable ledger by grouping upcoming obligations, supporting pay/log-history actions, and letting users inject past completed events without breaking origin-boundary safety.

**Target features:**
- Replace the global Events page with shadcn `Upcoming` and `History` ledger tabs.
- Group upcoming pending/overdue events into chronologically meaningful sticky-header sections with strong visual status cues.
- Let users mark projected upcoming events as paid so they materialize into completed history with motion-backed removal from Upcoming.
- Add manual historical event injection from item detail using completed events with explicit manual-override semantics.

</details>

<details>
<summary>Archived Prior Milestone Snapshot (v4.1 In-Progress Framing)</summary>

## Current Milestone: v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion

**Goal:** Elevate the OmniLedger dashboard with a premium, data-focused UI system that defaults to light mode, supports an explicit dark toggle, and uses MacOS-style spring motion for clearer interaction feedback.

**Target features:**
- Strict light-mode default theme system that ignores OS preference until the user explicitly toggles themes.
- High-contrast dashboard canvas, shadcn/ui Nova surfaces, crisp borders, text hierarchy, spacing, and radius tokens across the core UI shell.
- Framer Motion layout, mount/unmount, and tactile press interactions layered onto shadcn-based cards, forms, dialogs, and list items.
- A reusable layout wrapper plus exemplar shadcn-based Data Card, Form, Toast, and List Item patterns for rollout across the dashboard.

</details>

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
*Last updated: 2026-03-30 after archiving milestone v4.5*
