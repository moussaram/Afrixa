import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceKey);

serve(async () => {
  const { error, count } = await supabase
    .from('stories')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString())
    .eq('is_archived', false);

  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ deleted: count ?? 0 });
});
