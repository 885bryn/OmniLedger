---
phase: 08-auth-sessions-protected-access
plan: 05
subsystem: auth
tags: [frontend, session, redirect, react-router, vitest]

requires:
  - phase: 08-02
    provides: protected route gating and returnTo sanitization baseline
  - phase: 08-03
    provides: session-authenticated frontend transport and auth UX foundation
provides:
  - centralized protected-401 session-expired signaling in the frontend API client
  - visible session-expired UX and deterministic login redirect preserving deep-link intent
  - regression tests covering 401-triggered redirect and post-login deep-link restoration
affects: [phase-08-auth, phase-09-rbac]

tech-stack:
  added: []
  patterns:
    - custom browser event (`hact:session-expired`) for auth-expiry coordination
    - sessionStorage marker for session-expired login notice continuity

key-files:
  created:
    - frontend/src/features/auth/session-expired-banner.tsx
    - frontend/src/__tests__/session-expiry-redirect.test.tsx
  modified:
    - frontend/src/lib/api-client.ts
    - frontend/src/auth/auth-context.tsx
    - frontend/src/app/shell/app-shell.tsx
    - frontend/src/pages/auth/login-page.tsx
    - frontend/src/locales/en/common.json
    - frontend/src/locales/zh/common.json

key-decisions:
  - "Emit a single frontend-wide session-expired event for protected 401s instead of per-screen handling."
  - "Persist session-expired notice state in sessionStorage so login reliably shows expiry messaging during forced re-auth flows."

patterns-established:
  - "Protected API 401 -> dispatch session-expired event -> auth context coordinates redirect + return intent handling"
  - "Expiry notifications are security-safe and route-safe: auth routes do not self-trigger redirect loops"

requirements-completed: [AUTH-02]

duration: 4 min
completed: 2026-02-25
---

# Phase 8 Plan 05: Session Expiry Redirect UX Summary

**Protected API 401s now produce an explicit session-expired notice and deterministic login redirect that preserves exact deep-link return intent.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-25T23:05:41Z
- **Completed:** 2026-02-25T23:10:13Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added centralized protected-request 401 signaling in the frontend API client while keeping credentialed transport behavior.
- Wired auth context + shell banner behavior so expired sessions present clear UX and route users back through login with safe return intent.
- Added focused regression tests that lock redirect-to-login behavior and exact deep-link restoration after re-authentication.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire centralized 401 signaling and shell expiry UX** - `80585d2` (feat)
2. **Task 2: Add expiry redirect/deep-link restore regression coverage** - `36a7e00` (test)

## Files Created/Modified
- `frontend/src/lib/api-client.ts` - dispatches session-expired event for protected 401 responses.
- `frontend/src/auth/auth-context.tsx` - tracks expiry state, preserves return intent, and controls session-expired notice persistence.
- `frontend/src/app/shell/app-shell.tsx` - renders session-expired banner in protected shell layout.
- `frontend/src/features/auth/session-expired-banner.tsx` - dedicated visible expiry notice component.
- `frontend/src/pages/auth/login-page.tsx` - surfaces expiry notice during forced re-auth flow.
- `frontend/src/__tests__/session-expiry-redirect.test.tsx` - regression tests for 401 redirect + deep-link restoration.
- `frontend/src/locales/en/common.json` - English expiry notice copy.
- `frontend/src/locales/zh/common.json` - Chinese expiry notice copy.

## Decisions Made
- Standardized on one event channel (`hact:session-expired`) so all protected API consumers can trigger the same expiry flow.
- Kept return intent app-relative and stored in sessionStorage, then consumed once after successful re-authentication.
- Added login-page expiry notice continuity so users always receive explicit expiry feedback even when redirected immediately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added QueryClient provider to session-expiry regression harness**
- **Found during:** Task 2 (regression coverage)
- **Issue:** Test harness rendered `AppShell` without React Query context, causing runtime failure before expiry flow assertions.
- **Fix:** Wrapped router harness in `QueryClientProvider` with deterministic test defaults.
- **Files modified:** `frontend/src/__tests__/session-expiry-redirect.test.tsx`
- **Verification:** `npm --prefix frontend run test -- session-expiry-redirect --runInBand`
- **Committed in:** `36a7e00`

**2. [Rule 1 - Bug] Guarded 401 event dispatch to browser environments and ensured login notice continuity**
- **Found during:** Task 2 (regression execution)
- **Issue:** Session-expiry handling needed stable UX across redirect timing while remaining safe in non-browser contexts.
- **Fix:** Added browser guard around event dispatch, persisted session-expired notice marker, and surfaced notice on login route.
- **Files modified:** `frontend/src/lib/api-client.ts`, `frontend/src/auth/auth-context.tsx`, `frontend/src/pages/auth/login-page.tsx`
- **Verification:** `npm --prefix frontend run test -- session-expiry-redirect --runInBand` and `npm --prefix frontend run typecheck`
- **Committed in:** `36a7e00`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were required to complete deterministic regression coverage and keep session-expiry UX reliable without scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- AUTH-02 expiry UX is now explicit and regression-locked for protected request failures.
- Ready for remaining Phase 8 plans that build on stable session-expiry routing behavior.

---
*Phase: 08-auth-sessions-protected-access*
*Completed: 2026-02-25*

## Self-Check: PASSED
- FOUND: `.planning/phases/08-auth-sessions-protected-access/08-05-SUMMARY.md`
- FOUND: `80585d2`
- FOUND: `36a7e00`
