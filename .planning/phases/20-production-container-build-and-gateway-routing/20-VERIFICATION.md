---
phase: 20-production-container-build-and-gateway-routing
verified: 2026-03-04T22:51:30Z
status: human_needed
score: 5/7 must-haves verified
human_verification:
  - test: "Build and boot backend production container"
    expected: "`docker build -f Dockerfile.prod ...` succeeds and container serves `/health` on port 8080 when required env vars are present"
    why_human: "Container build/runtime behavior cannot be proven from static code inspection in this environment"
  - test: "Frontend production image build and static asset serving"
    expected: "`docker build -f frontend/Dockerfile.prod ...` succeeds and container serves built SPA assets over Nginx"
    why_human: "Multi-stage build and runtime serving require Docker execution"
  - test: "Same-origin `/api/*` gateway and CORS behavior in browser"
    expected: "Frontend requests flow through `/api/*` via Nginx to NAS-derived backend target and browser shows no production CORS failures"
    why_human: "End-to-end browser CORS behavior and upstream reachability require runtime integration testing"
---

# Phase 20: Production Container Build and Gateway Routing Verification Report

**Phase Goal:** Maintainers can build deployable production containers and serve frontend API traffic through Nginx without production CORS breakage.
**Verified:** 2026-03-04T22:51:30Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Maintainer can build the backend production image directly from `Dockerfile.prod` with no manual patching. | ? UNCERTAIN | `Dockerfile.prod` is present and build-oriented (`Dockerfile.prod:1`, `Dockerfile.prod:5`, `Dockerfile.prod:6`), but build was not executable in this environment. |
| 2 | Backend production container starts through startup preflight path and listens on port 8080. | ? UNCERTAIN | Startup wiring is present (`Dockerfile.prod:18`, `Dockerfile.prod:14`, `Dockerfile.prod:12`) and startup script launches server (`src/scripts/startup.js:96`), but runtime boot was not executed here. |
| 3 | Backend production container exits fast with clear env-validation diagnostics when required production env vars are missing. | ✓ VERIFIED | Startup validates production env (`src/scripts/startup.js:68`, `src/scripts/startup.js:77`), throws structured validation errors (`src/config/production-env.js:107`), and exits non-zero on validation error (`src/scripts/startup.js:100`). |
| 4 | Maintainer can build a frontend multi-stage production image from `frontend/Dockerfile.prod` that serves compiled assets via Nginx. | ? UNCERTAIN | Multi-stage build/runtime wiring exists (`frontend/Dockerfile.prod:1`, `frontend/Dockerfile.prod:14`, `frontend/Dockerfile.prod:18`), but Docker build/run could not be executed in this environment. |
| 5 | Browser API requests use a single `/api/*` prefix and are proxied through Nginx to a backend target derived from `NAS_STATIC_IP`. | ✓ VERIFIED | Production build defaults API base to `/api` (`frontend/Dockerfile.prod:8`); Nginx proxies `/api/` (`frontend/nginx/default.conf.template:12`, `frontend/nginx/default.conf.template:13`); upstream derives from `NAS_STATIC_IP` (`frontend/docker-entrypoint.sh:9`, `frontend/docker-entrypoint.sh:28`). |
| 6 | When upstream backend is unreachable, `/api/*` returns a clear JSON 502 response instead of default Nginx HTML. | ✓ VERIFIED | Error interception and JSON 502 envelope are configured (`frontend/nginx/default.conf.template:23`, `frontend/nginx/default.conf.template:27`, `frontend/nginx/default.conf.template:28`). |
| 7 | Gateway routing remains strict in production: missing/invalid backend target env does not silently fall back to localhost. | ✓ VERIFIED | Entrypoint fails on missing/invalid `NAS_STATIC_IP` (`frontend/docker-entrypoint.sh:11`, `frontend/docker-entrypoint.sh:15`), and only emits `BACKEND_UPSTREAM` from validated value (`frontend/docker-entrypoint.sh:28`). |

