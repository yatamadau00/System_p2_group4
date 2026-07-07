import { getDb } from './indexedDbRepository'
import { generateId } from './repository'
import { isSupabaseConfigured, supabase } from './supabaseClient'
import type { User } from '../types'

const DEFAULT_AVATAR_EMOJI = '🦉'
const DEFAULT_AVATAR_COLOR = '#f1e8d6'

interface UserRow {
  id: string
  username: string
  display_name: string
  password_hash: string
  bio: string | null
  avatar_emoji: string | null
  avatar_color: string | null
  avatar_image_url: string | null
  friend_code: string | null
  created_at: string
}

function createFriendCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `KOTO-${suffix}`
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    bio: row.bio ?? '',
    avatarEmoji: row.avatar_emoji ?? DEFAULT_AVATAR_EMOJI,
    avatarColor: row.avatar_color ?? DEFAULT_AVATAR_COLOR,
    avatarImageUrl: row.avatar_image_url ?? null,
    friendCode: row.friend_code ?? '',
    createdAt: new Date(row.created_at).getTime(),
  }
}

async function getSupabaseUserByUsername(username: string) {
  const { data, error } = await supabase!
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  return data ? rowToUser(data as UserRow) : undefined
}

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
  // ユーザー名の重複チェック（トリムして比較）
  const cleanUsername = username.trim()
  if (!cleanUsername) {
    throw new Error('ユーザー名を入力してください')
  }

  if (isSupabaseConfigured) {
    const existing = await getSupabaseUserByUsername(cleanUsername)
    if (existing) {
      throw new Error('このユーザー名はすでに使用されています')
    }

    const id = generateId()
    const { data, error } = await supabase!
      .from('users')
      .insert({
        id,
        username: cleanUsername,
        display_name: displayName.trim() || cleanUsername,
        password_hash: passwordHash,
        bio: '場所に想いを残すのが好きです。',
        avatar_emoji: DEFAULT_AVATAR_EMOJI,
        avatar_color: DEFAULT_AVATAR_COLOR,
        avatar_image_url: null,
        friend_code: createFriendCode(),
      })
      .select()
      .single()
    if (error) throw error
    return rowToUser(data as UserRow)
  }

  const db = await getDb()
  const existing = await db.getFromIndex('users', 'username', cleanUsername)
  if (existing) {
    throw new Error('このユーザー名はすでに使用されています')
  }

  const user: User = {
    id: generateId(),
    username: cleanUsername,
    displayName: displayName.trim() || cleanUsername,
    bio: '場所に想いを残すのが好きです。',
    avatarEmoji: DEFAULT_AVATAR_EMOJI,
    avatarColor: DEFAULT_AVATAR_COLOR,
    avatarImageUrl: null,
    friendCode: createFriendCode(),
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
  const cleanUsername = username.trim()

  if (isSupabaseConfigured) {
    const user = await getSupabaseUserByUsername(cleanUsername)
    if (!user || user.passwordHash !== passwordHash) {
      throw new Error('ユーザー名またはパスワードが正しくありません')
    }
    return user
  }

  const db = await getDb()
  const user = await db.getFromIndex('users', 'username', cleanUsername)
  if (!user || user.passwordHash !== passwordHash) {
    throw new Error('ユーザー名またはパスワードが正しくありません')
  }
  return user
}

/** ユーザーを ID から取得する */
export async function getUserById(id: string): Promise<User | undefined> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase!
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? rowToUser(data as UserRow) : undefined
  }

  const db = await getDb()
  return db.get('users', id)
}

/** プロフィール情報を更新する */
export async function updateUserProfile(
  id: string,
  updates: Pick<
    User,
    'displayName' | 'bio' | 'avatarEmoji' | 'avatarColor' | 'avatarImageUrl'
  >,
): Promise<User> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase!
      .from('users')
      .update({
        display_name: updates.displayName,
        bio: updates.bio ?? '',
        avatar_emoji: updates.avatarEmoji ?? DEFAULT_AVATAR_EMOJI,
        avatar_color: updates.avatarColor ?? DEFAULT_AVATAR_COLOR,
        avatar_image_url: updates.avatarImageUrl ?? null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return rowToUser(data as UserRow)
  }

  const db = await getDb()
  const current = await db.get('users', id)
  if (!current) {
    throw new Error('ユーザーが見つかりません')
  }
  const next: User = {
    ...current,
    displayName: updates.displayName,
    bio: updates.bio,
    avatarEmoji: updates.avatarEmoji,
    avatarColor: updates.avatarColor,
    avatarImageUrl: updates.avatarImageUrl ?? null,
  }
  await db.put('users', next)
  return next
}
