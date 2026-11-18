-- Afrixa 2.0.0 - Chantier 1: Securite & Moderation

alter table public.profiles
  add column if not exists is_private boolean default false,
  add column if not exists who_can_comment text default 'everyone' check (who_can_comment in ('everyone', 'followers', 'nobody')),
  add column if not exists who_can_message text default 'everyone' check (who_can_message in ('everyone', 'followers', 'nobody')),
  add column if not exists allow_duet boolean default true,
  add column if not exists allow_stitch boolean default true;

alter table public.products
  add constraint products_price_positive check (price > 0) not valid,
  add constraint products_stock_non_negative check (stock >= 0) not valid,
  add constraint products_name_length check (char_length(name) <= 80) not valid;

create table if not exists public.rate_limits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  action text not null check (action in ('comment', 'message', 'video_upload', 'product_create', 'follow', 'report', 'tip')),
  count integer default 1,
  window_start timestamptz default now()
);

create table if not exists public.moderation_actions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('warning', 'restrict_24h', 'ban_7days', 'ban_permanent')),
  reason text not null,
  content_type text check (content_type in ('video', 'comment', 'product', 'message', 'profile')),
  content_id uuid,
  admin_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.banned_words (
  id uuid default gen_random_uuid() primary key,
  word text not null unique,
  language text default 'fr',
  severity text default 'medium' check (severity in ('low', 'medium', 'high'))
);

create table if not exists public.content_reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references auth.users(id) on delete set null,
  content_type text not null check (content_type in ('video', 'comment', 'product', 'message', 'profile')),
  content_id uuid not null,
  reason text not null,
  description text,
  status text default 'pending' check (status in ('pending', 'reviewed', 'action_taken', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.user_blocks (
  id uuid default gen_random_uuid() primary key,
  blocker_id uuid references auth.users(id) on delete cascade,
  blocked_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(blocker_id, blocked_id)
);

create table if not exists public.follow_requests (
  id uuid default gen_random_uuid() primary key,
  requester_id uuid references auth.users(id) on delete cascade,
  target_id uuid references auth.users(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  unique(requester_id, target_id)
);

create table if not exists public.login_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  country text,
  city text,
  device_name text,
  user_agent text,
  ip_address inet,
  is_suspicious boolean default false,
  created_at timestamptz default now()
);

alter table public.rate_limits enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.banned_words enable row level security;
alter table public.content_reports enable row level security;
alter table public.user_blocks enable row level security;
alter table public.follow_requests enable row level security;
alter table public.login_history enable row level security;

create policy "rate_limits_owner_select" on public.rate_limits for select using (auth.uid() = user_id);
create policy "rate_limits_owner_insert" on public.rate_limits for insert with check (auth.uid() = user_id);
create policy "rate_limits_owner_update" on public.rate_limits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "moderation_actions_owner_select" on public.moderation_actions for select using (auth.uid() = user_id);
create policy "banned_words_public_select" on public.banned_words for select using (true);

create policy "content_reports_owner_insert" on public.content_reports for insert with check (auth.uid() = reporter_id);
create policy "content_reports_owner_select" on public.content_reports for select using (auth.uid() = reporter_id);

create policy "user_blocks_owner_all" on public.user_blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

create policy "follow_requests_participants_select" on public.follow_requests for select using (auth.uid() = requester_id or auth.uid() = target_id);
create policy "follow_requests_requester_insert" on public.follow_requests for insert with check (auth.uid() = requester_id);
create policy "follow_requests_target_update" on public.follow_requests for update using (auth.uid() = target_id) with check (auth.uid() = target_id);

create policy "login_history_owner_select" on public.login_history for select using (auth.uid() = user_id);
create policy "login_history_owner_insert" on public.login_history for insert with check (auth.uid() = user_id);

insert into public.banned_words (word, language, severity)
values
  ('arnaque', 'fr', 'medium'),
  ('escroc', 'fr', 'medium'),
  ('haine', 'fr', 'high'),
  ('violence', 'fr', 'high'),
  ('spam', 'fr', 'low')
on conflict (word) do nothing;

create index if not exists rate_limits_user_action_idx on public.rate_limits(user_id, action, window_start desc);
create index if not exists moderation_actions_user_active_idx on public.moderation_actions(user_id, is_active, created_at desc);
create index if not exists content_reports_status_idx on public.content_reports(status, created_at desc);
create index if not exists content_reports_content_idx on public.content_reports(content_type, content_id);
create index if not exists user_blocks_blocker_idx on public.user_blocks(blocker_id, blocked_id);
create index if not exists follow_requests_target_idx on public.follow_requests(target_id, status);
create index if not exists login_history_user_created_idx on public.login_history(user_id, created_at desc);
