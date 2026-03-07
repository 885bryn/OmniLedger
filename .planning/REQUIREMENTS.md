# Requirements: Household Asset & Commitment Tracker (HACT)

**Defined:** 2026-03-07
**Milestone:** v4.1 Frontend UI/UX Overhaul: High-Contrast Dual Theme (Light Mode Default) & Fluid MacOS-Style Motion
**Core Value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## v1 Requirements

### Theme System

- [x] **THEME-01**: User sees the OmniLedger dashboard in light mode on first render when no saved theme exists.
- [x] **THEME-02**: User can explicitly toggle the dashboard between light and dark themes.
- [x] **THEME-03**: User's explicit theme choice persists across refreshes using local storage.
- [x] **THEME-04**: User theme selection ignores OS/browser `prefers-color-scheme` and changes only from saved choice or direct toggle interaction.

### Visual System

- [ ] **VIS-01**: User sees the default light theme with `bg-neutral-50` canvas, `bg-white` card surfaces, `border-neutral-200`, `text-neutral-900` primary text, `text-neutral-500` secondary text, and subtle `shadow-sm` card elevation.
- [ ] **VIS-02**: User sees the dark theme with `dark:bg-neutral-950` canvas, `dark:bg-neutral-900` card surfaces, `dark:border-neutral-800`, `dark:text-neutral-100` primary text, `dark:text-neutral-400` secondary text, and border-only separation without card shadows.
- [ ] **VIS-03**: User sees consistent `rounded-xl` main cards and `rounded-lg` interactive controls across the updated dashboard shell.
- [ ] **VIS-04**: User sees generous in-card spacing that keeps dense financial data readable.

### Motion and Feedback

- [ ] **MOTION-01**: User sees mounts and unmounts use a shared Framer Motion spring transition with `type: "spring"`, `stiffness: 400`, and `damping: 30`.
- [ ] **MOTION-02**: User sees surrounding cards or rows fluidly reposition when list or grid items are added, removed, or reordered.
- [ ] **MOTION-03**: User sees interactive cards and primary buttons provide tactile press feedback with `whileTap={{ scale: 0.97 }}`.
- [ ] **MOTION-04**: User sees newly created rows or cards animate in from `opacity: 0, y: 10` to `opacity: 1, y: 0` and briefly highlight to confirm the addition.

### Implementation Delivery

- [x] **IMPL-01**: Engineer has a reusable layout wrapper/provider that enforces light mode as the initial theme and exposes a manual theme toggle.
- [x] **IMPL-02**: Engineer has the Tailwind and/or theme-provider configuration needed to support the milestone's dual-theme token system.
- [ ] **IMPL-03**: Engineer has an example Data Card pattern showing the required surface styling and motion props.
- [ ] **IMPL-04**: Engineer has an example List Item pattern showing layout animation, spring behavior, and creation feedback.

## Future Requirements (Deferred)

### Design System Rollout

- **DSYS-01**: User sees the same theme and motion system rolled out across remaining legacy screens beyond the first-pass dashboard surfaces.

### Expanded Motion

- **MOTION-05**: User sees route-level page transitions and staggered view reveals across dashboard navigation.

### Accessibility Controls

- **ACCS-01**: User can reduce non-essential motion through an explicit accessibility setting.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend/domain behavior changes | Milestone is limited to frontend presentation and interaction behavior. |
| OS/browser automatic theme detection | Initial render must stay in light mode until the user toggles. |
| Marketing-site or brand redesign work | Dashboard should remain a structured, data-first utility interface. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01 | Phase 24 | Complete |
| THEME-02 | Phase 24 | Complete |
| THEME-03 | Phase 24 | Complete |
| THEME-04 | Phase 24 | Complete |
| VIS-01 | Phase 25 | Pending |
| VIS-02 | Phase 25 | Pending |
| VIS-03 | Phase 25 | Pending |
| VIS-04 | Phase 25 | Pending |
| MOTION-01 | Phase 26 | Pending |
| MOTION-02 | Phase 26 | Pending |
| MOTION-03 | Phase 26 | Pending |
| MOTION-04 | Phase 26 | Pending |
| IMPL-01 | Phase 24 | Complete |
| IMPL-02 | Phase 24 | Complete |
| IMPL-03 | Phase 25 | Pending |
| IMPL-04 | Phase 26 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after completing phase 24 requirements*
