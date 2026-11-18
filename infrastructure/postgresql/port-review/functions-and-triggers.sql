-- Reference export of live public functions and triggers from Afrixa Supabase.
-- Generated 2026-11-18. REVIEW BEFORE EXECUTING on standalone PostgreSQL.
-- Some functions depend on Supabase services, auth/storage internals, secrets, or extensions.
-- Keep this file out of the automatic Docker init directory until each dependency is ported.

-- FUNCTIONS (18)
CREATE OR REPLACE FUNCTION public.calculate_order_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.total_price := NEW.unit_price * NEW.quantity;
  NEW.commission_amount := ROUND(NEW.total_price * NEW.commission_rate);
  NEW.seller_amount := NEW.total_price - NEW.commission_amount;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.consume_rate_limit(p_user_id uuid, p_action text, p_limit integer, p_window interval)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  rate_row public.rate_limits%ROWTYPE;
  next_count integer;
BEGIN
  IF p_user_id IS NULL OR p_limit < 1 OR p_window <= interval '0 seconds'
    OR p_action NOT IN ('comment', 'message', 'video_upload', 'product_create', 'follow', 'report', 'tip') THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters';
  END IF;

  -- One transaction-level lock per user and action prevents parallel requests
  -- from reading and updating the same counter concurrently.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext(p_action));

  SELECT * INTO rate_row
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND action = p_action
    AND window_start >= now() - p_window
  ORDER BY window_start DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (user_id, action, count, window_start)
    VALUES (p_user_id, p_action, 1, now());
    RETURN jsonb_build_object('allowed', true, 'remaining', p_limit - 1, 'limit', p_limit);
  END IF;

  IF COALESCE(rate_row.count, 0) >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'limit', p_limit);
  END IF;

  next_count := COALESCE(rate_row.count, 0) + 1;
  UPDATE public.rate_limits
  SET count = next_count
  WHERE id = rate_row.id;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', greatest(p_limit - next_count, 0),
    'limit', p_limit
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.enforce_creator_program_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actual_followers integer;
  caller_role text := coalesce(auth.role(), '');
