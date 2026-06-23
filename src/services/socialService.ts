import { useState, useCallback, useEffect } from 'react'
import type { User, UserProfile, Friend } from '../types'
import { generateId } from './repository'
import { updateUserProfile } from './authService'
import { isSupabaseConfigured, supabase } from './supabaseClient'

// --- おすすめのモックフレンド定義 ---
export const MOCK_SUGGESTED_FRIENDS: Omit<Friend, 'addedAt'>[] = [
  {
    id: 'friend-midori',
    name: 'みどり',
    bio: '緑の多い散歩道や、懐かしい珈琲店によくいます。のんびり歩くのが好き。',
    avatarEmoji: '🌲',
    avatarColor: '#e2ecc8',
    friendCode: 'KOTO-MDR7',
  },
  {
    id: 'friend-haru',
    name: 'はる',
    bio: '春の桜や、道端の小さなお花を見つけるのが好きです。よろしくね！',
    avatarEmoji: '🌸',
    avatarColor: '#ffdce3',
    friendCode: 'KOTO-HARU',
  },
  {
    id: 'friend-sora',
    name: 'そら',
    bio: '旅先の広い空や、ベンチから眺める川の流れが大好き。時々ことづてを残します。',
    avatarEmoji: '🕊️',
    avatarColor: '#dceffd',
    friendCode: 'KOTO-SORA',
  },
]

const PROFILE_KEY = 'kotozute-user-profile'
const FRIENDS_KEY = 'kotozute-friends'
const DEFAULT_BIO = '場所に想いを残すのが好きです。'
const DEFAULT_AVATAR_EMOJI = '🦉'
const DEFAULT_AVATAR_COLOR = '#f1e8d6'

interface FriendRow {
  id: string
  owner_id: string
  friend_id: string
  added_at: string
  friend: FriendUserRow | FriendUserRow[] | null
}

interface FriendUserRow {
  id: string
  display_name: string
  bio: string | null
  avatar_emoji: string | null
  avatar_color: string | null
  friend_code: string | null
}

function userToProfile(user: User): UserProfile {
  return {
    id: user.id,
    name: user.displayName,
    bio: user.bio ?? DEFAULT_BIO,
    avatarEmoji: user.avatarEmoji ?? DEFAULT_AVATAR_EMOJI,
    avatarColor: user.avatarColor ?? DEFAULT_AVATAR_COLOR,
    friendCode: user.friendCode || `KOTO-${user.id.slice(0, 4).toUpperCase()}`,
  }
}

function rowToFriend(row: FriendRow): Friend {
  const friend = Array.isArray(row.friend) ? row.friend[0] : row.friend

  return {
    id: row.friend_id,
    name: friend?.display_name ?? '名前のないフレンド',
    bio: friend?.bio ?? '',
    avatarEmoji: friend?.avatar_emoji ?? DEFAULT_AVATAR_EMOJI,
    avatarColor: friend?.avatar_color ?? DEFAULT_AVATAR_COLOR,
    friendCode: friend?.friend_code ?? '',
    addedAt: new Date(row.added_at).getTime(),
  }
}

function userRowToFriend(row: FriendUserRow): Friend {
  return {
    id: row.id,
    name: row.display_name,
    bio: row.bio ?? '',
    avatarEmoji: row.avatar_emoji ?? DEFAULT_AVATAR_EMOJI,
    avatarColor: row.avatar_color ?? DEFAULT_AVATAR_COLOR,
    friendCode: row.friend_code ?? '',
    addedAt: Date.now(),
  }
}

// ユーザーの初期プロフィールを生成
function createDefaultProfile(): UserProfile {
  const codeNum = Math.floor(1000 + Math.random() * 9000)
  return {
    id: generateId(),
    name: 'ことづてびと',
    bio: '場所に想いを残すのが好きです。',
    avatarEmoji: '🦉',
    avatarColor: '#f1e8d6',
    friendCode: `KOTO-${codeNum}`,
  }
}

