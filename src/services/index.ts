import { indexedDbRepository } from './indexedDbRepository'
import { supabaseRepository } from './supabaseRepository'
import { isSupabaseConfigured } from './supabaseClient'
import type { KotozuteRepository } from './repository'

/**
 * アプリが使うリポジトリを返す唯一の窓口。
 * - Supabase が設定されていれば「全員共有」の実装を使う
 * - 未設定なら端末内 IndexedDB（ローカル専用）にフォールバック
 */
export function getRepository(): KotozuteRepository {
  return isSupabaseConfigured ? supabaseRepository : indexedDbRepository
}

/** いま共有モード（Supabase）で動いているか */
export { isSupabaseConfigured } from './supabaseClient'

export type { KotozuteRepository } from './repository'
