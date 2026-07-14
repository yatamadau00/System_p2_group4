-- 既存のアプリ内ユーザーとSupabase Authユーザーを対応付ける。
-- Supabase Dashboard > SQL Editor で一度だけ実行してください。

alter table public.users
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists users_auth_user_id_unique
  on public.users (auth_user_id)
  where auth_user_id is not null;
