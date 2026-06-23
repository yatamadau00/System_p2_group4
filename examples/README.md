# Google Maps API demo

本体アプリのコードに触れず、Google Maps API を軽く試すためのサンプルです。

## 使い方

1. Google Cloud Console で API キーを作成します。
2. `Maps JavaScript API` を有効化します。
3. 必要に応じて `Geocoding API` も有効化します。
4. ブラウザで `google-maps-api-demo.html` を開きます。
5. API キーを入力して「地図を読み込む」を押します。

検索欄に住所や施設名を入れると、緯度経度へ変換して地図の中心とピンを移動します。

API キーは画面上で入力するだけで、ファイルには保存しません。

## `file://` で認証エラーになる場合

Google Cloud Console 側で HTTP リファラー制限を付けている API キーは、`file://` で開くと許可元に一致せず失敗することがあります。

その場合は、ローカルサーバー経由で開いてください。

```bash
python3 -m http.server 8000 --directory examples
```

ブラウザで開く URL:

```text
http://localhost:8000/google-maps-api-demo.html
```

API キーのアプリケーション制限を使う場合は、HTTP リファラーに次のどちらかを追加します。

```text
http://localhost:8000/*
http://127.0.0.1:8000/*
```

それでも「Google マップが正しく読み込まれませんでした」と出る場合は、Google Cloud Console で次を確認してください。

- `Maps JavaScript API` が有効になっている
- 請求先アカウントが有効になっている
- API キーが間違っていない
- API 制限を付けている場合、`Maps JavaScript API` が許可されている
