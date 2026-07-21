-- ユーザー名・パスワードでログインしたユーザーに、本人の認証方式だけを返す。
-- usersテーブルの列や既存データは変更しない、非破壊の追加SQLです。

create or replace function public.get_user_auth_details(
  p_user_id text,
  p_password_hash text
)
returns jsonb
language sql
security definer
stable
set search_path = public, auth
as $$
  select jsonb_build_object(
    'email', case
      when exists (
        select 1 from auth.identities i
        where i.user_id = a.id and i.provider = 'email'
      ) then a.email
      else null
    end,
    'email_verified',
      a.email_confirmed_at is not null
      and exists (
        select 1 from auth.identities i
        where i.user_id = a.id and i.provider = 'email'
      ),
    'google_linked', exists (
      select 1 from auth.identities i
      where i.user_id = a.id and i.provider = 'google'
    ),
    'google_email', (
      select i.identity_data ->> 'email'
      from auth.identities i
      where i.user_id = a.id and i.provider = 'google'
      limit 1
    )
  )
  from public.users u
  join auth.users a on a.id = u.auth_user_id
  where u.id = p_user_id
    and u.password_hash = p_password_hash
    and coalesce(u.password_hash, '') <> '';
$$;

revoke all on function public.get_user_auth_details(text, text) from public;
grant execute on function public.get_user_auth_details(text, text) to anon, authenticated;