BEGIN
  IF caller_role <> 'service_role' AND auth.uid() IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Creator program rows may only be changed by their owner';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT count(*)::integer INTO actual_followers
    FROM public.follows
    WHERE following_id = NEW.user_id;

    IF actual_followers < 500 THEN
      RAISE EXCEPTION 'At least 500 followers are required to join the creator program';
    END IF;

    NEW.followers_at_join := actual_followers;
    NEW.level := CASE
      WHEN actual_followers >= 500000 THEN 'elite'
      WHEN actual_followers >= 50000 THEN 'verified'
      WHEN actual_followers >= 5000 THEN 'rising'
      ELSE 'starter'
    END;
    NEW.is_active := true;
    RETURN NEW;
  END IF;

  IF caller_role <> 'service_role' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.level IS DISTINCT FROM OLD.level
      OR NEW.followers_at_join IS DISTINCT FROM OLD.followers_at_join
      OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
      RAISE EXCEPTION 'Creator program level and join details are managed by Afrixa';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.enforce_dispute_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  order_row public.orders%ROWTYPE;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR NEW.buyer_id IS DISTINCT FROM auth.uid()
      OR NEW.status <> 'ouvert' OR NEW.admin_decision IS NOT NULL
      OR NEW.seller_evidence IS NOT NULL THEN
      RAISE EXCEPTION 'Only the buyer may open an unresolved dispute';
    END IF;

    SELECT * INTO order_row
    FROM public.orders
    WHERE id = NEW.order_id AND buyer_id = auth.uid();

    IF NOT FOUND OR order_row.seller_id IS DISTINCT FROM NEW.seller_id
      OR order_row.status NOT IN ('payee', 'en_preparation', 'expediee', 'livree')
      OR order_row.escrow_released THEN
      RAISE EXCEPTION 'This order is not eligible for a dispute';
    END IF;

    NEW.created_at := now();
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.buyer_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.order_id IS DISTINCT FROM OLD.order_id
      OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
      OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
      OR NEW.reason IS DISTINCT FROM OLD.reason
      OR NEW.seller_evidence IS DISTINCT FROM OLD.seller_evidence
      OR NEW.admin_decision IS DISTINCT FROM OLD.admin_decision
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Buyers may only add evidence to an open dispute';
    END IF;
  ELSIF auth.uid() = OLD.seller_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.order_id IS DISTINCT FROM OLD.order_id
      OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
      OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
      OR NEW.reason IS DISTINCT FROM OLD.reason
      OR NEW.buyer_evidence IS DISTINCT FROM OLD.buyer_evidence
      OR NEW.admin_decision IS DISTINCT FROM OLD.admin_decision
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Sellers may only add evidence to an open dispute';
    END IF;
  ELSE
    RAISE EXCEPTION 'Only dispute participants may add evidence';
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.enforce_order_checkout_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  product_row public.products%ROWTYPE;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL OR NEW.buyer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'A buyer may only create their own order';
    END IF;
    IF NEW.product_id IS NULL OR NEW.quantity IS NULL OR NEW.quantity < 1 THEN
      RAISE EXCEPTION 'A valid product and quantity are required';
    END IF;

    SELECT * INTO product_row
    FROM public.products
    WHERE id = NEW.product_id AND is_active = true
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product is unavailable';
    END IF;
    IF product_row.seller_id = NEW.buyer_id THEN
      RAISE EXCEPTION 'A seller cannot buy their own product';
    END IF;
    IF NOT product_row.unlimited_stock AND COALESCE(product_row.stock, 0) < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient product stock';
    END IF;

    NEW.seller_id := product_row.seller_id;
    NEW.product_name := product_row.name;
    NEW.product_image := product_row.images[1];
    NEW.unit_price := product_row.price;
    NEW.commission_rate := CASE WHEN product_row.is_group_buy THEN 0.03 ELSE 0.05 END;
    NEW.status := 'en_attente';
    NEW.escrow_released := false;
    NEW.tracking_number := NULL;
    NEW.shipped_at := NULL;
    NEW.buyer_confirmed_at := NULL;
    NEW.released_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
    OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
    OR NEW.product_id IS DISTINCT FROM OLD.product_id
    OR NEW.product_name IS DISTINCT FROM OLD.product_name
    OR NEW.product_image IS DISTINCT FROM OLD.product_image
    OR NEW.quantity IS DISTINCT FROM OLD.quantity
    OR NEW.unit_price IS DISTINCT FROM OLD.unit_price
    OR NEW.total_price IS DISTINCT FROM OLD.total_price
    OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
    OR NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
    OR NEW.seller_amount IS DISTINCT FROM OLD.seller_amount
    OR NEW.payment_operator IS DISTINCT FROM OLD.payment_operator
    OR NEW.buyer_phone IS DISTINCT FROM OLD.buyer_phone
    OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
    OR NEW.escrow_released IS DISTINCT FROM OLD.escrow_released
    OR NEW.buyer_confirmed_at IS DISTINCT FROM OLD.buyer_confirmed_at
    OR NEW.released_at IS DISTINCT FROM OLD.released_at THEN
    RAISE EXCEPTION 'Checkout and escrow fields cannot be changed by a client';
  END IF;

  IF NEW.tracking_number IS DISTINCT FROM OLD.tracking_number
    OR NEW.shipped_at IS DISTINCT FROM OLD.shipped_at THEN
    IF auth.uid() IS DISTINCT FROM OLD.seller_id THEN
      RAISE EXCEPTION 'Only the seller may update shipment tracking';
    END IF;
    IF OLD.status NOT IN ('payee', 'en_preparation', 'expediee') THEN
      RAISE EXCEPTION 'Shipment details cannot be changed in this order state';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() = OLD.buyer_id AND NEW.status = 'livree' AND OLD.status = 'expediee' THEN
      RETURN NEW;
    END IF;
    IF auth.uid() = OLD.seller_id
      AND ((OLD.status = 'payee' AND NEW.status = 'en_preparation')
        OR (OLD.status = 'en_preparation' AND NEW.status = 'expediee')) THEN
      RETURN NEW;
    END IF;
    IF auth.uid() = OLD.buyer_id AND NEW.status = 'litige'
      AND OLD.status IN ('payee', 'en_preparation', 'expediee', 'livree') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'This order status transition must be performed through the authorized flow';
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.enforce_payment_transaction_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  order_row public.orders%ROWTYPE;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Payment transaction updates are server-only';
  END IF;

  SELECT * INTO order_row
  FROM public.orders
  WHERE id = NEW.order_id AND buyer_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found for this buyer'; END IF;
  IF order_row.status <> 'en_attente'
    OR NEW.fedapay_ref IS DISTINCT FROM order_row.payment_reference THEN
    RAISE EXCEPTION 'Payment reference is not valid for this order';
  END IF;

  NEW.amount := order_row.total_price;
  NEW.commission_amount := order_row.commission_amount;
  NEW.seller_amount := order_row.seller_amount;
  NEW.currency := 'XOF';
  NEW.status := 'initiated';
  NEW.fedapay_transaction_id := NULL;
  NEW.fedapay_payment_ref := NULL;
  NEW.fedapay_response := NULL;
  NEW.escrow_status := 'held';
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email_verifie)
  VALUES (
    NEW.id,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, false)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.prevent_seller_wallet_ledger_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'Le journal du portefeuille vendeur est immuable';
