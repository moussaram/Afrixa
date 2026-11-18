-- Extensions actually installed in the Afrixa Supabase database.
-- pgcrypto and uuid-ossp are included for compatibility where available.
-- Supabase-only extensions (pg_graphql, supabase_vault) are intentionally excluded.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
