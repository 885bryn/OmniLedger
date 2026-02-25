# Phase 8: Auth Sessions & Protected Access - Research

**Researched:** 2026-02-25
**Domain:** Session-based auth for Express API + React Router frontend
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
- None - discussion stayed within Phase 8 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can register and sign in with secure credential handling. | Add dedicated auth routes (`/auth/register`, `/auth/login`, `/auth/logout`, `/auth/session`) with bcrypt-based password verification, generic failure responses, and login throttling/cooldown. |
| AUTH-02 | Authenticated session is required for protected API and frontend routes. | Add server `requireAuth` middleware + session cookie transport + frontend route guard and API 401 redirect handling with return intent preservation. |
| AUTH-03 | API no longer accepts actor identity via client-selected `x-user-id` shim for authorization. | Remove `x-user-id` usage from API/client, derive actor from `req.session.userId`, and pass trusted actor context into domain services. |
</phase_requirements>

## Summary

Current codebase is ready for auth in terms of user schema (already has `email_normalized` and `password_hash`), but not in transport or authorization boundaries. Identity is currently client-selected via `x-user-id` in both backend routes and frontend API client (`src/api/routes/items.routes.js`, `src/api/routes/events.routes.js`, `frontend/src/lib/api-client.ts`), so Phase 8 must replace that end-to-end with server-derived session identity.

For this stack (Express 5 + Sequelize + React Router 7), the most stable path is cookie-backed server sessions using `express-session` and `connect-session-sequelize` instead of hand-rolled token/session plumbing. This directly satisfies immediate logout invalidation, multi-device sessions, and server-side actor derivation with lower implementation risk than custom JWT revocation logic.

Primary planning risk is compatibility fallout: most API tests and frontend components currently assume `x-user-id` selection and public route access. Plan should include a deliberate migration wave (auth foundation first, then protected-route rollout, then test rewrites) so the codebase does not land in a partially broken middle state.

**Primary recommendation:** Implement server-managed cookie sessions first, then gate all protected routes behind a single auth context/middleware, then remove every remaining `x-user-id` path.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express-session` | `^1.x` | Server-side session middleware and cookie transport | Official Express session middleware; supports signed SID cookies, regeneration, destroy, and store pluggability. |
| `connect-session-sequelize` | `^8.x` | Persist session records in SQL via Sequelize | Native fit for current Sequelize stack; supports expiry cleanup and touch semantics. |
| `bcryptjs` | `^3.x` | Password hashing and verify | Widely used in Node apps; async API fits request handling and avoids plain-text credential risks. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express-rate-limit` | `^8.x` | Login throttling and cooldown windows | Apply on `/auth/login` to enforce failed-attempt cooldown messaging and submit lockouts. |
| `react-router-dom` (existing) | `^7.13.1` | Frontend redirects and return-intent restore | Use route guards + `Navigate` state/query for preserved deep-link return. |
| `@tanstack/react-query` (existing) | `^5.90.21` | Auth-sensitive query invalidation on logout/expiry | Clear actor/session-bound caches after logout or 401 expiration flow. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cookie + server session | JWT access/refresh token stack | JWT adds revocation/rotation complexity; harder to guarantee immediate single-device logout invalidation in this phase. |
| `connect-session-sequelize` store | Custom `Sessions` model + middleware | More control but high edge-case burden (expiry cleanup, rotation, race handling) and slower to deliver safely. |
| `bcryptjs` | `argon2` | `argon2` is stronger cryptographically but adds native build/runtime complexity for current local Docker/dev flow. |

**Installation:**
```bash
npm install express-session connect-session-sequelize bcryptjs express-rate-limit
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── api/
│   ├── auth/                    # auth middleware + request actor helpers
│   ├── routes/auth.routes.js    # register/login/logout/session endpoints
│   └── routes/*.routes.js       # protected routes consume req.actor
├── domain/
│   └── auth/                    # register/authenticate service logic
├── db/
│   ├── migrations/              # session store table migration (if not auto-sync)
│   └── models/                  # user + optional session model hookup
frontend/src/
├── auth/                        # auth context, guards, return-intent utilities
├── pages/auth/                  # login/register pages
└── lib/api-client.ts            # credentials include + 401 expiry handling
```

