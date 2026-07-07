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
  kotozuteOpens: {
    key: string
    value: {
      id: string
      userId: string
      kotozuteId: string
      openedAt: number
    }
    indexes: { userId: string; kotozuteId: string }
  }
  kotozuteLikes: {
    key: string
    value: {
      id: string
      userId: string
      kotozuteId: string
      createdAt: number
    }
    indexes: { userId: string; kotozuteId: string }
  }
}

const DB_NAME = 'kotozute-db'
const DB_VERSION = 4
const SEEDED_KEY = 'seeded'

let dbPromise: Promise<IDBPDatabase<KotozuteDB>> | null = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB<KotozuteDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          const store = database.createObjectStore('kotozute', { keyPath: 'id' }) as any
          store.createIndex('createdAt', 'createdAt')
          store.createIndex('replyToId', 'replyToId')
          store.createIndex('rootId', 'rootId')
          database.createObjectStore('meta')
        }
        if (oldVersion < 2) {
          const store = transaction?.objectStore('kotozute') as any
          if (store && !store.indexNames.contains('replyToId')) {
            store.createIndex('replyToId', 'replyToId')
          }
          if (store && !store.indexNames.contains('rootId')) {
            store.createIndex('rootId', 'rootId')
          }
          const userStore = database.createObjectStore('users', { keyPath: 'id' })
          userStore.createIndex('username', 'username', { unique: true })
        }
        if (oldVersion < 3) {
          const openStore = database.createObjectStore('kotozuteOpens', {
            keyPath: 'id',
          })
          openStore.createIndex('userId', 'userId')
          openStore.createIndex('kotozuteId', 'kotozuteId')
        }
        if (oldVersion < 4) {
          const likeStore = database.createObjectStore('kotozuteLikes', {
            keyPath: 'id',
          })
          likeStore.createIndex('userId', 'userId')
          likeStore.createIndex('kotozuteId', 'kotozuteId')
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
  return {
    ...record,
    media: Array.isArray(record.media) ? record.media : [],
    rootId: record.rootId ?? record.replyToId ?? record.id,
    likesCount: record.likesCount ?? 0,
    likedByCurrentUser: record.likedByCurrentUser ?? false,
  }
}

async function attachLikes(
  records: Kotozute[],
  userId?: string | null,
): Promise<Kotozute[]> {
  const database = await db()
  const likes = await database.getAll('kotozuteLikes')
  const counts = new Map<string, number>()
  const likedByUser = new Set<string>()

  likes.forEach((like) => {
    counts.set(like.kotozuteId, (counts.get(like.kotozuteId) ?? 0) + 1)
    if (userId && like.userId === userId) likedByUser.add(like.kotozuteId)
  })

  return records.map((record) => ({
    ...normalize(record),
    likesCount: counts.get(record.id) ?? 0,
    likedByCurrentUser: likedByUser.has(record.id),
  }))
}

export const indexedDbRepository: KotozuteRepository = {
  async list(userId) {
    const all = await (await db()).getAll('kotozute')
    const withLikes = await attachLikes(all, userId)
    return withLikes.sort((a, b) => b.createdAt - a.createdAt)
  },

  async get(id, userId) {
    const record = await (await db()).get('kotozute', id)
    if (!record) return undefined
    const [withLikes] = await attachLikes([record], userId)
    return withLikes
  },

  async create(input: NewKotozute) {
    const id = generateId()
    const record: Kotozute = {
      ...input,
      id,
      createdAt: Date.now(),
      mine: input.mine ?? true,
      rootId: input.rootId ?? input.replyToId ?? id,
    }
    await (await db()).put('kotozute', record)
    return record
  },

  async update(id, patch) {
    const database = await db()
    const existing = await database.get('kotozute', id)
    if (!existing) throw new Error('ことづてが見つかりません')
    const updated: Kotozute = {
      ...existing,
      ...(patch.message !== undefined ? { message: patch.message } : {}),
      ...(patch.placeLabel !== undefined ? { placeLabel: patch.placeLabel } : {}),
      ...(patch.link !== undefined ? { link: patch.link } : {}),
      ...(patch.media !== undefined ? { media: patch.media } : {}),
    }
    await database.put('kotozute', updated)
    return normalize(updated)
  },

  async remove(id) {
    const database = await db()
    const tx = database.transaction(
      ['kotozute', 'kotozuteOpens', 'kotozuteLikes'],
      'readwrite',
    )
    await tx.objectStore('kotozute').delete(id)
    const opens = await tx.objectStore('kotozuteOpens').index('kotozuteId').getAll(id)
    await Promise.all(
      opens.map((open) => tx.objectStore('kotozuteOpens').delete(open.id)),
    )
    const likes = await tx.objectStore('kotozuteLikes').index('kotozuteId').getAll(id)
    await Promise.all(
      likes.map((like) => tx.objectStore('kotozuteLikes').delete(like.id)),
    )
    await tx.done
  },

  async listOpenHistory(userId) {
    const opens = await (await db())
      .getAllFromIndex('kotozuteOpens', 'userId', userId)
    return opens
      .map((open) => ({
        kotozuteId: open.kotozuteId,
        openedAt: open.openedAt,
      }))
      .sort((a, b) => b.openedAt - a.openedAt)
  },

  async markOpened(kotozuteId, userId) {
    const database = await db()
    const id = `${userId}:${kotozuteId}`
    const existing = await database.get('kotozuteOpens', id)
    if (existing) return false
    await database.put('kotozuteOpens', {
      id,
      userId,
      kotozuteId,
      openedAt: Date.now(),
    })
    return true
  },

  async toggleLike(kotozuteId, userId) {
    const database = await db()
    const id = `${userId}:${kotozuteId}`
    const existing = await database.get('kotozuteLikes', id)
    if (existing) {
      await database.delete('kotozuteLikes', id)
    } else {
      await database.put('kotozuteLikes', {
        id,
        userId,
        kotozuteId,
        createdAt: Date.now(),
      })
    }
    const likes = await database.getAllFromIndex('kotozuteLikes', 'kotozuteId', kotozuteId)
    return {
      liked: !existing,
      likesCount: likes.length,
    }
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
        rootId: item.rootId ?? item.replyToId ?? generateId(),
        validFrom: item.validFrom,
        validTo: item.validTo,
      }
      await tx.objectStore('kotozute').put(record)
    }
    await tx.objectStore('meta').put(true, SEEDED_KEY)
    await tx.done
  },
}
