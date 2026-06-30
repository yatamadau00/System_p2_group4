import { useState, useCallback, useEffect } from 'react'
import type { User, UserProfile, Group } from '../types'
import { generateId } from './repository'
import { updateUserProfile } from './authService'

const PROFILE_KEY = 'kotozute-user-profile'
const GROUPS_KEY = 'kotozute-groups'
const DEFAULT_BIO = '場所に想いを残すのが好きです。'
const DEFAULT_AVATAR_EMOJI = '🦉'
const DEFAULT_AVATAR_COLOR = '#f1e8d6'

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

// ユーザーの初期プロフィールを生成
function createDefaultProfile(): UserProfile {
  const codeNum = Math.floor(1000 + Math.random() * 9000)
  return {
    id: generateId(),
    name: 'ことづてびと',
    bio: DEFAULT_BIO,
    avatarEmoji: DEFAULT_AVATAR_EMOJI,
    avatarColor: DEFAULT_AVATAR_COLOR,
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

  const updateProfile = useCallback(
    async (updates: Partial<Omit<UserProfile, 'id' | 'friendCode'>>) => {
      const nextProfile = { ...profile, ...updates }

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
    },
    [currentUser, profile],
  )

  return { profile, updateProfile }
}

// ---- グループ（共有コードで出入りする） ----

/** 紛らわしい文字を避けたグループコードを生成（例: KOTO-AB23CD） */
function generateGroupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(6)
    crypto.getRandomValues(arr)
    for (let i = 0; i < 6; i++) s += chars[arr[i] % chars.length]
  } else {
    for (let i = 0; i < 6; i++)
      s += chars[Math.floor(Math.random() * chars.length)]
  }
  return `KOTO-${s}`
}

function loadGroups(): Group[] {
  const saved = localStorage.getItem(GROUPS_KEY)
  if (saved) {
    try {
      return JSON.parse(saved) as Group[]
    } catch (e) {
      console.error(e)
    }
  }
  return []
}

/**
 * 参加しているグループを管理するフック。
 * グループIDは共有コードで、作成すると発行され、入力すると参加できる。
 * 参加状態はこの端末にローカル保存する（ことづての group_id は共有DBに保存される）。
 */
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>(() => loadGroups())

  const persist = useCallback((list: Group[]) => {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(list))
    setGroups(list)
  }, [])

  /** グループを作成し、発行されたグループ（ID付き）を返す */
  const createGroup = useCallback(
    (name: string): Group => {
      const group: Group = {
        id: generateGroupCode(),
        name: name.trim() || '名もなきグループ',
        owner: true,
        joinedAt: Date.now(),
      }
      persist([...loadGroups(), group])
      return group
    },
    [persist],
  )

  /** グループIDを入力して参加する */
  const joinGroup = useCallback(
    (code: string): Group => {
      const id = code.trim().toUpperCase()
      if (!id) throw new Error('グループIDを入力してください。')
      const current = loadGroups()
      if (current.some((g) => g.id === id)) {
        throw new Error('すでにこのグループに参加しています。')
      }
      const group: Group = { id, name: id, owner: false, joinedAt: Date.now() }
      persist([...current, group])
      return group
    },
    [persist],
  )

  /** グループから抜ける */
  const leaveGroup = useCallback(
    (id: string) => {
      persist(loadGroups().filter((g) => g.id !== id))
    },
    [persist],
  )

  /** このグループに参加しているか */
  const isInGroup = useCallback(
    (id: string) => groups.some((g) => g.id === id),
    [groups],
  )

  return { groups, createGroup, joinGroup, leaveGroup, isInGroup }
}
