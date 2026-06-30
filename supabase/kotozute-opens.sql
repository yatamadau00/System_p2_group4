-- Add per-user kotozute open state without resetting existing data.

create table if not exists public.kotozute_opens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  kotozute_id uuid not null references public.kotozute(id) on delete cascade,
  opened_at timestamptz not null default now(),
  constraint kotozute_opens_user_kotozute_key unique (user_id, kotozute_id)
);

create index if not exists kotozute_opens_user_id_idx
  on public.kotozute_opens (user_id);

create index if not exists kotozute_opens_kotozute_id_idx
  on public.kotozute_opens (kotozute_id);

alter table public.kotozute_opens enable row level security;

drop policy if exists "kotozute_opens_select" on public.kotozute_opens;
drop policy if exists "kotozute_opens_insert" on public.kotozute_opens;

create policy "kotozute_opens_select"
  on public.kotozute_opens for select using (true);

create policy "kotozute_opens_insert"
  on public.kotozute_opens for insert with check (true);
