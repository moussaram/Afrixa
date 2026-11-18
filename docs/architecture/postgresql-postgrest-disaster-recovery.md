# Afrixa PostgreSQL/PostgREST disaster recovery

## Current phase: isolated foundation

- Docker Compose for PostgreSQL 17 and PostgREST 12.2.
- Persistent named volume and health checks.
- Loopback-only published ports.
- Restricted PostgREST authenticator role.
- No production data replication, traffic switch, or frontend cutover.

## Production gates

### Infrastructure
- Provision a VPS in a separate failure domain from Supabase.
- Configure encrypted persistent storage, firewall, TLS/private networking and monitoring.
- Configure encrypted off-site backups and prove a restore works.

### Data compatibility
- Inventory schemas, extensions, triggers, RLS policies and functions.
- Review Supabase-managed auth, storage and realtime objects; do not blindly copy internal schemas.
- Select and test a supported replication method, initial snapshot, ongoing changes, lag monitoring and consistency checks.

### Application compatibility
- Define a trusted JWT issuer and role/claim mapping.
- Reimplement and test authorization/RLS policies.
- Provide replacements for object storage, realtime and Edge Functions.
- Test uploads, messaging, notifications, payments, moderation and marketplace flows.

### Failover
- Monitor the primary independently.
- Require controlled promotion with fencing and exactly one writable primary.
- Define RPO/RTO, test failover, reconcile data, and validate before failback.

## Explicit non-goals

This change does not provision a VPS, deploy containers, create credentials, modify Supabase, replicate live data, or switch Afrixa traffic.
