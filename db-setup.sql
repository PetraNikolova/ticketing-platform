-- ─────────────────────────────────────────────────────────────────────────
-- One-time local database provisioning for the Ticketing System.
--
-- This file contains NO password. You supply one at runtime via a psql
-- variable, so nothing secret is ever written to a tracked file.
--
-- Run ONCE as a Postgres superuser (you'll be prompted for the postgres
-- password). Choose a LOCAL-ONLY app password and pass it as :pw — note the
-- inner single quotes, which make it a SQL string literal:
--
--     psql -U postgres -v pw="'your_local_app_password'" -f db-setup.sql
--
-- Then put that SAME app password into your .env (POSTGRES_PASSWORD and the
-- password inside DATABASE_URL).
--
-- Re-running will error with "role/database already exists" — that's harmless;
-- it just means provisioning was already done.
-- ─────────────────────────────────────────────────────────────────────────

CREATE ROLE ticketing WITH LOGIN PASSWORD :pw;

CREATE DATABASE ticketing OWNER ticketing;

GRANT ALL PRIVILEGES ON DATABASE ticketing TO ticketing;
