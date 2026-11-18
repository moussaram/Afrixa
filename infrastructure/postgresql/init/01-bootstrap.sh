#!/usr/bin/env bash
# The official Postgres image sources non-executable *.sh init files.
set -e
: "${POSTGREST_DB_PASSWORD:?POSTGREST_DB_PASSWORD is required}"
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 --set=postgrest_db_password="$POSTGREST_DB_PASSWORD" <<'SQL'
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE authenticator LOGIN; END IF;
END
$roles$;
ALTER ROLE authenticator LOGIN PASSWORD :'postgrest_db_password';
GRANT anon, authenticated TO authenticator;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS infra;
CREATE TABLE IF NOT EXISTS infra.healthcheck (
  id smallint PRIMARY KEY CHECK (id = 1),
  service text NOT NULL,
  status text NOT NULL CHECK (status IN ('ready', 'degraded')),
  checked_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO infra.healthcheck (id, service, status)
VALUES (1, 'afrixa-postgresql-standby', 'ready')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, checked_at = now();
GRANT USAGE ON SCHEMA public TO anon, authenticated;
SQL
