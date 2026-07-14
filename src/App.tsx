import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapScreen } from './components/MapScreen'
import { OpenView } from './components/OpenView'
import { ComposeFlow } from './components/ComposeFlow'
import { ListSheet } from './components/ListSheet'
import { ProfileSheet } from './components/ProfileSheet'
import { NearbyDeck } from './components/NearbyDeck'
import { GeoBanner } from './components/GeoBanner'
import { AuthSheet } from './components/AuthSheet'
import { CheckIcon, PlusIcon } from './components/icons'
import { useGeolocation } from './hooks/useGeolocation'
import { useKotozute } from './hooks/useKotozute'
import { useAuth } from './hooks/useAuth'
import { useNotifications } from './hooks/useNotifications'
import { useUserProfile, useGroups } from './services/socialService'
import { NotificationSheet } from './components/NotificationSheet'
import { enrich } from './lib/enrich'
import { DEFAULT_ZOOM } from './config'
import type { Kotozute, NewKotozute, Proximity } from './types'
import './App.css'

type MapLayerKey = 'public' | 'group' | 'created' | 'opened'
type MapLayerVisibility = Record<MapLayerKey, boolean>
type GroupLayerVisibility = Record<string, boolean>

const initialMapLayerVisibility: MapLayerVisibility = {
  public: true,
  group: true,
  created: false,
  opened: false,
}

function getMapLayerKey(item: Kotozute): MapLayerKey {
  if (item.mine) return 'created'
  if (item.openedByCurrentUser) return 'opened'
  if (item.visibility === 'group') return 'group'
  return 'public'
}

function isGroupVisible(item: Kotozute, groupLayerVisibility: GroupLayerVisibility) {
  if (item.visibility !== 'group') return true
  if (!item.groupId) return false
  return groupLayerVisibility[item.groupId] ?? true
}

