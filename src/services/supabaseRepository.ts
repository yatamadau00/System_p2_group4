import { openDB, type IDBPDatabase } from 'idb'
import type { AttachmentKind, Kotozute, NewKotozute } from '../types'
import { uid } from '../lib/media'
import {
  generateId,
  type KotozuteRepository,
  type SeedKotozute,
} from './repository'
import { MEDIA_BUCKET, supabase } from './supabaseClient'

/**
 * Supabase を用いた「全員共有」の保存実装。
 * - ことづて本体は public.kotozute テーブル（全体公開）
 * - 写真/映像/音声は Storage(kotozute-media) にアップロードし、公開URLを保存
 *
 * 「自分が残したか(mine)」は端末固有の概念なので、共有DBには持たせず
 * この端末の IndexedDB に作成IDを控えておき、読み出し時に突き合わせる。
 */

interface MediaJson {
  kind: AttachmentKind
  url: string
  mime_type?: string
  file_name?: string
}

interface Row {
  id: string
  lat: number
  lng: number
  message: string | null
  link: string | null
  author_name: string | null
  author_id: string | null
  author: { display_name: string | null } | null
  reply_to_id: string | null
  root_id: string | null
  place_label: string | null
  media: MediaJson[] | null
  visibility: string | null
  group_id: string | null
  is_anonymous: boolean | null
  is_sample: boolean | null
  created_at: string
}

// ---- 「自分が残した」IDの端末ローカル記録（IndexedDB） ----
let mineDbPromise: Promise<IDBPDatabase> | null = null
function mineDb() {
  if (!mineDbPromise) {
    mineDbPromise = openDB('kotozute-mine', 1, {
      upgrade(db) {
        db.createObjectStore('ids')
      },
    })
  }
  return mineDbPromise
}
async function getMineIds(): Promise<Set<string>> {
  const keys = await (await mineDb()).getAllKeys('ids')
  return new Set(keys as string[])
}
async function addMineId(id: string) {
  await (await mineDb()).put('ids', true, id)
}
async function removeMineId(id: string) {
  await (await mineDb()).delete('ids', id)
}

function rowToKotozute(row: Row, mineIds: Set<string>): Kotozute {
  return {
    id: row.id,
    replyToId: row.reply_to_id ?? undefined,
    rootId: row.root_id ?? row.reply_to_id ?? row.id,
    location: { lat: row.lat, lng: row.lng },
    message: row.message ?? '',
    link: row.link ?? undefined,
    media: (row.media ?? []).map((m) => ({
      id: uid(),
      kind: m.kind,
      url: m.url,
      mimeType: m.mime_type,
      fileName: m.file_name,
    })),
    authorName: row.is_anonymous
      ? undefined
      : row.author?.display_name ?? row.author_name ?? undefined,
    authorId: row.author_id ?? undefined,
    isAnonymous: row.is_anonymous ?? false,
    placeLabel: row.place_label ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    mine: mineIds.has(row.id),
    isSample: row.is_sample ?? false,
    visibility:
      row.visibility === 'group' || row.visibility === 'public'
        ? row.visibility
        : undefined,
    groupId: row.group_id ?? undefined,
  }
}

/** 拡張子をMIME/種別から推定（録音webm等のため） */
function extFor(mime?: string, fileName?: string, kind?: AttachmentKind): string {
  const fromName = fileName?.includes('.') ? fileName.split('.').pop() : undefined
  if (fromName) return fromName
  if (mime?.includes('/')) return mime.split('/')[1].split(';')[0]
  return kind === 'image' ? 'jpg' : kind === 'video' ? 'mp4' : 'webm'
}

