-- Afrixa Creator Features v2.0.0

create table if not exists public.creator_program (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  level text default 'starter' check (level in ('starter', 'rising', 'verified', 'elite')),
  followers_at_join integer default 0,
  joined_at timestamptz default now(),
  is_active boolean default true
);

create table if not exists public.creator_earnings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  type text not null check (type in ('views_bonus', 'gift_received', 'tip_received', 'subscription_revenue')),
  amount integer not null,
  status text default 'pending' check (status in ('pending', 'confirmed', 'paid')),
  period_start date,
  period_end date,
  created_at timestamptz default now()
);

create table if not exists public.creator_wallet (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  balance integer default 0,
  pending integer default 0,
  total_earned integer default 0,
  withdrawal_operator text,
  withdrawal_phone text,
  updated_at timestamptz default now()
);

create table if not exists public.virtual_gifts (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  emoji text,
  price_coins integer not null,
  fcfa_value integer not null,
  animation text
);

create table if not exists public.gift_transactions (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users(id) on delete set null,
  receiver_id uuid references auth.users(id) on delete cascade,
  live_id uuid,
  gift_id uuid references public.virtual_gifts(id) on delete set null,
  coins_spent integer not null,
  fcfa_earned integer not null,
  created_at timestamptz default now()
);

create table if not exists public.afrixa_coins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  balance integer default 0,
  updated_at timestamptz default now()
);

create table if not exists public.video_analytics (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references public.videos(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  views integer default 0,
  unique_views integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  saves integer default 0,
  avg_watch_duration double precision default 0,
  completion_rate double precision default 0,
  traffic_source jsonb default '{}'::jsonb,
  audience_countries jsonb default '{}'::jsonb,
  recorded_date date default current_date,
  created_at timestamptz default now()
);

create table if not exists public.profile_analytics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  followers_count integer default 0,
  following_count integer default 0,
  total_views integer default 0,
  total_likes integer default 0,
  profile_visits integer default 0,
  new_followers integer default 0,
  lost_followers integer default 0,
  recorded_date date default current_date
);

create table if not exists public.collab_requests (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users(id) on delete cascade,
  receiver_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('duo', 'duet', 'stitch')),
  video_id uuid references public.videos(id) on delete set null,
  message text,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined', 'completed')),
  created_at timestamptz default now()
);

create table if not exists public.collab_videos (
  id uuid default gen_random_uuid() primary key,
  video_id uuid references public.videos(id) on delete cascade,
  creator_1 uuid references auth.users(id) on delete cascade,
  creator_2 uuid references auth.users(id) on delete cascade,
  type text check (type in ('duo', 'duet', 'stitch')),
  revenue_split double precision default 0.5,
  created_at timestamptz default now()
);

