import { useState, useCallback } from 'react'
import type { UserProfile, Friend } from '../types'
import { generateId } from './repository'

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
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(() => {
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

  const updateProfile = useCallback((updates: Partial<Omit<UserProfile, 'id' | 'friendCode'>>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates }
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { profile, updateProfile }
}

/**
 * フレンド一覧を管理するフック
 */
export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>(() => {
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

  // フレンド一覧を保存
  const saveFriends = (list: Friend[]) => {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(list))
    setFriends(list)
  }

  // フレンドコードで追加
  const addFriendByCode = useCallback((code: string): Friend => {
    const cleanCode = code.trim().toUpperCase()
    
    // すでにフレンドか確認
    const alreadyFriend = friends.find(f => f.friendCode === cleanCode)
    if (alreadyFriend) {
      throw new Error('すでにフレンドに登録されています。')
    }

    // おすすめのモックフレンドから検索
    const mock = MOCK_SUGGESTED_FRIENDS.find(f => f.friendCode === cleanCode)
    if (mock) {
      const newFriend: Friend = {
        ...mock,
        addedAt: Date.now()
      }
      saveFriends([...friends, newFriend])
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
      saveFriends([...friends, newFriend])
      return newFriend
    }

    throw new Error('該当するフレンドが見つかりませんでした。（KOTO-XXXX 形式で入力してください）')
  }, [friends])

  // 直接オブジェクトからフレンド追加（おすすめの簡単登録用）
  const addFriendDirect = useCallback((suggested: Omit<Friend, 'addedAt'>) => {
    if (friends.some(f => f.id === suggested.id)) return
    const newFriend: Friend = {
      ...suggested,
      addedAt: Date.now()
    }
    saveFriends([...friends, newFriend])
  }, [friends])

  // フレンド削除
  const removeFriend = useCallback((id: string) => {
    const next = friends.filter(f => f.id !== id)
    saveFriends(next)
  }, [friends])

  const isFriend = useCallback((id: string) => {
    return friends.some(f => f.id === id)
  }, [friends])

  return {
    friends,
    addFriendByCode,
    addFriendDirect,
    removeFriend,
    isFriend,
    suggestedFriends: MOCK_SUGGESTED_FRIENDS
  }
}