/**
 * ユーザープロフィールを管理するフック
 */
export function useUserProfile(currentUser: User | null) {
  const [profile, setProfile] = useState<UserProfile>(() => {
    if (currentUser) return userToProfile(currentUser)

    const saved = localStorage.getItem(PROFILE_KEY)
    if (saved) {
      try {
        return JSON.parse(saved) as UserProfile
      } catch (e) {
        console.error(e)
      }
    }
    const defaultProfile = createDefaultProfile()
    localStorage.setItem(PROFILE_KEY, JSON.stringify(defaultProfile))
    return defaultProfile
  })

  useEffect(() => {
    if (currentUser) {
      setProfile(userToProfile(currentUser))
    }
  }, [currentUser])

  const updateProfile = useCallback(async (updates: Partial<Omit<UserProfile, 'id' | 'friendCode'>>) => {
    const current = profile
    const nextProfile = {
      ...current,
      ...updates,
    }

    if (currentUser) {
      const updated = await updateUserProfile(currentUser.id, {
        displayName: nextProfile.name,
        bio: nextProfile.bio,
        avatarEmoji: nextProfile.avatarEmoji,
        avatarColor: nextProfile.avatarColor,
      })
      setProfile(userToProfile(updated))
      return
    }

    setProfile((prev) => {
      const next = { ...prev, ...updates }
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
      return next
    })
  }, [currentUser, profile])

  return { profile, updateProfile }
}

/**
 * フレンド一覧を管理するフック
 */
