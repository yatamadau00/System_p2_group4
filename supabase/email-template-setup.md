# Supabase Auth メールテンプレート設定

メールサービスのリンク検査によって、Supabaseの一度限りのリンクが利用者より先に消費されることを防ぐ設定です。

Supabase Dashboard の `Authentication` → `Email Templates` で、以下の2種類を変更します。

## Change Email Address

本文中の確認リンクを次に置き換えます。

```html
<h2>メールアドレスの確認</h2>
<p>次のボタンから「ことづて」を開き、画面上でもう一度確認してください。</p>
<p>
  <a href="{{ .RedirectTo }}/?token_hash={{ .TokenHash }}&type=email_change">
    メールアドレスを確認する
  </a>
</p>
<p>この操作に心当たりがない場合は、このメールを無視してください。</p>
```

## Reset Password

本文中の再設定リンクを次に置き換えます。

```html
<h2>パスワードの再設定</h2>
<p>次のボタンから「ことづて」を開き、画面上で本人確認してください。</p>
<p>
  <a href="{{ .RedirectTo }}/?token_hash={{ .TokenHash }}&type=recovery">
    パスワードを再設定する
  </a>
</p>
<p>この操作に心当たりがない場合は、このメールを無視してください。</p>
```

## URL Configuration

`Site URL` には、毎回変わらない本番URLを設定します。

```text
https://system-p2-group4.vercel.app
```

`Redirect URLs` には、少なくとも次を登録します。

```text
https://system-p2-group4.vercel.app/**
http://localhost:5173/**
```

Vercelのデプロイごとに変わるプレビューURLを `Site URL` には設定しません。
