-- メール確認済みのSupabase Authセッションから、連携済みユーザーの
-- アプリ用パスワードを再設定する非破壊マイグレーションです。
-- verifyOtp(type: 'recovery') 後のJWTでは環境によりamrが'recovery'にならないため、
-- 確認済みAuthユーザーとpublic.usersの厳密な紐付けを本人確認に使用します。

create or replace function public.reset_linked_user_password(p_new_password_hash text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null
    or coalesce(p_new_password_hash, '') = ''
    or not exists (
      select 1 from auth.users
      where id = auth.uid() and email_confirmed_at is not null
    ) then
    return false;
  end if;

  update public.users
  set password_hash = p_new_password_hash
  where auth_user_id = auth.uid()
    and coalesce(password_hash, '') <> '';

  return found;
end;
$$;

revoke all on function public.reset_linked_user_password(text) from public;
grant execute on function public.reset_linked_user_password(text) to authenticated;