END;
$function$


CREATE OR REPLACE FUNCTION public.record_order_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.order_timeline (order_id, status, message)
  VALUES (NEW.id, NEW.status, 'Commande créée');
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.record_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  status_message text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'en_attente' THEN status_message := 'Commande créée';
      WHEN 'payee' THEN status_message := 'Paiement confirmé';
      WHEN 'en_preparation' THEN status_message := 'Le vendeur prépare votre commande';
      WHEN 'expediee' THEN status_message := 'Commande expédiée';
      WHEN 'livree' THEN status_message := 'Livraison confirmée';
      WHEN 'terminee' THEN status_message := 'Commande terminée';
      WHEN 'litige' THEN status_message := 'Litige ouvert';
      WHEN 'annulee' THEN status_message := 'Commande annulée';
      ELSE status_message := 'Statut mis à jour';
    END CASE;

    INSERT INTO public.order_timeline (order_id, status, message)
    VALUES (NEW.id, NEW.status, status_message);
  END IF;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$


CREATE OR REPLACE FUNCTION public.set_profile_verification_from_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(auth_user.phone_confirmed_at IS NOT NULL, false),
    COALESCE(auth_user.email_confirmed_at IS NOT NULL, false)
  INTO NEW.mobile_verifie, NEW.email_verifie
  FROM auth.users AS auth_user
  WHERE auth_user.id = NEW.user_id;

  IF NOT FOUND THEN
    NEW.mobile_verifie := false;
    NEW.email_verifie := false;
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.sync_comment_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  old_active boolean := false;
  new_active boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    old_active := NOT OLD.is_deleted;
    IF old_active THEN
      IF OLD.parent_id IS NULL THEN
        UPDATE public.videos
        SET comments_count = greatest(coalesce(comments_count, 0) - 1, 0)
        WHERE id = OLD.video_id;
      ELSE
        UPDATE public.comments
        SET replies_count = greatest(coalesce(replies_count, 0) - 1, 0)
        WHERE id = OLD.parent_id;
      END IF;
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    new_active := NOT NEW.is_deleted;
    IF new_active THEN
      IF NEW.parent_id IS NULL THEN
        UPDATE public.videos
        SET comments_count = coalesce(comments_count, 0) + 1
        WHERE id = NEW.video_id;
      ELSE
        UPDATE public.comments
        SET replies_count = coalesce(replies_count, 0) + 1
        WHERE id = NEW.parent_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$function$


