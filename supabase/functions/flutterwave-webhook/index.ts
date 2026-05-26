import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('FLW_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (WEBHOOK_SECRET) {
      const hash = req.headers.get('verif-hash');
      if (hash !== WEBHOOK_SECRET) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }
    }

    const payload = await req.json();
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (payload.event === 'charge.completed' && payload.data?.status === 'successful') {
      const txRef = payload.data.tx_ref;
      const txId = payload.data.id;

      // Verify with Flutterwave
      const verifyRes = await fetch(
        `https://api.flutterwave.com/v3/transactions/${txId}/verify`,
        { headers: { Authorization: `Bearer ${SECRET}` } },
      );
      const verifyData = await verifyRes.json();

      if (verifyData?.data?.status === 'successful' && verifyData?.data?.tx_ref === txRef) {
        const { data: tx } = await supabase
          .from('payment_transactions')
          .select('id, order_id')
          .eq('flutterwave_ref', txRef)
          .maybeSingle();

        if (tx) {
          await supabase
            .from('payment_transactions')
            .update({
              status: 'successful',
              flutterwave_tx_id: String(txId),
              flutterwave_response: verifyData,
              escrow_status: 'held',
            })
            .eq('id', tx.id);

          await supabase.from('orders').update({ status: 'payee' }).eq('id', tx.order_id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
