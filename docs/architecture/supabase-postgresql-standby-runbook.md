# Afrixa — Supabase primary / PostgreSQL standby runbook

**Status:** planned and versioned; waiting for a dedicated PostgreSQL host.  
**Current production authority:** Supabase project `Afrixa` (`kxxwdiyloplkoyperwty`).  
**Standby target:** PostgreSQL 17 + PostgREST 12.2, defined in `docker-compose.postgres.yml`.  
**Current traffic:** remains on Supabase. No cutover, replication, or failover is enabled by this plan.

## 1. Verified baseline

- Supabase project is reported `ACTIVE_HEALTHY`, PostgreSQL 17.6.
- A read-only SQL connectivity check succeeded on 2026-11-18.
- Railway project `Afrixa` has a production service named `Afrixa`.
- Railway production already contains the variable names `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID`. Values were not exposed by the connected account, and this plan does not overwrite them.
- The application uses `@supabase/supabase-js` and currently constructs its client from Vite Supabase environment variables.
- The standalone PostgreSQL foundation contains the exported public schema and policy snapshot, but it has not yet been run on a real host.

## 2. Target architecture

1. **Normal operation:** Afrixa application -> Supabase URL/Auth/PostgREST/Storage/Realtime/Edge Functions. Supabase remains the only writer and source of truth.
2. **Standby preparation:** provision an isolated VPS, deploy PostgreSQL/PostgREST privately, restore schema, configure security and backups, then validate compatibility.
3. **Data protection:** choose a supported replication or recovery method only after checking Supabase plan, replication privileges, network access, WAL/slot availability, schema compatibility, and acceptable lag. Do not assume managed Supabase allows unrestricted physical replication.
4. **Failover:** operator-approved promotion only after fencing the old primary. Exactly one writable database is allowed. Update the application endpoint and any required service endpoints only after authentication, permissions, data integrity, and smoke tests pass.
5. **Recovery/failback:** restore the original service as a replica or reconcile changes using a documented procedure. Never simply point both environments at the same application traffic.

## 3. Implementation phases and acceptance gates

### Phase A — Host provisioning (blocked until a VPS is available)
- Select a VPS in a separate failure domain and record provider, region, CPU/RAM, disk, bandwidth, and monthly cost.
- Use an encrypted persistent disk with capacity alerts; restrict SSH to known administrators and use key-based access.
- Install supported Docker Engine and Compose; configure firewall, automatic security updates, time sync, monitoring, and log rotation.
- Keep PostgreSQL and PostgREST bound to loopback/private networking. Put any externally reachable API behind TLS reverse proxy, rate limits, and firewall rules.
- Generate unique high-entropy database and JWT secrets on the host. Store them in the host secret manager or protected environment file; never commit them.
- Acceptance: host hardened, disk persistent, ports private, secrets stored, Docker Compose configuration validates.

### Phase B — First boot and schema validation
- Start from a new empty data volume only; run the committed init scripts in order.
- Validate PostgreSQL readiness, PostgREST health, expected extension availability, all expected public tables, constraints, indexes, RLS flags, and policies.
- Check all foreign keys and confirm no unexpected public grants to `anon` or `authenticated`.
- Keep `service_role` credentials server-side only. Never embed an administrative or service-role secret in browser/mobile code.
- Acceptance: reproducible first boot, catalog counts match the snapshot, no critical SQL errors, and backup/restore smoke test passes.

### Phase C — Supabase-specific compatibility
- Review and port the archived public functions and triggers one by one; replace Supabase-only helpers and test each dependency.
- Implement an explicit identity/JWT strategy. The local `auth.users` compatibility table and helper functions are not a full Supabase Auth replacement; Supabase-issued tokens must not be assumed to work with the standby.
- Recreate least-privilege table grants and RLS policies based on actual application operations. Do not copy broad production grants without review.
- Decide replacements for Storage, Realtime, Edge Functions, scheduled jobs, webhooks, and secrets. Document URL/API differences.
- Acceptance: automated tests for signup/login/session refresh, profiles, feed, posts/videos, comments/likes/shares, messaging, live features, creator wallets/coins, marketplace, orders, payments/webhooks, moderation, and notifications.

### Phase D — Replication and recovery
- Compare available approaches: supported logical replication, scheduled encrypted backups plus restore, or application-level transactional outbox/dual-write with idempotency. Select only after validating source privileges and consistency requirements.
- Define RPO/RTO, replication-lag thresholds, alerting, backup frequency, retention, encryption, and off-site location.
- Prove restore to a clean host and verify row counts/checksums for selected critical tables.
- If logical replication is selected, explicitly handle DDL changes, sequences, large objects/storage files, deletes, and initial snapshot consistency.
- Acceptance: documented recovery test with measured RPO/RTO and no unexplained data divergence.

### Phase E — Controlled failover rehearsal
- Use a staging environment and synthetic/test data first.
- Simulate primary unavailability; fence or disable writes to the old primary before promoting the standby.
- Validate database writes, Auth/JWT, RLS, storage, realtime, Edge Functions, payment callbacks, notifications, and background jobs.
- Switch endpoint/configuration only through a reviewed release; verify client caches, PWA/mobile builds, CORS, DNS/TLS, and rollback path.
- Acceptance: signed rehearsal report, single-writer proof, no critical data loss, tested rollback/failback.

### Phase F — Production activation (separate approval required)
- Only after all gates pass, schedule a maintenance window, announce impact, freeze schema changes, take a final backup/snapshot, stop writes, synchronize final changes, fence primary, promote standby, switch traffic, and run smoke tests.
- Monitor errors, latency, database load, replication/recovery state, payment/webhook queues, and user reports.
- Keep a documented rollback decision point. Do not automatically fail back without reconciliation.
- Production cutover is not authorized by this planning document.

## 4. Configuration contract

- Current app variables remain `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID`.
- Standby-only secrets belong on the VPS or a server-side secret manager; they must not be prefixed with `VITE_` or exposed to clients.
- Do not place a PostgreSQL administrator password, replication password, PostgREST signing secret, Supabase service-role key, or payment provider secret in Git.
- A future cutover must introduce a tested backend/API abstraction or a deliberate client configuration release. Merely replacing the Supabase URL is insufficient because Auth, Storage, Realtime, and Edge Functions are separate services.

## 5. Operational safeguards

- No automatic failover until fencing, health checks, split-brain prevention, and recovery tests are proven.
- No bidirectional writes or active-active configuration.
- No schema migration on both databases independently; migrations must be versioned, reviewed, and applied in a controlled order.
- Every backup must be encrypted, access-controlled, retained according to policy, and periodically restored in a test environment.
- Never delete or recreate a non-empty PostgreSQL volume to rerun initialization scripts.
- Treat replication lag, backup age, disk space, certificate expiry, failed jobs, and health-check failures as monitored alerts.

## 6. Current blockers and next actions

1. Obtain/provision a dedicated VPS and confirm its monthly budget.
2. Deploy the committed Compose stack and run first-boot validation.
3. Inspect Supabase replication capabilities and privileges for this exact project/plan before choosing replication.
4. Complete function/trigger, Auth, RLS, Storage, Realtime, and Edge Function compatibility.
5. Test backups/restores and controlled failover in staging.
6. Request explicit production-cutover approval after evidence is reviewed.

**Until these blockers are cleared, Supabase remains primary and Afrixa continues operating exactly as it does today.**
