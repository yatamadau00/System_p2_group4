-- メール確認済みだがアプリ側との連携だけが完了しなかった test3 を修復する。
-- 対象のAuthユーザーIDとメールアドレスを両方確認してから更新するため、
-- 他のユーザーを誤って紐付けない一度限りの修復SQLです。

do $$
declare
  target_auth_user_id uuid := 'd7c6ce7c-a342-48e6-9e08-01a2f62bfb74';
  updated_count integer;
begin
  if not exists (
    select 1
    from auth.users
    where id = target_auth_user_id
      and lower(email) = lower('tyamauchijobhunt@gmail.com')
      and email_confirmed_at is not null
  ) then
    raise exception '確認済みの対象Authユーザーが見つかりません';
  end if;

  if exists (
    select 1 from public.users
    where auth_user_id = target_auth_user_id
      and username <> 'test3'
  ) then
    raise exception '対象Authユーザーは別のアプリユーザーに連携済みです';
  end if;

  update public.users
  set auth_user_id = target_auth_user_id
  where username = 'test3'
    and auth_user_id is null
    and coalesce(password_hash, '') <> '';

  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'test3を安全に更新できませんでした';
  end if;
end;
$$;
