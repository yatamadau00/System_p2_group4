-- password_hash をクライアント（anonキー）から読めなくする対策マイグレーション。
-- Supabase Dashboard > SQL Editor で一度だけ実行してください。冪等・非破壊です。
--
-- ねらい:
--   * RLS の行ポリシー（誰でも行を読める＝授業用の緩さ）はそのまま維持する。
--   * ただし users テーブルの password_hash 列だけは anon / authenticated から
--     SELECT できないように「列レベル権限」で塞ぐ。
--   * ログイン時のハッシュ照合は、ハッシュをクライアントへ返さずに
--     DB 内で完結させる RPC 関数 authenticate_user() に移す。
--   * クライアントが必要とする「パスワードを持っているか（Google専用アカウントか）」の
--     判定は、ハッシュそのものではなく生成列 has_password（boolean）で提供する。

-- 1) 「パスワードを持っているか」を表す生成列。password_hash から自動計算・自動更新される。
--    この列は select してもハッシュ本体を露出しない。
alter table public.users
  add column if not exists has_password boolean
  generated always as (coalesce(password_hash, '') <> '') stored;

-- 2) 列レベル権限で password_hash だけ読めなくする。
--    いったんテーブル全体の SELECT を剥奪し、password_hash を除く列のみ再付与する。
--    （INSERT / UPDATE / DELETE 権限には触れないので、登録や更新は今まで通り動く）
revoke select on public.users from anon, authenticated;
grant select (
  id,
  auth_user_id,
  username,
  display_name,
  bio,
  avatar_emoji,
  avatar_color,
  avatar_image_url,
  friend_code,
  created_at,
  has_password
) on public.users to anon, authenticated;

-- 3) ログイン用 RPC。ハッシュ照合を DB 内で行い、ハッシュ本体は返さない。
--    security definer で実行され、関数の内部だけが password_hash を参照できる。
create or replace function public.authenticate_user(
  p_username text,
  p_password_hash text
)
returns table (
  id text,
  auth_user_id uuid,
  username text,
  display_name text,
  bio text,
  avatar_emoji text,
  avatar_color text,
  avatar_image_url text,
  friend_code text,
  created_at timestamptz,
  has_password boolean
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.auth_user_id,
    u.username,
    u.display_name,
    u.bio,
    u.avatar_emoji,
    u.avatar_color,
    u.avatar_image_url,
    u.friend_code,
    u.created_at,
    (coalesce(u.password_hash, '') <> '') as has_password
  from public.users u
  where u.username = p_username
    and u.password_hash = p_password_hash
    -- 空ハッシュ（Google専用アカウント）へ空パスワードでログインされるのを防ぐ
    and coalesce(u.password_hash, '') <> '';
$$;

revoke all on function public.authenticate_user(text, text) from public;
grant execute on function public.authenticate_user(text, text) to anon, authenticated;
