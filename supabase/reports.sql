-- reports テーブルの作成
-- ことづて、および返信に対する通報データを保存します。

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  kotozute_id uuid not null references public.kotozute(id) on delete cascade,
  reporter_id text references public.users(id) on delete set null,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  constraint unique_reporter_kotozute unique (reporter_id, kotozute_id)
);

-- 行レベルセキュリティ（RLS）を有効化
alter table public.reports enable row level security;

-- 開発デモ用：誰でも通報（挿入）できるポリシー
create policy "Enable insert for everyone" on public.reports
  for insert with check (true);

-- 開発デモ用：通報内容を確認できるようにするポリシー
create policy "Enable select for everyone" on public.reports
  for select using (true);
