-- ログイン中のユーザーが、現在のパスワードを確認して変更するための関数。
-- 既存テーブルや既存ユーザーを変更しない、冪等・非破壊のマイグレーションです。

create or replace function public.change_user_password(
  p_user_id text,
  p_current_password_hash text,
  p_new_password_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if coalesce(p_current_password_hash, '') = ''
    or coalesce(p_new_password_hash, '') = '' then
    return false;
  end if;

  update public.users
  set password_hash = p_new_password_hash
  where id = p_user_id
    and password_hash = p_current_password_hash
    and coalesce(password_hash, '') <> '';

  get diagnostics updated_count = row_count;
  return updated_count = 1;
end;
$$;

revoke all on function public.change_user_password(text, text, text) from public;
grant execute on function public.change_user_password(text, text, text) to anon, authenticated;
