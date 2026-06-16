import { indexedDbRepository } from './indexedDbRepository'
import type { KotozuteRepository } from './repository'

/**
 * アプリが使うリポジトリを返す唯一の窓口。
 * バックエンド差し替え時はここで実装を切り替える（例: return httpRepository）。
 */
export function getRepository(): KotozuteRepository {
  return indexedDbRepository
}

export type { KotozuteRepository } from './repository'
