import type { Kotozute, LatLng, Proximity } from '../types'
import { haversineMeters, proximityFor } from './geo'

/** 現在地からの距離・近接状態を付与したことづて */
export interface EnrichedKotozute extends Kotozute {
  /** 現在地からの距離(m)。現在地不明なら null */
  distance: number | null
  proximity: Proximity
}

export function enrich(
  items: Kotozute[],
  position: LatLng | null,
): EnrichedKotozute[] {
  return items.map((k) => {
    if (!position) {
      return { ...k, distance: null, proximity: 'far' as Proximity }
    }
    const distance = haversineMeters(position, k.location)
    return { ...k, distance, proximity: proximityFor(distance) }
  })
}
