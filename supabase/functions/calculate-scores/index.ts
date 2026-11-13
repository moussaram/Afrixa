import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cronSecret = Deno.env.get('CRON_SECRET');
const VIDEO_BATCH_SIZE = 200;

function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!supabaseUrl || !serviceKey || !cronSecret) {
    console.error('Missing server configuration for calculate-scores');
    return new Response('Scheduled job is not configured', { status: 503 });
  }

  if (!safeEqual(request.headers.get('x-cron-secret') ?? '', cronSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let cursor: string | null = null;
  let processedVideos = 0;
  let calculatedScores = 0;
  let batches = 0;

  // Each RPC call scores one bounded page inside Postgres. The cursor is the
  // last UUID in the previous page, so the job has no arbitrary 500-video cap.
  while (true) {
    const { data, error } = await supabase.rpc('refresh_video_scores_batch', {
      p_after_video_id: cursor,
      p_batch_size: VIDEO_BATCH_SIZE,
    });

    if (error) {
      console.error('Unable to calculate a video-score batch', { cursor, error });
      return new Response('Unable to calculate video scores', { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    const processed = Number(result?.processed_videos ?? 0);
    const scored = Number(result?.scored_rows ?? 0);
    const nextCursor = typeof result?.next_after_video_id === 'string'
      ? result.next_after_video_id
      : null;
    const hasMore = Boolean(result?.has_more);

    processedVideos += processed;
    calculatedScores += scored;
    batches += 1;

    if (!hasMore || processed === 0) break;

    if (!nextCursor || nextCursor === cursor) {
      console.error('Video-score pagination did not advance', { cursor, nextCursor });
      return new Response('Video-score pagination could not advance', { status: 500 });
    }

    cursor = nextCursor;
  }

  return Response.json({
    processed_videos: processedVideos,
    calculated_scores: calculatedScores,
    batches,
  });
});
