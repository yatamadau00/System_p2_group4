-- reports テーブルの定義

-- ENUMがなければ作る
do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_reason') then
    create type public.report_reason as enum (
      'spam',
      'inappropriate',
      'privacy',
      'harassment',
      'other'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'report_status') then
    create type public.report_status as enum (
      'pending',
      'resolved',
      'dismissed'
    );
  end if;
end$$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  kotozute_id uuid not null references public.kotozute(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason public.report_reason not null,
  details text,
  status public.report_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reports_reporter_kotozute_unique
  on public.reports (reporter_id, kotozute_id)
  where reporter_id is not null;
