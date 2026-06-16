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
import type { NewKotozute } from './types'
import './App.css'

export function App() {
  const geo = useGeolocation(true)
  const { items, loading, create, remove } = useKotozute()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  const [showList, setShowList] = useState(false)
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

  const overlayOpen = composing || showList || !!selected

  return (
    <div className="app">
      <MapScreen
        items={enriched}
        position={position}
        totalCount={items.length}
        unlockableCount={unlockableCount}
        onSelectPin={(id) => setSelectedId(id)}
        onOpenList={() => setShowList(true)}
        onMapLoad={handleMapLoad}
      />

      {/* 位置情報の状態フィードバック（オーバーレイ中は隠す） */}
      {!overlayOpen && <GeoBanner status={geo.status} onRetry={geo.start} />}

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
        />
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
