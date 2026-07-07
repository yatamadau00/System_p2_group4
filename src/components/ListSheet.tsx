import { useMemo, useState } from 'react'
import type { EnrichedKotozute } from '../lib/enrich'
import { formatDistance } from '../lib/geo'
import { primaryKind } from '../lib/media'
import { Sheet } from './Sheet'
import {
  AudioIcon,
  EnvelopeIcon,
  ImageIcon,
  TextIcon,
  TrashIcon,
  VideoIcon,
  LockIcon,
  StarIcon,
} from './icons'
import './ListSheet.css'

const KIND_ICON = {
  text: TextIcon,
  image: ImageIcon,
  video: VideoIcon,
  audio: AudioIcon,
}

interface ListSheetProps {
  items: EnrichedKotozute[]
  hasPosition: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onClose: () => void
}

export function ListSheet({
  items,
  hasPosition,
  onSelect,
  onDelete,
  onToggleFavorite,
  onClose,
}: ListSheetProps) {
  const [tab, setTab] = useState<'all' | 'favorite' | 'mine'>('all')

  const list = useMemo(() => {
    const filtered =
      tab === 'mine'
        ? items.filter((k) => k.mine)
        : tab === 'favorite'
          ? items.filter((k) => k.favoritedByCurrentUser)
          : items
    return [...filtered].sort((a, b) => {
      if (tab === 'favorite') {
        if (!!a.openedByCurrentUser !== !!b.openedByCurrentUser) {
          return a.openedByCurrentUser ? 1 : -1
        }
      }
      if (a.distance != null && b.distance != null) return a.distance - b.distance
      return b.createdAt - a.createdAt
    })
  }, [items, tab])

  return (
    <Sheet title="ことづて一覧" onClose={onClose}>
      <div className="segmented" role="tablist">
        <button
          role="tab"
          aria-pressed={tab === 'all'}
          onClick={() => setTab('all')}
        >
          みんなのことづて
        </button>
        <button
          role="tab"
          aria-pressed={tab === 'mine'}
          onClick={() => setTab('mine')}
        >
          わたしのことづて
        </button>
        <button
          role="tab"
          aria-pressed={tab === 'favorite'}
          onClick={() => setTab('favorite')}
        >
          お気に入り
        </button>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <span className="empty__mark">
            <EnvelopeIcon width={28} height={28} />
          </span>
          <b>
            {tab === 'mine'
              ? 'まだ、ことづてを残していません'
              : tab === 'favorite'
                ? 'お気に入りはまだありません'
              : 'まだ、ことづてがありません'}
          </b>
          <p>
            {tab === 'mine'
              ? '思い出の場所に、最初のひとつを結んでみませんか。'
              : tab === 'favorite'
                ? '行きたい場所や、あとで開きたいことづてに星を付けておけます。'
              : 'この街のどこかに、誰かの想いが置かれるのを待っています。'}
          </p>
        </div>
      ) : (
        <ul className="cz-list">
          {list.map((k) => {
            const Icon = KIND_ICON[primaryKind(k)]
            const statusText =
              k.openedByCurrentUser
                ? '開封済み'
                : k.proximity === 'unlockable'
                ? '開封できます'
                : k.distance != null
                  ? formatDistance(k.distance)
                  : '距離不明'
            const subText = k.mine
              ? '— あなたのことづて'
              : k.authorName
                ? `— ${k.authorName}`
                : 'なまえのない誰かから'
            return (
              <li key={k.id}>
                <button className="cz-row" onClick={() => onSelect(k.id)}>
                  <span className={`cz-row__badge cz-row__badge--${k.proximity}`}>
                    <Icon />
                  </span>
                  <span className="cz-row__main">
                    <span className="cz-row__place" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {k.placeLabel ?? 'この場所のことづて'}
                      </span>
                      {k.visibility === 'group' && (
                        <span className="friend-only-badge" style={{ flexShrink: 0 }}>
                          <LockIcon width={10} height={10} style={{ marginRight: 2, display: 'inline-block', verticalAlign: 'middle' }} />
                          グループ限定
                        </span>
                      )}
                    </span>
                    <span className="cz-row__sub">{subText}</span>
                  </span>
                  {hasPosition || k.proximity === 'unlockable' ? (
                    <span className={`cz-row__status cz-row__status--${k.proximity}`}>
                      {statusText}
                    </span>
                  ) : null}
                  <span
                    role="button"
                    tabIndex={0}
                    className={`cz-row__favorite${k.favoritedByCurrentUser ? ' cz-row__favorite--active' : ''}`}
                    aria-label={
                      k.favoritedByCurrentUser
                        ? 'お気に入りから外す'
                        : 'お気に入りに追加'
                    }
                    aria-pressed={!!k.favoritedByCurrentUser}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFavorite(k.id)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        e.stopPropagation()
                        onToggleFavorite(k.id)
                      }
                    }}
                  >
                    <StarIcon width={18} height={18} filled={!!k.favoritedByCurrentUser} />
                  </span>
                  {k.mine && (
                    <span
                      role="button"
                      tabIndex={0}
                      className="cz-row__delete"
                      aria-label="このことづてを削除"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('このことづてを取り消しますか？')) onDelete(k.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          if (confirm('このことづてを取り消しますか？')) onDelete(k.id)
                        }
                      }}
                    >
                      <TrashIcon width={18} height={18} />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
