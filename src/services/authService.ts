import { getDb } from './indexedDbRepository'
import { generateId } from './repository'
import type { User } from '../types'

/** Web Crypto API を用いてパスワードを SHA-256 でハッシュ化する */
export async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** ユーザーを新規登録する */
export async function registerUser(
  username: string,
  displayName: string,
  passwordHash: string,
): Promise<User> {
  const db = await getDb()

  // ユーザー名の重複チェック（トリムして比較）
  const cleanUsername = username.trim()
  if (!cleanUsername) {
    throw new Error('ユーザー名を入力してください')
  }

  const existing = await db.getFromIndex('users', 'username', cleanUsername)
  if (existing) {
    throw new Error('このユーザー名はすでに使用されています')
  }

  const user: User = {
    id: generateId(),
    username: cleanUsername,
    displayName: displayName.trim() || cleanUsername,
    passwordHash,
    createdAt: Date.now(),
  }

  await db.put('users', user)
  return user
}

/** ユーザーを認証する */
export async function authenticateUser(
  username: string,
  passwordHash: string,
): Promise<User> {
  const db = await getDb()
  const cleanUsername = username.trim()
  const user = await db.getFromIndex('users', 'username', cleanUsername)
  if (!user || user.passwordHash !== passwordHash) {
    throw new Error('ユーザー名またはパスワードが正しくありません')
  }
  return user
}

/** ユーザーを ID から取得する */
export async function getUserById(id: string): Promise<User | undefined> {
  const db = await getDb()
  return db.get('users', id)
}
