-- Kotozute Supabase schema.
-- Destructive reset: this drops existing app tables and recreates them.

drop table if exists public.group_members cascade;
drop table if exists public.groups cascade;
drop table if exists public.friends cascade;
drop table if exists public.notifications cascade;
drop table if exists public.kotozute_favorites cascade;
drop table if exists public.kotozute_likes cascade;
drop table if exists public.kotozute_opens cascade;
drop table if exists public.kotozute cascade;
drop table if exists public.auth_account_link_tokens cascade;
drop table if exists public.users cascade;

create table public.users (
  id text primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  username text not null unique,
  display_name text not null,
  password_hash text not null,
  bio text not null default '',
  avatar_emoji text not null default '🦉',
  avatar_color text not null default '#f1e8d6',
  avatar_image_url text,
  friend_code text not null unique,
  created_at timestamptz not null default now(),
  -- パスワードを持つか（Google専用アカウントは空ハッシュ→false）。
  -- password_hash から自動計算され、ハッシュ本体を露出せずに判定に使える。
  has_password boolean generated always as (coalesce(password_hash, '') <> '') stored
);

create table public.auth_account_link_tokens (
  token_hash text primary key,
  user_id text not null unique references public.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now()
);

create table public.kotozute (
  id uuid primary key default gen_random_uuid(),
  reply_to_id uuid references public.kotozute(id) on delete set null,
  root_id uuid references public.kotozute(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  message text not null default '',
  link text,
  author_id text references public.users(id) on delete set null,
  author_name text,
  is_anonymous boolean not null default false,
  place_label text,
  media jsonb not null default '[]'::jsonb,
  visibility text not null default 'public' check (visibility in ('public', 'group')),
  group_id text,
  is_secret boolean not null default false,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  valid_from timestamptz,
  valid_to timestamptz
);

create table public.friends (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.users(id) on delete cascade,
  friend_id text not null references public.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  constraint friends_not_self_check check (owner_id <> friend_id),
  constraint friends_owner_friend_key unique (owner_id, friend_id)
);

create table public.kotozute_opens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  kotozute_id uuid not null references public.kotozute(id) on delete cascade,
  opened_at timestamptz not null default now(),
  constraint kotozute_opens_user_kotozute_key unique (user_id, kotozute_id)
);

create table public.kotozute_likes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  kotozute_id uuid not null references public.kotozute(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint kotozute_likes_user_kotozute_key unique (user_id, kotozute_id)
);

create table public.kotozute_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  kotozute_id uuid not null references public.kotozute(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint kotozute_favorites_user_kotozute_key unique (user_id, kotozute_id)
);

