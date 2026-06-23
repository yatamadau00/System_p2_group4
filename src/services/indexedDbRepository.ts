import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Kotozute, NewKotozute, User } from '../types'
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
  users: {
    key: string
    value: User
    indexes: { username: string }
  }
}

const DB_NAME = 'kotozute-db'
const DB_VERSION = 2
const SEEDED_KEY = 'seeded'

let dbPromise: Promise<IDBPDatabase<KotozuteDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<KotozuteDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const store = database.createObjectStore('kotozute', { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt')
          database.createObjectStore('meta')
        }
        if (oldVersion < 2) {
          const userStore = database.createObjectStore('users', { keyPath: 'id' })
          userStore.createIndex('username', 'username', { unique: true })
        }
      },
    })
  }
  return dbPromise
}

export function getDb() {
  return db()
}


/**
 * IndexedDB を用いた永続化実装。
 * メディアは Blob としてそのまま格納されるため、object URL を都度生成して表示する。
 */
/**
 * 古いスキーマで保存されたレコード（media 配列を持たない等）を、
 * 現行の形へ正規化する。これにより読み出し後はどこでも media を配列として扱える。
 */
function normalize(record: Kotozute): Kotozute {
  return { ...record, media: Array.isArray(record.media) ? record.media : [] }
}

export const indexedDbRepository: KotozuteRepository = {
  async list() {
    const all = await (await db()).getAll('kotozute')
    return all.map(normalize).sort((a, b) => b.createdAt - a.createdAt)
  },

  async get(id) {
    const record = await (await db()).get('kotozute', id)
    return record ? normalize(record) : undefined
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
