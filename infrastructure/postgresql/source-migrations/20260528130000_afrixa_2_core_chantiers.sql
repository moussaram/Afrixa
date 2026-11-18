-- Afrixa 2.0.0 - Chantiers 3 a 17

create table if not exists public.sounds (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  artist text,
  cover_url text,
  audio_url text not null,
  duration double precision,
  type text default 'music' check (type in ('music', 'original', 'effect')),
  category text,
  uses_count integer default 0,
  is_trending boolean default false,
  source_video_id uuid,
  creator_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.series (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  created_at timestamptz default now()
);

alter table public.videos
  add column if not exists duration double precision,
  add column if not exists file_size integer,
  add column if not exists resolution text,
  add column if not exists audio_track text,
  add column if not exists sound_id uuid references public.sounds(id),
  add column if not exists allow_duet boolean default true,
  add column if not exists allow_stitch boolean default true,
  add column if not exists allow_download boolean default true,
  add column if not exists is_exclusive boolean default false,
  add column if not exists series_id uuid references public.series(id),
  add column if not exists episode_number integer,
  add column if not exists tagged_products uuid[],
  add column if not exists cover_timestamp double precision default 0,
  add column if not exists comments_count integer default 0,
  add column if not exists comments_disabled boolean default false,
  add column if not exists search_vector tsvector generated always as (
    to_tsvector('french', coalesce(title,'') || ' ' || coalesce(description,''))
  ) stored;

create table if not exists public.video_watch_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  watch_duration double precision default 0,
  completion_rate double precision default 0,
  last_position double precision default 0,
  watch_count integer default 1,
  last_watched_at timestamptz default now(),
  unique(user_id, video_id)
);

create table if not exists public.comments (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references public.videos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  content text not null check (char_length(content) <= 500 and content !~* '<script'),
  likes_count integer default 0,
  replies_count integer default 0,
  is_pinned boolean default false,
  is_deleted boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.comment_likes (
  id uuid default gen_random_uuid() primary key,
  comment_id uuid references public.comments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  unique(comment_id, user_id)
);

create table if not exists public.comment_mentions (
  id uuid default gen_random_uuid() primary key,
  comment_id uuid references public.comments(id) on delete cascade,
  mentioned_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.stories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('photo', 'video', 'text')),
  media_url text,
  text_content text,
  text_color text default '#FFFFFF',
  background_color text default '#7C3AED',
  duration integer default 5 check (duration between 5 and 15),
  views_count integer default 0,
  expires_at timestamptz default now() + interval '24 hours',
  is_archived boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.story_views (
  id uuid default gen_random_uuid() primary key,
  story_id uuid references public.stories(id) on delete cascade,
  viewer_id uuid references auth.users(id) on delete cascade,
  viewed_at timestamptz default now(),
  unique(story_id, viewer_id)
);

create table if not exists public.user_interests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  categories text[] default '{}',
  not_interested text[] default '{}',
  updated_at timestamptz default now()
);

create table if not exists public.video_scores (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references public.videos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  score double precision default 0,
  last_calculated timestamptz default now(),
  unique(video_id, user_id)
);

create table if not exists public.ad_campaigns (
  id uuid default gen_random_uuid() primary key,
  advertiser_name text not null,
  advertiser_email text not null,
  title text not null,
  description text,
  media_url text not null,
  media_type text check (media_type in ('image', 'video')),
  cta_text text,
  cta_url text,
  budget integer not null,
  spent integer default 0,
  cpc integer default 50,
  target_countries text[] default '{CI,SN,ML,BF,GN}',
  target_age_min integer default 16,
  target_age_max integer default 45,
  target_interests text[],
  impressions integer default 0,
  clicks integer default 0,
  status text default 'pending' check (status in ('pending', 'active', 'paused', 'completed', 'rejected')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.ad_impressions (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.ad_campaigns(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  clicked boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.premium_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  plan text default 'monthly' check (plan in ('monthly', 'yearly')),
  price integer not null,
  status text default 'active' check (status in ('active', 'cancelled', 'expired')),
  current_period_start date,
  current_period_end date,
  flutterwave_sub_id text,
  created_at timestamptz default now()
);

alter table public.profiles
  add column if not exists is_premium boolean default false,
  add column if not exists premium_expires_at timestamptz;

create table if not exists public.coin_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  coins_amount integer not null,
  fcfa_paid integer not null,
  operator text not null,
  flutterwave_ref text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.coin_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('sent_gift', 'received_gift', 'sent_tip', 'received_tip', 'purchased', 'withdrawn')),
  amount integer not null,
  reference_id uuid,
  description text,
  created_at timestamptz default now()
);

create index if not exists idx_videos_user_id on public.videos(user_id);
create index if not exists idx_videos_created_at on public.videos(created_at desc);
create index if not exists videos_search_idx on public.videos using gin(search_vector);
create index if not exists idx_products_seller_id on public.products(seller_id);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_orders_buyer_id on public.orders(buyer_id);
create index if not exists idx_orders_seller_id on public.orders(seller_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id, is_read);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id, created_at);
create index if not exists idx_comments_video_id on public.comments(video_id, created_at desc);
create index if not exists idx_stories_user_id on public.stories(user_id, expires_at);
create index if not exists idx_video_scores_user_score on public.video_scores(user_id, score desc);

alter table public.sounds enable row level security;
alter table public.video_watch_history enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.comment_mentions enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.user_interests enable row level security;
alter table public.video_scores enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_impressions enable row level security;
alter table public.premium_subscriptions enable row level security;
alter table public.coin_purchases enable row level security;
alter table public.coin_transactions enable row level security;

create policy "sounds_public_select" on public.sounds for select using (true);
create policy "video_watch_history_owner_all" on public.video_watch_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "comments_public_select" on public.comments for select using (is_deleted = false);
create policy "comments_owner_insert" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_owner_update" on public.comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "comment_likes_owner_all" on public.comment_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "comment_mentions_public_select" on public.comment_mentions for select using (true);
create policy "stories_public_select" on public.stories for select using (expires_at > now() and is_archived = false);
create policy "stories_owner_all" on public.stories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "story_views_owner_all" on public.story_views for all using (auth.uid() = viewer_id) with check (auth.uid() = viewer_id);
create policy "user_interests_owner_all" on public.user_interests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "video_scores_owner_select" on public.video_scores for select using (auth.uid() = user_id);
create policy "ad_campaigns_public_active_select" on public.ad_campaigns for select using (status = 'active');
create policy "ad_impressions_owner_insert" on public.ad_impressions for insert with check (auth.uid() = user_id or user_id is null);
create policy "premium_subscriptions_owner_select" on public.premium_subscriptions for select using (auth.uid() = user_id);
create policy "coin_purchases_owner_select" on public.coin_purchases for select using (auth.uid() = user_id);
create policy "coin_purchases_owner_insert" on public.coin_purchases for insert with check (auth.uid() = user_id);
create policy "coin_transactions_owner_select" on public.coin_transactions for select using (auth.uid() = user_id);
