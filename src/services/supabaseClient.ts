import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Supabase の接続情報が揃っているか（揃っていなければローカルIndexedDBにフォールバック） */
export const isSupabaseConfigured =
  url.trim().length > 0 && anonKey.trim().length > 0

/**
 * Supabase クライアント。anon キーはブラウザ公開前提の鍵で、
 * アクセス制御は DB 側の RLS ポリシーで行う。
 */
export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null

/** メディア保存に使う公開バケット名 */
export const MEDIA_BUCKET = 'kotozute-media'
