import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const getOperatorCode = (operator: string): string => {
  const codes: Record<string, string> = {
    orange_money: 'ORANGE',
    wave: 'WAVE',
    mtn: 'MTN',
    moov: 'MOOV',
  };
  return codes[operator] || 'ORANGE';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth: only buyer can release
    const authHeader = req.headers.get('Authorization') ?? '';
    const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await anonClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .maybeSingle();

    if (orderErr || !order) throw new Error('Commande introuvable');
    if (order.buyer_id !== userId) throw new Error('Non autorisé');
    if (order.escrow_released) throw new Error('Escrow déjà libéré');

    const { data: tx } = await admin
      .from('payment_transactions')
      .select('*')
      .eq('order_id', order_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: sellerProfile, error: sellerErr } = await admin
      .from('profiles')
      .select('numero_mobile')
      .eq('user_id', order.seller_id)
      .maybeSingle();

    if (sellerErr) throw sellerErr;

    const sellerPhone = sellerProfile?.numero_mobile;
    if (!sellerPhone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Numéro Mobile Money vendeur indisponible' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sellerOperator = order.payment_operator || 'orange_money';
    const payoutRef = `PAYOUT-${order_id}-${Date.now()}`;

    // Flutterwave transfer
    const transferRes = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank: getOperatorCode(sellerOperator),
        account_number: sellerPhone,
        amount: order.seller_amount,
        currency: 'XOF',
        narration: `Paiement Afrixa commande ${order_id.slice(0, 8)}`,
        reference: payoutRef,
        beneficiary_name: 'Afrixa Seller',
      }),
    });
    const transferData = await transferRes.json();
    const transferOk = transferData?.status === 'success';

    if (transferOk) {
      if (tx) {
        await admin
          .from('payment_transactions')
          .update({ escrow_status: 'released' })
          .eq('id', tx.id);
      }

      await admin
        .from('orders')
        .update({ status: 'terminee', escrow_released: true })
        .eq('id', order_id);

      await admin.from('seller_payouts').insert({
        seller_id: order.seller_id,
        order_id,
        amount: order.seller_amount,
        operator: sellerOperator,
        phone: sellerPhone,
        status: 'envoye',
        payout_reference: payoutRef,
      });

      await admin.from('commissions').insert({
        order_id,
        amount: order.commission_amount,
        rate: order.commission_rate,
        type: 'normale',
        status: 'percue',
      });

      await admin.from('notifications').insert({
        user_id: order.seller_id,
        type: 'paiement',
        title: 'Paiement reçu',
        message: `💸 ${order.seller_amount.toLocaleString()} FCFA reçus pour votre commande`,
        order_id,
      });

      return new Response(
        JSON.stringify({ success: true, reference: payoutRef, transferData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.error('Transfer failed', transferData);
    return new Response(
      JSON.stringify({ success: false, error: transferData?.message || 'Transfert échoué' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
