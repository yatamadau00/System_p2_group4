import { getDb } from './indexedDbRepository'
import { generateId } from './repository'
import { isSupabaseConfigured, supabase } from './supabaseClient'
import type { StoredUser, User } from '../types'
import type { User as SupabaseAuthUser } from '@supabase/supabase-js'

const DEFAULT_AVATAR_EMOJI = '🦉'
const DEFAULT_AVATAR_COLOR = '#f1e8d6'

/**
 * users テーブルから取得してよい列。
 * password_hash は DB 側の列レベル権限で anon から遮断されているため含めない。
 * （含めると select がエラーになる）
 */
const USER_COLUMNS =
  'id, auth_user_id, username, display_name, bio, avatar_emoji, avatar_color, avatar_image_url, friend_code, created_at, has_password'

interface UserRow {
  id: string
  auth_user_id: string | null
  username: string
  display_name: string
  has_password: boolean
  bio: string | null
  avatar_emoji: string | null
  avatar_color: string | null
  avatar_image_url: string | null
  friend_code: string | null
  created_at: string
}

interface UserAuthDetails {
  email?: string
  email_verified?: boolean
  google_linked?: boolean
  google_email?: string
}

/** 端末内保存の StoredUser から、ハッシュを取り除いたアプリ用 User を作る。 */
function toAppUser(stored: StoredUser): User {
  const { passwordHash: _passwordHash, ...user } = stored
  void _passwordHash
  return user
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

function getAuthIdentityDetails(authUser: SupabaseAuthUser) {
  const emailIdentity = authUser.identities?.find((identity) => identity.provider === 'email')
  const googleIdentity = authUser.identities?.find((identity) => identity.provider === 'google')
  const googleEmail = googleIdentity?.identity_data?.email

  return {
    email: emailIdentity ? authUser.email : undefined,
    emailVerified: !!emailIdentity && !!authUser.email_confirmed_at,
    googleLinked:
      !!googleIdentity ||
      authUser.app_metadata.providers?.includes('google') ||
      authUser.app_metadata.provider === 'google',
    googleEmail: typeof googleEmail === 'string' ? googleEmail : undefined,
  }
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    authUserId: row.auth_user_id ?? null,
    username: row.username,
    displayName: row.display_name,
    hasPassword: row.has_password ?? false,
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
    .select(USER_COLUMNS)
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  return data ? rowToUser(data as unknown as UserRow) : undefined
}

async function getSupabaseUserByAuthUserId(authUserId: string) {
  const { data, error } = await supabase!
    .from('users')
    .select(USER_COLUMNS)
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (error) throw error
  return data ? rowToUser(data as unknown as UserRow) : undefined
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
      .select(USER_COLUMNS)
      .single()
    if (error) throw error
    return rowToUser(data as unknown as UserRow)
  }

  const db = await getDb()
  const existing = await db.getFromIndex('users', 'username', cleanUsername)
  if (existing) {
    throw new Error('このユーザー名はすでに使用されています')
  }

  const stored: StoredUser = {
    id: generateId(),
    username: cleanUsername,
    displayName: displayName.trim() || cleanUsername,
    bio: '場所に想いを残すのが好きです。',
    avatarEmoji: DEFAULT_AVATAR_EMOJI,
    avatarColor: DEFAULT_AVATAR_COLOR,
    avatarImageUrl: null,
    friendCode: createFriendCode(),
    hasPassword: passwordHash !== '',
    passwordHash,
    createdAt: Date.now(),
  }

  await db.put('users', stored)
  return toAppUser(stored)
}

/** ユーザーを認証する */
export async function authenticateUser(
  username: string,
  passwordHash: string,
): Promise<User> {
  const cleanUsername = username.trim()

  if (isSupabaseConfigured) {
    // ハッシュ照合は DB 内の RPC で行う。ハッシュ本体はクライアントへ渡さない。
    const { data, error } = await supabase!.rpc('authenticate_user', {
      p_username: cleanUsername,
      p_password_hash: passwordHash,
    })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) {
      throw new Error('ユーザー名またはパスワードが正しくありません')
    }
    const user = rowToUser(row as UserRow)
    const { data: authDetails, error: authDetailsError } = await supabase!.rpc(
      'get_user_auth_details',
      {
        p_user_id: user.id,
        p_password_hash: passwordHash,
      },
    )
    if (authDetailsError) {
      // SQLの適用前でも従来のログイン機能は止めない。
      console.warn('認証方式の表示情報を取得できませんでした:', authDetailsError.message)
      return user
    }
    const details = authDetails as UserAuthDetails | null
    return {
      ...user,
      email: details?.email,
      emailVerified: !!details?.email_verified,
      googleLinked: !!details?.google_linked,
      googleEmail: details?.google_email,
    }
  }

  const db = await getDb()
  const stored = await db.getFromIndex('users', 'username', cleanUsername)
  if (!stored || stored.passwordHash !== passwordHash) {
    throw new Error('ユーザー名またはパスワードが正しくありません')
  }
  return toAppUser(stored)
}

