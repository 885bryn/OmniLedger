---
phase: 21-portainer-stack-deployment-and-persistence
plan: 02
subsystem: infra
tags: [ghcr, docker, portainer, compose, persistence]

requires:
  - phase: 21-portainer-stack-deployment-and-persistence
    provides: Portainer stack contract, env mapping, and NAS bind-mount baseline from Plan 21-01
provides:
  - GHCR-first production image publish paths in GitHub Actions and CLI
  - Pull-only compose deployment contract using release-tagged GHCR frontend/backend images
  - Updated verification record with pull-first runtime diagnostics and DEPL requirement traceability
affects: [phase-22-operator-deployment-documentation, deployment-operations]

tech-stack:
  added: [docker/login-action, docker/build-push-action]
  patterns: [single GHCR tag contract across CI and CLI, image-only Portainer deployment]

key-files:
  created:
    - .github/workflows/publish-prod-images.yml
    - scripts/deploy/publish-ghcr-images.sh
    - .planning/phases/21-portainer-stack-deployment-and-persistence/21-VERIFICATION.md
  modified:
    - docker-compose.prod.yml
    - .env.example

key-decisions:
  - "Use GHCR as the only publish target and keep one canonical image naming/tagging contract for backend and frontend."
  - "Require GHCR_OWNER and IMAGE_TAG in compose interpolation so Portainer deployments fail fast when image coordinates are missing."
  - "Set verification status to diagnosed when runtime probes are blocked by missing Docker daemon, while preserving DEPL traceability and follow-up commands."

patterns-established:
  - "Release publish parity: CI workflow and local CLI script generate/push identical GHCR image tags."
  - "Portainer deployment uses pull-first image updates (`docker compose pull` + `up -d`) with no local Dockerfile build dependency."

requirements-completed: [DEPL-01, DEPL-02, DEPL-03]

duration: 7 min
completed: 2026-03-05
---

# Phase 21 Plan 02: GHCR Stack Deployment Gap Closure Summary

**GHCR-backed backend/frontend image publishing is now automated in CI and CLI, and production compose now deploys by pulling tagged GHCR images instead of local builds.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T00:27:34Z
- **Completed:** 2026-03-05T00:35:17Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Added `.github/workflows/publish-prod-images.yml` with `workflow_dispatch` release-tag input and optional `latest` tagging, publishing both production images to GHCR.
- Added `scripts/deploy/publish-ghcr-images.sh` to mirror CI behavior locally, including deterministic contexts (`.` + `Dockerfile.prod`, `frontend` + `frontend/Dockerfile.prod`) and `--dry-run` support.
- Converted `docker-compose.prod.yml` frontend/backend services from `build:` to required GHCR `image:` tags driven by `${GHCR_OWNER}` and `${IMAGE_TAG}`.
- Updated `.env.example` with GHCR deployment variables needed for Portainer Web Editor stack env input.
- Replaced Phase 21 verification report with terminal `diagnosed` status, including pull-first runtime command evidence and DEPL-01/02/03 mapping.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GHCR-first production image publishing workflow (CI and CLI)** - `c15a812` (feat)
2. **Task 2: Switch Portainer production compose contract from local build to remote images** - `45755a2` (feat)
3. **Task 3: Verify pull-based deployment, restart persistence, and finalize Phase 21 verification** - `59f52ec` (fix)

## Files Created/Modified
- `.github/workflows/publish-prod-images.yml` - GHCR publish workflow for backend/frontend production images.
- `scripts/deploy/publish-ghcr-images.sh` - Local CLI publish path with dry-run and optional latest tags.
- `docker-compose.prod.yml` - Image-only deployment contract using GHCR owner/tag variables.
- `.env.example` - Added `GHCR_OWNER` and `IMAGE_TAG` as required deployment inputs.
- `.planning/phases/21-portainer-stack-deployment-and-persistence/21-VERIFICATION.md` - Pull-first runtime evidence, diagnosis, and requirement traceability.

## Decisions Made
- GHCR remains the only registry target for this gap closure to honor the locked deployment direction.
- Compose now treats image coordinates as required operator input (`GHCR_OWNER`, `IMAGE_TAG`) to avoid implicit or stale image selection.
- Verification status is terminally `diagnosed` in this executor when Docker runtime is unavailable, with explicit NAS follow-up steps retained for closure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adjusted unavailable verifier command to supported tooling path**
- **Found during:** Task 3 (verification command execution)
- **Issue:** Planned command `gsd-tools verify phase ...` is not supported by the installed gsd-tools CLI.
- **Fix:** Used available verifier command set and preserved verification evidence directly in `21-VERIFICATION.md` with explicit runtime diagnostics and requirement coverage.
- **Files modified:** `.planning/phases/21-portainer-stack-deployment-and-persistence/21-VERIFICATION.md`
- **Verification:** `node ... gsd-tools.cjs verify phase-completeness 21 --json` executed, and report remained consistent with incomplete-plan state before summary creation.
- **Committed in:** `59f52ec`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep; deviation only handled CLI compatibility while preserving intended verification evidence.

## Authentication Gates
None.

## Issues Encountered
- Docker daemon was unavailable in this environment (`//./pipe/dockerDesktopLinuxEngine` missing), so pull/up/restart runtime probes must be rerun on a Docker-enabled NAS/host for live persistence proof.

## User Setup Required

None - no extra external dashboard setup beyond existing Portainer environment variable entry.

## Next Phase Readiness
- GHCR publish and pull-only compose deployment contracts are complete and documented for operators.
- Phase 22 can now focus on end-to-end operator documentation using this finalized image/tag workflow and NAS runtime validation checklist.

---
*Phase: 21-portainer-stack-deployment-and-persistence*
*Completed: 2026-03-05*

## Self-Check: PASSED

- FOUND: `.planning/phases/21-portainer-stack-deployment-and-persistence/21-02-SUMMARY.md`
- FOUND: `c15a812`
- FOUND: `45755a2`
- FOUND: `59f52ec`
