import { useCallback, useEffect, useState, useRef } from 'react'
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
import { BellIcon, ListIcon, LocateIcon, UserIcon } from './icons'
import './MapScreen.css'

type MapLayerKey = 'public' | 'group' | 'created' | 'opened'
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
  profile: UserProfile
  onOpenProfile: () => void
  unreadCount: number
  onOpenNotifications: () => void
  mapLayerVisibility: MapLayerVisibility
  onToggleMapLayer: (key: MapLayerKey) => void
  favoriteOnly: boolean
  onToggleFavoriteOnly: () => void
  groups: Group[]
  groupLayerVisibility: GroupLayerVisibility
  onToggleGroupLayer: (groupId: string) => void
  routeTarget: EnrichedKotozute | null
  onCloseRoute: () => void
}

type RouteMode = 'WALKING' | 'TRANSIT' | 'DRIVING'
type RouteStatus = 'idle' | 'loading' | 'active' | 'error'

interface RouteSummary {
  distanceMeters: number | null
  durationMillis: number | null
}

interface MapsRoute {
  distanceMeters?: number
  durationMillis?: number
  viewport?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral
  createPolylines: () => google.maps.Polyline[]
}

const hasKey = GOOGLE_MAPS_API_KEY.trim().length > 0

const overlayOffset = {
  x: 0,
  y: 0,
}

function formatRouteDuration(durationMillis: number | null) {
  if (durationMillis == null) return '—'
  const minutes = Math.max(1, Math.round(durationMillis / 60_000))
  if (minutes < 60) return `約${minutes}分`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `約${hours}時間${rest}分` : `約${hours}時間`
}

