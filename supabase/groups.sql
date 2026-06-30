-- グループ機能のための移行SQL（既存DBを「消さずに」安全に更新する）
--
-- ✅ テーブルやデータは一切削除しません（DROP TABLE はしません）。
-- ✅ 何度実行しても安全（idempotent）です。
--
-- やること：
--   1. kotozute に group_id 列を追加し、visibility に 'group' を許可
--   2. groups / group_members テーブルを追加（ユーザーに紐づくグループ）
--
-- グループはユーザーアカウントに紐づきます（どの端末でも同じグループが見え、メンバーも記録される）。

-- ============ 1) kotozute 側 ============
alter table public.kotozute add column if not exists group_id text;

-- visibility の既存CHECK制約を（名前に依らず）すべて外してから付け直す
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.kotozute'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%visibility%'
  loop
    execute format('alter table public.kotozute drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.kotozute
  add constraint kotozute_visibility_check
  check (visibility in ('public', 'group', 'friends'));

-- ============ 2) グループ本体とメンバー ============
create table if not exists public.groups (
  id text primary key,                 -- 共有コード（例: KOTO-AB23CD）
  name text not null default '',
  owner_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id text not null references public.groups(id) on delete cascade,
  user_id text not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);
create index if not exists group_members_group_idx on public.group_members (group_id);

-- ============ 3) RLS（デモ用に広く開ける） ============
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "groups_select" on public.groups;
drop policy if exists "groups_insert" on public.groups;
drop policy if exists "groups_update" on public.groups;
drop policy if exists "groups_delete" on public.groups;
create policy "groups_select" on public.groups for select using (true);
create policy "groups_insert" on public.groups for insert with check (true);
create policy "groups_update" on public.groups for update using (true) with check (true);
create policy "groups_delete" on public.groups for delete using (true);

drop policy if exists "group_members_select" on public.group_members;
drop policy if exists "group_members_insert" on public.group_members;
drop policy if exists "group_members_delete" on public.group_members;
create policy "group_members_select" on public.group_members for select using (true);
create policy "group_members_insert" on public.group_members for insert with check (true);
create policy "group_members_delete" on public.group_members for delete using (true);