### Pattern 1: Session middleware before protected routers
**What:** Initialize session middleware once at app bootstrap, then derive `req.actor` from `req.session` in a dedicated `requireAuth` middleware.
**When to use:** All API routes except registration/login/health.
**Example:**
```javascript
// Source: https://github.com/expressjs/session
const session = require('express-session')

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: sequelizeStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}))
```

### Pattern 2: Auth boundary at route layer, domain receives trusted actor
**What:** Route handler pulls actor from authenticated session context only and passes to domain commands/queries.
**When to use:** Replacing all `actorUserId: req.header("x-user-id")` callsites.
**Example:**
```javascript
// Source: repo migration target from src/api/routes/items.routes.js
router.get('/items', requireAuth, async (req, res, next) => {
  const listed = await listItems({
    actorUserId: req.actor.userId,
    search: req.query.search,
  })
  res.status(200).json(listed)
})
```

### Pattern 3: Frontend protected-route redirect with safe return intent
**What:** If no authenticated session, redirect to login and preserve exact path+query+hash in `returnTo`.
**When to use:** Root shell and all currently protected pages (`/dashboard`, `/items*`, `/events`).
**Example:**
```tsx
// Source: https://reactrouter.com/api/components/Navigate
const returnTo = `${location.pathname}${location.search}${location.hash}`
if (!session) {
  return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />
}
return children
```

### Pattern 4: Centralized 401 expiry handler in API client
**What:** API client catches 401, emits "session expired" event, and triggers login redirect while preserving current location.
**When to use:** In `frontend/src/lib/api-client.ts` for all protected requests.
**Example:**
```typescript
if (response.status === 401) {
  window.dispatchEvent(new CustomEvent('hact:session-expired'))
  throw new ApiClientError({ status: 401, code: 'session_expired', message: 'Session expired' })
}
```

### Anti-Patterns to Avoid
- **Client-selected actor identity:** Never read `x-user-id` for authorization decisions after Phase 8.
- **Wildcard CORS with credentials:** `Access-Control-Allow-Origin: *` breaks credentialed cookies and blocks browser behavior.
- **LocalStorage auth token for this phase:** Conflicts with server-derived session identity and increases XSS exposure.
- **Open redirect on return URL:** Reject absolute/external `returnTo` values; allow only app-relative paths.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session lifecycle | Custom cookie parsing/signing + manual SID rotation | `express-session` | Handles signing, regeneration, destroy, cookie config, and stable middleware semantics. |
| SQL session persistence | Bespoke TTL cleanup cron and store adapter | `connect-session-sequelize` | Provides expiration handling and Sequelize-backed store behavior already solved/tested. |
| Password KDF | DIY hashing logic with SHA-256/salt | `bcryptjs` | Adaptive work factor and standard password verify flow. |
| Login cooldown | Custom in-memory counters | `express-rate-limit` | Battle-tested throttling, 429 handling, and pluggable policy surface. |

**Key insight:** Auth/session edge cases are mostly in lifecycle and transport, not route handlers; reusing standard middleware sharply reduces breach-prone logic.

## Common Pitfalls

### Pitfall 1: CORS + cookie credentials mismatch
**What goes wrong:** Browser silently drops/blocks session cookie behavior.
**Why it happens:** Current API sets `Access-Control-Allow-Origin: *` and no credential header.
**How to avoid:** Return explicit frontend origin, set `Access-Control-Allow-Credentials: true`, and use `fetch(..., { credentials: 'include' })`.
**Warning signs:** Login appears successful but subsequent protected API calls still return 401.

### Pitfall 2: Registration contract conflicts with current `User` schema
**What goes wrong:** Email/password-only UI cannot create user because `username` is currently required.
**Why it happens:** `src/db/models/user.model.js` enforces `username` and normalized uniqueness.
**How to avoid:** Decide Phase 8 rule early (derive username from email local-part + uniqueness suffix, or schema change to optional username).
**Warning signs:** 422/validation errors on first register implementation.

### Pitfall 3: Partial migration leaves hidden `x-user-id` paths
**What goes wrong:** AUTH-03 fails despite new login working.
**Why it happens:** Existing code references `x-user-id` in API routes, CORS allow-headers, frontend fetch helpers, and tests.
**How to avoid:** Track a hard removal checklist across backend routes, frontend client, and all tests.
**Warning signs:** Requests still succeed when manually supplying arbitrary `x-user-id`.

