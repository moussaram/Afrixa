# Afrixa PostgreSQL standby

## Start on a VPS

1. Install Docker Engine and Docker Compose.
2. Copy `.env.postgres.example` to `.env.postgres`.
3. Replace all placeholders with unique, strong secrets. Use URL-safe characters for database passwords.
4. Validate and start:

   ```sh
   docker compose --env-file .env.postgres -f docker-compose.postgres.yml config
   docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d
   docker compose --env-file .env.postgres -f docker-compose.postgres.yml ps
   curl -i http://127.0.0.1:3001/
   ```

PostgreSQL (5433) and PostgREST (3001) bind to loopback only by default. Do not expose PostgreSQL publicly. Put PostgREST behind HTTPS, authentication, rate limiting, and a firewall before external access.

## Security and compatibility

- Bootstrap creates roles and a private health-check table only. It does not copy Afrixa production schema or user data.
- PostgREST exposes `public`, but no application table privileges are granted automatically. Add reviewed grants and RLS policies per table.
- The standby JWT secret is independent of Supabase Auth. Existing Supabase access tokens will not work without a deliberate compatible verification design.
- PostgREST does not replace Supabase Auth, Storage, Realtime, or Edge Functions.
- This is a standby foundation, not active replication or automatic failover. Do not point the live frontend at it yet.
- Initialization scripts run only when the data volume is first created. Never delete a volume containing data just to rerun initialization.

## Production gates

Provision a separate VPS and encrypted persistent storage; configure encrypted off-site backups and test restores; secure networking/TLS; inventory Supabase schemas, extensions, triggers and RLS; design and test replication; replace Supabase-specific services; enforce a single-writer/fencing model; test failover and failback before production use.
