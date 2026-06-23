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
import { useUserProfile, useFriends } from './services/socialService'
import { enrich } from './lib/enrich'
import { DEFAULT_ZOOM } from './config'
import type { NewKotozute } from './types'
import './App.css'

export function App() {
  const geo = useGeolocation(true)
  const { items, loading, create, remove } = useKotozute()
  const { currentUser, logout } = useAuth()
  const { profile: rawProfile, updateProfile } = useUserProfile()
  const {
    friends,
    addFriendByCode,
    addFriendDirect,
    removeFriend,
    isFriend,
    suggestedFriends,
  } = useFriends()

  // ログイン中の場合はプロフィール情報をログインユーザーの情報で上書きする
  const profile = useMemo(() => {
    if (currentUser) {
      return {
        ...rawProfile,
        id: currentUser.id,
        name: currentUser.displayName,
      }
    }
    return rawProfile
  }, [rawProfile, currentUser])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 地図ピンと下部リストの相互ハイライト用（開封状態とは別）
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [showList, setShowList] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const mapRef = useRef<google.maps.Map | null>(null)

  const position = geo.position

  // 表示可能なことづてにフィルター（全体公開 or 自分が作成 or 登録済みのフレンドが作成したもの）
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (item.mine) return true
      if (!item.visibility || item.visibility === 'public') return true
      if (item.visibility === 'friends' && item.authorId && isFriend(item.authorId)) {
        return true
      }
      return false
    })
  }, [items, isFriend])

  // 現在地からの距離・近接状態を付与
  const enriched = useMemo(() => enrich(visibleItems, position), [visibleItems, position])
  const unlockableCount = useMemo(
    () => enriched.filter((k) => k.proximity === 'unlockable').length,
    [enriched],
  )
  // 下部カルーセル＝現在地の半径内（＝いま開ける）ことづて。距離が近い順。
  const nearbyItems = useMemo(
    () =>
      enriched
        .filter((k) => k.proximity === 'unlockable')
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)),
    [enriched],
  )
  const selected = useMemo(
    () => enriched.find((k) => k.id === selectedId) ?? null,
    [enriched, selectedId],
  )

  // コールバックを安定させつつ最新の一覧を参照するための ref
  const itemsRef = useRef(enriched)
  itemsRef.current = enriched

  // トーストの自動消滅
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  const handleMapLoad = useCallback((map: google.maps.Map | null) => {
    mapRef.current = map
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
      const inputWithAuthor = currentUser
        ? { ...input, authorId: currentUser.id }
        : input
      const created = await create(inputWithAuthor)
      setComposing(false)
      setToast('ことづてを、この場所に残しました')
      // 残した直後にその場所のピンへ意識を向ける
      if (mapRef.current) mapRef.current.panTo(created.location)
    },
    [create, currentUser],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id)
      if (selectedId === id) setSelectedId(null)
      setToast('ことづてを取り消しました')
    },
    [remove, selectedId],
  )

  const overlayOpen = composing || showList || showProfile || !!selected || showAuth

  return (
    <div className="app">
      <MapScreen
        items={enriched}
        position={position}
        totalCount={visibleItems.length}
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
        />
      )}

      {/* ことづてを残す FAB */}
      {!overlayOpen && !loading && (
        <button
          className="fab"
          onClick={() => setComposing(true)}
          aria-label="ことづてを残す"
        >
          <span className="fab__plus">
            <PlusIcon width={20} height={20} />
          </span>
          ここに、ことづてを残す
        </button>
      )}

      {/* 残す */}
      {composing && (
        <ComposeFlow
          position={position}
          onRetryLocation={geo.start}
          onSubmit={handleSubmit}
          onClose={() => setComposing(false)}
          profile={profile}
        />
      )}

      {/* 一覧 */}
      {showList && (
        <ListSheet
          items={enriched}
          hasPosition={!!position}
          onSelect={(id) => {
            setShowList(false)
            handleSelect(id)
          }}
          onDelete={handleDelete}
          onClose={() => setShowList(false)}
        />
      )}

      {/* プロフィール & フレンド */}
      {showProfile && (
        <ProfileSheet
          items={items}
          profile={profile}
          updateProfile={updateProfile}
          friends={friends}
          addFriendByCode={addFriendByCode}
          addFriendDirect={addFriendDirect}
          removeFriend={removeFriend}
          suggestedFriends={suggestedFriends}
          onSelectKotozute={(id) => {
            setShowProfile(false)
            setSelectedId(id)
          }}
          onDeleteKotozute={handleDelete}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* 受け取り / 開封 */}
      {selected && (
        <OpenView kotozute={selected} onClose={() => setSelectedId(null)} />
      )}

      {/* ログイン / 新規登録 */}
      {showAuth && (
        <AuthSheet onClose={() => setShowAuth(false)} />
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

