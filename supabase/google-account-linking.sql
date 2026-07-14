-- 既存のアプリ内ユーザーとSupabase Authユーザーを対応付ける。
-- Supabase Dashboard > SQL Editor で一度だけ実行してください。

alter table public.users
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists users_auth_user_id_unique
  on public.users (auth_user_id)
  where auth_user_id is not null;

-- 認証済み本人が、既存アカウントからGoogleログインを解除する。
-- Google Identityが最後のIdentityであるため、Authユーザーごと削除する。
create or replace function public.disconnect_google_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_auth_user_id uuid := auth.uid();
  linked_password_hash text;
begin
  if current_auth_user_id is null then
    raise exception '認証が必要です';
  end if;

  select password_hash
    into linked_password_hash
    from public.users
   where auth_user_id = current_auth_user_id;

  if linked_password_hash is null then
    raise exception '連携されたアカウントが見つかりません';
  end if;

  if linked_password_hash = '' then
    raise exception 'Googleで作成したアカウントは連携解除できません';
  end if;

  update public.users
     set auth_user_id = null
   where auth_user_id = current_auth_user_id;

  delete from auth.users
   where id = current_auth_user_id;
end;
$$;

revoke all on function public.disconnect_google_account() from public;
grant execute on function public.disconnect_google_account() to authenticated;
