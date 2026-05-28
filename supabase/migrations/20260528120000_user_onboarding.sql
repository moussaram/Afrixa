-- Afrixa 2.0.0 - Chantier 2: Onboarding utilisateur

create table if not exists public.user_onboarding (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique,
  step_completed integer default 0 check (step_completed between 0 and 5),
  interests text[] default '{}',
  onboarding_done boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_onboarding enable row level security;

create policy "user_onboarding_owner_select"
  on public.user_onboarding for select
  using (auth.uid() = user_id);

create policy "user_onboarding_owner_insert"
  on public.user_onboarding for insert
  with check (auth.uid() = user_id);

create policy "user_onboarding_owner_update"
  on public.user_onboarding for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_onboarding_user_id_idx
  on public.user_onboarding(user_id);
