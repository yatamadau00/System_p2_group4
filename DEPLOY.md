# デプロイ手順（Vercel）— リポジトリ所有者向け

このアプリ「ことづて」を **Vercel** に上げて、**全員がアクセスできる固定URL** を作る手順です。
やることは **Vercel の作業だけ**。コードはすべて push 済みなので、コードを触る必要はありません。

所要時間：約5〜10分。

---

## 事前に用意するもの

デプロイには **環境変数3つの値** が必要です。これは作成者（このリポジトリに Supabase を組み込んだ人）から **別途（Slack/DM等で）受け取って** ください。
※ セキュリティのためキーはリポジトリに含めていません。

| 変数名 | 中身 | どこから |
| --- | --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps のキー | 作成者から受領 |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | 作成者から受領 |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...`（anon public） | 作成者から受領 |

---

## 手順

### 1. Vercel にログイン
[https://vercel.com](https://vercel.com) を開き、**「Continue with GitHub」** でログイン。

### 2. プロジェクトを取り込む
- 右上 **「Add New...」→「Project」**
- リポジトリ一覧から **`System_p2_group4`** を探して **「Import」**
  - 出てこない場合は「Adjust GitHub App Permissions」でこのリポジトリへのアクセスを許可。

### 3. ビルド設定（基本そのままでOK）
Vercel が自動で **Vite** と判定します。以下になっていれば変更不要：
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 4. 環境変数を登録（重要）
「**Environment Variables**」のセクションに、上で受け取った3つを1つずつ追加：

| Name | Value |
| --- | --- |
| `VITE_GOOGLE_MAPS_API_KEY` | （受け取ったMapsキー） |
| `VITE_SUPABASE_URL` | （受け取ったURL） |
| `VITE_SUPABASE_ANON_KEY` | （受け取ったanonキー） |

> 入力欄に Name と Value を入れて「Add」を3回。すべて **Production / Preview / Development** にチェックが入っていればOK（デフォルトで全部入っています）。

### 5. デプロイ
**「Deploy」** を押す → 1〜2分で完了し、**`https://〜.vercel.app`** というURLが発行されます。
このURLを全員に共有すれば、**みんなで同じことづてを見られます**。

### 6. （最後に）Google Maps キーの制限にドメインを追加
地図が「This page didn't load Google Maps correctly」になる場合、キーのドメイン制限が原因です。

- [Google Cloud Console](https://console.cloud.google.com/) → 該当キー → **アプリケーションの制限 = HTTPリファラー**
- 次を許可リストに追加（`xxxx` は実際のVercelドメインに置換）：
  ```
  https://xxxx.vercel.app/*
  ```
- 反映に数分かかることがあります。

---

## 確認

発行されたURLをスマホ/PCで開き：
- 地図が表示される（出ない場合は手順6）
- ことづてのピンが見える／ことづてを残せる
- 別の端末で開いても、同じことづてが見える（＝共有できている）

## 補足

- **以降の更新は自動**：`main` ブランチに push されるたびに Vercel が自動で再デプロイします。手作業は不要。
- Supabase 側のテーブル作成（SQL実行）は作成者が完了済みです。デプロイ作業では不要です。
- うまくいかないときは、Vercel の「Deployments」→該当デプロイ→「Logs」でエラーを確認できます。

現状Vercelの管理者でないといけない