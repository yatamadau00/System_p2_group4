import { useCallback, useState, useRef } from 'react'
import {
  GoogleMap,
  OverlayView,
  OverlayViewF,
  useJsApiLoader,
} from '@react-google-maps/api'
import type { EnrichedKotozute } from '../lib/enrich'
import type { Group, LatLng, User, UserProfile } from '../types'
import {
  DEFAULT_ZOOM,
  FALLBACK_CENTER,
  GOOGLE_MAPS_API_KEY,
} from '../config'
import { KOTOZUTE_MAP_STYLE } from '../lib/mapStyle'
import { Pin } from './Pin'
import { BellIcon, ListIcon, LocateIcon } from './icons'
import './MapScreen.css'

type MapLayerKey = 'public' | 'group' | 'owned'
type MapLayerVisibility = Record<MapLayerKey, boolean>
type GroupLayerVisibility = Record<string, boolean>

interface MapScreenProps {
  items: EnrichedKotozute[]
  position: LatLng | null
  totalCount: number
  unlockableCount: number
  highlightedId: string | null
  onSelectPin: (id: string) => void
  onOpenList: () => void
  onMapLoad: (map: google.maps.Map | null) => void
  currentUser: User | null
  onOpenAuth: () => void
  onLogout: () => void
  profile: UserProfile
  onOpenProfile: () => void
  unreadCount: number
  onOpenNotifications: () => void
  mapLayerVisibility: MapLayerVisibility
  onToggleMapLayer: (key: MapLayerKey) => void
  groups: Group[]
  groupLayerVisibility: GroupLayerVisibility
  onToggleGroupLayer: (groupId: string) => void
}

const hasKey = GOOGLE_MAPS_API_KEY.trim().length > 0

const overlayOffset = {
  x: 0,
  y: 0,
}

