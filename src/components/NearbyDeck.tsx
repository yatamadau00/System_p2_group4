import { useEffect, useRef, type MouseEvent, type PointerEvent, type WheelEvent } from 'react'
import type { EnrichedKotozute } from '../lib/enrich'
import type { Group } from '../types'
import { primaryKind } from '../lib/media'
import { PigeonIcon } from './icons'
import './NearbyDeck.css'

const KIND_SHORT = {
  text: 'メッセージ',
  image: '写真',
  video: '映像',
  audio: '声',
}

interface NearbyDeckProps {
  /** 現在地の半径内（開封可能）にあることづて。距離順で渡される想定 */
  items: EnrichedKotozute[]
  /** 参加中グループ（グループことづてのアイコン表示用） */
  groups: Group[]
  highlightedId: string | null
  /** 現在地が取れているか（空状態の文言を分けるため） */
  hasPosition: boolean
  onSelect: (id: string) => void
  onOpen: (id: string) => void
}

/**
 * マップ下部の「食べログ型」カルーセル。
 * 現在地の半径内にある（＝いま開ける）ことづてを横スクロールで一覧表示する。
 * カードをタップすると地図がその位置へフォーカスし、ピンと相互にハイライトされる。
 */
export function NearbyDeck({
  items,
  groups,
  highlightedId,
  hasPosition,
  onSelect,
  onOpen,
}: NearbyDeckProps) {
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const suppressClickRef = useRef(false)
  const wheelSnapTimer = useRef<number | null>(null)
  const scrollAnimRef = useRef<number | null>(null)

  /**
   * scrollLeft を自前の requestAnimationFrame でアニメーションする。
   * ブラウザの scroll-behavior:'smooth' は scroll-snap-type と組み合わせると
   * Safari で瞬時にジャンプする不具合があり、Chrome でもスナップと競合して
   * カクついて見えることがあるため、ネイティブのスムーズスクロールには頼らない。
   */
  const animateScrollTo = (target: number, duration = 320) => {
    const el = scrollRef.current
    if (!el) return
    if (scrollAnimRef.current != null) cancelAnimationFrame(scrollAnimRef.current)
    const start = el.scrollLeft
    const change = target - start
    if (Math.abs(change) < 1) return
    // ブラウザのネイティブスナップが JS 駆動のスクロールと競合してカクつくのを防ぐ
    el.style.scrollSnapType = 'none'
    const startTime = performance.now()
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      el.scrollLeft = start + change * easeOutCubic(progress)
      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(step)
      } else {
        scrollAnimRef.current = null
        el.style.scrollSnapType = ''
      }
    }
    scrollAnimRef.current = requestAnimationFrame(step)
  }

  const centerOn = (card: HTMLElement) => {
    const el = scrollRef.current
    if (!el) return
    const target = card.offsetLeft + card.offsetWidth / 2 - el.clientWidth / 2
    animateScrollTo(target)
  }

  // ピン側で選ばれたら、対応カードを中央へスクロール
  useEffect(() => {
    if (highlightedId && cardRefs.current[highlightedId]) {
      centerOn(cardRefs.current[highlightedId]!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedId])

  useEffect(
    () => () => {
      if (wheelSnapTimer.current != null) window.clearTimeout(wheelSnapTimer.current)
      if (scrollAnimRef.current != null) cancelAnimationFrame(scrollAnimRef.current)
    },
    [],
  )

  // ドラッグを離した位置に一番近いカードへ、スライドするように滑らかにスナップさせる
  const snapToNearest = () => {
    const el = scrollRef.current
    if (!el) return
    const cards = Array.from(el.children) as HTMLElement[]
    if (cards.length === 0) return
    const containerCenter = el.scrollLeft + el.clientWidth / 2
    let closest = cards[0]
    let closestDist = Infinity
    for (const card of cards) {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2
      const dist = Math.abs(cardCenter - containerCenter)
      if (dist < closestDist) {
        closestDist = dist
        closest = card
      }
    }
    centerOn(closest)
  }

  // マウスでのドラッグ操作でも横スクロールできるようにする（タッチは既定のスクロールに任せる）
  // window に直接リスナーを張ることで、setPointerCapture によるクリック判定の狂いを避ける
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return
    const el = scrollRef.current
    if (!el) return
    if (scrollAnimRef.current != null) {
      cancelAnimationFrame(scrollAnimRef.current)
      scrollAnimRef.current = null
    }
    el.style.scrollSnapType = 'none'
    const startX = e.clientX
    const startScrollLeft = el.scrollLeft
    let moved = false

    const onMove = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - startX
      if (Math.abs(dx) > 4) moved = true
      el.scrollLeft = startScrollLeft - dx
    }
    const onUp = () => {
      if (moved) {
        suppressClickRef.current = true
        snapToNearest()
      } else {
        el.style.scrollSnapType = ''
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ドラッグでカードが動いた直後は、そのままタップ扱いにしない
  const handleClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault()
      e.stopPropagation()
      suppressClickRef.current = false
    }
  }

  // マウスホイール（縦方向）でも横に流せるようにする。操作が止まったら滑らかにスナップ
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el) return
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      if (scrollAnimRef.current != null) {
        cancelAnimationFrame(scrollAnimRef.current)
        scrollAnimRef.current = null
      }
      el.style.scrollSnapType = 'none'
      el.scrollLeft += e.deltaY
      e.preventDefault()
      if (wheelSnapTimer.current != null) window.clearTimeout(wheelSnapTimer.current)
      wheelSnapTimer.current = window.setTimeout(snapToNearest, 120)
    }
  }

  return (
    <div className="nearby-deck" role="region" aria-label="近くで開けることづて">
      {items.length === 0 ? (
        <div className="nearby-empty">
          <span className="nearby-empty__mark">
            <PigeonIcon width={22} height={22} />
          </span>
          <span className="nearby-empty__text">
            {hasPosition
              ? 'いまの場所には、開けることづてがありません。もう少し歩いて、ピンに近づいてみてください。'
              : '現在地を取得すると、近くで開けることづてがここに並びます。'}
          </span>
        </div>
      ) : (
        <div
          className="nearby-scroll"
          ref={scrollRef}
          onPointerDown={handlePointerDown}
          onClickCapture={handleClickCapture}
          onWheel={handleWheel}
        >
          {items.map((k) => {
            const kind = primaryKind(k)
            const active = highlightedId === k.id
            const group =
              k.visibility === 'group' && k.groupId
                ? groups.find((g) => g.id === k.groupId)
                : undefined
            return (
              <button
                key={k.id}
                ref={(el) => {
                  cardRefs.current[k.id] = el
                }}
                className={`nearby-card${active ? ' nearby-card--active' : ''}`}
                onClick={() => active ? onOpen(k.id) : onSelect(k.id)}
                aria-label={active ? `${KIND_SHORT[kind]}のことづてを開く` : `${KIND_SHORT[kind]}のことづて。地図のピンを表示`}
              >
                <span
                  className={`nearby-card__badge nearby-card__badge--${kind}`}
                  style={group ? { backgroundColor: group.avatarColor } : undefined}
                >
                  {group ? (
                    group.avatarImageUrl ? (
                      <img
                        src={group.avatarImageUrl}
                        alt=""
                        className="nearby-card__badge-img"
                      />
                    ) : (
                      <span className="nearby-card__badge-emoji">
                        {group.avatarEmoji}
                      </span>
                    )
                  ) : (
                    <PigeonIcon width={30} height={30} className="nearby-card__badge-pigeon" />
                  )}
                </span>
                <span className="nearby-card__body">
                  <span className="nearby-card__place">
                    {k.placeLabel ?? 'この場所のことづて'}
                  </span>
                  <span className="nearby-card__meta">
                    {k.authorName ?? 'なまえのない人'}さんから
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
