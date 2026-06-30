import { useEffect, useMemo, useRef, useState } from 'react'
import type { EnrichedKotozute } from '../lib/enrich'
import { formatDistance } from '../lib/geo'
import { kindLabel } from '../lib/media'
import { NEAR_RADIUS_M, UNLOCK_RADIUS_M } from '../config'
import { MediaView } from './MediaView'
import { CloseIcon, FlagIcon, LinkIcon, LockIcon } from './icons'
import './OpenView.css'

type Phase = 'locked' | 'ready' | 'opening' | 'opened'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const RING = 92 // 半径
const CIRC = 2 * Math.PI * RING

interface OpenViewProps {
  kotozute: EnrichedKotozute
  onClose: () => void
  onOpened?: (id: string) => void
}

/**
 * 受け取り（開封）画面。体験のクライマックス。
 * - 遠い間はロックし、距離リングと「あと◯m」を出す。
 * - 十分近づくと封蝋が灯り、タップで封が割れ→光と共にベールが晴れ→中身が現れる。
 */
export function OpenView({ kotozute, onClose, onOpened }: OpenViewProps) {
  const initiallyUnlockable = kotozute.proximity === 'unlockable'
  const [phase, setPhase] = useState<Phase>(
    initiallyUnlockable ? 'ready' : 'locked',
  )
  const openedOnce = useRef(false)
  const titleId = 'open-title'

  // 歩いて近づいたらロック→開封可能へ自動遷移（既に開封済みなら維持）
  useEffect(() => {
    if (openedOnce.current) return
    if (kotozute.proximity === 'unlockable') {
      setPhase((p) => (p === 'locked' ? 'ready' : p))
    } else {
      setPhase((p) => (p === 'ready' ? 'locked' : p))
    }
  }, [kotozute.proximity])

  const openSeal = () => {
    openedOnce.current = true
    onOpened?.(kotozute.id)
    if (prefersReducedMotion()) {
      setPhase('opened')
      return
    }
    setPhase('opening')
    window.setTimeout(() => setPhase('opened'), 1100)
  }

  // 距離リングの進捗（NEAR で 0、UNLOCK で 1）
  const progress = useMemo(() => {
    const d = kotozute.distance
    if (d == null) return 0
    if (d <= UNLOCK_RADIUS_M) return 1
    if (d >= NEAR_RADIUS_M) return 0.04
    return (NEAR_RADIUS_M - d) / (NEAR_RADIUS_M - UNLOCK_RADIUS_M)
  }, [kotozute.distance])

  const opened = phase === 'opened'

  return (
    <div
      className={`open${phase === 'opening' ? ' open--opening' : ''}${
        opened ? ' open--opened' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="open__bg" aria-hidden />
      <div className="open__paper" aria-hidden />
      {phase === 'opening' && (
        <>
          <div className="flash" aria-hidden />
          <div className="veil veil--top" aria-hidden />
          <div className="veil veil--bottom" aria-hidden />
        </>
      )}

      <div className="open__top">
        <button className="open__close" onClick={onClose} aria-label="閉じる">
          <CloseIcon />
        </button>
      </div>

      <div
        className="open__stage"
        onClick={(e) => {
          // 開封前は、中身の外側（背景）をタップで閉じられる
          if (
            (phase === 'locked' || phase === 'ready') &&
            e.target === e.currentTarget
          ) {
            onClose()
          }
        }}
      >
        {phase === 'locked' && (
          <LockedView kotozute={kotozute} progress={progress} titleId={titleId} />
        )}

        {(phase === 'ready' || phase === 'opening') && (
          <div className="ready">
            <div className="locked__place" id={titleId}>
              {kotozute.placeLabel ?? 'この場所のことづて'}
            </div>
            <button
              className="seal"
              onClick={openSeal}
              disabled={phase === 'opening'}
              aria-label="封を開ける"
            >
              <span className="seal__halo" aria-hidden />
              <span className="seal__glyph">言</span>
            </button>
            <p className="locked__hint">
              ここまで来てくれて、ありがとう。
              <br />
              そっと、封を開けてみてください。
            </p>
          </div>
        )}

        {opened && <Letter kotozute={kotozute} />}
      </div>
    </div>
  )
}

function LockedView({
  kotozute,
  progress,
  titleId,
}: {
  kotozute: EnrichedKotozute
  progress: number
  titleId: string
}) {
  const d = kotozute.distance
  const remaining = d != null ? Math.max(0, d - UNLOCK_RADIUS_M) : null

  return (
    <div className="locked">
      <div className="locked__place" id={titleId}>
        {kotozute.placeLabel ?? 'どこかの誰かのことづて'}
      </div>

      {kotozute.visibility === 'group' && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 -8px 0' }}>
          <span className="friend-only-badge">
            <LockIcon width={10} height={10} style={{ marginRight: 2, display: 'inline-block', verticalAlign: 'middle' }} />
            グループ限定公開
          </span>
        </div>
      )}

      <div className="ring" role="img" aria-label="目的地までの距離">
        <svg viewBox="0 0 200 200" width="200" height="200">
          <circle className="ring__track" cx="100" cy="100" r={RING} />
          <circle
            className="ring__progress"
            cx="100"
            cy="100"
            r={RING}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
          />
        </svg>
        <div className="ring__seal">
          <LockIcon />
        </div>
      </div>

      {remaining != null ? (
        <div className="locked__distance">
          <span>開封まで、あと</span>
          <b>{formatDistance(remaining)}</b>
        </div>
      ) : (
        <div className="locked__distance">
          <span>現在地がわかると、距離が見えます</span>
        </div>
      )}

      <p className="locked__hint">
        このことづては、この場所でしか開けません。
        <br />
        もう少しだけ、近づいてみてください。
      </p>
      <div className="locked__peek">
        {kindLabel(kotozute)}が、ここで待っています
      </div>
    </div>
  )
}

function Letter({ kotozute }: { kotozute: EnrichedKotozute }) {
  const date = new Date(kotozute.createdAt)
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  const hasBody = kotozute.message.trim().length > 0 || !!kotozute.link

  return (
    <div className="letter">
      <div className="letter__place">
        {kotozute.placeLabel ?? 'この場所のことづて'}
      </div>
      <div className="letter__meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <span>{kindLabel(kotozute)}</span>
        <span aria-hidden>・</span>
        <span>{dateStr}</span>
        {kotozute.openedByCurrentUser && (
          <>
            <span aria-hidden>・</span>
            <span>開封済み</span>
          </>
        )}
        {kotozute.visibility === 'group' && (
          <span className="friend-only-badge" style={{ margin: 0 }}>
            <LockIcon width={10} height={10} style={{ marginRight: 2, display: 'inline-block', verticalAlign: 'middle' }} />
            グループ限定
          </span>
        )}
      </div>

      <div className="letter__card">
        {/* 添えられたメディアを順に表示（複数可） */}
        {(kotozute.media ?? []).map((m) => (
          <MediaView key={m.id} media={m} />
        ))}
        {hasBody && (
          <div className="letter__message">
            {kotozute.message}
            {kotozute.link && (
              <div>
                <a
                  className="letter__link"
                  href={kotozute.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <LinkIcon width={18} height={18} />
                  {kotozute.link}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {kotozute.authorName && (
        <div className="letter__sign">— {kotozute.authorName} より</div>
      )}

      <div className="letter__actions">
        <button
          className="letter__report"
          onClick={() =>
            alert('このことづてを報告しました。ご協力ありがとうございます。')
          }
        >
          <FlagIcon
            width={12}
            height={12}
            style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }}
          />
          このことづてを報告する
        </button>
      </div>
    </div>
  )
}
