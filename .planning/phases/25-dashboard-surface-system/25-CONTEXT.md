# Phase 25: Dashboard Surface System - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Roll the new high-contrast visual system across the authenticated OmniLedger shell and first-pass dashboard surfaces using shadcn/ui Nova primitives. This phase owns cards, forms, toasts, spacing, borders, and exemplar data-surface patterns in both light and dark themes. It does not own Framer Motion behavior patterns beyond any minimal styling needed to support later motion work.

</domain>

<decisions>
## Implementation Decisions

### Primitive standardization
- Use shadcn/ui Nova as the required primitive layer for this phase.
- Do not create bespoke Tailwind buttons, cards, dialogs, tabs, or form primitives when an official shadcn component exists.
- Add official components with `npx shadcn@latest add [component]` as needed during implementation.
- Import UI primitives through the `@/components/ui` alias.

### Surface language
- Match a Linear/Vercel-style high-contrast utility aesthetic: crisp 1px borders, structured panels, restrained shadows in light mode, and deep-black dark mode.
- Keep light mode as the visual default baseline for all surface decisions.
- Main cards should read as `rounded-xl`; inner actionable elements should read as `rounded-lg`.
- Favor dense-but-readable data presentation with deliberate spacing rather than soft, decorative layouts.

### Forms and feedback surfaces
- Phase 25 should explicitly migrate first-pass forms to shadcn form primitives rather than preserving raw Tailwind field styling.
- Toast presentation should move to a shadcn-aligned toast surface so notifications inherit the same theme tokens and surface language.
- Dashboard cards, auth forms, and high-traffic data entry/edit surfaces should share one visual system instead of page-specific styling patterns.

### Theme compliance
- All shadcn components must respect the CSS variables in `frontend/src/index.css` so the strict light-default / manual dark-toggle behavior from Phase 24 remains intact.
- No system theme detection or `prefers-color-scheme` logic may be introduced while adopting shadcn primitives.
- Dark mode should rely on borders and contrast separation instead of heavy shadows.

### Claude's Discretion
- Exact component rollout order across dashboard, auth, and item-management surfaces.
- Which official shadcn primitives are needed first, as long as the phase covers cards, forms, and toast surfaces.
- Exact token tuning for neutral scales, provided the result stays crisp, high-contrast, and light-first.

</decisions>

<specifics>
## Specific Ideas

- Visual reference: Linear.app / Vercel dashboard rather than a soft SaaS gradient style.
- Preserve the new Phase 24 shell direction and extend it into data cards, forms, and notifications.
- Treat shadcn adoption as an architecture decision for the rest of the milestone, not a one-off implementation detail.

</specifics>

<deferred>
## Deferred Ideas

- Framer Motion layout persistence, tactile spring interactions, and animated add/reflow patterns belong to Phase 26.
- Broader rollout to every legacy screen beyond first-pass dashboard/auth/item surfaces remains a later design-system expansion.

</deferred>

---

*Phase: 25-dashboard-surface-system*
*Context gathered: 2026-03-07*
