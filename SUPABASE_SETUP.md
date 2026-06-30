# Supabase セットアップ

このアプリは、Supabase を設定すると全員で同じことづてを共有できます。

## 1. SQLを実行

### ✅ すでにデータがある場合（データを消さずに更新）

すでに運用中で **データを消したくない場合は、追加だけの安全なSQLを実行**してください（テーブルは作り直しません・何度実行してもOK）。

グループ機能を有効にする：[`supabase/groups.sql`](supabase/groups.sql) を SQL Editor に貼り付けて実行。
- `kotozute` に `group_id` 列を追加し、`visibility` に `'group'` を許可するだけです。
- `DROP TABLE` は一切しないので、既存のことづて・ユーザー・通知は残ります。

（他の追加用SQL：通知だけ → [`supabase/notifications.sql`](supabase/notifications.sql)／匿名投稿カラムだけ → [`supabase/anonymous-posts.sql`](supabase/anonymous-posts.sql)）

### ⚠️ まっさらに作り直す場合のみ（データは消えます）

初期構築や、リセットして作り直したいときだけ [`supabase/schema.sql`](supabase/schema.sql) を実行します。
このSQLは **`users` / `kotozute` / `friends` / `notifications` テーブルを削除して作り直す**ため、**現在のデータは消えます**。運用中のDBには実行しないでください。

> 補足：エディタ上で `do $$ ... $$` や `::regclass` に赤線が出ることがありますが、これはエディタのSQL方言設定（SQL Server等）による誤検知で、Supabase(PostgreSQL)では正しく動きます。

## 2. テーブル構成

### `users`

ユーザー登録情報を保存します。

| column | meaning |
| --- | --- |
| `id` | ユーザーID |
| `username` | ログイン用ユーザー名 |
| `display_name` | 表示名 |
| `password_hash` | パスワードハッシュ |
| `bio` | 自己紹介 |
| `avatar_emoji` | アバター |
| `avatar_color` | アバター背景色 |
| `friend_code` | フレンド追加用コード |

### `kotozute`

ことづて本体を保存します。

`author_id` は `users.id` に外部キー接続します。
表示名は基本的に `users.display_name` から取得します。
匿名投稿は `is_anonymous` で表示名を隠します。
サンプルなどユーザーに紐づかないことづてだけ `author_name` を使います。

### `friends`

フレンド関係を保存します。

| column | meaning |
| --- | --- |
| `owner_id` | フレンド登録したユーザーID |
| `friend_id` | 登録された相手のユーザーID |

どちらも `users.id` に外部キー接続します。

### `notifications`

アプリ内通知を保存します。

| column | meaning |
| --- | --- |
| `recipient_id` | 通知を受け取るユーザーID |
| `type` | `near` / `unlockable` / `system` / `received` |
| `related_id` | 関連することづてID |
| `read` | 既読状態 |

`recipient_id` は `users.id`、`related_id` は `kotozute.id` に外部キー接続します。

## 3. `.env` を設定

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Google Maps を使う場合は次も設定します。

```env
VITE_GOOGLE_MAPS_API_KEY=あなたのキー
```

## 4. 起動

```bash
npm install
npm run dev
```

## 注意

現在のRLSポリシーはデモ用に広く開けています。授業用プロトタイプとしては扱いやすいですが、本番運用するなら Supabase Auth に寄せ、更新・削除を本人だけに制限してください。
