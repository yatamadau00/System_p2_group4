-- グループ機能のための移行SQL（既存DBを「消さずに」安全に更新する）
--
-- ✅ テーブルやデータは一切削除しません（DROP TABLE はしません）。
-- ✅ 何度実行しても安全（idempotent）です。
-- やること：
--   1. kotozute に group_id 列を追加（無ければ）
--   2. visibility の CHECK 制約を 'group' を許可する形に張り替える
--      （制約名が環境で違っても確実に動くよう、既存のvisibility制約を動的に探して外す）
--
-- ※ グループの作成・参加は端末ローカルの共有コードで扱うため、新しいテーブルは不要です。
--   ことづてがどのグループ向けかを表す group_id だけを共有DBに保存します。

-- 1) group_id 列を追加（既にあれば何もしない）
alter table public.kotozute add column if not exists group_id text;

-- 2) visibility の既存CHECK制約を（名前に依らず）すべて外す
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

-- 3) 'public' / 'group' を許可する制約を付け直す
--    （過去に 'friends' で保存されたデータが残っていても弾かれないよう許容しておく）
alter table public.kotozute
  add constraint kotozute_visibility_check
  check (visibility in ('public', 'group', 'friends'));
