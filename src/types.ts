/** ことづて アプリのドメイン型定義 */

export type MediaKind = 'text' | 'image' | 'video' | 'audio'

/** 地理座標 */
export interface LatLng {
  lat: number
  lng: number
}

/**
 * 添付メディア。
 * MVPでは blob を IndexedDB に保存し、表示時に object URL を生成する。
 * バックエンド差し替え時は `url` にリモートURLを入れる運用に切り替え可能。
 */
export interface MediaPayload {
  kind: MediaKind
  /** image/video/audio のとき：永続化されたバイナリ */
  blob?: Blob
  /** MIME タイプ（例: image/jpeg） */
  mimeType?: string
  /** ファイル名（任意・表示用） */
  fileName?: string
  /** リモート運用時のメディアURL（MVPでは未使用、API差し替え用） */
  url?: string
}

/** 場所に残された「ことづて」 */
export interface Kotozute {
  id: string
  /** 残した位置 */
  location: LatLng
  /** メディア種別 */
  mediaKind: MediaKind
  /** 本文・言葉（テキスト種別では主役、他種別では添え書き） */
  message: string
  /** 任意のリンク（テキストに貼れる） */
  link?: string
  /** 添付メディア（text の場合は無し） */
  media?: MediaPayload
  /** 残した人の表示名（匿名可・任意） */
  authorName?: string
  /** 残した地点の呼び名（例:「卒業した教室」）任意 */
  placeLabel?: string
  /** 作成時刻（epoch ms） */
  createdAt: number
  /** この端末で残したものか（自分の一覧表示用） */
  mine: boolean
  /** ダミーデータ（サンプル）か */
  isSample?: boolean
}

/** 新規作成時の入力（id/createdAt はサービス層が付与） */
export type NewKotozute = Omit<Kotozute, 'id' | 'createdAt' | 'mine'> &
  Partial<Pick<Kotozute, 'mine'>>

/** 位置情報の取得状態 */
export type GeoStatus =
  | 'idle'
  | 'prompting'
  | 'watching'
  | 'denied'
  | 'unavailable'
  | 'error'

/** ことづての近接状態（現在地との距離から導出） */
export type Proximity = 'far' | 'near' | 'unlockable'
