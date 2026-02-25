# Household Asset & Commitment Tracker (HACT) Local Runtime

Run the API and PostgreSQL together with Docker Compose using one repeatable path.

## Quickstart

1. Copy the environment template:
   - `cp .env.example .env`
2. Start the full stack:
   - `docker compose up -d`
3. Verify service health:
   - `docker compose ps`
   - `curl http://localhost:8080/health`
4. Verify local-network access from another device on your LAN:
   - Open `http://<HOST_LAN_IP>:8080/health`
   - Example host IP discovery:
     - macOS/Linux: `ip addr` or `ifconfig`
     - Windows (PowerShell): `ipconfig`
5. Stop the stack when done:
   - `docker compose down`

## Runtime Contract

- Services: `api`, `db`
- API host port: `8080`
- PostgreSQL host port: `5433` (container port `5432`)
- API readiness endpoint: `/health`
- Database data persistence: named volume `hact-postgres-data`

## Troubleshooting

### 1) Port conflicts (8080 or 5433 already in use)

- Symptom: `docker compose up -d` fails with a port binding error.
- Check listeners:
  - macOS/Linux: `lsof -i :8080` and `lsof -i :5433`
  - Windows (PowerShell): `netstat -ano | findstr :8080` and `netstat -ano | findstr :5433`
- Fix: stop the conflicting process or change host ports in `docker-compose.yml` and keep docs aligned.

### 2) Missing or invalid environment values

- Symptom: API container exits early, migration fails, or DB auth errors appear in logs.
- Check env file:
  - `cp .env.example .env` (if missing)
  - Confirm `DATABASE_URL`, `DB_PASSWORD`, and `JWT_SECRET` are set.
- Check logs:
  - `docker compose logs api`
  - `docker compose logs db`

### 3) Delayed database readiness on first boot

- Symptom: API takes longer to become healthy immediately after `up -d`.
- Why: PostgreSQL initialization can take extra time before accepting connections.
- Check progress:
  - `docker compose ps`
  - `docker compose logs -f db`
- Wait until `db` is healthy, then re-check:
  - `curl http://localhost:8080/health`

## Frontend Workspace

Phase 6 introduces a dedicated React + TypeScript + Vite workspace at `frontend/` with a Tailwind baseline for upcoming UI plans.

1. Install frontend dependencies:
   - `npm --prefix frontend install`
2. Start frontend dev server:
   - `npm --prefix frontend run dev`
3. Build frontend for production:
   - `npm --prefix frontend run build`
4. Run frontend tests (baseline command):
   - `npm --prefix frontend run test`
