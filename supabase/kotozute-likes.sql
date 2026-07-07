-- いいね機能用テーブル。
-- 既存DBに追加で流すための非破壊マイグレーションです。

create table if not exists public.kotozute_likes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  kotozute_id uuid not null references public.kotozute(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint kotozute_likes_user_kotozute_key unique (user_id, kotozute_id)
);

create index if not exists kotozute_likes_user_id_idx
  on public.kotozute_likes (user_id);

create index if not exists kotozute_likes_kotozute_id_idx
  on public.kotozute_likes (kotozute_id);

alter table public.kotozute_likes enable row level security;

drop policy if exists "kotozute_likes_select" on public.kotozute_likes;
drop policy if exists "kotozute_likes_insert" on public.kotozute_likes;
drop policy if exists "kotozute_likes_delete" on public.kotozute_likes;

-- Demo policies. This is intentionally open for the class prototype.
create policy "kotozute_likes_select" on public.kotozute_likes
  for select using (true);

create policy "kotozute_likes_insert" on public.kotozute_likes
  for insert with check (true);

create policy "kotozute_likes_delete" on public.kotozute_likes
  for delete using (true);
