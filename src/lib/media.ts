import type { Kotozute, MediaKind } from '../types'

/** 軽量なローカルID（メディア要素のkey/削除用） */
export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `m_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

/**
 * ことづての「主要な種類」を導出する。
 * ピンのアイコンや色分け、ラベル表示に用いる。
 * 優先度: 映像 > 写真 > 声 > ことば。
 */
export function primaryKind(k: Pick<Kotozute, 'media'>): MediaKind {
  const kinds = new Set((k.media ?? []).map((m) => m.kind))
  if (kinds.has('video')) return 'video'
  if (kinds.has('image')) return 'image'
  if (kinds.has('audio')) return 'audio'
  return 'text'
}

/** 中身を一言で表すラベル（複数種類が混ざるときは総称） */
export function kindLabel(k: Pick<Kotozute, 'media'>): string {
  const kinds = new Set((k.media ?? []).map((m) => m.kind))
  if (kinds.size === 0) return 'ことばのことづて'
  if (kinds.size > 1) return 'いくつもの想いのことづて'
  const only = [...kinds][0]
  return only === 'image'
    ? '写真のことづて'
    : only === 'video'
      ? '映像のことづて'
      : '声のことづて'
}
