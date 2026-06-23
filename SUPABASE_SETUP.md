# Supabase セットアップ（みんなでことづてを共有する）

このアプリは、Supabase を設定すると **全員が同じことづてを共有** できます。
設定しなければ、これまで通り端末内（共有されない）で動きます。

所要時間：約10分。**サーバを動かす必要はありません**（`npm run dev` のまま、フロントから直接 Supabase に繋がります）。

---

## 1. プロジェクトを作る

1. https://supabase.com にサインイン → **New project**
2. 名前・データベースパスワード・リージョン（Tokyo 推奨）を設定して作成
3. 作成完了まで1〜2分待つ

## 2. テーブルとストレージを作る（SQLを貼るだけ）

左メニュー **SQL Editor** → **New query** に以下を貼って **Run**：

```sql
-- ことづて本体
create table if not exists public.kotozute (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null,
  lng double precision not null,
  message text not null default '',
  link text,
  author_name text,
  place_label text,
  media jsonb not null default '[]'::jsonb,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.kotozute enable row level security;

-- MVP（匿名・全体公開）：誰でも読める／残せる／消せる
create policy "kotozute_select" on public.kotozute for select using (true);
create policy "kotozute_insert" on public.kotozute for insert with check (true);
create policy "kotozute_delete" on public.kotozute for delete using (true);

-- メディア用の公開バケット
insert into storage.buckets (id, name, public)
values ('kotozute-media', 'kotozute-media', true)
on conflict (id) do nothing;

create policy "media_read"   on storage.objects for select using (bucket_id = 'kotozute-media');
create policy "media_write"  on storage.objects for insert with check (bucket_id = 'kotozute-media');
create policy "media_delete" on storage.objects for delete using (bucket_id = 'kotozute-media');
```

## 3. キーを `.env` に設定

左メニュー **Project Settings > API** を開き、次の2つをコピー：

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** キー → `VITE_SUPABASE_ANON_KEY`

`.env` に貼り付け：

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...（anon public キー）
```

> anon public キーは**ブラウザに置いて安全**な鍵です（アクセス制御は上の RLS ポリシーで実施）。
> ⚠️ `service_role` キーは絶対に置かないでください（全権限を持つ秘密鍵）。

## 4. 再起動

```bash
# Ctrl+C で止めてから
npm run dev
```

これで、トンネルURL（または各自のPC）から **全員が同じことづて** を見られます。
最初の1回だけ、サンプルことづてが自動で投入されます。

---

## 補足・注意

- **公開範囲**：MVPの仕様どおり「全体公開・匿名」です。誰でも閲覧・作成・削除できます（デモ向け）。
  本番運用するなら、認証（フレンド機能など）を入れて削除ポリシーを「作成者のみ」に絞るのが望ましいです。
- **「わたしのことづて」** は端末ごとの記録（この端末で残したID）で判定しています。別端末では「わたしの」には出ません（共有自体はされます）。
- 設定をやめれば（`.env` の2つを空にする）、また端末内モードに戻ります。
