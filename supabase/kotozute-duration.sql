-- kotozute テーブルに開封有効期間用のカラムを追加します。
-- 既存のDBにこの変更を反映するために使用します。

alter table public.kotozute 
  add column if not exists valid_from timestamptz,
  add column if not exists valid_to timestamptz;
