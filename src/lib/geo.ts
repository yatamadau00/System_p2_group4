import type { LatLng, Proximity } from '../types'
import { NEAR_RADIUS_M, UNLOCK_RADIUS_M } from '../config'

const EARTH_RADIUS_M = 6_371_000

const toRad = (deg: number) => (deg * Math.PI) / 180

/**
 * Haversine 公式で2地点間の距離（メートル）を求める。
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * 距離から近接状態を導出する。
 * - unlockable: しきい値（既定50m）未満 → 開封可能
 * - near:       「もうすぐ届く」範囲（既定200m）内
 * - far:        それより遠い
 */
export function proximityFor(distanceM: number): Proximity {
  if (distanceM < UNLOCK_RADIUS_M) return 'unlockable'
  if (distanceM < NEAR_RADIUS_M) return 'near'
  return 'far'
}

/** 距離を人にやさしい表記に整える（例: 12m / 1.4km） */
export function formatDistance(distanceM: number): string {
  if (!Number.isFinite(distanceM)) return '— m'
  if (distanceM < 1000) return `${Math.round(distanceM)}m`
  return `${(distanceM / 1000).toFixed(distanceM < 10000 ? 1 : 0)}km`
}
