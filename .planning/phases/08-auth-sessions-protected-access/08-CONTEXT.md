# Phase 8: Auth Sessions & Protected Access - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver secure registration/sign-in and authenticated access gates for frontend and API routes, replacing client-selected actor identity with authenticated session context. This phase defines login/session behavior and protected-route handling only.

</domain>

<decisions>
## Implementation Decisions

### Entry and primary auth flow
- Unauthenticated access to protected routes auto-redirects to login.
- First-time registration path is email and password only in this phase.
- Successful login returns user to their original intended destination; if none exists, use the default authenticated landing route.
- Sessions persist across refresh and browser reopen until logout or server-side expiry.

### Failed sign-in experience
- Use generic security-safe copy for credential errors (do not reveal whether email or password failed).
- Show both a top-level form alert and inline field feedback.
- Keep email input, clear password input after failed attempts.
- After too many failed attempts, show temporary cooldown messaging and disable submit until cooldown expires.

### Protected-route and auth-expiry behavior
- Protected frontend routes always redirect unauthenticated users to login.
- Preserve and restore exact intended path (including query params) after authentication.
- For API 401 responses during an active session, show a session-expired notice and route to login with return intent preserved.
- Deep links (including detail/edit pages) should open directly after successful login.

### Session boundaries
- Explicit logout invalidates the current device session immediately and returns user to login.
- No inactivity-based idle timeout in this phase; expiry is driven by standard session/token lifecycle.
- Concurrent sessions across multiple devices are allowed.
- Session expiry should present a clear session-expired banner before/while redirecting to login flow.

### Claude's Discretion
- Exact wording style and layout details for banners and inline error components, while preserving chosen behavior.
- Exact default authenticated landing route when no return URL is present.
- Exact cooldown duration and display cadence, if not constrained elsewhere.

</decisions>

<specifics>
## Specific Ideas

- Preserve full deep-link intent so users continue exactly where they started after authentication.
- Prefer secure UX defaults: generic auth errors and explicit expiry messaging.

</specifics>

<deferred>
## Deferred Ideas

- None - discussion stayed within Phase 8 scope.

</deferred>

---

*Phase: 08-auth-sessions-protected-access*
*Context gathered: 2026-02-25*
