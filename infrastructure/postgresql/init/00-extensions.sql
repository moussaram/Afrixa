-- Portable extension required by the current Afrixa SQL baseline.
-- gen_random_uuid() is built into supported PostgreSQL versions; pgcrypto is retained for compatibility.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
