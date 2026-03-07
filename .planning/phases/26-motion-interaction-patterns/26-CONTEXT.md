# Phase 26: Motion Interaction Patterns - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Layer MacOS-style motion onto the shadcn-based OmniLedger surface system so users can follow inserts, removals, reflows, and interaction feedback without abrupt visual jumps. This phase owns spring behavior, tactile press feedback, layout persistence, and creation confirmation patterns for existing surfaces; it does not add new product capabilities.

</domain>

<decisions>
## Implementation Decisions

### Motion intensity
- Motion should feel restrained and premium rather than theatrical.
- Repositioning should be fast with a cushioned landing, like a Mac utility app.
- Use one mostly consistent motion language across the product, with only small emphasis differences for more important state changes.
- In-shell view changes can use a subtle content shift, but not large or cinematic route transitions.

### Create feedback
- New rows or cards should arrive with a fade-up and slight lift rather than a strong slide-in.
- Newly created content should briefly show a subtle tint flash that reads as confirmation, not selection.
- The confirmation cue should be very brief before the surface settles back to normal.
- If multiple items appear together, use a small stagger so each addition registers without becoming a long animation sequence.

### Tactile press feedback
- Apply tactile press feedback to primary buttons, clickable card actions, dialog actions, and shell controls.
- The press effect should feel light and native-like rather than heavy or exaggerated.
- The same tactile feedback language should work consistently across mouse and touch interactions.
- Eligible controls should share one consistent press feel rather than giving primary actions a different motion personality.

### Claude's Discretion
- Exact motion durations and timing values, as long as they preserve the restrained premium feel.
- Which existing screens receive the subtle in-shell content shift first.
- Exact tint color and highlight implementation for creation feedback, provided it stays brief and subtle.

</decisions>

<specifics>
## Specific Ideas

- The desired feel is MacOS-style utility motion: polished, quick, and legible under dense data.
- Motion should support the shadcn surface system from Phase 25 rather than compete with it.
- New-item confirmation should read as a gentle lift plus tint flash, not a dramatic insertion animation.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 26-motion-interaction-patterns*
*Context gathered: 2026-03-07*