export const supabaseRepository: KotozuteRepository = {
  async list() {
    const { data, error } = await supabase!
      .from('kotozute')
      .select('*, author:users!kotozute_author_id_fkey(display_name)')
      .order('created_at', { ascending: false })
    if (error) throw error
    const mine = await getMineIds()
    return (data as Row[]).map((r) => rowToKotozute(r, mine))
  },

  async get(id) {
    const { data, error } = await supabase!
      .from('kotozute')
      .select('*, author:users!kotozute_author_id_fkey(display_name)')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return undefined
    const mine = await getMineIds()
    return rowToKotozute(data as Row, mine)
  },

  async create(input: NewKotozute) {
    const id = generateId()

    // メディアを Storage にアップロードして公開URLを得る
    const media: MediaJson[] = []
    for (const m of input.media) {
      if (m.blob) {
        const path = `${id}/${uid()}.${extFor(m.mimeType, m.fileName, m.kind)}`
        const { error: upErr } = await supabase!.storage
          .from(MEDIA_BUCKET)
          .upload(path, m.blob, { contentType: m.mimeType, upsert: false })
        if (upErr) throw upErr
        const { data: pub } = supabase!.storage
          .from(MEDIA_BUCKET)
          .getPublicUrl(path)
        media.push({
          kind: m.kind,
          url: pub.publicUrl,
          mime_type: m.mimeType,
          file_name: m.fileName,
        })
      } else if (m.url) {
        media.push({
          kind: m.kind,
          url: m.url,
          mime_type: m.mimeType,
          file_name: m.fileName,
        })
      }
    }

    const { data, error } = await supabase!
      .from('kotozute')
      .insert({
        id,
        lat: input.location.lat,
        lng: input.location.lng,
        message: input.message,
        link: input.link ?? null,
        author_name: input.authorId ? null : input.authorName ?? null,
        author_id: input.authorId ?? null,
        reply_to_id: input.replyToId ?? null,
        root_id: input.rootId ?? input.replyToId ?? id,
        is_anonymous: input.isAnonymous ?? false,
        place_label: input.placeLabel ?? null,
        media,
        visibility: input.visibility ?? 'public',
        group_id: input.groupId ?? null,
        is_sample: false,
      })
      .select('*, author:users!kotozute_author_id_fkey(display_name)')
      .single()
    if (error) throw error

    await addMineId(id)
    return rowToKotozute(data as Row, new Set([id]))
  },

  async update(id, patch) {
    const row: Record<string, unknown> = {}
    if (patch.message !== undefined) row.message = patch.message
    if (patch.placeLabel !== undefined) row.place_label = patch.placeLabel || null
    if (patch.link !== undefined) row.link = patch.link || null

    const { data, error } = await supabase!
      .from('kotozute')
      .update(row)
      .eq('id', id)
      .select('*, author:users!kotozute_author_id_fkey(display_name)')
      .single()
    if (error) throw error
    const mine = await getMineIds()
    return rowToKotozute(data as Row, mine)
  },

  async remove(id) {
    // 付随メディアもベストエフォートで削除
    const { data: files } = await supabase!.storage
      .from(MEDIA_BUCKET)
      .list(id)
    if (files && files.length > 0) {
      await supabase!.storage
        .from(MEDIA_BUCKET)
        .remove(files.map((f: { name: string }) => `${id}/${f.name}`))
    }
    const { error } = await supabase!.from('kotozute').delete().eq('id', id)
    if (error) throw error
    await removeMineId(id)
  },

  async listOpenedIds(userId) {
    const { data, error } = await supabase!
      .from('kotozute_opens')
      .select('kotozute_id')
      .eq('user_id', userId)
    if (error) {
      console.warn('Kotozute open state could not be loaded:', error)
      return new Set()
    }
    return new Set(
      (data as { kotozute_id: string }[]).map((row) => row.kotozute_id),
    )
  },

  async markOpened(kotozuteId, userId) {
    const { data: existing, error: existingError } = await supabase!
      .from('kotozute_opens')
      .select('id')
      .eq('user_id', userId)
      .eq('kotozute_id', kotozuteId)
      .maybeSingle()
    if (existingError) {
      console.warn('Kotozute open state could not be checked:', existingError)
      return false
    }
    if (existing) return false

    const { error } = await supabase!
      .from('kotozute_opens')
      .insert({
        user_id: userId,
        kotozute_id: kotozuteId,
      })
    if (error) {
      console.warn('Kotozute open state could not be saved:', error)
      return false
    }
    return true
  },

  async ensureSeed(seed: SeedKotozute[]) {
    // 共有DBなので、まだ1件も無いときだけサンプルを投入する
    const { count, error } = await supabase!
      .from('kotozute')
      .select('*', { count: 'exact', head: true })
    if (error) throw error
    if ((count ?? 0) > 0) return

    const rows = seed.map((s) => {
      const id = generateId()
      return {
        id,
        lat: s.location.lat,
        lng: s.location.lng,
        message: s.message,
        link: s.link ?? null,
        author_name: s.authorName ?? null,
        author_id: null,
        reply_to_id: s.replyToId ?? null,
        root_id: s.rootId ?? s.replyToId ?? id,
        is_anonymous: s.isAnonymous ?? false,
        place_label: s.placeLabel ?? null,
        media: [],
        visibility: s.visibility ?? 'public',
        group_id: s.groupId ?? null,
        is_sample: true,
        created_at: new Date(s.createdAt ?? Date.now()).toISOString(),
      }
    })
    await supabase!.from('kotozute').insert(rows)
  },
}
