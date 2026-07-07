import type { Kotozute, KotozuteOpenHistory, NewKotozute } from '../types'

/** サンプル投入用。作成時刻を明示できる（一覧の並びに変化を出すため） */
export type SeedKotozute = NewKotozute & { createdAt?: number }

/**
 * ことづての保存・取得を担う抽象インターフェース。
 *
 * MVP では IndexedDB 実装（`indexedDbRepository`）を使う。
 * 将来バックエンドAPIに差し替える際は、この interface を満たす
 * 別実装（例: `httpRepository`）を作って `getRepository()` の返り値を
 * 切り替えるだけでよい。アプリ本体はこの interface 以外に依存しない。
 */
export interface KotozuteRepository {
  /** すべてのことづてを取得（新しい順） */
  list(): Promise<Kotozute[]>
  /** 1件取得 */
  get(id: string): Promise<Kotozute | undefined>
  /** 新規作成して保存。確定した Kotozute を返す */
  create(input: NewKotozute): Promise<Kotozute>
  /** 削除 */
  remove(id: string): Promise<void>
  /** 指定ユーザーのことづて取得履歴を取得（新しい順） */
  listOpenHistory(userId: string): Promise<KotozuteOpenHistory[]>
  /** 指定ユーザーの開封を記録。新規記録なら true */
  markOpened(kotozuteId: string, userId: string): Promise<boolean>
  /** 初回起動時にサンプルを投入（既にデータがあれば何もしない） */
  ensureSeed(seed: SeedKotozute[]): Promise<void>
}

/** 衝突しにくいIDを生成（crypto.randomUUID があれば利用） */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `k_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}
