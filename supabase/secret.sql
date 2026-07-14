-- シークレットことづて機能の移行SQL（既存DBを消さずに安全に更新・冪等）
--
-- ✅ テーブルやデータは削除しません。列を1つ足すだけです。
-- シークレットのことづては、地図にピンを出さず、5m以内に入ると通知とともに現れる。

alter table public.kotozute add column if not exists is_secret boolean not null default false;
