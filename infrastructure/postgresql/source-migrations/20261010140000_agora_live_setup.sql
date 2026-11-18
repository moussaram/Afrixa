alter table public.live_sessions
  add column if not exists privacy text not null default 'public'
    check (privacy in ('public', 'followers', 'private'));

alter table public.live_sessions
  add constraint live_sessions_status_check
  check (status in ('live', 'ended')) not valid;

alter table public.live_sessions
  validate constraint live_sessions_status_check;

create index if not exists live_sessions_host_status_idx
  on public.live_sessions(host_id, status, started_at desc);
