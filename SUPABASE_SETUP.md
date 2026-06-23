# Supabase セットアップ

このアプリは、Supabase を設定すると全員で同じことづてを共有できます。

## 1. SQLを実行

Supabase の SQL Editor で [`supabase/schema.sql`](supabase/schema.sql) を貼り付けて実行してください。

このSQLは **既存の `users` / `kotozute` / `friends` テーブルを削除して作り直します**。
現在入っていることづても消えるため、必要なら先にエクスポートしてください。

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
表示名は `author_name` に重複保存せず、基本的に `users.display_name` から取得します。
匿名またはサンプルのことづてだけ `author_name` を使います。

### `friends`

フレンド関係を保存します。

| column | meaning |
| --- | --- |
| `owner_id` | フレンド登録したユーザーID |
| `friend_id` | 登録された相手のユーザーID |

どちらも `users.id` に外部キー接続します。

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
