# Phase 24: Theme Foundation - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver strict light-first theme initialization for the authenticated OmniLedger experience, plus a manual dark/light toggle that ignores OS theme preference and restores the user's explicit choice. This phase defines the access point and behavior of theme control, not the broader visual token rollout or motion patterns for cards and lists.

</domain>

<decisions>
## Implementation Decisions

### Toggle placement
- Put the theme toggle in the top-right area of the authenticated app header on desktop.
- Make the control a compact icon button rather than a labeled toggle or segmented switch.
- Keep the toggle available in the global authenticated app chrome so users can reach it from any signed-in screen.
- On smaller screens, move theme access into the mobile menu instead of keeping it exposed in the visible header.

### Theme switch feedback
- Theme changes should use a subtle animated shift rather than an instant snap or a dramatic transition.
- The control should communicate current state by changing its icon with the active theme.
- Do not add extra confirmation UI such as a toast after switching themes.
- The motion style should feel restrained and Mac-like: polished, fluid, and quick enough for a data-focused utility app.

### Claude's Discretion
- Exact icon set and visual styling of the toggle button.
- Exact duration and implementation details of the subtle theme transition.
- Exact mobile menu presentation so long as theme access remains easy to find.

</decisions>

<specifics>
## Specific Ideas

- Preserve a utility-dashboard feel rather than making the control feel like a marketing-site flourish.
- Desktop behavior should favor discoverability; mobile behavior should favor a clean header.
- Theme changes should feel polished in a Mac utility-app way, but still immediate enough for dense dashboard work.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 24-theme-foundation*
*Context gathered: 2026-03-07*
