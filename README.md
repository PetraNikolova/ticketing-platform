# Ticketing System

A Kanban-style ticket tracker — three-tier single-page app backed by PostgreSQL.
Built to the *Hackathon Ticketing System Requirements v4* specification.

> **Status:** feature-complete for the mandatory scope (auth + email verification,
> teams, epics, tickets, comments, Kanban board) with backend and end-to-end tests.
> See `PLAN.md` (kept alongside the spec) for the phased build plan and locked
> architectural decisions.

## Architecture

| Tier | Technology |
|------|------------|
| Presentation | React 19 + Vite + TypeScript SPA |
| Application / API | NestJS (TypeScript), HTTP API under `/api` |
| Persistence | PostgreSQL 16+ |

Authentication uses an **httpOnly cookie session** (signed JWT). In the container
deployment, an **nginx** frontend container serves the SPA and reverse-proxies
`/api` to the backend, so the browser sees a single origin (no CORS).

```
repo-root/
├── backend/        NestJS API + Prisma
├── frontend/       Vite React SPA
├── docker-compose.yml   (Docker deliverable — see note below)
└── .env.example    copy to .env and fill in
```

## Running locally (native — no Docker required)

This project is developed without Docker. You need:

- **Node.js 20+** (developed on Node 24)
- **PostgreSQL 16+** running locally (developed on PostgreSQL 18)

### 1. Configure environment

```sh
cp .env.example .env
# edit .env: set DATABASE_URL to your local Postgres, JWT_SECRET, and SMTP settings
```

### 2. Backend

```sh
cd backend
npm install
npm run prisma:deploy    # apply migrations to your database
npm run start:dev        # http://localhost:3000/api
```

Health check: `GET http://localhost:3000/api/health` → `{"status":"ok",...}`

Local email: run a catcher so verification emails are viewable.

```sh
cd backend
npm run mail:dev         # SMTP on :1025, inbox UI at http://localhost:1080
```

Optional — seed a verified demo user for manual testing (idempotent; reads
`DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` from `.env`):

```sh
cd backend
npm run seed
```

> The seed is never run on the default startup path, so a fresh database always
> starts with schema + migration metadata only and no application rows.

### 3. Frontend

```sh
cd frontend
npm install
npm run dev              # http://localhost:5173 (proxies /api → :3000)
```

## Running with Docker (deliverable for QA)

From a clean checkout at the repo root:

```sh
docker compose up --build
```

Then open **http://localhost:8080** (the maildev inbox is at **http://localhost:1080**).
Compose starts four services — `db` (PostgreSQL), `backend` (NestJS, applies
migrations on boot), `frontend` (nginx serving the SPA and reverse-proxying
`/api`), and `mail` (maildev) — so the full signup → verify → login flow works
without any external services. Sensible defaults let it run with no `.env`;
create a root `.env` (see `.env.example`) to override the database password,
`JWT_SECRET`, or point `SMTP_HOST` at `relay1.dataart.com`.

> **Verified:** `docker compose up --build` was validated end-to-end on Docker
> Engine 29 (Compose v2, in WSL2 — no Docker Desktop needed): both images build,
> migrations apply on boot, the fresh database starts empty, and the full
> signup → verify → login flow works through the nginx proxy and maildev.

## Tests

| Suite | Command | What it covers |
|-------|---------|----------------|
| Backend API (Jest + Supertest) | `cd backend && npm run test:e2e` | Full business flow across auth, teams, epics, tickets, comments — incl. 409 delete guards, cross-team epic rejection, and `modifiedAt` semantics (45 assertions). |
| End-to-end (Playwright) | `cd frontend && npm run test:e2e` | Log in → board → **drag a ticket to a new column** → assert the state is persisted on the server **after a full page reload**. |

The Playwright suite starts the dev servers if they aren't already running
(reusing them if they are) and seeds the demo user automatically. PostgreSQL
must be running locally.

## Configuration

Copy `.env.example` to `.env` and adjust. `.env` is git-ignored; no secrets are
committed.

| Variable | Purpose |
|----------|---------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Database credentials (also used to compose `DATABASE_URL` in Docker). |
| `POSTGRES_HOST` / `POSTGRES_PORT` | Database host/port for native runs. |
| `DATABASE_URL` | Prisma connection string. |
| `JWT_SECRET` | Secret used to sign the httpOnly session-cookie JWT. |
| `SESSION_TTL` | Session lifetime, e.g. `7d`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | SMTP settings for verification email (`relay1.dataart.com` for DataArt/QA). |
| `APP_BASE_URL` | Public frontend URL used to build verification links. |
| `BACKEND_PORT` | Port the API listens on. |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` | Optional. Credentials for the local `npm run seed` demo user. Leave blank in deployed/QA environments. |