export function App() {
  const geo = useGeolocation(true)
  const { currentUser, logout } = useAuth()
  const {
    items,
    openHistory,
    loading,
    create,
    update,
    remove,
    markOpened,
    toggleLike,
    toggleFavorite,
  } = useKotozute(currentUser?.id)
  const { unreadCount, addNotification } = useNotifications()
  const { profile, updateProfile } = useUserProfile(currentUser)
  const {
    groups,
    createGroup,
    joinGroup,
    leaveGroup,
    updateGroup,
    getGroupMembers,
    isInGroup,
  } = useGroups(currentUser)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 地図ピンと下部リストの相互ハイライト用（開封状態とは別）
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [showList, setShowList] = useState(false)
  const [openedFromList, setOpenedFromList] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null)
  const [profileUnlockedId, setProfileUnlockedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [mapLayerVisibility, setMapLayerVisibility] = useState<MapLayerVisibility>(
    initialMapLayerVisibility,
  )
  const [groupLayerVisibility, setGroupLayerVisibility] = useState<GroupLayerVisibility>({})
  const [favoriteOnly, setFavoriteOnly] = useState(false)

  const mapRef = useRef<google.maps.Map | null>(null)
  const listScrollRef = useRef(0)
  const listTabRef = useRef<'all' | 'favorite' | 'mine'>('all')

  const position = geo.position

  // 表示可能なことづてにフィルター（全体公開 or 自分が作成 or 登録済みのフレンドが作成したもの）
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (item.replyToId) return false
      if (item.mine) return true
      if (!item.visibility || item.visibility === 'public') return true
      if (item.visibility === 'group' && item.groupId && isInGroup(item.groupId)) {
        return true
      }
      return false
    })
  }, [items, isInGroup])

  // 現在地からの距離・近接状態を付与
  const enriched = useMemo(() => enrich(visibleItems, position), [visibleItems, position])
  // 地図に表示するピン（期間内、表示レイヤー、お気に入り条件に合致するもののみ）
  const mapItems = useMemo(() => {
    const now = Date.now()
    const personalLayer = mapLayerVisibility.created
      ? 'created'
      : mapLayerVisibility.opened
        ? 'opened'
        : null

    return enriched.filter((item) => {
      // 1. 開封有効期間のチェック
      if (item.validFrom && now < item.validFrom) return false
      if (item.validTo && now > item.validTo) return false

      // 2. 地図レイヤー切り替えのチェック
      const layerKey = getMapLayerKey(item)
      if (personalLayer) return layerKey === personalLayer

      if (!mapLayerVisibility[layerKey]) return false
      if (layerKey === 'group' && !isGroupVisible(item, groupLayerVisibility)) {
        return false
      }

      // 3. お気に入りだけ表示する横断フィルタ
      if (favoriteOnly && !item.favoritedByCurrentUser) return false

      return true
    })
  }, [enriched, favoriteOnly, groupLayerVisibility, mapLayerVisibility])
  const unlockableCount = useMemo(
    () => mapItems.filter((k) => k.proximity === 'unlockable').length,
    [mapItems],
  )
  // 下部カルーセル＝現在地の半径内（＝いま開ける）かつ期間内のことづて。距離が近い順。
  const nearbyItems = useMemo(
    () =>
      mapItems
        .filter((k) => k.proximity === 'unlockable')
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)),
    [mapItems],
  )
  const selected = useMemo(
    () => {
      if (selectedId && selectedId === profileUnlockedId) {
        const replayableItem = visibleItems.find(
          (k) => k.id === selectedId && (k.mine || k.openedByCurrentUser),
        )
        if (replayableItem) {
          return {
            ...replayableItem,
            distance: null,
            proximity: 'unlockable' as const,
          }
        }
      }
      return enriched.find((k) => k.id === selectedId) ?? null
    },
    [enriched, profileUnlockedId, selectedId, visibleItems],
  )
  const replyTarget = useMemo(
    () => enriched.find((k) => k.id === replyTargetId) ?? null,
    [enriched, replyTargetId],
  )
  const selectedReplies = useMemo(() => {
    if (!selected) return []
    return items
      .filter(
        (item) =>
          item.id !== selected.id &&
          (item.replyToId === selected.id || item.rootId === selected.id),
      )
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((item) => {
        const distance = position ? null : null
        return {
          ...item,
          distance,
          proximity: 'far' as const,
        }
      })
  }, [items, selected])

  // コールバックを安定させつつ最新の一覧を参照するための ref
  const itemsRef = useRef(enriched)
  itemsRef.current = enriched

  // トーストの自動消滅
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  const previousProximityRef = useRef(new Map<string, Proximity>())

  // 位置情報とことづての状態を監視し、射程圏外から圏内に入った瞬間だけ通知する。
  useEffect(() => {
    const previous = previousProximityRef.current
    const currentIds = new Set(enriched.map((item) => item.id))

    enriched.forEach((item) => {
      const before = previous.get(item.id)
      const enteredUnlockRadius =
        position &&
        item.proximity === 'unlockable' &&
        before !== 'unlockable'

      if (enteredUnlockRadius && !item.mine && !item.openedByCurrentUser) {
        const label = item.placeLabel || item.authorName || '近くのことづて'
        addNotification(
          'ことづての射程圏内に入りました',
          `『${label}』が開封できます。封を開けてみましょう。`,
          'unlockable',
          item.id,
        )
      }

      previous.set(item.id, item.proximity)
    })

    previous.forEach((_, id) => {
      if (!currentIds.has(id)) {
        previous.delete(id)
      }
    })

    if (!position) {
      previous.clear()
    }
  }, [addNotification, enriched, position])

  const handleMapLoad = useCallback((map: google.maps.Map | null) => {
    mapRef.current = map
  }, [])

  const handleToggleMapLayer = useCallback((key: MapLayerKey) => {
    setMapLayerVisibility((current) => ({
      ...current,
      ...(key === 'created' || key === 'opened'
        ? {
            created: key === 'created' ? !current.created : false,
            opened: key === 'opened' ? !current.opened : false,
          }
        : { [key]: !current[key] }),
    }))
  }, [])

  const handleToggleGroupLayer = useCallback((groupId: string) => {
    setGroupLayerVisibility((current) => ({
      ...current,
      [groupId]: !(current[groupId] ?? true),
    }))
  }, [])

  /** 地図をことづての位置へ寄せる */
  const focusOn = useCallback((id: string) => {
    const k = itemsRef.current.find((x) => x.id === id)
    if (k && mapRef.current) {
      mapRef.current.panTo(k.location)
      const z = mapRef.current.getZoom() ?? DEFAULT_ZOOM
      if (z < DEFAULT_ZOOM) mapRef.current.setZoom(DEFAULT_ZOOM)
    }
  }, [])

  /**
   * カード or ピンの選択。対応ピン/カードを相互ハイライトし、
   * 地図をその位置へセンタリングしてから開封画面を開く。
   * （同一地点でピンが重なっても、リスト経由で個別に選べる）
   */
  const handleSelect = useCallback(
    (id: string) => {
      setProfileUnlockedId(null)
      setHighlightedId(id)
      focusOn(id)
      setSelectedId(id)
    },
    [focusOn],
  )

  /**
   * 下部カルーセルからの選択。開封はせず、対応ピンをセンタリング＆ハイライトして
   * 目立たせるだけにする（開封はピンをタップして行う）。
   */
  const handleHighlight = useCallback(
    (id: string) => {
      setHighlightedId(id)
      focusOn(id)
    },
    [focusOn],
  )

  const handleSubmit = useCallback(
    async (input: NewKotozute) => {
      if (!currentUser) {
        setComposing(false)
        setShowAuth(true)
        return
      }
      const replyingTo = replyTarget
      const inputWithAuthor = { ...input, authorId: currentUser.id }
      const inputWithThread = replyingTo
        ? {
            ...inputWithAuthor,
            replyToId: replyingTo.id,
            rootId: replyingTo.rootId ?? replyingTo.id,
          }
        : inputWithAuthor
      const created = await create(inputWithThread)
      setComposing(false)
      if (replyingTo) {
        setSelectedId(replyingTo.id)
        setToast('返信を残しました')
      } else {
        setToast('ことづてを、この場所に残しました')
        // 残した直後にその場所のピンへ意識を向ける
        if (mapRef.current) mapRef.current.panTo(created.location)
      }
      setReplyTargetId(null)

      // 返信通知: 返信先の作者へ届くようにする
      if (replyingTo?.authorId) {
        const senderName = currentUser?.displayName ?? profile.name ?? 'だれか'
        const targetLabel = replyingTo.placeLabel || replyingTo.authorName || 'あなたのことづて'
        addNotification(
          '返信が届きました',
          `${senderName}さんが『${targetLabel}』に返信しました。`,
          'received',
          replyingTo.id,
          replyingTo.authorId,
        )
      }

      // 模擬開封通知（デモ用）
      // 15秒後に「誰かがあなたのことづてを開封した」という通知を発生させる
      if (!replyingTo) {
        setTimeout(() => {
          const place = created.placeLabel || 'あなたの残した場所'
          const names = ['さくら', 'たかし', 'けんた', 'みく', 'たくみ']
          const randomName = names[Math.floor(Math.random() * names.length)]

          addNotification(
            '言伝が受け取られました',
            `${randomName}さんが、あなたが「${place}」に残した言伝を開封しました！`,
            'received',
            created.id,
          )
        }, 15000)
      }
    },
    [create, currentUser, addNotification, replyTarget, profile.name],
  )


  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id)
      if (selectedId === id) setSelectedId(null)
      if (profileUnlockedId === id) setProfileUnlockedId(null)
      setToast('ことづてを取り消しました')
    },
    [profileUnlockedId, remove, selectedId],
  )

  const handleDeleteReply = useCallback(
    async (id: string) => {
      const target = items.find((item) => item.id === id)
      if (!target) return

      const isOwner = target.authorId
        ? currentUser?.id === target.authorId
        : target.mine

      if (!isOwner) {
        setToast('この返信は削除できません')
        return
      }

      await remove(id)
      setToast('返信を取り消しました')
    },
    [currentUser?.id, items, remove],
  )

  const handleReply = useCallback((target: Kotozute) => {
    if (!currentUser) {
      setShowAuth(true)
      return
    }
    setReplyTargetId(target.id)
    setSelectedId(null)
    setComposing(true)
  }, [currentUser])

  const handleCloseCompose = useCallback(() => {
    setComposing(false)
    setReplyTargetId(null)
  }, [])

  const handleOpened = useCallback(
    async (id: string) => {
      if (!currentUser) return
      try {
        await markOpened(id)
      } catch (e) {
        console.warn('Failed to record kotozute open:', e)
      }
    },
    [currentUser, markOpened],
  )

  const handleToggleLike = useCallback(
    async (id: string) => {
      if (!currentUser) {
        setShowAuth(true)
        return
      }
      try {
        const result = await toggleLike(id)
        if (result) {
          setToast(result.liked ? 'いいねしました' : 'いいねを取り消しました')
        }
      } catch (e) {
        console.warn('Failed to toggle kotozute like:', e)
        setToast('いいねを更新できませんでした')
      }
    },
    [currentUser, toggleLike],
  )

  const handleToggleFavorite = useCallback(
    async (id: string) => {
      if (!currentUser) {
        setShowAuth(true)
        return
      }
      try {
        const result = await toggleFavorite(id)
        if (result) {
          setToast(result.favorited ? 'お気に入りに追加しました' : 'お気に入りから外しました')
        }
      } catch (e) {
        console.warn('Failed to toggle kotozute favorite:', e)
        setToast('お気に入りを更新できませんでした')
      }
    },
    [currentUser, toggleFavorite],
  )

  const overlayOpen =
    composing || showList || showProfile || !!selected || showAuth || showNotifications

  return (
    <div className="app">
      <MapScreen
        items={mapItems}
        position={position}
        totalCount={mapItems.length}
        unlockableCount={unlockableCount}
        highlightedId={highlightedId}
        onSelectPin={handleSelect}
        onOpenList={() => setShowList(true)}
        onMapLoad={handleMapLoad}
        currentUser={currentUser}
        onOpenAuth={() => setShowAuth(true)}
        onLogout={logout}
        profile={profile}
        onOpenProfile={() => setShowProfile(true)}
        unreadCount={unreadCount}
        onOpenNotifications={() => setShowNotifications(true)}
        mapLayerVisibility={mapLayerVisibility}
        onToggleMapLayer={handleToggleMapLayer}
        favoriteOnly={favoriteOnly}
        onToggleFavoriteOnly={() => setFavoriteOnly((value) => !value)}
        groups={groups}
        groupLayerVisibility={groupLayerVisibility}
        onToggleGroupLayer={handleToggleGroupLayer}
      />

      {/* 位置情報の状態フィードバック（オーバーレイ中は隠す） */}
      {!overlayOpen && <GeoBanner status={geo.status} onRetry={geo.start} />}

      {/* 下部カルーセル：現在地の半径内で「いま開ける」ことづて（食べログ型） */}
      {!overlayOpen && !loading && (
        <NearbyDeck
          items={nearbyItems}
          highlightedId={highlightedId}
          hasPosition={!!position}
          onSelect={handleHighlight}
          onOpen={handleSelect}
        />
      )}

      {/* ことづてを残す FAB */}
      {!overlayOpen && !loading && currentUser && (
        <button
          className="fab"
          onClick={() => {
            setReplyTargetId(null)
            setComposing(true)
          }}
          aria-label="ことづてを残す"
        >
          <span className="fab__plus">
            <PlusIcon width={20} height={20} />
          </span>
          ここに、ことづてを残す
        </button>
      )}

      {/* 残す */}
      {composing && currentUser && (
        <ComposeFlow
          position={position}
          onRetryLocation={geo.start}
          onSubmit={handleSubmit}
          onClose={handleCloseCompose}
          profile={profile}
          mode={replyTarget ? 'reply' : 'new'}
          replyTarget={replyTarget}
          groups={groups}
        />
      )}

      {/* 一覧 */}
      {showList && (
        <ListSheet
          items={enriched}
          hasPosition={!!position}
          savedScroll={listScrollRef.current}
          savedTab={listTabRef.current}
          onSaveScroll={(v) => { listScrollRef.current = v }}
          onSaveTab={(t) => { listTabRef.current = t }}
          onSelect={(id) => {
            setShowList(false)
            handleHighlight(id)
            setOpenedFromList(true)
            setTimeout(() => handleSelect(id), 600)
          }}
          onDelete={handleDelete}
          onToggleFavorite={handleToggleFavorite}
          onClose={() => setShowList(false)}
        />
      )}

      {/* プロフィール & グループ */}
      {showProfile && (
        <ProfileSheet
          items={visibleItems}
          openHistory={openHistory}
          profile={profile}
          updateProfile={updateProfile}
          groups={groups}
          createGroup={createGroup}
          joinGroup={joinGroup}
          leaveGroup={leaveGroup}
          updateGroup={updateGroup}
          getGroupMembers={getGroupMembers}
          onSelectKotozute={(id) => {
            setShowProfile(false)
            setProfileUnlockedId(id)
            setSelectedId(id)
          }}
          onDeleteKotozute={handleDelete}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* 受け取り / 開封 */}
      {selected && (
        <OpenView
          kotozute={selected}
          replies={selectedReplies}
          onClose={() => {
            setSelectedId(null)
            setProfileUnlockedId(null)
            if (openedFromList) {
              setOpenedFromList(false)
              setShowList(true)
            }
          }}
          onReply={() => handleReply(selected)}
          onDeleteReply={handleDeleteReply}
          currentUserId={currentUser?.id ?? null}
          onOpened={handleOpened}
          onEdit={update}
          onToggleLike={handleToggleLike}
          onToggleFavorite={handleToggleFavorite}
        />
      )}

      {/* ログイン / 新規登録 */}
      {showAuth && (
        <AuthSheet onClose={() => setShowAuth(false)} />
      )}

      {/* 通知 */}
      {showNotifications && (
        <NotificationSheet
          onSelectKotozute={(id) => {
            setShowNotifications(false)
            handleSelect(id)
          }}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* トースト */}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast__check">
            <CheckIcon width={14} height={14} />
          </span>
          {toast}
        </div>
      )}
    </div>
  )
}
