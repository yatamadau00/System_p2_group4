-- Web Push の購読情報を保存するテーブル。
-- Supabase Dashboard > SQL Editor で一度だけ実行してください。冪等・非破壊です。
--
-- 1ユーザーが複数端末で購読しうるので (user_id, endpoint) 単位で保持する。
-- endpoint はプッシュサービスが払い出す端末ごとの宛先URL（実質ユニーク）。

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- 授業用プロトタイプのため意図的に開放的なポリシー（他テーブルと同方針）。
drop policy if exists "push_subscriptions_select" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete" on public.push_subscriptions;

create policy "push_subscriptions_select" on public.push_subscriptions for select using (true);
create policy "push_subscriptions_insert" on public.push_subscriptions for insert with check (true);
create policy "push_subscriptions_update" on public.push_subscriptions for update using (true) with check (true);
create policy "push_subscriptions_delete" on public.push_subscriptions for delete using (true);
