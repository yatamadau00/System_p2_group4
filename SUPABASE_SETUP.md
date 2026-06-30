# Supabase セットアップ

このアプリは、Supabase を設定すると全員で同じことづてを共有できます。

## 1. SQLを実行

Supabase の SQL Editor で [`supabase/schema.sql`](supabase/schema.sql) を貼り付けて実行してください。

このSQLは **既存の `users` / `kotozute` / `friends` / `notifications` テーブルを削除して作り直します**。
現在入っているデータも消えるため、必要なら先にエクスポートしてください。

既存DBを残したまま通知テーブルだけ追加したい場合は、代わりに [`supabase/notifications.sql`](supabase/notifications.sql) だけを実行してください。
既存DBを残したまま匿名投稿表示のカラムだけ追加したい場合は、[`supabase/anonymous-posts.sql`](supabase/anonymous-posts.sql) を実行してください。
既存DBを残したままユーザーごとの開封状態だけ追加したい場合は、[`supabase/kotozute-opens.sql`](supabase/kotozute-opens.sql) を実行してください。

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

### `kotozute_opens`

ユーザーごとの開封状態を保存します。

| カラム | 内容 |
|---|---|
| `user_id` | 開封したユーザーID |
| `kotozute_id` | 開封されたことづてID |
| `opened_at` | 開封日時 |

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