/** 現在のパスワードを確認し、メール連携用の一度限りのトークンを登録する。 */
export async function beginEmailAccountLink(
  userId: string,
  passwordHash: string,
  tokenHash: string,
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('メール登録にはSupabaseの設定が必要です')
  }
  const { data, error } = await supabase.rpc('begin_email_account_link', {
    p_user_id: userId,
    p_password_hash: passwordHash,
    p_token_hash: tokenHash,
  })
  if (error) throw error
  if (!data) throw new Error('現在のパスワードが正しくありません')
}

/** メール確認済みAuthユーザーを、開始時に認証した既存プロフィールへ紐づける。 */
export async function completeEmailAccountLink(
  tokenHash: string,
  authUser: SupabaseAuthUser,
): Promise<User> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('メール登録にはSupabaseの設定が必要です')
  }
  const { data, error } = await supabase.rpc('complete_email_account_link', {
    p_token_hash: tokenHash,
  })
  if (error) throw error
  if (!data) throw new Error('メール確認の有効期限が切れたか、連携を完了できませんでした')

  const user = await getSupabaseUserByAuthUserId(authUser.id)
  if (!user) throw new Error('連携先のユーザーが見つかりません')
  return { ...user, ...getAuthIdentityDetails(authUser) }
}

/** メールで本人確認済みのAuthセッションから、連携済みユーザーのパスワードを再設定する。 */
export async function resetLinkedUserPassword(passwordHash: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('パスワード再設定にはSupabaseの設定が必要です')
  }
  const { data, error } = await supabase.rpc('reset_linked_user_password', {
    p_new_password_hash: passwordHash,
  })
  if (error) throw error
  if (!data) throw new Error('再設定リンクが無効か、対象のユーザーが見つかりません')
}

/** ユーザーを ID から取得する */
export async function getUserById(id: string): Promise<User | undefined> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase!
      .from('users')
      .select(USER_COLUMNS)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? rowToUser(data as unknown as UserRow) : undefined
  }

  const db = await getDb()
  const stored = await db.get('users', id)
  return stored ? toAppUser(stored) : undefined
}

/** Supabase AuthのGoogleユーザーを既存のアプリ内プロフィールへ同期する。 */
export async function syncGoogleUser(authUser: SupabaseAuthUser): Promise<User> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('GoogleログインにはSupabaseの設定が必要です')
  }

  const { data: linkedData, error: linkedError } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .eq('auth_user_id', authUser.id)
    .maybeSingle()
  if (linkedError) throw linkedError

  const existing = linkedData
    ? rowToUser(linkedData as unknown as UserRow)
    : await getUserById(authUser.id)
  // auth_user_id で既存プロフィールに到達した場合、Googleは認証手段としてのみ使う。
  // ユーザーが設定した表示名・自己紹介・アバターは上書きしない。
  if (linkedData) {
    return { ...existing!, ...getAuthIdentityDetails(authUser) }
  }

  if (existing) {
    const { data, error } = await supabase
      .from('users')
      .update({
        auth_user_id: authUser.id,
      })
      .eq('id', existing.id)
      .select(USER_COLUMNS)
      .single()
    if (error) throw error
    return {
      ...rowToUser(data as unknown as UserRow),
      ...getAuthIdentityDetails(authUser),
    }
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      id: authUser.id,
      auth_user_id: authUser.id,
      username: oauthUsername(authUser),
      // Googleプロフィールは読み込まず、初回ログイン後にアプリ内で決めてもらう。
      display_name: '',
      password_hash: '',
      bio: '場所に想いを残すのが好きです。',
      avatar_emoji: DEFAULT_AVATAR_EMOJI,
      avatar_color: DEFAULT_AVATAR_COLOR,
      avatar_image_url: null,
      friend_code: createFriendCode(),
    })
    .select(USER_COLUMNS)
    .single()
  if (error) throw error
  return {
    ...rowToUser(data as unknown as UserRow),
    ...getAuthIdentityDetails(authUser),
  }
}

/** Google Identityのリンク完了後、既存プロフィールをAuthユーザーへ紐づける。 */
export async function completeGoogleAccountLink(
  existingUserId: string,
  authUser: SupabaseAuthUser,
): Promise<User> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Googleアカウント連携にはSupabaseの設定が必要です')
  }

  const { data, error } = await supabase
    .from('users')
    .update({ auth_user_id: authUser.id })
    .eq('id', existingUserId)
    .select(USER_COLUMNS)
    .single()
  if (error) throw error
  return {
    ...rowToUser(data as unknown as UserRow),
    ...getAuthIdentityDetails(authUser),
  }
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
      .select(USER_COLUMNS)
      .single()
    if (error) throw error
    return rowToUser(data as unknown as UserRow)
  }

  const db = await getDb()
  const current = await db.get('users', id)
  if (!current) {
    throw new Error('ユーザーが見つかりません')
  }
  const next: StoredUser = {
    ...current,
    displayName: updates.displayName,
    bio: updates.bio,
    avatarEmoji: updates.avatarEmoji,
    avatarColor: updates.avatarColor,
    avatarImageUrl: updates.avatarImageUrl ?? null,
  }
  await db.put('users', next)
  return toAppUser(next)
}