**Score:** 5/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `Dockerfile.prod` | Production backend container build/runtime contract | ✓ VERIFIED | Exists, substantive, and wired to startup preflight + prod deps (`Dockerfile.prod:6`, `Dockerfile.prod:18`). |
| `.dockerignore` | Deterministic backend production build context exclusions | ✓ VERIFIED | Exists with concrete exclusions for planning/frontend/local artifacts (`.dockerignore:4`, `.dockerignore:5`, `.dockerignore:11`). |
| `frontend/Dockerfile.prod` | Frontend multi-stage build and Nginx runtime image | ✓ VERIFIED | Exists, substantive, and wired to template + entrypoint (`frontend/Dockerfile.prod:19`, `frontend/Dockerfile.prod:20`, `frontend/Dockerfile.prod:26`). |
| `frontend/nginx/default.conf.template` | Nginx SPA + `/api` gateway routing contract | ✓ VERIFIED | Exists, substantive, and wired with proxy + error envelope behavior (`frontend/nginx/default.conf.template:12`, `frontend/nginx/default.conf.template:23`). |
| `frontend/docker-entrypoint.sh` | Runtime env-to-Nginx target resolution and strict startup validation | ✓ VERIFIED | Exists, substantive, and wired as container entrypoint (`frontend/docker-entrypoint.sh:31`, `frontend/Dockerfile.prod:26`). |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `Dockerfile.prod` | `src/scripts/startup.js` | container CMD uses startup preflight before server boot | ✓ WIRED | `CMD ["node", "src/scripts/startup.js"]` present (`Dockerfile.prod:18`). |
| `Dockerfile.prod` | `package-lock.json` | runtime dependency install for reproducible production image | ✓ WIRED | Lockfile copied and `npm ci --omit=dev` used (`Dockerfile.prod:5`, `Dockerfile.prod:6`). |
| `frontend/docker-entrypoint.sh` | `frontend/nginx/default.conf.template` | envsubst renders backend upstream from NAS_STATIC_IP | ✓ WIRED | `envsubst` renders template with `BACKEND_UPSTREAM` derived from `NAS_STATIC_IP` (`frontend/docker-entrypoint.sh:9`, `frontend/docker-entrypoint.sh:31`). |
| `frontend/nginx/default.conf.template` | `http://${NAS_STATIC_IP}:8080` | `location /api/` proxy_pass to env-rendered upstream | ✓ WIRED | `/api/` block uses `proxy_pass ${BACKEND_UPSTREAM}`; entrypoint sets `BACKEND_UPSTREAM=http://${trimmed_nas_ip}:8080` (`frontend/nginx/default.conf.template:12`, `frontend/nginx/default.conf.template:13`, `frontend/docker-entrypoint.sh:28`). |
| `frontend/nginx/default.conf.template` | JSON 502 envelope | intercept upstream gateway errors | ✓ WIRED | `error_page 502 503 504 = @gateway_error` and JSON response configured (`frontend/nginx/default.conf.template:23`, `frontend/nginx/default.conf.template:28`). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| CONT-01 | `20-01-PLAN.md` | Maintainer can build backend production image from `Dockerfile.prod` with runtime behavior suitable for deployment. | ? NEEDS HUMAN | Static contract is in place (`Dockerfile.prod:1`, `Dockerfile.prod:18`), but Docker build/run validation is required to fully confirm. |
| CONT-02 | `20-02-PLAN.md` | Maintainer can build frontend production image from multi-stage `Dockerfile.prod` serving built assets in runtime. | ? NEEDS HUMAN | Multi-stage build/runtime wiring exists (`frontend/Dockerfile.prod:1`, `frontend/Dockerfile.prod:18`), but container execution is required to confirm runtime behavior. |
| CONT-03 | `20-02-PLAN.md` | Frontend API requests route through Nginx gateway to NAS-derived backend targets, preventing production CORS breakage. | ? NEEDS HUMAN | Proxy wiring and strict env resolution are implemented (`frontend/nginx/default.conf.template:12`, `frontend/docker-entrypoint.sh:28`), but browser-level CORS outcome requires integration testing. |

All requirement IDs declared in plan frontmatter (`CONT-01`, `CONT-02`, `CONT-03`) are present in `.planning/REQUIREMENTS.md:18`, `.planning/REQUIREMENTS.md:19`, `.planning/REQUIREMENTS.md:20` and phase traceability table (`.planning/REQUIREMENTS.md:57`, `.planning/REQUIREMENTS.md:58`, `.planning/REQUIREMENTS.md:59`). No orphaned Phase 20 requirements detected.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| None | - | No TODO/FIXME/placeholder/empty-impl markers found in inspected phase files | ℹ️ Info | No stub-style anti-pattern evidence in core phase artifacts |

### Human Verification Required

### 1. Backend Production Build + Runtime

**Test:** Run `docker build -f Dockerfile.prod -t hact-backend-prod:test .`, then run container with required env and probe `/health` on mapped port.
**Expected:** Build succeeds; container starts through startup preflight and responds `200` from `/health` on port 8080.
**Why human:** Requires Docker daemon and runtime networking not available in this verification environment.

### 2. Frontend Production Build + Asset Serving

**Test:** Run `docker build -f frontend/Dockerfile.prod -t hact-frontend-prod:test frontend`, then open `/` from running container.
**Expected:** Build succeeds and Nginx serves compiled SPA assets.
**Why human:** Multi-stage container build and runtime serving cannot be programmatically validated here.

### 3. Gateway Routing + CORS Outcome

**Test:** Run frontend container with `NAS_STATIC_IP` and verify browser API calls hit same-origin `/api/*`; test backend-unreachable case.
**Expected:** API requests route through gateway without browser CORS errors; unreachable upstream returns JSON 502 envelope.
**Why human:** End-to-end browser behavior and network integration require live environment execution.

### Gaps Summary

No code-level wiring gaps were found in phase artifacts or key links. Remaining uncertainty is runtime/integration validation only (container build/run and browser CORS behavior), so status is `human_needed` rather than `gaps_found`.

---

_Verified: 2026-03-04T22:51:30Z_
_Verifier: Claude (gsd-verifier)_
