-- お気に入り機能用テーブル。
-- 既存DBに追加で流すための非破壊マイグレーションです。

create table if not exists public.kotozute_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  kotozute_id uuid not null references public.kotozute(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint kotozute_favorites_user_kotozute_key unique (user_id, kotozute_id)
);

create index if not exists kotozute_favorites_user_id_idx
  on public.kotozute_favorites (user_id);

create index if not exists kotozute_favorites_kotozute_id_idx
  on public.kotozute_favorites (kotozute_id);

alter table public.kotozute_favorites enable row level security;

drop policy if exists "kotozute_favorites_select" on public.kotozute_favorites;
drop policy if exists "kotozute_favorites_insert" on public.kotozute_favorites;
drop policy if exists "kotozute_favorites_delete" on public.kotozute_favorites;

-- Demo policies. This is intentionally open for the class prototype.
create policy "kotozute_favorites_select" on public.kotozute_favorites
  for select using (true);

create policy "kotozute_favorites_insert" on public.kotozute_favorites
  for insert with check (true);

create policy "kotozute_favorites_delete" on public.kotozute_favorites
  for delete using (true);
