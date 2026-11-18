# Afrixa PostgREST

PostgREST runs as a separate container in `docker-compose.postgres.yml`, connecting to the standby database through the restricted `authenticator` role.

- Listener: `127.0.0.1:3001` by default.
- Exposed schema: `public`.
- Anonymous database role: `anon`.
- Pool size: `POSTGREST_DB_POOL`.
- JWT secret: `POSTGREST_JWT_SECRET`, stored only in the VPS environment/secret manager.

No application tables are granted to `anon` or `authenticated` by default. Before exposing tables, grant only required operations and implement/test RLS. Never connect PostgREST as the PostgreSQL administrator.

This is not a drop-in replacement for the current Supabase client. Supabase Auth, Storage, Realtime and Edge Functions require separate compatible services.
