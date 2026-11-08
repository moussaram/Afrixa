-- Recover Cloudflare Stream identifiers for legacy uploads created by Afrixa.
-- This allows the signed-URL backfill function to protect those assets too.
BEGIN;

UPDATE public.videos AS video
SET cloudflare_uid = lower(substring(
  video.hls_url
  FROM 'cloudflarestream\.com/([a-f0-9]{32})/manifest/video\.m3u8'
))
WHERE video.cloudflare_uid IS NULL
  AND video.hls_url ~* '^https://customer-[a-z0-9-]+\.cloudflarestream\.com/[a-f0-9]{32}/manifest/video\.m3u8$'
  AND NOT EXISTS (
    SELECT 1
    FROM public.videos AS existing_video
    WHERE existing_video.cloudflare_uid = lower(substring(
      video.hls_url
      FROM 'cloudflarestream\.com/([a-f0-9]{32})/manifest/video\.m3u8'
    ))
  );

COMMIT;
