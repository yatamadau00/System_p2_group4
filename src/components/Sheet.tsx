import { useEffect, type ReactNode } from 'react'
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div
        className="scrim"
        onClick={dismissOnScrim ? onClose : undefined}
        aria-hidden
      />
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div className="sheet__grip" aria-hidden />
        <header className="sheet__head">
          {onBack ? (
            <button className="icon-btn" onClick={onBack} aria-label="戻る">
              <BackIcon />
            </button>
          ) : (
            <button className="icon-btn" onClick={onClose} aria-label="閉じる">
              <CloseIcon />
            </button>
          )}
          {title != null && <h2 className="sheet__title">{title}</h2>}
          {headerRight ?? <span style={{ width: 40, flex: 'none' }} />}
        </header>
        <div className="sheet__body">{children}</div>
      </section>
    </>
  )
}