export function MapScreen(props: MapScreenProps) {
  const {
    items,
    position,
    totalCount,
    unlockableCount,
    highlightedId,
    onSelectPin,
    onOpenList,
    onMapLoad,
    currentUser,
    onOpenAuth,
    onLogout,
    profile,
    onOpenProfile,
    unreadCount,
    onOpenNotifications,
    mapLayerVisibility,
    onToggleMapLayer,
    groups,
    groupLayerVisibility,
    onToggleGroupLayer,
  } = props
  const [groupSelectorOpen, setGroupSelectorOpen] = useState(false)

  // ハイライト中のピンを最後に描画して、重なっても前面に出す
  const orderedItems = highlightedId
    ? [
        ...items.filter((k) => k.id !== highlightedId),
        ...items.filter((k) => k.id === highlightedId),
      ]
    : items

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'kotozute-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const mapRef = useRef<google.maps.Map | null>(null)

  const handleLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      onMapLoad(map)
    },
    [onMapLoad],
  )

  const handleUnmount = useCallback(() => {
    mapRef.current = null
    onMapLoad(null)
  }, [onMapLoad])

  const recenter = useCallback(() => {
    if (mapRef.current && position) {
      mapRef.current.panTo(position)
      mapRef.current.setZoom(DEFAULT_ZOOM)
    }
  }, [position])

  const brandBar = (
    <div className="topbar" role="banner">
      <span className="topbar__mark" aria-hidden />
      <div>
        <div className="topbar__title">ことづて</div>
        <div className="topbar__count">
          {unlockableCount > 0
            ? `いま ${unlockableCount} 通、開けられます`
            : `この地に ${totalCount} 通`}
        </div>
      </div>
      <span className="topbar__divider" />
      <div className="topbar__auth">
        {currentUser ? (
          <div className="topbar__user">
            <span className="topbar__username" title={profile.name}>
              {profile.name}
            </span>
            <button
              className="topbar__btn"
              onClick={onLogout}
              aria-label="ログアウト"
            >
              ログアウト
            </button>
          </div>
        ) : (
          <button
            className="topbar__btn"
            onClick={onOpenAuth}
            aria-label="ログイン"
          >
            ログイン
          </button>
        )}
      </div>
    </div>
  )

  const profileButton = (
    <button
      className="map-btn map-btn--profile"
      onClick={onOpenProfile}
      style={{ backgroundColor: profile.avatarColor }}
      aria-label="プロフィールをひらく"
    >
      {profile.avatarEmoji}
    </button>
  )

  const visibleGroupCount = groups.filter((group) => groupLayerVisibility[group.id] ?? true)
    .length

  const layerControls = (
    <div className="map-layers" role="group" aria-label="地図に表示することづて">
      <button
        className={`map-layer${mapLayerVisibility.public ? ' map-layer--active' : ''}`}
        type="button"
        aria-pressed={mapLayerVisibility.public}
        onClick={() => onToggleMapLayer('public')}
      >
        公開
      </button>
      <div className="map-layer-group">
        <button
          className={`map-layer map-layer--group${visibleGroupCount > 0 ? ' map-layer--active' : ''}`}
          type="button"
          aria-expanded={groupSelectorOpen}
          aria-controls="map-group-selector"
          onClick={() => setGroupSelectorOpen((open) => !open)}
        >
          グループ
        </button>
        {groupSelectorOpen && (
          <div
            id="map-group-selector"
            className="map-group-selector"
            aria-label="表示するグループを選択"
          >
            <div className="map-group-selector__title">表示するグループ</div>
            {groups.length === 0 ? (
              <p className="map-group-selector__empty">参加中のグループなし</p>
            ) : (
              groups.map((group) => {
                const active = groupLayerVisibility[group.id] ?? true
                return (
                  <button
                    key={group.id}
                    className={`map-group-option${active ? ' map-group-option--active' : ''}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onToggleGroupLayer(group.id)}
                  >
                    <span
                      className="map-group-option__avatar"
                      style={{ backgroundColor: group.avatarColor }}
                      aria-hidden
                    >
                      {group.avatarEmoji}
                    </span>
                    <span className="map-group-option__name">{group.name || group.id}</span>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
      <button
        className={`map-layer map-layer--owned${mapLayerVisibility.owned ? ' map-layer--active' : ''}`}
        type="button"
        aria-pressed={mapLayerVisibility.owned}
        onClick={() => onToggleMapLayer('owned')}
      >
        自作/取得済み
      </button>
    </div>
  )

  // --- フォールバック地図（キー未設定 or 読み込み失敗） ---
  if (!hasKey || loadError) {
    return (
      <div className="map-root">
        <FallbackMap items={items} onSelectPin={onSelectPin} />
        {brandBar}
        {profileButton}
        {layerControls}
        <div className="map-controls">
          <button
            className="map-btn map-btn--notification"
            onClick={onOpenNotifications}
            aria-label="通知一覧"
          >
            <BellIcon />
            {unreadCount > 0 && <span className="map-btn__badge">{unreadCount}</span>}
          </button>
          <button className="map-btn" onClick={onOpenList} aria-label="ことづて一覧">
            <ListIcon />
          </button>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="map-root">
        <div className="map-fallback" aria-busy="true">
          <div className="map-fallback__inner">
            <div className="spinner" />
            <p>地図をひらいています…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="map-root">
      <GoogleMap
        mapContainerClassName="map-canvas"
        center={position ?? FALLBACK_CENTER}
        zoom={DEFAULT_ZOOM}
        onLoad={handleLoad}
        onUnmount={handleUnmount}
        options={{
          styles: KOTOZUTE_MAP_STYLE,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          backgroundColor: '#1e2530',
          minZoom: 3,
          maxZoom: 22,
        }}
      >
        {/* 現在地（OverlayViewF＝再レンダリングでも消えない関数版を使用） */}
        {position && (
          <OverlayViewF
            position={position}
            mapPaneName={OverlayView.OVERLAY_LAYER}
            getPixelPositionOffset={() => overlayOffset}
          >
            <div className="me" aria-hidden>
              <span className="me__ring" />
              <span className="me__dot" />
            </div>
          </OverlayViewF>
        )}

        {/* ことづてピン（ハイライト中は最前面に） */}
        {orderedItems.map((k) => (
          <OverlayViewF
            key={k.id}
            position={k.location}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={() => overlayOffset}
          >
            <Pin
              kotozute={k}
              highlighted={k.id === highlightedId}
              onClick={() => onSelectPin(k.id)}
            />
          </OverlayViewF>
        ))}
      </GoogleMap>

      {brandBar}
      {profileButton}
      {layerControls}
      <div className="map-controls">
        <button
          className="map-btn map-btn--notification"
          onClick={onOpenNotifications}
          aria-label="通知一覧をひらく"
        >
          <BellIcon />
          {unreadCount > 0 && <span className="map-btn__badge">{unreadCount}</span>}
        </button>
        <button
          className="map-btn"
          onClick={onOpenList}
          aria-label="ことづて一覧をひらく"
        >
          <ListIcon />
        </button>
        <button
          className="map-btn"
          onClick={recenter}
          disabled={!position}
          aria-label="現在地へ戻る"
        >
          <LocateIcon />
        </button>
      </div>
    </div>
  )
}

/**
 * APIキー未設定・読み込み失敗時のフォールバック。
 * 抽象的なグリッド地図の上にことづてピンを散らし、体験の雰囲気だけは伝える。
 */
function FallbackMap({
  items,
  onSelectPin,
}: {
  items: EnrichedKotozute[]
  onSelectPin: (id: string) => void
}) {
  return (
    <div className="map-fallback">
      <div className="map-fallback__pins">
        {items.slice(0, 5).map((k, i) => {
          // ピンを擬似的に画面上へ散らす（決定的な配置）
          const left = 18 + ((i * 37) % 64)
          const top = 26 + ((i * 23) % 48)
          return (
            <div
              key={k.id}
              style={{
                position: 'absolute',
                left: `${left}%`,
                top: `${top}%`,
                pointerEvents: 'auto',
              }}
            >
              <Pin kotozute={k} onClick={() => onSelectPin(k.id)} />
            </div>
          )
        })}
      </div>
      <div className="map-fallback__inner">
        <h2>地図はいま、お休み中です</h2>
        <p>
          <code>VITE_GOOGLE_MAPS_API_KEY</code> を設定すると、
          ほんものの地図の上にことづてが灯ります。
        </p>
        <p style={{ opacity: 0.8 }}>
          設定がなくても、ピンに触れれば中身を確かめられます。
        </p>
      </div>
    </div>
  )
}
