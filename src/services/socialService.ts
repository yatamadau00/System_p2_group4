import { useState, useCallback, useEffect } from 'react'
import type { User, UserProfile, Group } from '../types'
import { generateId } from './repository'
import { updateUserProfile } from './authService'
import { isSupabaseConfigured, supabase } from './supabaseClient'

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

// --- ローカル保存（Supabase未設定・未ログイン時のフォールバック） ---
function loadLocalGroups(): Group[] {
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
function saveLocalGroups(list: Group[]) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(list))
}

// --- Supabase（ユーザーに紐づくグループ） ---
interface GroupJoinRow {
  joined_at: string
  groups:
    | { id: string; name: string | null; owner_id: string | null }
    | { id: string; name: string | null; owner_id: string | null }[]
    | null
}

function joinRowToGroup(row: GroupJoinRow, userId: string): Group | null {
  const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
  if (!g) return null
  return {
    id: g.id,
    name: g.name || g.id,
    owner: g.owner_id === userId,
    joinedAt: new Date(row.joined_at).getTime(),
  }
}

async function fetchMemberGroups(userId: string): Promise<Group[]> {
  const { data, error } = await supabase!
    .from('group_members')
    .select('joined_at, groups:groups!inner(id, name, owner_id)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
  if (error) throw error
  return (data as unknown as GroupJoinRow[])
    .map((r) => joinRowToGroup(r, userId))
    .filter((g): g is Group => g !== null)
}

/**
 * 参加しているグループを管理するフック。
 * ログイン中は Supabase の groups / group_members に保存し、ユーザーに紐づける
 * （どの端末でも同じグループが見え、メンバーも記録される）。
 * 未ログイン/未設定時は端末ローカルにフォールバックする。
 */
export function useGroups(currentUser: User | null) {
  const useDb = !!currentUser && isSupabaseConfigured
  const [groups, setGroups] = useState<Group[]>(() =>
    useDb ? [] : loadLocalGroups(),
  )

  // ログイン状態に応じてグループ一覧を読み込む
  useEffect(() => {
    if (!useDb || !currentUser) {
      setGroups(loadLocalGroups())
      return
    }
    let cancelled = false
    fetchMemberGroups(currentUser.id)
      .then((list) => {
        if (!cancelled) setGroups(list)
      })
      .catch((e) => console.error(e))
    return () => {
      cancelled = true
    }
  }, [useDb, currentUser])

  const createGroup = useCallback(
    async (name: string): Promise<Group> => {
      const cleanName = name.trim() || '名もなきグループ'
      if (useDb && currentUser) {
        const id = generateGroupCode()
        const { error: gErr } = await supabase!
          .from('groups')
          .insert({ id, name: cleanName, owner_id: currentUser.id })
        if (gErr) throw gErr
        const { error: mErr } = await supabase!
          .from('group_members')
          .insert({ group_id: id, user_id: currentUser.id })
        if (mErr) throw mErr
        const group: Group = {
          id,
          name: cleanName,
          owner: true,
          joinedAt: Date.now(),
        }
        setGroups((prev) => [group, ...prev])
        return group
      }
      const group: Group = {
        id: generateGroupCode(),
        name: cleanName,
        owner: true,
        joinedAt: Date.now(),
      }
      const next = [group, ...loadLocalGroups()]
      saveLocalGroups(next)
      setGroups(next)
      return group
    },
    [useDb, currentUser],
  )

  const joinGroup = useCallback(
    async (code: string): Promise<Group> => {
      const id = code.trim().toUpperCase()
      if (!id) throw new Error('グループIDを入力してください。')

      if (useDb && currentUser) {
        const { data: g, error } = await supabase!
          .from('groups')
          .select('id, name, owner_id')
          .eq('id', id)
          .maybeSingle()
        if (error) throw error
        if (!g) throw new Error('そのIDのグループは見つかりませんでした。')

        const { data: existing } = await supabase!
          .from('group_members')
          .select('group_id')
          .eq('group_id', id)
          .eq('user_id', currentUser.id)
          .maybeSingle()
        if (existing) throw new Error('すでにこのグループに参加しています。')

        const { error: mErr } = await supabase!
          .from('group_members')
          .insert({ group_id: id, user_id: currentUser.id })
        if (mErr) throw mErr

        const group: Group = {
          id: g.id,
          name: (g.name as string) || g.id,
          owner: g.owner_id === currentUser.id,
          joinedAt: Date.now(),
        }
        setGroups((prev) => [group, ...prev.filter((x) => x.id !== group.id)])
        return group
      }

      const current = loadLocalGroups()
      if (current.some((x) => x.id === id)) {
        throw new Error('すでにこのグループに参加しています。')
      }
      const group: Group = { id, name: id, owner: false, joinedAt: Date.now() }
      const next = [group, ...current]
      saveLocalGroups(next)
      setGroups(next)
      return group
    },
    [useDb, currentUser],
  )

  const leaveGroup = useCallback(
    async (id: string): Promise<void> => {
      if (useDb && currentUser) {
        const { error } = await supabase!
          .from('group_members')
          .delete()
          .eq('group_id', id)
          .eq('user_id', currentUser.id)
        if (error) throw error
        setGroups((prev) => prev.filter((g) => g.id !== id))
        return
      }
      const next = loadLocalGroups().filter((g) => g.id !== id)
      saveLocalGroups(next)
      setGroups(next)
    },
    [useDb, currentUser],
  )

  const isInGroup = useCallback(
    (id: string) => groups.some((g) => g.id === id),
    [groups],
  )

  return { groups, createGroup, joinGroup, leaveGroup, isInGroup }
}
