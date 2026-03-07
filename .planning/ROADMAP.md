# Roadmap: Household Asset & Commitment Tracker (HACT)

## Milestones

- ✅ **v1.0 MVP** - Phases 1-7 shipped 2026-02-25 (`.planning/milestones/v1.0-ROADMAP.md`)
- ✅ **v2.0 Auth, Timeline & Data Lifecycle** - Phases 8-13 shipped 2026-03-02 (`.planning/milestones/v2.0-ROADMAP.md`, `.planning/milestones/v2.0-MILESTONE-AUDIT.md`)
- ✅ **v3.0 Data Portability** - Phases 14-18 shipped 2026-03-04 (`.planning/milestones/v3.0-ROADMAP.md`, `.planning/milestones/v3.0-MILESTONE-AUDIT.md`)
- ✅ **v4.0 Interactive Production Deployment for Ugreen NAS** - Phases 19-23 shipped 2026-03-07 (`.planning/milestones/v4.0-ROADMAP.md`, `.planning/milestones/v4.0-REQUIREMENTS.md`, `.planning/milestones/v4.0-MILESTONE-AUDIT.md`)
- 🚧 **v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion** - Phase 24 shipped; Phase 25 is next

## Phases

<details>
<summary>Shipped milestone history</summary>

- v1.0 MVP - Phases 1-7
- v2.0 Auth, Timeline & Data Lifecycle - Phases 8-13
- v3.0 Data Portability - Phases 14-18
- v4.0 Interactive Production Deployment for Ugreen NAS - Phases 19-23

</details>

### 🚧 v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion

**Milestone Goal:** Users get a premium, data-first OmniLedger dashboard that starts in light mode, supports an explicit dark toggle, and uses spring-driven motion to keep dense UI changes readable.

- [x] **Phase 24: Theme Foundation** - Deliver strict light-first theme initialization, manual toggle behavior, and persisted user choice. (completed 2026-03-07)
- [ ] **Phase 25: Dashboard Surface System** - Apply the high-contrast dual-theme shell, spacing, radius, and exemplar data-card surface pattern.
- [ ] **Phase 26: Motion Interaction Patterns** - Add shared spring motion, tactile press feedback, fluid layout reflow, and exemplar list-item creation feedback.

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
**Goal**: Users can scan dense financial information in a consistent, high-contrast dashboard shell across light and dark themes.
**Depends on**: Phase 24
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, IMPL-03
**Success Criteria** (what must be TRUE):
  1. User sees the light theme use the milestone canvas, card, border, text, and subtle elevation tokens across the updated dashboard shell.
  2. User sees the dark theme swap to the milestone dark canvas, card, border, and text tokens without relying on card shadows for separation.
  3. User sees main cards use `rounded-xl` styling and interactive controls use `rounded-lg` styling consistently across updated dashboard surfaces.
  4. User can read dense dashboard data comfortably because updated cards use generous internal spacing and clear hierarchy.
  5. User sees at least one exemplar data-card pattern that matches the shell's required surface styling and can be reused across the dashboard.
**Plans**: TBD

### Phase 26: Motion Interaction Patterns
**Goal**: Users can follow dashboard changes through fluid MacOS-style motion and tactile feedback instead of abrupt reflows.
**Depends on**: Phase 25
**Requirements**: MOTION-01, MOTION-02, MOTION-03, MOTION-04, IMPL-04
**Success Criteria** (what must be TRUE):
  1. User sees cards and rows enter or leave with a shared spring feel instead of abrupt appearance changes.
  2. User sees surrounding cards or rows fluidly reposition when records are added, removed, or reordered.
  3. User gets tactile press feedback on interactive cards and primary actions during pointer/tap interaction.
  4. User sees newly created rows or cards slide in from a slight vertical offset and briefly highlight so additions are easy to spot.
  5. User sees at least one exemplar list-item pattern that combines layout animation, spring motion, and creation confirmation consistently.
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 24. Theme Foundation | v4.1 | 2/2 | Complete | 2026-03-07 |
| 25. Dashboard Surface System | v4.1 | 0/TBD | Not started | - |
| 26. Motion Interaction Patterns | v4.1 | 0/TBD | Not started | - |

---
*Last updated: 2026-03-07 after completing plan 24-02*
