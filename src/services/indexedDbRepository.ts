import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Kotozute, NewKotozute } from '../types'
import {
  generateId,
  type KotozuteRepository,
  type SeedKotozute,
} from './repository'

interface KotozuteDB extends DBSchema {
  kotozute: {
    key: string
    value: Kotozute
    indexes: { createdAt: number }
  }
  meta: {
    key: string
    value: boolean
  }
}

const DB_NAME = 'kotozute-db'
const DB_VERSION = 1
const SEEDED_KEY = 'seeded'

let dbPromise: Promise<IDBPDatabase<KotozuteDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<KotozuteDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const store = database.createObjectStore('kotozute', { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
        database.createObjectStore('meta')
      },
    })
  }
  return dbPromise
}

/**
 * IndexedDB を用いた永続化実装。
 * メディアは Blob としてそのまま格納されるため、object URL を都度生成して表示する。
 */
export const indexedDbRepository: KotozuteRepository = {
  async list() {
    const all = await (await db()).getAll('kotozute')
    return all.sort((a, b) => b.createdAt - a.createdAt)
  },

  async get(id) {
    return (await db()).get('kotozute', id)
  },

  async create(input: NewKotozute) {
    const record: Kotozute = {
      ...input,
      id: generateId(),
      createdAt: Date.now(),
      mine: input.mine ?? true,
    }
    await (await db()).put('kotozute', record)
    return record
  },

  async remove(id) {
    await (await db()).delete('kotozute', id)
  },

  async ensureSeed(seed: SeedKotozute[]) {
    const database = await db()
    const already = await database.get('meta', SEEDED_KEY)
    if (already) return

    const tx = database.transaction(['kotozute', 'meta'], 'readwrite')
    for (const item of seed) {
      const record: Kotozute = {
        ...item,
        id: generateId(),
        createdAt: item.createdAt ?? Date.now(),
        mine: item.mine ?? false,
      }
      await tx.objectStore('kotozute').put(record)
    }
    await tx.objectStore('meta').put(true, SEEDED_KEY)
    await tx.done
  },
}
