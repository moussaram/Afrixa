-- Phase 1 / Security: prevent client-side self-granting of paid creator entitlements.
-- Creator membership and subscription state must be written only by trusted
-- payment/webhook workflows. The current UI has no verified payment flow for
-- fan-club memberships, so direct activation is intentionally disabled.

BEGIN;

-- Creator Program: users may request enrollment (the existing integrity trigger
-- derives eligibility and level from the actual follows table), but cannot
-- edit or deactivate their entitlement row from the browser.
DROP POLICY IF EXISTS "creator_program_owner_update" ON public.creator_program;
DROP POLICY IF EXISTS "creator_program_own_all" ON public.creator_program;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.creator_program
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.creator_program TO authenticated;

-- Paid fan-club membership must never be created as active by an unverified
-- browser request. Keep owner reads; all writes are reserved for service_role.
DROP POLICY IF EXISTS "fan_club_memberships_owner_insert" ON public.fan_club_memberships;
DROP POLICY IF EXISTS "fan_club_memberships_owner_all" ON public.fan_club_memberships;
DROP POLICY IF EXISTS "fan_club_memberships_owner_select" ON public.fan_club_memberships;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.fan_club_memberships
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.fan_club_memberships TO authenticated;

CREATE POLICY "fan_club_memberships_owner_select"
  ON public.fan_club_memberships
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Subscription status and provider identifiers are payment-provider state,
-- never user-submitted state.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.premium_subscriptions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.premium_subscriptions TO authenticated;

-- Coin purchase requests may be created by their owner, but cannot be edited
-- or deleted by that owner after submission. Confirmation remains server-only.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.coin_purchases
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.coin_purchases TO authenticated;

-- These are append-only financial event streams. Explicit grants complement
-- RLS and ensure no client write path can be reopened by a permissive policy.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.coin_transactions, public.transactions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.coin_transactions, public.transactions TO authenticated;

COMMIT;