export function useFriends(currentUser: User | null) {
  const [friends, setFriends] = useState<Friend[]>(() => {
    if (currentUser && isSupabaseConfigured) return []

    const saved = localStorage.getItem(FRIENDS_KEY)
    if (saved) {
      try {
        return JSON.parse(saved) as Friend[]
      } catch (e) {
        console.error(e)
      }
    }
    return []
  })

  useEffect(() => {
    if (!currentUser || !isSupabaseConfigured) {
      const saved = localStorage.getItem(FRIENDS_KEY)
      if (saved) {
        try {
          setFriends(JSON.parse(saved) as Friend[])
          return
        } catch (e) {
          console.error(e)
        }
      }
      setFriends([])
      return
    }

    let cancelled = false
    ;(async () => {
      const list = await loadSupabaseFriends(currentUser.id)
      if (!cancelled) setFriends(list)
    })().catch((e) => {
      console.error(e)
    })
    return () => {
      cancelled = true
    }
  }, [currentUser])

  // フレンド一覧を保存
  const saveFriends = (list: Friend[]) => {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(list))
    setFriends(list)
  }

  // フレンドコードで追加
  const addFriendByCode = useCallback(async (code: string): Promise<Friend> => {
    const cleanCode = code.trim().toUpperCase()
    
    // すでにフレンドか確認
    const alreadyFriend = friends.find(f => f.friendCode === cleanCode)
    if (alreadyFriend) {
      throw new Error('すでにフレンドに登録されています。')
    }

    if (currentUser && isSupabaseConfigured) {
      const found = await findSupabaseUserByFriendCode(cleanCode)
      if (found) {
        if (found.id === currentUser.id) {
          throw new Error('自分自身はフレンドに追加できません。')
        }
        const friend = userRowToFriend(found)
        await saveSupabaseFriend(currentUser.id, friend)
        setFriends((prev) => [...prev, friend])
        return friend
      }
    }

    // おすすめのモックフレンドから検索
    if (currentUser && isSupabaseConfigured) {
      throw new Error('登録済みユーザーのフレンドコードを入力してください。')
    }

    const mock = MOCK_SUGGESTED_FRIENDS.find(f => f.friendCode === cleanCode)
    if (mock) {
      const newFriend: Friend = {
        ...mock,
        addedAt: Date.now()
      }
      if (currentUser && isSupabaseConfigured) {
        await saveSupabaseFriend(currentUser.id, newFriend)
        setFriends((prev) => [...prev, newFriend])
      } else {
        saveFriends([...friends, newFriend])
      }
      return newFriend
    }

    // 一般的なフォーマット（KOTO-XXXX）であれば、疑似的にフレンドを自動生成してあげる（遊び心）
    const match = cleanCode.match(/^KOTO-([A-Z0-9]{4})$/)
    if (match) {
      const id = `friend-custom-${generateId()}`
      const newFriend: Friend = {
        id,
        name: `旅人 #${match[1]}`,
        bio: `フレンドコード ${cleanCode} で登録された新しい友達。`,
        avatarEmoji: '🦊',
        avatarColor: '#f4d6b8',
        friendCode: cleanCode,
        addedAt: Date.now()
      }
      if (currentUser && isSupabaseConfigured) {
        await saveSupabaseFriend(currentUser.id, newFriend)
        setFriends((prev) => [...prev, newFriend])
      } else {
        saveFriends([...friends, newFriend])
      }
      return newFriend
    }

    throw new Error('該当するフレンドが見つかりませんでした。（KOTO-XXXX 形式で入力してください）')
  }, [currentUser, friends])

  // 直接オブジェクトからフレンド追加（おすすめの簡単登録用）
  const addFriendDirect = useCallback(async (suggested: Omit<Friend, 'addedAt'>) => {
    if (currentUser && isSupabaseConfigured) {
      throw new Error('登録済みユーザーのフレンドコードから追加してください。')
    }

    if (friends.some(f => f.id === suggested.id)) return
    const newFriend: Friend = {
      ...suggested,
      addedAt: Date.now()
    }
    if (currentUser && isSupabaseConfigured) {
      await saveSupabaseFriend(currentUser.id, newFriend)
      setFriends((prev) => [...prev, newFriend])
    } else {
      saveFriends([...friends, newFriend])
    }
  }, [currentUser, friends])

  // フレンド削除
  const removeFriend = useCallback(async (id: string) => {
    const next = friends.filter(f => f.id !== id)
    if (currentUser && isSupabaseConfigured) {
      await removeSupabaseFriend(currentUser.id, id)
      setFriends(next)
    } else {
      saveFriends(next)
    }
  }, [currentUser, friends])

  const isFriend = useCallback((id: string) => {
    return friends.some(f => f.id === id)
  }, [friends])

  return {
    friends,
    addFriendByCode,
    addFriendDirect,
    removeFriend,
    isFriend,
    suggestedFriends: currentUser && isSupabaseConfigured ? [] : MOCK_SUGGESTED_FRIENDS
  }
}

async function loadSupabaseFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await supabase!
    .from('friends')
    .select('id, owner_id, friend_id, added_at, friend:users!friends_friend_id_fkey(id, display_name, bio, avatar_emoji, avatar_color, friend_code)')
    .eq('owner_id', userId)
    .order('added_at', { ascending: false })
  if (error) throw error
  return (data as unknown as FriendRow[]).map(rowToFriend)
}

async function findSupabaseUserByFriendCode(code: string): Promise<FriendUserRow | null> {
  const { data, error } = await supabase!
    .from('users')
    .select('id, display_name, bio, avatar_emoji, avatar_color, friend_code')
    .eq('friend_code', code)
    .maybeSingle()
  if (error) throw error
  return (data as FriendUserRow | null) ?? null
}

async function saveSupabaseFriend(ownerId: string, friend: Friend) {
  const { error } = await supabase!
    .from('friends')
    .upsert(
      {
        owner_id: ownerId,
        friend_id: friend.id,
      },
      { onConflict: 'owner_id,friend_id' },
    )
  if (error) throw error
}

async function removeSupabaseFriend(ownerId: string, friendId: string) {
  const { error } = await supabase!
    .from('friends')
    .delete()
    .eq('owner_id', ownerId)
    .eq('friend_id', friendId)
  if (error) throw error
}
