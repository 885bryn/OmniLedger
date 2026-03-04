# Requirements: Household Asset & Commitment Tracker (HACT)

**Defined:** 2026-03-03
**Milestone:** v4.0 Interactive Production Deployment for Ugreen NAS
**Core Value:** Users can see each asset together with its linked obligations and timeline status so they can make clear, timely household financial decisions.

## v1 Requirements

### Environment Configuration

- [x] **ENV-01**: Operator can configure `NAS_STATIC_IP` externally, and frontend/backend network targets resolve from environment variables instead of hardcoded host values.
- [x] **ENV-02**: Operator can configure `HACT_ADMIN_EMAIL` externally, and backend admin/God Mode identity assignment uses that environment variable.
- [x] **ENV-03**: Operator can configure `DB_PASSWORD` externally, and postgres/backend connection auth uses the environment variable without checked-in secrets.
- [x] **ENV-04**: Operator receives clear startup validation errors when required production environment variables are missing.

### Production Containers and Gateway

- [x] **CONT-01**: Maintainer can build backend production image from `Dockerfile.prod` with runtime behavior suitable for deployment.
- [ ] **CONT-02**: Maintainer can build frontend production image from a multi-stage `Dockerfile.prod` that serves built assets in container runtime.
- [ ] **CONT-03**: Frontend API requests are routed through Nginx gateway to backend targets derived from `NAS_STATIC_IP`, preventing production CORS breakage.

### Portainer Stack Deployment

- [ ] **DEPL-01**: Operator can deploy a three-service production stack (`frontend`, `backend`, `postgres`) using `docker-compose.prod.yml`.
- [ ] **DEPL-02**: Operator can provide host environment variables in Portainer, and compose maps them into services including `API_URL=http://${NAS_STATIC_IP}:8085/api`.
- [ ] **DEPL-03**: Postgres data persists to NAS storage via `/volume1/docker/house-erp/db-data` volume mapping.

### Deployment Documentation

- [ ] **DOCS-01**: Operator can follow a production deployment README that lists exact Portainer stack environment variables required for successful deployment.

## Future Requirements (Deferred)

### Post-Deployment Operations

- **OPER-01**: Operator can run zero-downtime rolling updates for frontend and backend services.
- **OPER-02**: Operator can restore postgres data from NAS backups with a documented recovery runbook.
- **OPER-03**: Operator can monitor service health and restart policy behavior from a dedicated operations dashboard.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Kubernetes orchestration | Portainer on single Ugreen NAS is the milestone deployment target. |
| Cloud-managed database services | Milestone requires self-hosted local postgres persistence. |
| Multi-node HA clustering | Not required for initial self-hosted production rollout. |
| SSO / external IdP admin mapping | Milestone admin identity scope is `HACT_ADMIN_EMAIL` only. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | Phase 19 | Complete |
| ENV-02 | Phase 19 | Complete |
| ENV-03 | Phase 19 | Complete |
| ENV-04 | Phase 19 | Complete |
| CONT-01 | Phase 20 | Complete |
| CONT-02 | Phase 20 | Pending |
| CONT-03 | Phase 20 | Pending |
| DEPL-01 | Phase 21 | Pending |
| DEPL-02 | Phase 21 | Pending |
| DEPL-03 | Phase 21 | Pending |
| DOCS-01 | Phase 22 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after milestone v4.0 roadmap creation*
