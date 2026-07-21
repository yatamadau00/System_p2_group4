-- 既存のパスワードユーザーへ、確認済みメールのSupabase Authユーザーを安全に紐づける。
-- 既存のusers行や関連データを削除しない、冪等・非破壊のマイグレーションです。

create table if not exists public.auth_account_link_tokens (
  token_hash text primary key,
  user_id text not null unique references public.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now()
);

alter table public.auth_account_link_tokens enable row level security;
revoke all on public.auth_account_link_tokens from anon, authenticated;

create or replace function public.begin_email_account_link(
  p_user_id text,
  p_password_hash text,
  p_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.auth_account_link_tokens where expires_at <= now();

  if coalesce(p_token_hash, '') = '' or not exists (
    select 1 from public.users
    where id = p_user_id
      and password_hash = p_password_hash
      and coalesce(password_hash, '') <> ''
      and auth_user_id is null
  ) then
    return false;
  end if;

  insert into public.auth_account_link_tokens (token_hash, user_id, expires_at)
  values (p_token_hash, p_user_id, now() + interval '30 minutes')
  on conflict (user_id) do update
    set token_hash = excluded.token_hash,
        expires_at = excluded.expires_at,
        created_at = now();
  return true;
end;
$$;

create or replace function public.complete_email_account_link(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  linked_user_id text;
begin
  if auth.uid() is null or not exists (
    select 1 from auth.users
    where id = auth.uid() and email_confirmed_at is not null
  ) then
    return false;
  end if;

  select user_id into linked_user_id
  from public.auth_account_link_tokens
  where token_hash = p_token_hash and expires_at > now();

  if linked_user_id is null then
    return false;
  end if;

  update public.users
  set auth_user_id = auth.uid()
  where id = linked_user_id and auth_user_id is null;

  if not found then
    return false;
  end if;

  delete from public.auth_account_link_tokens where user_id = linked_user_id;
  return true;
end;
$$;

revoke all on function public.begin_email_account_link(text, text, text) from public;
revoke all on function public.complete_email_account_link(text) from public;
grant execute on function public.begin_email_account_link(text, text, text) to anon, authenticated;
grant execute on function public.complete_email_account_link(text) to authenticated;
