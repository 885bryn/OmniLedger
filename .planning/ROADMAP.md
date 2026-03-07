# Roadmap: Household Asset & Commitment Tracker (HACT)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 shipped 2026-02-25 (`.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v2.0 Auth, Timeline & Data Lifecycle** - Phases 8-13 shipped 2026-03-02 (`.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-MILESTONE-AUDIT.md`)
- ✅ **v3.0 Data Portability** - Phases 14-18 shipped 2026-03-04 (`.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v3.0-MILESTONE-AUDIT.md`)
- ✅ **v4.0 Interactive Production Deployment for Ugreen NAS** - Phases 19-23 shipped 2026-03-07 (`.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.0-REQUIREMENTS.md`, `.planning/milestones/v4.0-MILESTONE-AUDIT.md`)
- 🚧 **v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion** - Phases 24-25 shipped; Phase 26 is next

## Phases

<details>
<summary>Shipped milestone history</summary>

- v1.0 MVP - Phases 1-7
- v2.0 Auth, Timeline & Data Lifecycle - Phases 8-13
- v3.0 Data Portability - Phases 14-18
- v4.0 Interactive Production Deployment for Ugreen NAS - Phases 19-23

</details>

### 🚧 v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion

**Milestone Goal:** Users get a premium, data-first OmniLedger dashboard that starts in light mode, uses shadcn/ui Nova primitives for its visual system, supports an explicit dark toggle, and layers spring-driven motion onto dense UI changes.

- [x] **Phase 24: Theme Foundation** - Deliver strict light-first theme initialization, manual toggle behavior, and persisted user choice. (completed 2026-03-07)
- [x] **Phase 25: Dashboard Surface System** - Apply the high-contrast shadcn-based shell, cards, forms, toasts, and exemplar data-surface patterns. (completed 2026-03-07)
- [ ] **Phase 26: Motion Interaction Patterns** - Add shared Framer Motion spring behavior, tactile feedback, fluid layout reflow, and exemplar shadcn list/panel animation patterns.

## Phase Details

### Phase 24: Theme Foundation
**Goal**: Users can enter OmniLedger in a predictable light theme and intentionally switch themes without OS interference.
**Depends on**: Phase 23
**Requirements**: THEME-01, THEME-02, THEME-03, THEME-04, IMPL-01, IMPL-02
**Success Criteria** (what must be TRUE):
  1. User sees the dashboard render in light mode on first load when no saved theme exists, even if the device prefers dark mode.
  2. User can manually switch between light and dark themes from the dashboard UI.
  3. User refreshes the app and sees their last explicit theme choice restored.
  4. User sees theme changes happen only from saved local choice or direct toggle interaction, not from OS/browser preference changes.
**Plans**: 2 plans

Plans:
- [x] `24-01-PLAN.md` - Establish the class-driven theme provider, light-first boot behavior, and persisted explicit-choice contract.
- [x] `24-02-PLAN.md` - Add the authenticated shell's desktop/mobile theme toggle controls and regression coverage.

### Phase 25: Dashboard Surface System
**Goal**: Users can scan dense financial information in a consistent, high-contrast dashboard shell built from shadcn/ui Nova primitives across light and dark themes.
**Depends on**: Phase 24
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, IMPL-03
**Success Criteria** (what must be TRUE):
  1. User sees the light theme use the milestone canvas, shadcn surface, border, text, and subtle elevation tokens across the updated dashboard shell.
  2. User sees the dark theme swap to the milestone deep-black canvas, shadcn surface, border, and text tokens without relying on card shadows for separation.
  3. User sees official shadcn cards use `rounded-xl` styling and shadcn interactive controls use `rounded-lg` styling consistently across updated dashboard surfaces.
  4. User can read dense dashboard forms and data panels comfortably because updated surfaces use generous spacing and clear hierarchy.
  5. User sees at least one exemplar data-card pattern built from `@/components/ui` primitives that can be reused across dashboard views.
**Plans**: 3 plans

Plans:
- [x] `25-01-PLAN.md` - Establish the Phase 25 surface tokens, shell styling, and reusable dashboard data-card pattern.
- [x] `25-02-PLAN.md` - Migrate auth entry, dialogs, and toast presentation to shadcn-aligned surfaces.
- [x] `25-03-PLAN.md` - Roll the shared shadcn form system across first-pass item-management and admin action surfaces.

### Phase 26: Motion Interaction Patterns
**Goal**: Users can follow dashboard changes through fluid MacOS-style Framer Motion behavior and tactile feedback layered onto shadcn-based surfaces instead of abrupt reflows.
**Depends on**: Phase 25
**Requirements**: MOTION-01, MOTION-02, MOTION-03, MOTION-04, IMPL-04
**Success Criteria** (what must be TRUE):
  1. User sees shadcn cards, rows, or panels enter and leave with a shared Framer Motion spring feel instead of abrupt appearance changes.
  2. User sees surrounding cards or rows fluidly reposition when records are added, removed, or reordered.
  3. User gets tactile press feedback on interactive shadcn cards and primary actions during pointer/tap interaction.
  4. User sees newly created rows or cards slide in from a slight vertical offset and briefly highlight so additions are easy to spot.
  5. User sees at least one exemplar `@/components/ui` list or panel pattern that combines layout animation, spring motion, and creation confirmation consistently.
**Plans**: 3 plans

Plans:
- [ ] `26-01-PLAN.md` - Add the shared Framer Motion foundation, reusable animated surface primitives, and subtle in-shell content shift.
- [ ] `26-02-PLAN.md` - Apply shared spring layout motion and creation feedback to dashboard and events exemplar surfaces.
- [ ] `26-03-PLAN.md` - Roll tactile press feedback and new-record confirmation across item workflows, dialogs, and shell controls.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 24. Theme Foundation | v4.1 | 2/2 | Complete | 2026-03-07 |
| 25. Dashboard Surface System | v4.1 | Complete    | 2026-03-07 | 2026-03-07 |
| 26. Motion Interaction Patterns | v4.1 | 0/3 | Not started | - |

---
*Last updated: 2026-03-07 after planning phase 26*
