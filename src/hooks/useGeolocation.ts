import { useCallback, useEffect, useRef, useState } from 'react'
import type { GeoStatus, LatLng } from '../types'

interface GeoState {
  status: GeoStatus
  position: LatLng | null
  accuracy: number | null
  /** 端末の向き（取得できれば。現在地マーカーの向き表示に使用） */
  heading: number | null
  error: string | null
}

const INITIAL: GeoState = {
  status: 'idle',
  position: null,
  accuracy: null,
  heading: null,
  error: null,
}

/**
 * navigator.geolocation.watchPosition で現在地を追従する。
 * 権限拒否・非対応・タイムアウトを状態として丁寧に区別し、
 * 呼び出し側がフォールバックUIを出せるようにする。
 */
export function useGeolocation(autoStart = true) {
  const [state, setState] = useState<GeoState>(INITIAL)
  const watchId = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchId.current != null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [])

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState((s) => ({
        ...s,
        status: 'unavailable',
        error: 'このブラウザは位置情報に対応していません。',
      }))
      return
    }

    setState((s) => ({ ...s, status: 'prompting', error: null }))

    // 既存の watch があれば一旦解除
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current)
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          status: 'watching',
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          heading:
            pos.coords.heading != null && !Number.isNaN(pos.coords.heading)
              ? pos.coords.heading
              : null,
          error: null,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState((s) => ({
            ...s,
            status: 'denied',
            error: '位置情報の利用が許可されていません。',
          }))
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setState((s) => ({
            ...s,
            status: 'error',
            error: '現在地を特定できませんでした。',
          }))
        } else {
          setState((s) => ({
            ...s,
            status: 'error',
            error: '位置情報の取得に時間がかかっています。',
          }))
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 20_000,
      },
    )
  }, [])

  useEffect(() => {
    if (autoStart) start()
    return stop
  }, [autoStart, start, stop])

  return { ...state, start, stop }
}
