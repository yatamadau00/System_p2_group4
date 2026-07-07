/** ことづて アプリのドメイン型定義 */

/** ことづての「主要な種類」を表す（ピンのアイコンや色などに使う） */
export type MediaKind = 'text' | 'image' | 'video' | 'audio'

/** 添付メディアの種類（テキストは本文 message として持つので含まない） */
export type AttachmentKind = 'image' | 'video' | 'audio'

/** 地理座標 */
export interface LatLng {
  lat: number
  lng: number
}

/**
 * 添付メディア1点。
 * MVPでは blob を IndexedDB に保存し、表示時に object URL を生成する。
 * バックエンド差し替え時は `url` にリモートURLを入れる運用に切り替え可能。
 */
export interface MediaItem {
  /** ローカル識別子（リスト描画・削除に使用） */
  id: string
  kind: AttachmentKind
  /** 永続化されたバイナリ */
  blob?: Blob
  /** MIME タイプ（例: image/jpeg） */
  mimeType?: string
  /** ファイル名（任意・表示用） */
  fileName?: string
  /** リモート運用時のメディアURL（MVPでは未使用、API差し替え用） */
  url?: string
}

/**
 * 場所に残された「ことづて」。
 * 1通の中に、本文・リンクに加えて複数のメディア（写真・映像・音声）を
 * 自由に添えられる（種別を1つに絞らせない）。
 */
export interface Kotozute {
  id: string
  /** 返信先のことづてID（返信でない場合は未設定） */
  replyToId?: string
  /** スレッドの起点となることづてID（自分が起点なら自分のID） */
  rootId?: string
  /** 残した位置 */
  location: LatLng
  /** 本文・言葉 */
  message: string
  /** 任意のリンク */
  link?: string
  /** 添付メディア（0件以上） */
  media: MediaItem[]
  /** 残した人の表示名（匿名可・任意） */
  authorName?: string
  /** 残した人のユーザーID（任意） */
  authorId?: string
  /** 投稿者名を公開しないか */
  isAnonymous?: boolean
  /** 残した地点の呼び名（例:「卒業した教室」）任意 */
  placeLabel?: string
  /** 作成時刻（epoch ms） */
  createdAt: number
  /** この端末で残したものか（自分の一覧表示用） */
  mine: boolean
  /** ダミーデータ（サンプル）か */
  isSample?: boolean
  /** 公開範囲（全体公開 or グループ限定） */
  visibility?: 'public' | 'group'
  /** group 限定のとき、対象グループのID（共有コード） */
  groupId?: string
  /** 現在のログインユーザーが開封済みか */
  openedByCurrentUser?: boolean
}

/** ユーザーがことづてを取得（開封）した履歴 */
export interface KotozuteOpenHistory {
  kotozuteId: string
  openedAt: number
}

/** 新規作成時の入力（id/createdAt はサービス層が付与） */
export type NewKotozute = Omit<Kotozute, 'id' | 'createdAt' | 'mine'> &
  Partial<Pick<Kotozute, 'mine'>>

/** ユーザー自身のプロフィール */
export interface UserProfile {
  id: string
  name: string
  bio: string
  avatarEmoji: string
  avatarColor: string
  friendCode: string
}

/** 参加しているグループ（共有コードで出入りする） */
export interface Group {
  /** グループID＝共有コード（例: KOTO-AB12CD） */
  id: string
  /** グループ名（作成者が付ける。未設定ならコードを表示） */
  name: string
  /** グループのアイコン絵文字 */
  avatarEmoji: string
  /** グループのアイコン背景色 */
  avatarColor: string
  /** 自分が作成したグループか */
  owner: boolean
  /** 参加した時刻（epoch ms） */
  joinedAt: number
}

/** グループのメンバー（一覧表示用） */
export interface GroupMember {
  id: string
  name: string
  avatarEmoji: string
  avatarColor: string
  joinedAt: number
  /** グループの作成者か */
  owner: boolean
}

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

/** ユーザーアカウント */
export interface User {
  id: string
  /** ログイン用ユーザー名（一意） */
  username: string
  /** 表示名 */
  displayName: string
  /** 自己紹介 */
  bio?: string
  /** アバター絵文字 */
  avatarEmoji?: string
  /** アバター背景色 */
  avatarColor?: string
  /** フレンド追加用コード */
  friendCode?: string
  /** パスワードのSHA-256ハッシュ */
  passwordHash: string
  /** 作成時刻（epoch ms） */
  createdAt: number
}

/** アプリ内通知情報 */
export interface AppNotification {
  id: string
  title: string
  message: string
  type: 'near' | 'unlockable' | 'system' | 'received'
  relatedId?: string // 関連することづてのID
  createdAt: number
  read: boolean
}
