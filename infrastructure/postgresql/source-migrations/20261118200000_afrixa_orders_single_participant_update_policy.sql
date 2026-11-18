-- Consolidate order participant UPDATE access into one authenticated policy.
-- This avoids overlapping permissive UPDATE policies while retaining buyer/seller access.

DROP POLICY IF EXISTS "Buyers and sellers can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update their own orders" ON public.orders;

CREATE POLICY "Order participants can update their own orders"
  ON public.orders FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = buyer_id OR (SELECT auth.uid()) = seller_id)
  WITH CHECK ((SELECT auth.uid()) = buyer_id OR (SELECT auth.uid()) = seller_id);
