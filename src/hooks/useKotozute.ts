import { useCallback, useEffect, useState } from 'react'
import type { Kotozute, NewKotozute } from '../types'
import { getRepository } from '../services'
import { SAMPLE_KOTOZUTE } from '../services/seed'

/**
 * ことづてのコレクションを読み込み・作成・削除するフック。
 * リポジトリ（現状 IndexedDB）越しに永続化する。
 */
export function useKotozute() {
  const [items, setItems] = useState<Kotozute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const repo = getRepository()
    const list = await repo.list()
    setItems(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const repo = getRepository()
        await repo.ensureSeed(SAMPLE_KOTOZUTE)
        const list = await repo.list()
        if (!cancelled) setItems(list)
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
  }, [])

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

  return { items, loading, error, create, remove, refresh }
}