create table if not exists public.challenges (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  hashtag text not null unique,
  description text,
  cover_image text,
  prize_description text,
  prize_amount integer,
  sponsor_name text,
  sponsor_logo text,
  status text default 'active' check (status in ('active', 'ended', 'upcoming')),
  starts_at timestamptz,
  ends_at timestamptz,
  participants_count integer default 0,
  views_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.challenge_submissions (
  id uuid default gen_random_uuid() primary key,
  challenge_id uuid references public.challenges(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  rank integer,
  votes integer default 0,
  is_winner boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.series (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references auth.users(id) on delete cascade,
  title text not null,
  description text,
  cover_image text,
  category text,
  total_episodes integer default 0,
  subscribers_count integer default 0,
  is_complete boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.series_episodes (
  id uuid default gen_random_uuid() primary key,
  series_id uuid references public.series(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  episode_number integer not null,
  title text,
  created_at timestamptz default now()
);

create table if not exists public.series_subscriptions (
  id uuid default gen_random_uuid() primary key,
  series_id uuid references public.series(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(series_id, user_id)
);

create table if not exists public.spotlights (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('creator_of_week', 'video_of_week')),
  user_id uuid references auth.users(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.fan_clubs (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references auth.users(id) on delete cascade unique,
  name text,
  description text,
  price_monthly integer not null,
  perks text[],
  members_count integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.fan_club_memberships (
  id uuid default gen_random_uuid() primary key,
  fan_club_id uuid references public.fan_clubs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text default 'active' check (status in ('active', 'cancelled', 'expired')),
  current_period_start date,
  current_period_end date,
  flutterwave_subscription_id text,
  created_at timestamptz default now()
);

create table if not exists public.super_notifications (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references auth.users(id) on delete cascade,
  creator_id uuid references auth.users(id) on delete cascade,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(follower_id, creator_id)
);

alter table public.creator_program enable row level security;
alter table public.creator_earnings enable row level security;
alter table public.creator_wallet enable row level security;
alter table public.virtual_gifts enable row level security;
alter table public.gift_transactions enable row level security;
alter table public.afrixa_coins enable row level security;
alter table public.video_analytics enable row level security;
alter table public.profile_analytics enable row level security;
alter table public.collab_requests enable row level security;
alter table public.collab_videos enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_submissions enable row level security;
alter table public.series enable row level security;
alter table public.series_episodes enable row level security;
alter table public.series_subscriptions enable row level security;
alter table public.spotlights enable row level security;
alter table public.fan_clubs enable row level security;
alter table public.fan_club_memberships enable row level security;
alter table public.super_notifications enable row level security;

create policy "creator_program_select_all" on public.creator_program for select using (true);
create policy "creator_program_own_all" on public.creator_program for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "creator_earnings_owner_select" on public.creator_earnings for select using (auth.uid() = user_id);
create policy "creator_earnings_owner_insert" on public.creator_earnings for insert with check (auth.uid() = user_id);

create policy "creator_wallet_owner_all" on public.creator_wallet for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "virtual_gifts_select_all" on public.virtual_gifts for select using (true);

create policy "gift_transactions_participants_select" on public.gift_transactions for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "gift_transactions_sender_insert" on public.gift_transactions for insert with check (auth.uid() = sender_id);

create policy "afrixa_coins_owner_all" on public.afrixa_coins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "video_analytics_owner_select" on public.video_analytics for select using (auth.uid() = user_id);
create policy "profile_analytics_owner_select" on public.profile_analytics for select using (auth.uid() = user_id);

create policy "collab_requests_participants_all" on public.collab_requests for all using (auth.uid() = sender_id or auth.uid() = receiver_id) with check (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "collab_videos_select_all" on public.collab_videos for select using (true);

create policy "challenges_select_all" on public.challenges for select using (true);
create policy "challenge_submissions_select_all" on public.challenge_submissions for select using (true);
create policy "challenge_submissions_owner_insert" on public.challenge_submissions for insert with check (auth.uid() = user_id);

create policy "series_select_all" on public.series for select using (true);
create policy "series_owner_all" on public.series for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
create policy "series_episodes_select_all" on public.series_episodes for select using (true);
create policy "series_subscriptions_owner_all" on public.series_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "spotlights_select_active" on public.spotlights for select using (is_active = true);

create policy "fan_clubs_select_all" on public.fan_clubs for select using (true);
create policy "fan_clubs_owner_all" on public.fan_clubs for all using (auth.uid() = creator_id) with check (auth.uid() = creator_id);
create policy "fan_club_memberships_owner_select" on public.fan_club_memberships for select using (auth.uid() = user_id);
create policy "fan_club_memberships_owner_insert" on public.fan_club_memberships for insert with check (auth.uid() = user_id);

create policy "super_notifications_owner_all" on public.super_notifications for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);
create policy "super_notifications_creator_count" on public.super_notifications for select using (auth.uid() = creator_id or auth.uid() = follower_id);

insert into public.virtual_gifts (name, emoji, price_coins, fcfa_value, animation)
values
  ('Rose', '🌹', 10, 50, 'rose-pop'),
  ('Coeur', '💜', 50, 250, 'heart-burst'),
  ('Lion', '🦁', 200, 1000, 'lion-roar'),
  ('Couronne', '👑', 500, 2500, 'crown-glow'),
  ('Diamant', '💎', 2000, 10000, 'diamond-shine')
on conflict do nothing;

create index if not exists creator_earnings_user_created_idx on public.creator_earnings(user_id, created_at desc);
create index if not exists video_analytics_user_date_idx on public.video_analytics(user_id, recorded_date desc);
create index if not exists profile_analytics_user_date_idx on public.profile_analytics(user_id, recorded_date desc);
create index if not exists challenges_status_dates_idx on public.challenges(status, starts_at, ends_at);
create index if not exists series_creator_idx on public.series(creator_id, created_at desc);
create index if not exists super_notifications_creator_idx on public.super_notifications(creator_id) where is_active = true;
