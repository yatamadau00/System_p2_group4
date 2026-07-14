import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { BackIcon, CloseIcon } from './icons'
import './ui.css'

interface SheetProps {
  title?: ReactNode
  onClose: () => void
  /** 戻る矢印を出す場合のハンドラ */
  onBack?: () => void
  /** ヘッダー右側の追加要素 */
  headerRight?: ReactNode
  children: ReactNode
  /** スクリムのタップで閉じるか（既定 true） */
  dismissOnScrim?: boolean
  labelledBy?: string
}

/**
 * 共通のボトムシート。背面スクリム＋ハンドル＋ヘッダーを備える。
 * Escape / スクリムタップで閉じられ、開いている間は背面スクロールを止める。
 */
export function Sheet({
  title,
  onClose,
  onBack,
  headerRight,
  children,
  dismissOnScrim = true,
  labelledBy,
}: SheetProps) {
  const sheetRef = useRef<HTMLElement>(null)
  const dragState = useRef<{ startY: number; startTime: number } | null>(null)
  /** ドラッグを離した位置に確定した分（累積） */
  const [offsetY, setOffsetY] = useState(0)
  /** ドラッグ中、指の移動に追従する分（離すと offsetY へ確定） */
  const [dragDelta, setDragDelta] = useState(0)
  const [dragging, setDragging] = useState(false)

  const dragY = Math.max(0, offsetY + dragDelta)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleGripPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragState.current = { startY: e.clientY, startTime: Date.now() }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handleGripPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    setDragDelta(e.clientY - dragState.current.startY)
  }

  const handleGripPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return
    const delta = e.clientY - dragState.current.startY
    const elapsed = Date.now() - dragState.current.startTime
    const velocity = delta / Math.max(elapsed, 1) // px/ms
    const sheetHeight = sheetRef.current?.offsetHeight ?? 400
    const settledY = Math.max(0, offsetY + delta)
    dragState.current = null
    setDragging(false)
    setDragDelta(0)
    // 大きく引き下げたか、一定距離以上を素早くフリックした場合のみ閉じる
    // （小さな移動で速度だけ出るタップの誤爆を避けるため、フリックには最低移動量も課す）
    const isBigDrag = settledY > sheetHeight * 0.7
    const isFastFlick = delta > 80 && velocity > 0.8
    if (isBigDrag || isFastFlick) {
      onClose()
    } else {
      // 離した位置でそのまま止める（スナップバックしない）
      setOffsetY(settledY)
    }
  }

  return (
    <>
      <div
        className="scrim"
        onClick={dismissOnScrim ? onClose : undefined}
        aria-hidden
      />
      <section
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : undefined,
        }}
      >
        <div
          className="sheet__grip"
          aria-hidden
          onPointerDown={handleGripPointerDown}
          onPointerMove={handleGripPointerMove}
          onPointerUp={handleGripPointerUp}
          onPointerCancel={handleGripPointerUp}
        />
        <header className="sheet__head">
          {/* 左：戻る（あれば）。無ければ余白で中央タイトルを保つ */}
          {onBack ? (
            <button className="icon-btn" onClick={onBack} aria-label="戻る">
              <BackIcon />
            </button>
          ) : (
            <span style={{ width: 40, flex: 'none' }} />
          )}
          {title != null && <h2 className="sheet__title">{title}</h2>}
          {/* 右：閉じる（×）を常に同じ位置に統一 */}
          {headerRight ?? (
            <button className="icon-btn" onClick={onClose} aria-label="閉じる">
              <CloseIcon />
            </button>
          )}
        </header>
        <div className="sheet__body">{children}</div>
      </section>
    </>
  )
}
