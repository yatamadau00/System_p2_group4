-- グループ機能のための移行SQL（既存DBにそのまま実行できる・何度でも安全）
-- ことづてを「グループ限定公開」にできるよう、kotozute に group_id 列を追加し、
-- visibility の許可値を public / group に切り替える。
--
-- ※ グループ自体（作成・参加）は端末ローカルの共有コードで扱うため、
--   新しいテーブルは不要。ことづての group_id だけを共有DBに保存する。

-- group_id 列を追加（無ければ）
alter table public.kotozute add column if not exists group_id text;

-- visibility の制約を public / group に張り替える
-- （古い 'friends' 値が残っていると新制約に違反するため、先に group へ寄せる）
update public.kotozute set visibility = 'group' where visibility = 'friends';

alter table public.kotozute drop constraint if exists kotozute_visibility_check;
alter table public.kotozute
  add constraint kotozute_visibility_check
  check (visibility in ('public', 'group'));
