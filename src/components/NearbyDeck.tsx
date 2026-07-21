import { useEffect, useRef } from 'react'
import type { EnrichedKotozute } from '../lib/enrich'
import type { Group } from '../types'
import { formatDistance } from '../lib/geo'
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

  // ピン側で選ばれたら、対応カードを中央へスクロール
  useEffect(() => {
    if (highlightedId && cardRefs.current[highlightedId]) {
      cardRefs.current[highlightedId]?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }
  }, [highlightedId])

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
        <div className="nearby-scroll">
          {items.map((k) => {
            const kind = primaryKind(k)
            const date = new Date(k.createdAt)
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
                    {KIND_SHORT[kind]}・{k.authorName ?? 'なまえのない人'}
                  </span>
                  <span className="nearby-card__sub">
                    {date.getMonth() + 1}月{date.getDate()}日
                    <span className="nearby-card__open">
                      {k.openedByCurrentUser ? '開封済み' : active ? 'タップで開く' : 'タップでピンを表示'}
                      （{formatDistance(k.distance ?? 0)}）
                    </span>
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
