import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapScreen } from './components/MapScreen'
import { OpenView } from './components/OpenView'
import { ComposeFlow } from './components/ComposeFlow'
import { ListSheet } from './components/ListSheet'
import { GeoBanner } from './components/GeoBanner'
import { CheckIcon, PlusIcon } from './components/icons'
import { useGeolocation } from './hooks/useGeolocation'
import { useKotozute } from './hooks/useKotozute'
import { enrich } from './lib/enrich'
import { FALLBACK_CENTER } from './config'
import type { LatLng, NewKotozute } from './types'
import './App.css'

/** 地図上で場所を選ぶ要求を表す内部状態 */
interface PickRequest {
  initial: LatLng | null
  resolve: (value: LatLng | null) => void
}

export function App() {
  const geo = useGeolocation(true)
  const { items, loading, create, remove } = useKotozute()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [showList, setShowList] = useState(false)
  const [pick, setPick] = useState<PickRequest | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const mapRef = useRef<google.maps.Map | null>(null)

  const position = geo.position

  // 現在地からの距離・近接状態を付与
  const enriched = useMemo(() => enrich(items, position), [items, position])
  const unlockableCount = useMemo(
    () => enriched.filter((k) => k.proximity === 'unlockable').length,
    [enriched],
  )
  const selected = useMemo(
    () => enriched.find((k) => k.id === selectedId) ?? null,
    [enriched, selectedId],
  )

  // トーストの自動消滅
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  const handleMapLoad = useCallback((map: google.maps.Map | null) => {
    mapRef.current = map
  }, [])

  /**
   * 地図で場所を選ぶ。地図が使える場合はピックモードに入り、
   * 確定座標を Promise で返す。地図が無い（キー未設定）場合は
   * 現在地 / フォールバック中心で即座に解決する。
   */
  const requestMapPick = useCallback(
    (initial: LatLng | null) =>
      new Promise<LatLng | null>((resolve) => {
        if (!mapRef.current) {
          resolve(initial ?? position ?? FALLBACK_CENTER)
          setToast('地図が使えないため、おおよその場所に置きました')
          return
        }
        setPick({ initial, resolve })
      }),
    [position],
  )

  const confirmPick = useCallback(() => {
    if (!pick) return
    const center = mapRef.current?.getCenter()
    const chosen: LatLng | null = center
      ? { lat: center.lat(), lng: center.lng() }
      : (pick.initial ?? position ?? FALLBACK_CENTER)
    pick.resolve(chosen)
    setPick(null)
  }, [pick, position])

  const cancelPick = useCallback(() => {
    if (!pick) return
    pick.resolve(null)
    setPick(null)
  }, [pick])

  const handleSubmit = useCallback(
    async (input: NewKotozute) => {
      const created = await create(input)
      setComposing(false)
      setToast('ことづてを、この場所に残しました')
      // 残した直後にその場所のピンへ意識を向ける
      if (mapRef.current) mapRef.current.panTo(created.location)
    },
    [create],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      await remove(id)
      if (selectedId === id) setSelectedId(null)
      setToast('ことづてを取り消しました')
    },
    [remove, selectedId],
  )

  const overlayOpen = composing || showList || !!selected || !!pick

  return (
    <div className="app">
      <MapScreen
        items={enriched}
        position={position}
        totalCount={items.length}
        unlockableCount={unlockableCount}
        pickMode={!!pick}
        pickInitial={pick?.initial ?? null}
        onSelectPin={(id) => setSelectedId(id)}
        onOpenList={() => setShowList(true)}
        onMapLoad={handleMapLoad}
      />

      {/* 位置情報の状態フィードバック（ピック中・オーバーレイ中は隠す） */}
      {!pick && !overlayOpen && (
        <GeoBanner status={geo.status} onRetry={geo.start} />
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

      {/* 場所えらびの確定バー */}
      {pick && (
        <div className="confirm-bar">
          <button className="btn btn--soft" onClick={cancelPick}>
            やめる
          </button>
          <button className="btn btn--primary" onClick={confirmPick}>
            この場所に残す
          </button>
        </div>
      )}

      {/* 残す（ピック中は視覚的に隠してドラフトは保持） */}
      {composing && (
        <div style={{ display: pick ? 'none' : 'contents' }}>
          <ComposeFlow
            position={position}
            requestMapPick={requestMapPick}
            onSubmit={handleSubmit}
            onClose={() => setComposing(false)}
          />
        </div>
      )}

      {/* 一覧 */}
      {showList && (
        <ListSheet
          items={enriched}
          hasPosition={!!position}
          onSelect={(id) => {
            setShowList(false)
            setSelectedId(id)
          }}
          onDelete={handleDelete}
          onClose={() => setShowList(false)}
        />
      )}

      {/* 受け取り / 開封 */}
      {selected && (
        <OpenView kotozute={selected} onClose={() => setSelectedId(null)} />
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