create table public.notifications (
  id text primary key,
  recipient_id text not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('near', 'unlockable', 'system', 'received')),
  related_id uuid references public.kotozute(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.groups (
  id text primary key,
  name text not null default '',
  avatar_emoji text not null default '👥',
  avatar_color text not null default '#dceffd',
  avatar_image_url text,
  owner_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id text not null references public.groups(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index kotozute_author_id_idx on public.kotozute (author_id);
create index kotozute_reply_to_id_idx on public.kotozute (reply_to_id);
create index kotozute_root_id_idx on public.kotozute (root_id);
create index kotozute_created_at_idx on public.kotozute (created_at desc);
create index friends_owner_id_idx on public.friends (owner_id);
create index friends_friend_id_idx on public.friends (friend_id);
create index kotozute_opens_user_id_idx on public.kotozute_opens (user_id);
create index kotozute_opens_kotozute_id_idx on public.kotozute_opens (kotozute_id);
create index kotozute_likes_user_id_idx on public.kotozute_likes (user_id);
create index kotozute_likes_kotozute_id_idx on public.kotozute_likes (kotozute_id);
create index kotozute_favorites_user_id_idx on public.kotozute_favorites (user_id);
create index kotozute_favorites_kotozute_id_idx on public.kotozute_favorites (kotozute_id);
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index group_members_user_idx on public.group_members (user_id);
create index group_members_group_idx on public.group_members (group_id);

alter table public.users enable row level security;
alter table public.auth_account_link_tokens enable row level security;
alter table public.kotozute enable row level security;
alter table public.friends enable row level security;
alter table public.kotozute_opens enable row level security;
alter table public.kotozute_likes enable row level security;
alter table public.kotozute_favorites enable row level security;
alter table public.notifications enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Demo policies. This is intentionally open for the class prototype.
-- Do not use this as-is for a production app.
create policy "users_select" on public.users for select using (true);
create policy "users_insert" on public.users for insert with check (true);
create policy "users_update" on public.users for update using (true) with check (true);

create policy "kotozute_select" on public.kotozute for select using (true);
create policy "kotozute_insert" on public.kotozute for insert with check (true);
create policy "kotozute_update" on public.kotozute for update using (true) with check (true);
create policy "kotozute_delete" on public.kotozute for delete using (true);

create policy "friends_select" on public.friends for select using (true);
create policy "friends_insert" on public.friends for insert with check (true);
create policy "friends_delete" on public.friends for delete using (true);

create policy "kotozute_opens_select" on public.kotozute_opens for select using (true);
create policy "kotozute_opens_insert" on public.kotozute_opens for insert with check (true);

create policy "kotozute_likes_select" on public.kotozute_likes for select using (true);
create policy "kotozute_likes_insert" on public.kotozute_likes for insert with check (true);
create policy "kotozute_likes_delete" on public.kotozute_likes for delete using (true);

create policy "kotozute_favorites_select" on public.kotozute_favorites for select using (true);
create policy "kotozute_favorites_insert" on public.kotozute_favorites for insert with check (true);
create policy "kotozute_favorites_delete" on public.kotozute_favorites for delete using (true);

create policy "notifications_select" on public.notifications for select using (true);
create policy "notifications_insert" on public.notifications for insert with check (true);
create policy "notifications_update" on public.notifications for update using (true) with check (true);
create policy "notifications_delete" on public.notifications for delete using (true);

create policy "groups_select" on public.groups for select using (true);
create policy "groups_insert" on public.groups for insert with check (true);
create policy "groups_update" on public.groups for update using (true) with check (true);
create policy "groups_delete" on public.groups for delete using (true);

create policy "group_members_select" on public.group_members for select using (true);
create policy "group_members_insert" on public.group_members for insert with check (true);
create policy "group_members_delete" on public.group_members for delete using (true);

-- 認証済み本人によるGoogle連携解除。
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

  select password_hash into linked_password_hash
    from public.users
   where auth_user_id = current_auth_user_id;

  if linked_password_hash is null then
    raise exception '連携されたアカウントが見つかりません';
  end if;
  if linked_password_hash = '' then
    raise exception 'Googleで作成したアカウントは連携解除できません';
  end if;

  update public.users set auth_user_id = null
   where auth_user_id = current_auth_user_id;
  delete from auth.users where id = current_auth_user_id;
end;
$$;

revoke all on function public.disconnect_google_account() from public;
grant execute on function public.disconnect_google_account() to authenticated;

-- password_hash 列だけをクライアント（anonキー）から読めなくする。
-- 行ポリシー（誰でも読める授業用の緩さ）は維持し、列レベル権限で password_hash のみ塞ぐ。
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

-- ログイン用 RPC。ハッシュ照合を DB 内で完結させ、ハッシュ本体はクライアントへ返さない。
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
    and coalesce(u.password_hash, '') <> '';
$$;

revoke all on function public.authenticate_user(text, text) from public;
grant execute on function public.authenticate_user(text, text) to anon, authenticated;

-- 正しいアプリ用パスワードを確認できた本人にだけ、Supabase Authの
-- メール認証・Google連携の表示用情報を返す。
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

revoke all on public.auth_account_link_tokens from anon, authenticated;
revoke all on function public.begin_email_account_link(text, text, text) from public;
revoke all on function public.complete_email_account_link(text) from public;
grant execute on function public.begin_email_account_link(text, text, text) to anon, authenticated;
grant execute on function public.complete_email_account_link(text) to authenticated;

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
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as method
      where method ->> 'method' = 'recovery'
    )
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

insert into storage.buckets (id, name, public)
values ('kotozute-media', 'kotozute-media', true)
on conflict (id) do nothing;

drop policy if exists "media_read" on storage.objects;
drop policy if exists "media_write" on storage.objects;
drop policy if exists "media_delete" on storage.objects;
create policy "media_read" on storage.objects for select using (bucket_id = 'kotozute-media');
create policy "media_write" on storage.objects for insert with check (bucket_id = 'kotozute-media');
create policy "media_delete" on storage.objects for delete using (bucket_id = 'kotozute-media');