function formatRouteDistance(distanceMeters: number | null) {
  if (distanceMeters == null) return '—'
  if (distanceMeters < 1000) return `約${Math.round(distanceMeters)}m`
  return `約${(distanceMeters / 1000).toFixed(distanceMeters < 10_000 ? 1 : 0)}km`
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
    profile,
    onOpenProfile,
    unreadCount,
    onOpenNotifications,
    mapLayerVisibility,
    onToggleMapLayer,
    favoriteOnly,
    onToggleFavoriteOnly,
    groups,
    groupLayerVisibility,
    onToggleGroupLayer,
    routeTarget,
    onCloseRoute,
  } = props
  const [groupSelectorOpen, setGroupSelectorOpen] = useState(false)

  // ハイライト中のピンを最後に描画して、重なっても前面に出す
  const itemsWithRouteTarget =
    routeTarget && !items.some((item) => item.id === routeTarget.id)
      ? [...items, routeTarget]
      : items
  const orderedItems = highlightedId
    ? [
        ...itemsWithRouteTarget.filter((k) => k.id !== highlightedId),
        ...itemsWithRouteTarget.filter((k) => k.id === highlightedId),
      ]
    : itemsWithRouteTarget

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'kotozute-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const routePolylinesRef = useRef<google.maps.Polyline[]>([])
  const routeRequestRef = useRef(0)
  const routeOriginTargetRef = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [routeMode, setRouteMode] = useState<RouteMode>('WALKING')
  const [routeOrigin, setRouteOrigin] = useState<LatLng | null>(null)
  const [routeStatus, setRouteStatus] = useState<RouteStatus>('idle')
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)

  const handleLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map
      setMapReady(true)
      onMapLoad(map)
    },
    [onMapLoad],
  )

  const handleUnmount = useCallback(() => {
    mapRef.current = null
    setMapReady(false)
    onMapLoad(null)
  }, [onMapLoad])

  const recenter = useCallback(() => {
    if (mapRef.current && position) {
      mapRef.current.panTo(position)
      mapRef.current.setZoom(DEFAULT_ZOOM)
    }
  }, [position])

  const clearRoutePolylines = useCallback(() => {
    routePolylinesRef.current.forEach((polyline) => polyline.setMap(null))
    routePolylinesRef.current = []
  }, [])

  // 経路開始時の現在地を出発地として固定。watchPosition のたびに
  // Routes API を呼び直さず、モード切替時だけ再計算する。
  useEffect(() => {
    if (!routeTarget) {
      routeOriginTargetRef.current = null
      setRouteOrigin(null)
      setRouteStatus('idle')
      setRouteSummary(null)
      setRouteError(null)
      clearRoutePolylines()
      return
    }

    if (position && routeOriginTargetRef.current !== routeTarget.id) {
      routeOriginTargetRef.current = routeTarget.id
      setRouteOrigin(position)
    }
  }, [clearRoutePolylines, position, routeTarget])

  useEffect(() => {
    if (!routeTarget) return
    if (!routeOrigin) {
      setRouteStatus('error')
      setRouteError('経路を表示するには位置情報が必要です。')
      return
    }
    if (!hasKey) {
      setRouteStatus('error')
      setRouteError('Google Maps APIが設定されていません。')
      return
    }
    if (!mapReady || !mapRef.current) return

    const requestId = ++routeRequestRef.current
    clearRoutePolylines()
    setRouteStatus('loading')
    setRouteSummary(null)
    setRouteError(null)

    ;(async () => {
      try {
        const importLibrary = google.maps.importLibrary as unknown as (
          name: string,
        ) => Promise<Record<string, unknown>>
        const routesLibrary = await importLibrary('routes')
        const Route = routesLibrary.Route as {
          computeRoutes: (request: Record<string, unknown>) => Promise<{ routes: MapsRoute[] }>
        }
        const fields = ['path', 'distanceMeters', 'durationMillis', 'viewport']
        if (routeMode === 'TRANSIT') fields.push('legs')

        const { routes } = await Route.computeRoutes({
          origin: routeOrigin,
          destination: routeTarget.location,
          travelMode: routeMode,
          fields,
          ...(routeMode === 'DRIVING' ? { routingPreference: 'TRAFFIC_AWARE' } : {}),
        })
        if (requestId !== routeRequestRef.current) return
        const route = routes[0]
        if (!route) throw new Error('route not found')

        const polylines = route.createPolylines()
        polylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: '#d67b3f',
            strokeOpacity: 0.95,
            strokeWeight: 6,
            zIndex: 10,
          })
          polyline.setMap(mapRef.current)
        })
        routePolylinesRef.current = polylines
        if (route.viewport) mapRef.current?.fitBounds(route.viewport, 72)

        setRouteSummary({
          distanceMeters: route.distanceMeters ?? null,
          durationMillis: route.durationMillis ?? null,
        })
        setRouteStatus('active')
      } catch (error) {
        console.warn('Failed to calculate route:', error)
        if (requestId !== routeRequestRef.current) return
        setRouteStatus('error')
        setRouteError('この移動手段での経路を取得できませんでした。')
      }
    })()

    return () => {
      routeRequestRef.current += 1
      clearRoutePolylines()
    }
  }, [
    clearRoutePolylines,
    mapReady,
    routeMode,
    routeOrigin,
    routeTarget?.id,
    routeTarget?.location.lat,
    routeTarget?.location.lng,
  ])

  // ブランド情報とユーザー（アバター＋名前）を 1 本のトップバーに統合。
  // ユーザーチップをタップするとプロフィールが開く（ログアウトはプロフィール内へ集約）。
  const topBar = (
    <header className="topbar" role="banner">
      <div className="topbar__brand">
        <span className="topbar__mark" aria-hidden />
        <div className="topbar__brand-text">
          <div className="topbar__title">ことづて</div>
          <div className="topbar__count">
            {unlockableCount > 0
              ? `いま ${unlockableCount} 通、開けられます`
              : `この地に ${totalCount} 通`}
          </div>
        </div>
      </div>

      {currentUser ? (
        <button
          className="topbar__user"
          onClick={onOpenProfile}
          aria-label="プロフィールをひらく"
        >
          <span className="topbar__username" title={profile.name}>
            {profile.name}
          </span>
          <span
            className="topbar__avatar"
            style={{ backgroundColor: profile.avatarColor }}
            aria-hidden
          >
            {profile.avatarImageUrl ? (
              <img src={profile.avatarImageUrl} alt="" className="topbar__avatar-image" />
            ) : (
              profile.avatarEmoji
            )}
          </span>
        </button>
      ) : (
        <button
          className="topbar__user topbar__user--guest"
          onClick={onOpenAuth}
          aria-label="ログイン"
        >
          <span className="topbar__username">ログイン</span>
          <span className="topbar__avatar topbar__avatar--guest" aria-hidden>
            <UserIcon width={22} height={22} />
          </span>
        </button>
      )}
    </header>
  )

  const visibleGroupCount = groups.filter((group) => groupLayerVisibility[group.id] ?? true)
    .length
  const personalLayer = mapLayerVisibility.created
    ? 'created'
    : mapLayerVisibility.opened
      ? 'opened'
      : null
  const standardFiltersDisabled = personalLayer !== null

  const layerControls = (
    <div className="map-layers" role="group" aria-label="地図に表示することづて">
      <button
        className={`map-layer map-layer--favorite map-layer--parent${favoriteOnly ? ' map-layer--active' : ''}${standardFiltersDisabled ? ' map-layer--disabled' : ''}`}
        type="button"
        aria-pressed={favoriteOnly}
        disabled={standardFiltersDisabled}
        onClick={onToggleFavoriteOnly}
      >
        お気に入り
      </button>
      <div className="map-layer-children">
        <button
          className={`map-layer map-layer--child${mapLayerVisibility.public ? ' map-layer--active' : ''}${standardFiltersDisabled ? ' map-layer--disabled' : ''}`}
          type="button"
          aria-pressed={mapLayerVisibility.public}
          disabled={standardFiltersDisabled}
          onClick={() => onToggleMapLayer('public')}
        >
          公開
        </button>
        <div className="map-layer-group">
          <button
            className={`map-layer map-layer--child map-layer--group${visibleGroupCount > 0 ? ' map-layer--active' : ''}${standardFiltersDisabled ? ' map-layer--disabled' : ''}`}
            type="button"
            aria-expanded={groupSelectorOpen}
            aria-controls="map-group-selector"
            disabled={standardFiltersDisabled}
            onClick={() => setGroupSelectorOpen((open) => !open)}
          >
            グループ
          </button>
          {groupSelectorOpen && !standardFiltersDisabled && (
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
                        {group.avatarImageUrl ? (
                          <img
                            src={group.avatarImageUrl}
                            alt=""
                            className="map-group-option__avatar-image"
                          />
                        ) : (
                          group.avatarEmoji
                        )}
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
          className={`map-layer map-layer--child map-layer--opened${mapLayerVisibility.opened ? ' map-layer--active' : ''}`}
          type="button"
          aria-pressed={mapLayerVisibility.opened}
          onClick={() => onToggleMapLayer('opened')}
        >
          開封済
        </button>
        <button
          className={`map-layer map-layer--child map-layer--created${mapLayerVisibility.created ? ' map-layer--active' : ''}`}
          type="button"
          aria-pressed={mapLayerVisibility.created}
          onClick={() => onToggleMapLayer('created')}
        >
          {currentUser?.displayName || profile.name || '自作'}
        </button>
      </div>
    </div>
  )

  const mapsUrl = routeTarget
    ? `https://www.google.com/maps/dir/?api=1&destination=${routeTarget.location.lat},${routeTarget.location.lng}&travelmode=${routeMode.toLowerCase()}`
    : '#'
  const routePanel = routeTarget ? (
    <section className="route-panel" aria-label="目的地までの経路">
      <div className="route-panel__header">
        <div>
          <div className="route-panel__eyebrow">目的地までの経路</div>
          <strong>{routeTarget.placeLabel || 'ことづての場所'}</strong>
        </div>
        <button type="button" className="route-panel__close" onClick={onCloseRoute}>
          終了
        </button>
      </div>
      <div className="route-modes" role="group" aria-label="移動手段">
        {([
          ['WALKING', '🚶', '徒歩'],
          ['TRANSIT', '🚆', '公共交通'],
          ['DRIVING', '🚗', '車'],
        ] as const).map(([mode, icon, label]) => (
          <button
            key={mode}
            type="button"
            className={`route-mode${routeMode === mode ? ' route-mode--active' : ''}`}
            aria-pressed={routeMode === mode}
            onClick={() => setRouteMode(mode)}
          >
            <span aria-hidden>{icon}</span>
            {label}
          </button>
        ))}
      </div>
      <div className="route-panel__result" role="status" aria-live="polite">
        {routeStatus === 'loading' && <span>経路を探しています…</span>}
        {routeStatus === 'active' && routeSummary && (
          <>
            <b>{formatRouteDuration(routeSummary.durationMillis)}</b>
            <span>{formatRouteDistance(routeSummary.distanceMeters)}</span>
          </>
        )}
        {routeStatus === 'error' && <span>{routeError}</span>}
      </div>
      {routeStatus === 'error' && (
        <div className="route-panel__fallbacks">
          {position && (
            <button
              type="button"
              onClick={() => setRouteOrigin({ ...position })}
            >
              もう一度試す
            </button>
          )}
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            Googleマップで開く
          </a>
        </div>
      )}
      {routeMode === 'WALKING' && routeStatus === 'active' && (
        <p className="route-panel__notice">実際の歩道や通行状況を確認して移動してください。</p>
      )}
    </section>
  ) : null

  // --- フォールバック地図（キー未設定 or 読み込み失敗） ---
  if (!hasKey || loadError) {
    return (
      <div className="map-root">
        <FallbackMap items={items} onSelectPin={onSelectPin} />
        {topBar}
        {routeTarget ? routePanel : layerControls}
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
              group={
                k.visibility === 'group' && k.groupId
                  ? groups.find((g) => g.id === k.groupId)
                  : undefined
              }
              highlighted={k.id === highlightedId}
              onClick={() => onSelectPin(k.id)}
            />
          </OverlayViewF>
        ))}
      </GoogleMap>

      {topBar}
      {routeTarget ? routePanel : layerControls}
      {!routeTarget && <div className="map-controls">
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
      </div>}
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
