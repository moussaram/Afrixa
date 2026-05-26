import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { transaction_id, tx_ref, expected_amount } = await req.json();
    if (!transaction_id || !tx_ref) {
      return new Response(JSON.stringify({ error: 'transaction_id and tx_ref required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify with Flutterwave
    const flwRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const flwData = await flwRes.json();

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const verified =
      flwData?.status === 'success' &&
      flwData?.data?.status === 'successful' &&
      flwData?.data?.tx_ref === tx_ref &&
      (!expected_amount || Number(flwData.data.amount) >= Number(expected_amount));

    // Update payment_transactions by ref
    const { data: tx } = await supabase
      .from('payment_transactions')
      .select('id, order_id, commission_amount, seller_amount')
      .eq('flutterwave_ref', tx_ref)
      .maybeSingle();

    if (tx) {
      await supabase
        .from('payment_transactions')
        .update({
          status: verified ? 'successful' : 'failed',
          flutterwave_tx_id: String(transaction_id),
          flutterwave_response: flwData,
          escrow_status: verified ? 'held' : 'refunded',
        })
        .eq('id', tx.id);

      await supabase
        .from('orders')
        .update({ status: verified ? 'payee' : 'annulee' })
        .eq('id', tx.order_id);
    }

    return new Response(JSON.stringify({ verified, flwData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
