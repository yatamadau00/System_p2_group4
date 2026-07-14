import { useState, useCallback, useEffect } from 'react'
import type { User, UserProfile, Group, GroupMember } from '../types'
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
    avatarImageUrl: user.avatarImageUrl ?? null,
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
    avatarImageUrl: null,
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
      return
    }
    // ログアウト時：ログインユーザーの情報を残さず、ローカル/既定プロフィールへ戻す
    const saved = localStorage.getItem(PROFILE_KEY)
    if (saved) {
      try {
        setProfile(JSON.parse(saved) as UserProfile)
        return
      } catch (e) {
        console.error(e)
      }
    }
    const defaultProfile = createDefaultProfile()
    localStorage.setItem(PROFILE_KEY, JSON.stringify(defaultProfile))
    setProfile(defaultProfile)
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
          avatarImageUrl: nextProfile.avatarImageUrl ?? null,
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

const GROUP_DEFAULT_EMOJI = '👥'
const GROUP_DEFAULT_COLOR = '#dceffd'

// --- Supabase（ユーザーに紐づくグループ） ---
interface GroupRow {
  id: string
  name: string | null
  avatar_emoji: string | null
  avatar_color: string | null
  avatar_image_url: string | null
  owner_id: string | null
}

interface GroupJoinRow {
  joined_at: string
  groups: GroupRow | GroupRow[] | null
}

function rowToGroup(g: GroupRow, userId: string, joinedAt: number): Group {
  return {
    id: g.id,
    name: g.name || g.id,
    avatarEmoji: g.avatar_emoji || GROUP_DEFAULT_EMOJI,
    avatarColor: g.avatar_color || GROUP_DEFAULT_COLOR,
    avatarImageUrl: g.avatar_image_url ?? null,
    owner: g.owner_id === userId,
    joinedAt,
  }
}

const GROUP_COLS =
  'id, name, avatar_emoji, avatar_color, avatar_image_url, owner_id'

async function fetchMemberGroups(userId: string): Promise<Group[]> {
  const { data, error } = await supabase!
    .from('group_members')
    .select(`joined_at, groups:groups!inner(${GROUP_COLS})`)
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
  if (error) throw error
  return (data as unknown as GroupJoinRow[])
    .map((r) => {
      const g = Array.isArray(r.groups) ? r.groups[0] : r.groups
      return g ? rowToGroup(g, userId, new Date(r.joined_at).getTime()) : null
    })
    .filter((g): g is Group => g !== null)
}

interface MemberJoinRow {
  joined_at: string
  user_id: string
  users:
    | { id: string; display_name: string | null; avatar_emoji: string | null; avatar_color: string | null }
    | { id: string; display_name: string | null; avatar_emoji: string | null; avatar_color: string | null }[]
    | null
}

