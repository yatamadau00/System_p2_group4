import { useCallback, useEffect, useState } from 'react'
import type { Kotozute, KotozuteOpenHistory, NewKotozute } from '../types'
import { getRepository } from '../services'
import { SAMPLE_KOTOZUTE } from '../services/seed'

/**
 * ことづてのコレクションを読み込み・作成・削除するフック。
 * リポジトリ（現状 IndexedDB）越しに永続化する。
 */
export function useKotozute(userId?: string | null) {
  const [items, setItems] = useState<Kotozute[]>([])
  const [openHistory, setOpenHistory] = useState<KotozuteOpenHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const repo = getRepository()
    const history = userId ? await repo.listOpenHistory(userId) : []
    const openedIds = new Set(history.map((record) => record.kotozuteId))
    const list = await repo.list()
    setOpenHistory(history)
    setItems(
      list.map((item) => ({
        ...item,
        openedByCurrentUser: openedIds.has(item.id),
      })),
    )
  }, [userId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const repo = getRepository()
        await repo.ensureSeed(SAMPLE_KOTOZUTE)
        const history = userId ? await repo.listOpenHistory(userId) : []
        const openedIds = new Set(history.map((record) => record.kotozuteId))
        const list = await repo.list()
        if (!cancelled) {
          setOpenHistory(history)
          setItems(
            list.map((item) => ({
              ...item,
              openedByCurrentUser: openedIds.has(item.id),
            })),
          )
        }
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('ことづての読み込みに失敗しました。')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const create = useCallback(
    async (input: NewKotozute) => {
      const repo = getRepository()
      const created = await repo.create(input)
      await refresh()
      return created
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      const repo = getRepository()
      await repo.remove(id)
      await refresh()
    },
    [refresh],
  )

  const markOpened = useCallback(
    async (id: string) => {
      if (!userId) return false
      const repo = getRepository()
      const isNew = await repo.markOpened(id, userId)
      await refresh()
      return isNew
    },
    [refresh, userId],
  )

  return { items, openHistory, loading, error, create, remove, refresh, markOpened }
}
