# ことづて

> 場所に想いを残し、誰かがその場所を訪れたときに受け取る、非同期の位置連動メッセージアプリ。

思い出の場所（卒業した教室、一緒に行った旅先、実家の最寄り駅）に、声・写真・映像・言葉を「ことづて」として残しておく。地図上でそれを見つけた人が、実際にその場所へ足を運び、**十分に近づいてはじめて開封できる** ── 「場所版のタイムカプセル」のような体験です。

これは **MVP / 動くプロトタイプ** です。フロントエンド完結で、バックエンドは持ちません（永続化は端末内の IndexedDB）。

---

## 体験のながれ

1. **マップ（ホーム）** — 全画面の地図に、現在地とことづてのピンが点在します。ピンは距離で見た目が変わります。
   - 🔒 **遠い** … くすんだ施錠ピン（中身は見えない）
   - 💓 **近い**（既定200m以内）… 琥珀色に脈打ちはじめる
   - ✨ **開封可能**（既定50m以内）… 光輪をまとって灯る
2. **近づく** — ピンをタップすると受け取り画面へ。離れている間は「開封まで、あと◯m」と距離リングで導きます。
3. **開封** — 十分近づくと封蝋が灯り、タップすると封が割れ、光と共にベールが晴れて中身が現れます（体験のクライマックス）。
4. **残す** — フローティングボタンから、場所を決め → 種別（ことば／写真／映像／声）を選び → 中身を綴って残します。

---

## セットアップ

### 1. 依存をインストール

```bash
npm install
```

### 2. Google Maps API キーを設定（任意）

`.env.example` を `.env` にコピーし、キーを設定します。

```bash
cp .env.example .env
```

```env
VITE_GOOGLE_MAPS_API_KEY=あなたのキー
```

