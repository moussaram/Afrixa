import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceKey);

serve(async () => {
  const { data: users, error: usersError } = await supabase
    .from('user_interests')
    .select('user_id,categories,not_interested');
  if (usersError) return new Response(usersError.message, { status: 500 });

  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('id,user_id,title,description,views_count,likes_count,comments_count,shares_count,created_at,location_name')
    .eq('is_published', true)
    .limit(500);
  if (videosError) return new Response(videosError.message, { status: 500 });

  const rows = [];
  for (const user of users ?? []) {
    for (const video of videos ?? []) {
      const text = `${video.title ?? ''} ${video.description ?? ''}`.toLowerCase();
      const categoryMatch = (user.categories ?? []).some((category: string) => text.includes(category.toLowerCase())) ? 1 : 0;
      const views = Math.max(video.views_count ?? 0, 1);
      const engagementRate = ((video.likes_count ?? 0) + (video.comments_count ?? 0) + (video.shares_count ?? 0)) / views;
      const ageHours = (Date.now() - new Date(video.created_at).getTime()) / 36e5;
      const recency = ageHours < 48 ? 1 : Math.max(0, 1 - ageHours / 720);
      const score = Math.round(categoryMatch * 30 + Math.min(engagementRate, 1) * 25 + recency * 10);
      rows.push({ user_id: user.user_id, video_id: video.id, score, last_calculated: new Date().toISOString() });
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('video_scores').upsert(rows, { onConflict: 'video_id,user_id' });
    if (error) return new Response(error.message, { status: 500 });
  }

  return Response.json({ calculated: rows.length });
});
