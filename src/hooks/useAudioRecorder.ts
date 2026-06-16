import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderStatus =
  | 'idle'
  | 'recording'
  | 'recorded'
  | 'denied'
  | 'unsupported'

interface RecorderState {
  status: RecorderStatus
  /** 録音結果。停止後に確定する */
  blob: Blob | null
  mimeType: string | null
  /** 経過秒（録音中に増える） */
  seconds: number
}

const isSupported = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined'

/**
 * その場で音声を録音するフック（MediaRecorder）。
 * ファイル選択に頼らず、ブラウザ内でマイク録音 → プレビューできる。
 */
export function useAudioRecorder() {
  const [state, setState] = useState<RecorderState>({
    status: 'idle',
    blob: null,
    mimeType: null,
    seconds: 0,
  })

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    if (!isSupported()) {
      setState((s) => ({ ...s, status: 'unsupported' }))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      // 対応する MIME を選ぶ（webm / mp4 / 既定）
      const candidates = ['audio/webm', 'audio/mp4', 'audio/ogg']
      const mimeType =
        candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? ''
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      )
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        stopStream()
        clearTimer()
        setState((s) => ({ ...s, status: 'recorded', blob, mimeType: type }))
      }

      recorder.start()
      setState({ status: 'recording', blob: null, mimeType: null, seconds: 0 })
      timerRef.current = window.setInterval(() => {
        setState((s) => ({ ...s, seconds: s.seconds + 1 }))
      }, 1000)
    } catch {
      stopStream()
      setState((s) => ({ ...s, status: 'denied' }))
    }
  }, [clearTimer, stopStream])

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  const reset = useCallback(() => {
    stop()
    stopStream()
    clearTimer()
    chunksRef.current = []
    setState({ status: 'idle', blob: null, mimeType: null, seconds: 0 })
  }, [stop, stopStream, clearTimer])

  // アンマウント時の後始末
  useEffect(
    () => () => {
      stopStream()
      clearTimer()
    },
    [stopStream, clearTimer],
  )

  return { ...state, supported: isSupported(), start, stop, reset }
}