CREATE OR REPLACE FUNCTION public.sync_comment_like_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  target_comment_id uuid;
  count_delta integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_comment_id := OLD.comment_id;
    count_delta := -1;
  ELSE
    target_comment_id := NEW.comment_id;
    count_delta := 1;
  END IF;

  UPDATE public.comments
  SET likes_count = greatest(coalesce(likes_count, 0) + count_delta, 0)
  WHERE id = target_comment_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.sync_profile_verification_from_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO UPDATE
    SET mobile_verifie = EXCLUDED.mobile_verifie,
        email_verifie = EXCLUDED.email_verifie;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.sync_video_engagement_counts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  target_video_id uuid;
  count_delta integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_video_id := OLD.video_id;
    count_delta := -1;
  ELSE
    target_video_id := NEW.video_id;
    count_delta := 1;
  END IF;

  IF TG_TABLE_NAME = 'video_likes' THEN
    UPDATE public.videos
    SET likes_count = greatest(coalesce(likes_count, 0) + count_delta, 0)
    WHERE id = target_video_id;
  ELSIF TG_TABLE_NAME = 'video_saves' THEN
    UPDATE public.videos
    SET saves_count = greatest(coalesce(saves_count, 0) + count_delta, 0)
    WHERE id = target_video_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.conversations
  SET
    last_message = NEW.content,
    last_message_at = NEW.created_at,
    last_sender_id = NEW.sender_id,
    unread_count_1 = CASE WHEN participant_1 != NEW.sender_id THEN unread_count_1 + 1 ELSE unread_count_1 END,
    unread_count_2 = CASE WHEN participant_2 != NEW.sender_id THEN unread_count_2 + 1 ELSE unread_count_2 END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$


-- TRIGGERS (25)
CREATE TRIGGER update_coin_balances_updated_at BEFORE UPDATE ON coin_balances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sync_comment_like_counts AFTER INSERT OR DELETE ON comment_likes FOR EACH ROW EXECUTE FUNCTION sync_comment_like_counts();

CREATE TRIGGER sync_comment_counts AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON comments FOR EACH ROW EXECUTE FUNCTION sync_comment_counts();

CREATE TRIGGER creator_program_integrity BEFORE INSERT OR UPDATE ON creator_program FOR EACH ROW EXECUTE FUNCTION enforce_creator_program_integrity();

CREATE TRIGGER dispute_integrity BEFORE INSERT OR UPDATE ON disputes FOR EACH ROW EXECUTE FUNCTION enforce_dispute_integrity();

CREATE TRIGGER update_help_messages_updated_at BEFORE UPDATE ON help_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_new_message AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER a_order_checkout_integrity BEFORE INSERT OR UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION enforce_order_checkout_integrity();

CREATE TRIGGER calculate_commission_before_insert BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION calculate_order_commission();

CREATE TRIGGER calculate_commission_before_update BEFORE UPDATE OF unit_price, quantity, commission_rate ON orders FOR EACH ROW EXECUTE FUNCTION calculate_order_commission();

CREATE TRIGGER record_order_creation AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION record_order_creation();

CREATE TRIGGER record_status_change AFTER UPDATE OF status ON orders FOR EACH ROW EXECUTE FUNCTION record_order_status_change();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER payment_transaction_integrity BEFORE INSERT OR UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION enforce_payment_transaction_integrity();

CREATE TRIGGER update_payment_tx_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER profiles_verification_from_auth BEFORE INSERT OR UPDATE OF user_id, mobile_verifie, email_verifie ON profiles FOR EACH ROW EXECUTE FUNCTION set_profile_verification_from_auth();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER seller_wallet_ledger_append_only BEFORE DELETE OR UPDATE ON seller_wallet_ledger FOR EACH ROW EXECUTE FUNCTION prevent_seller_wallet_ledger_mutation();

CREATE TRIGGER update_user_fcm_tokens_updated_at BEFORE UPDATE ON user_fcm_tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_video_comments_updated_at BEFORE UPDATE ON video_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sync_video_like_counts AFTER INSERT OR DELETE ON video_likes FOR EACH ROW EXECUTE FUNCTION sync_video_engagement_counts();

CREATE TRIGGER sync_video_save_counts AFTER INSERT OR DELETE ON video_saves FOR EACH ROW EXECUTE FUNCTION sync_video_engagement_counts();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