- キーは [Google Cloud Console](https://console.cloud.google.com/) で **Maps JavaScript API** を有効化して取得します。
- **キーが未設定でも起動します。** その場合は、抽象的なフォールバック地図の上にピンが並び、タップで中身を確かめられます（地図機能のみ休止）。

### 3. 起動

```bash
npm run dev      # 開発サーバー（http://localhost:5173）
npm run build    # 型チェック + 本番ビルド
npm run preview  # ビルド結果のプレビュー
```

> 📱 **スマートフォンでの利用を主対象** にしています。位置情報・カメラを使うため、実機では `https`（または `localhost`）でのアクセスを推奨します。同一 LAN の実機からは `vite` が表示する Network アドレスで開けます（位置情報の取得には https が要るため、`npm run build` → ホスティング、もしくはトンネリングを推奨）。

---

## 権限と状態のフォールバック

体験が破綻しないよう、主要な状態に専用UIを用意しています。

| 状態 | 挙動 |
| --- | --- |
| 位置情報 取得中 | 上部に「現在地をさがしています…」 |
| 位置情報 拒否 | 「もう一度試す」導線付きバナー。地図とことづては引き続き閲覧可 |
| 位置情報 非対応 | その旨を案内し、閲覧は継続 |
| APIキー 未設定 / 読込失敗 | フォールバック地図（ピンは表示・タップ可） |
| ことづて 0件 | 一覧に丁寧な空状態（初回はサンプルを自動投入） |

---

## 設計の方向性（ダイジェスト）

- **トーン**: 「デジタルでありながら、温かく、人の気配を残す」。和紙・封蝋・夕暮れの光。
- **カラー**: 生成りの和紙（背景）／封蝋の琥珀（主役・灯り）／苔のセージ（近接の合図）／藍墨の夜（地図）。汎用の青一色に逃げない。
- **タイポ**: 見出し・本文に明朝（Shippori Mincho）で情緒、UIラベルにゴシック（Noto Sans JP）で機能。
- **開封演出**: 封蝋が割れる → 光の閃光 → ベールが上下に晴れる → 中身がふわりと立ち上がる。`transform`/`opacity` ベースで、`prefers-reduced-motion` を尊重して静止に切り替え。

詳細トークンは [`src/styles/tokens.css`](src/styles/tokens.css) に集約しています。

---

## ディレクトリ構成

```
src/
├─ main.tsx                  エントリ
├─ App.tsx                   画面遷移・状態のオーケストレーション
├─ config.ts                 調整可能な定数（開封半径50m 等）
├─ types.ts                  ドメイン型
├─ styles/
│  ├─ tokens.css             デザイントークン（色・余白・影・モーション）
│  └─ global.css             リセット・共通アニメーション
├─ lib/
│  ├─ geo.ts                 Haversine 距離・近接判定・距離表記
│  ├─ enrich.ts              ことづて × 現在地 → 距離/近接を付与
│  └─ mapStyle.ts            Google Maps カスタムスタイル
├─ hooks/
│  ├─ useGeolocation.ts      watchPosition 追従と状態管理
│  ├─ useKotozute.ts         コレクションの読み込み・作成・削除
│  └─ useObjectUrl.ts        Blob → object URL（自動解放）
├─ services/                 ★ データ層（差し替え可能）
│  ├─ repository.ts          KotozuteRepository インターフェース
│  ├─ indexedDbRepository.ts IndexedDB 実装
│  ├─ index.ts               getRepository() — 唯一の窓口
│  └─ seed.ts                サンプルことづて
└─ components/
   ├─ MapScreen.tsx          地図・ピン・フォールバック地図
   ├─ Pin.tsx                近接状態で変化するピン
   ├─ OpenView.tsx           受け取り/開封（クライマックス）
   ├─ ComposeFlow.tsx        残す（3ステップ＋メディア取込）
   ├─ ListSheet.tsx          一覧（みんな/わたし、削除）
   ├─ MediaView.tsx          開封後のメディア描画
   ├─ GeoBanner.tsx          位置情報の状態フィードバック
   ├─ Sheet.tsx              共通ボトムシート
   └─ icons.tsx              インラインSVGアイコン
```

---

## データ層の差し替え（→ バックエンドAPI）

保存・取得は [`KotozuteRepository`](src/services/repository.ts) インターフェースの背後に隔離しています。アプリ本体はこの interface 以外に依存しません。

```ts
export interface KotozuteRepository {
  list(): Promise<Kotozute[]>
  get(id: string): Promise<Kotozute | undefined>
  create(input: NewKotozute): Promise<Kotozute>
  remove(id: string): Promise<void>
  ensureSeed(seed: SeedKotozute[]): Promise<void>
}
```

バックエンドに繋ぐときは、この interface を満たす `httpRepository` を作り、[`src/services/index.ts`](src/services/index.ts) の `getRepository()` の返り値を差し替えるだけです。メディアは現在 Blob を IndexedDB に格納していますが、`MediaPayload.url`（リモートURL）に切り替えられるよう型を用意済みです。

```ts
export function getRepository(): KotozuteRepository {
  return indexedDbRepository // ← ここを httpRepository に差し替える
}
```

---

## 主要な調整値

[`src/config.ts`](src/config.ts) で変更できます。

| 定数 | 既定 | 意味 |
| --- | --- | --- |
| `UNLOCK_RADIUS_M` | `50` | 開封可能になる距離（m） |
| `NEAR_RADIUS_M` | `200` | ピンが脈打ちはじめる距離（m） |
| `DEFAULT_ZOOM` | `16` | 地図の初期ズーム |
| `FALLBACK_CENTER` | 東京駅周辺 | 現在地不明時の初期中心（サンプルもこの近辺） |

---

## MVP のスコープ外（意図的に未実装）

フレンド／宛先指定／配信範囲、ログイン・認証（匿名で残す・受け取る）、AI検閲・通報フローの作り込み（開封画面に通報ボタンのUIのみ設置）、課金、キャラクター。すべてのことづては全体公開です。

## 技術スタック

React 18 + TypeScript / Vite / `@react-google-maps/api` / `idb`（IndexedDB）。状態管理は標準 hooks のみ。
