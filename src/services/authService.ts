import { getDb } from './indexedDbRepository'
import { generateId } from './repository'
import { isSupabaseConfigured, supabase } from './supabaseClient'
import type { User } from '../types'
import type { User as SupabaseAuthUser } from '@supabase/supabase-js'

const DEFAULT_AVATAR_EMOJI = '🦉'
const DEFAULT_AVATAR_COLOR = '#f1e8d6'

interface UserRow {
  id: string
  auth_user_id: string | null
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

function oauthUsername(authUser: SupabaseAuthUser) {
  const emailName = authUser.email?.split('@')[0] ?? 'google-user'
  const safeName = emailName.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'google-user'
  return `${safeName}-${authUser.id.slice(0, 8)}`
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    authUserId: row.auth_user_id ?? null,
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

/** Supabase AuthのGoogleユーザーを既存のアプリ内プロフィールへ同期する。 */
export async function syncGoogleUser(authUser: SupabaseAuthUser): Promise<User> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('GoogleログインにはSupabaseの設定が必要です')
  }

  const metadata = authUser.user_metadata ?? {}
  const displayName =
    (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    authUser.email?.split('@')[0] ||
    'Googleユーザー'
  const avatarImageUrl =
    (typeof metadata.avatar_url === 'string' && metadata.avatar_url) ||
    (typeof metadata.picture === 'string' && metadata.picture) ||
    null

  const { data: linkedData, error: linkedError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (linkedError) throw linkedError

  const existing = linkedData
    ? rowToUser(linkedData as UserRow)
    : await getUserById(authUser.id)
  if (existing) {
    const { data, error } = await supabase
      .from('users')
      .update({
        auth_user_id: authUser.id,
        display_name: displayName,
        avatar_image_url: avatarImageUrl,
      })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    return { ...rowToUser(data as UserRow), email: authUser.email }
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: authUser.id,
      auth_user_id: authUser.id,
      username: oauthUsername(authUser),
      display_name: displayName,
      password_hash: '',
      bio: '場所に想いを残すのが好きです。',
      avatar_emoji: DEFAULT_AVATAR_EMOJI,
      avatar_color: DEFAULT_AVATAR_COLOR,
      avatar_image_url: avatarImageUrl,
      friend_code: createFriendCode(),
    })
    .select()
    .single()
  if (error) throw error
  return { ...rowToUser(data as UserRow), email: authUser.email }
}

/** Google Identityのリンク完了後、既存プロフィールをAuthユーザーへ紐づける。 */
export async function completeGoogleAccountLink(
  existingUserId: string,
  authUser: SupabaseAuthUser,
): Promise<User> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Googleアカウント連携にはSupabaseの設定が必要です')
  }

  const metadata = authUser.user_metadata ?? {}
  const displayName =
    (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
    (typeof metadata.name === 'string' && metadata.name.trim())
  const avatarImageUrl =
    (typeof metadata.avatar_url === 'string' && metadata.avatar_url) ||
    (typeof metadata.picture === 'string' && metadata.picture)

  const updates: Record<string, string> = { auth_user_id: authUser.id }
  if (displayName) updates.display_name = displayName
  if (avatarImageUrl) updates.avatar_image_url = avatarImageUrl

  // このGoogle Identityで先に直接ログインして作られたアプリ内プロフィールが
  // ある場合は、Authとの紐づけだけを外して既存プロフィールへ付け替える。
  const { data: alreadyLinked, error: linkedLookupError } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (linkedLookupError) throw linkedLookupError
  if (alreadyLinked && alreadyLinked.id !== existingUserId) {
    const { error: detachError } = await supabase
      .from('users')
      .update({ auth_user_id: null })
      .eq('id', alreadyLinked.id)
    if (detachError) throw detachError
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', existingUserId)
    .select()
    .single()
  if (error) throw error
  return { ...rowToUser(data as UserRow), email: authUser.email }
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
