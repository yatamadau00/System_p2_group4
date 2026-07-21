/** アプリ全体の調整可能な定数 */

/** 開封可能になる距離（メートル）。ここを変えると近接判定のしきい値が変わる。 */
export const UNLOCK_RADIUS_M = 5

/** 「もうすぐ届く」演出に入る距離（メートル）。ピンが脈打ち始める。 */
export const NEAR_RADIUS_M = 200

/** 地図の初期ズーム */
export const DEFAULT_ZOOM = 18

/**
 * 現在地が取得できないときの地図の初期中心。
 * （東京駅周辺。サンプルのことづてもこの近辺に配置する）
 */
export const FALLBACK_CENTER = { lat: 35.681236, lng: 139.767125 }

/** Google Maps APIキー（未設定可。未設定時はフォールバック地図を表示） */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

/**
 * Web Push の VAPID 公開鍵（未設定可。未設定時はプッシュ購読を行わない）。
 * 秘密鍵は送信サーバー(/api)側の環境変数にのみ置く。
 */
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
