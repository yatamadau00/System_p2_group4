import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderStatus =
  | 'idle'
  | 'preparing' // マイク確保中（ウォームアップ）
  | 'ready' // マイク準備OK・即録音できる
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
 *
 * ラグ対策として、パネルを開いた時点で prime() でマイクを先に確保しておく。
 * これにより録音ボタンを押した瞬間に MediaRecorder.start() でき、
 * 「押してから録り始まるまでの待ち」を実質ゼロにする。
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

  /** 既存のマイクストリームを返す。無ければ取得する。 */
  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    return stream
  }, [])

  /** マイクを事前に確保しておく（ウォームアップ）。 */
  const prime = useCallback(async () => {
    if (!isSupported()) {
      setState((s) => ({ ...s, status: 'unsupported' }))
      return
    }
    setState((s) => ({ ...s, status: 'preparing' }))
    try {
      await ensureStream()
      setState((s) => (s.status === 'preparing' ? { ...s, status: 'ready' } : s))
    } catch {
      stopStream()
      setState((s) => ({ ...s, status: 'denied' }))
    }
  }, [ensureStream, stopStream])

  const start = useCallback(async () => {
    if (!isSupported()) {
      setState((s) => ({ ...s, status: 'unsupported' }))
      return
    }
    try {
      const stream = await ensureStream()
      if (!stream) throw new Error('no stream')
      chunksRef.current = []

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
        clearTimer()
        // ストリームは保持したままにし、「録り直す」を即時にする
        setState((s) => ({ ...s, status: 'recorded', blob, mimeType: type }))
      }

      recorder.start()
      setState((s) => ({ ...s, status: 'recording', blob: null, seconds: 0 }))
      timerRef.current = window.setInterval(() => {
        setState((s) => ({ ...s, seconds: s.seconds + 1 }))
      }, 1000)
    } catch {
      stopStream()
      setState((s) => ({ ...s, status: 'denied' }))
    }
  }, [ensureStream, clearTimer, stopStream])

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  /** 録り直し：結果を捨てて、すぐ録音できる状態へ戻す（マイクは保持）。 */
  const reset = useCallback(() => {
    chunksRef.current = []
    setState((s) => ({
      ...s,
      status: streamRef.current ? 'ready' : 'idle',
      blob: null,
      mimeType: null,
      seconds: 0,
    }))
  }, [])

  // アンマウント時にマイクを解放
  useEffect(
    () => () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      stopStream()
      clearTimer()
    },
    [stopStream, clearTimer],
  )

  return { ...state, supported: isSupported(), prime, start, stop, reset }
}