async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data: g } = await supabase!
    .from('groups')
    .select('owner_id')
    .eq('id', groupId)
    .maybeSingle()
  const ownerId = (g as { owner_id: string | null } | null)?.owner_id ?? null

  const { data, error } = await supabase!
    .from('group_members')
    .select('joined_at, user_id, users:users!inner(id, display_name, avatar_emoji, avatar_color)')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true })
  if (error) throw error

  return (data as unknown as MemberJoinRow[])
    .map((r) => {
      const u = Array.isArray(r.users) ? r.users[0] : r.users
      if (!u) return null
      return {
        id: u.id,
        name: u.display_name || '名もなき人',
        avatarEmoji: u.avatar_emoji || '🙂',
        avatarColor: u.avatar_color || '#f1e8d6',
        joinedAt: new Date(r.joined_at).getTime(),
        owner: u.id === ownerId,
      } as GroupMember
    })
    .filter((m): m is GroupMember => m !== null)
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
    async (name: string, avatarImageUrl?: string | null): Promise<Group> => {
      const cleanName = name.trim() || '名もなきグループ'
      const image = avatarImageUrl ?? null
      if (useDb && currentUser) {
        const id = generateGroupCode()
        const { error: gErr } = await supabase!.from('groups').insert({
          id,
          name: cleanName,
          avatar_emoji: GROUP_DEFAULT_EMOJI,
          avatar_color: GROUP_DEFAULT_COLOR,
          avatar_image_url: image,
          owner_id: currentUser.id,
        })
        if (gErr) throw gErr
        const { error: mErr } = await supabase!
          .from('group_members')
          .insert({ group_id: id, user_id: currentUser.id })
        if (mErr) throw mErr
        const group: Group = {
          id,
          name: cleanName,
          avatarEmoji: GROUP_DEFAULT_EMOJI,
          avatarColor: GROUP_DEFAULT_COLOR,
          avatarImageUrl: image,
          owner: true,
          joinedAt: Date.now(),
        }
        setGroups((prev) => [group, ...prev])
        return group
      }
      const group: Group = {
        id: generateGroupCode(),
        name: cleanName,
        avatarEmoji: GROUP_DEFAULT_EMOJI,
        avatarColor: GROUP_DEFAULT_COLOR,
        avatarImageUrl: image,
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
          .select(GROUP_COLS)
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

        const group = rowToGroup(g as GroupRow, currentUser.id, Date.now())
        setGroups((prev) => [group, ...prev.filter((x) => x.id !== group.id)])
        return group
      }

      const current = loadLocalGroups()
      if (current.some((x) => x.id === id)) {
        throw new Error('すでにこのグループに参加しています。')
      }
      const group: Group = {
        id,
        name: id,
        avatarEmoji: GROUP_DEFAULT_EMOJI,
        avatarColor: GROUP_DEFAULT_COLOR,
        avatarImageUrl: null,
        owner: false,
        joinedAt: Date.now(),
      }
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

  /** グループの見た目（名前・アイコン）を更新する（作成者向け） */
  const updateGroup = useCallback(
    async (
      id: string,
      updates: Partial<
        Pick<Group, 'name' | 'avatarEmoji' | 'avatarColor' | 'avatarImageUrl'>
      >,
    ): Promise<void> => {
      const patch: Record<string, string | null> = {}
      if (updates.name !== undefined) patch.name = updates.name.trim() || id
      if (updates.avatarEmoji !== undefined) patch.avatar_emoji = updates.avatarEmoji
      if (updates.avatarColor !== undefined) patch.avatar_color = updates.avatarColor
      if (updates.avatarImageUrl !== undefined)
        patch.avatar_image_url = updates.avatarImageUrl

      if (useDb && currentUser) {
        const { error } = await supabase!.from('groups').update(patch).eq('id', id)
        if (error) throw error
      }
      const apply = (g: Group): Group =>
        g.id === id
          ? {
              ...g,
              name: updates.name?.trim() || g.name,
              avatarEmoji: updates.avatarEmoji ?? g.avatarEmoji,
              avatarColor: updates.avatarColor ?? g.avatarColor,
              avatarImageUrl:
                updates.avatarImageUrl !== undefined
                  ? updates.avatarImageUrl
                  : g.avatarImageUrl,
            }
          : g
      if (!useDb) saveLocalGroups(loadLocalGroups().map(apply))
      setGroups((prev) => prev.map(apply))
    },
    [useDb, currentUser],
  )

  /** グループのメンバー一覧を取得する */
  const getGroupMembers = useCallback(
    async (id: string): Promise<GroupMember[]> => {
      if (!useDb) return []
      return fetchGroupMembers(id)
    },
    [useDb],
  )

  const isInGroup = useCallback(
    (id: string) => groups.some((g) => g.id === id),
    [groups],
  )

  return {
    groups,
    createGroup,
    joinGroup,
    leaveGroup,
    updateGroup,
    getGroupMembers,
    isInGroup,
  }
}
