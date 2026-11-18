# Supabase-to-PostgreSQL schema export notes

Snapshot date: 2026-11-18  
Supabase project: `kxxwdiyloplkoyperwty`

## Export inventory

- 69 tables in the live `public` schema.
- 126 row-level security policies in `public`.
- All live table columns, defaults, nullability, constraints and indexes exported to `schema_snapshot.sql`.
- RLS enablement and policy expressions exported to the snapshot.
- 18 live public SQL functions and 25 triggers exported to `port-review/functions-and-triggers.sql`.
- 24 original migration SQL sources archived under `source-migrations/`.
- One missing video-engagement migration reconstructed from the live database catalog and named with the `.reconstructed.sql` suffix.
- Live migration ledger contains 25 entries.

## Deliberately not copied

- User records and other production data.
- Supabase Auth credentials, password hashes, refresh tokens and active sessions.
- Storage objects and bucket contents.
- Realtime replication state, Edge Function secrets and external provider credentials.
- Supabase-managed extension schemas and internals such as `vault` and `graphql`.
- Broad table grants. The source catalog currently reports 1,919 role-table grant rows, including extensive grants to `anon` and `authenticated`; do not reproduce these without a least-privilege review.

## Standalone compatibility

`init/00-auth-compat.sql` supplies only the small `auth.users` reference table and `auth.uid()`, `auth.jwt()`, `auth.role()` helpers needed by the exported RLS expressions. It is not a complete identity system. A trusted external authentication service must issue signed JWTs compatible with the PostgREST secret.

The snapshot is loaded on first initialization through Docker's init directory. It is a schema baseline, not yet a production-ready replacement: business functions/triggers need dependency-by-dependency porting; least-privilege grants, external storage, Realtime, Edge Functions, data replication and failover remain to be implemented and tested.

## Validation required

Run the stack on a disposable VPS/test environment, confirm all 69 tables and 126 policies exist, compare constraints/indexes, then port and test functions/triggers. Never test the initial import against a volume containing valuable data.