### Pitfall 4: Session fixation at login boundary
**What goes wrong:** Attacker-controlled pre-login SID may persist into authenticated state.
**Why it happens:** Login writes user identity to existing session without regeneration.
**How to avoid:** Regenerate session ID on successful login before setting actor context.
**Warning signs:** Same SID value before and after login in network traces.

### Pitfall 5: Generic auth messaging broken by timing/response differences
**What goes wrong:** Credential errors leak account existence despite generic text.
**Why it happens:** Different code paths for unknown email vs wrong password.
**How to avoid:** Keep response envelope and status uniform for invalid credential outcomes.
**Warning signs:** Different status codes/body shapes/latency patterns across invalid cases.

## Code Examples

Verified patterns from official sources:

### Express session initialization
```javascript
// Source: https://github.com/expressjs/session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false },
}))
```

### Sequelize-backed session store
```javascript
// Source: https://github.com/mweibel/connect-session-sequelize
const session = require('express-session')
const SequelizeStore = require('connect-session-sequelize')(session.Store)

const store = new SequelizeStore({ db: sequelize })
store.sync()
```

### Password hashing + verify
```javascript
// Source: https://github.com/dcodeIO/bcrypt.js
const bcrypt = require('bcryptjs')

const hash = await bcrypt.hash(password, 12)
const ok = await bcrypt.compare(passwordAttempt, hash)
```

### Login throttling middleware
```javascript
// Source: https://github.com/express-rate-limit/express-rate-limit
const { rateLimit } = require('express-rate-limit')

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client passes `x-user-id` and server trusts it | Server derives actor from authenticated session context | Phase 8 | Closes impersonation vector and enables real protected access. |
| Public frontend routes with actor switcher | Auth-guarded routes with login redirect + return restore | Phase 8 | Deep links become secure while preserving intended navigation flow. |
| CORS wildcard (`*`) without credentials | Explicit allow-origin + `Allow-Credentials: true` for cookie sessions | Phase 8 | Browser can carry session cookies correctly across frontend/API origins. |

**Deprecated/outdated:**
- `x-user-id` as authorization identity source.
- `Access-Control-Allow-Headers` containing `x-user-id` after migration.
- Local user-switch actor selection as security boundary.

## Open Questions

1. **How should `username` be handled when signup is email+password only?**
   - What we know: Current `User` model requires unique `username` + `username_normalized`.
   - What's unclear: Whether to keep username internally derived or migrate schema in Phase 8.
   - Recommendation: Keep schema stable in Phase 8 and derive deterministic username from email local-part with collision suffix; postpone profile/rename UX.

2. **What exact cooldown policy should be shipped?**
   - What we know: Decision requires cooldown messaging and disabled submit after too many failures.
   - What's unclear: Threshold/window/cooldown duration values.
   - Recommendation: Start with `5` failures per `10` minutes and display retry countdown from 429 response metadata.

## Sources

### Primary (HIGH confidence)
- https://github.com/expressjs/session - official middleware behavior, cookie/session options, MemoryStore warning.
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie - cookie security semantics (`HttpOnly`, `SameSite`, `Secure`, expiry).
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS - credentialed CORS requirements and wildcard constraints.
- Repository evidence: `src/api/app.js`, `src/api/routes/items.routes.js`, `src/api/routes/events.routes.js`, `frontend/src/lib/api-client.ts`, `frontend/src/app/router.tsx`.

### Secondary (MEDIUM confidence)
- https://github.com/mweibel/connect-session-sequelize - Sequelize session store usage and expiry behavior (community package, not Express core).
- https://github.com/dcodeIO/bcrypt.js - bcrypt API and input-length caveat (community package docs).
- https://github.com/express-rate-limit/express-rate-limit - login throttling middleware options.
- https://reactrouter.com/api/components/Navigate - redirect mechanics in current router version.
- https://owasp.org/www-project-cheat-sheets/cheatsheets/Authentication_Cheat_Sheet.html - generic auth errors and throttling guidance.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - based on official Express/MDN docs plus mature package docs and direct repo fit.
- Architecture: HIGH - strongly constrained by current code paths that explicitly use `x-user-id` and unprotected routing.
- Pitfalls: HIGH - validated against both current repo behavior and official browser/session docs.

**Research date:** 2026-02-25
**Valid until:** 2026-03-27
