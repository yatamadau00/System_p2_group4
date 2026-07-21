import { useEffect, useMemo, useRef, useState } from 'react'
import type { EnrichedKotozute } from '../lib/enrich'
import type { Group } from '../types'
import { formatDistance } from '../lib/geo'
import { Sheet } from './Sheet'
import {
  EnvelopeIcon,
  TrashIcon,
  LockIcon,
  StarIcon,
} from './icons'
import './ListSheet.css'

interface ListSheetProps {
  items: EnrichedKotozute[]
  /** 参加中グループ（グループことづてのアイコン表示用） */
  groups: Group[]
  hasPosition: boolean
  savedScroll?: number
  savedTab?: 'all' | 'favorite' | 'mine'
  onSaveScroll?: (scrollTop: number) => void
  onSaveTab?: (tab: 'all' | 'favorite' | 'mine') => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onClose: () => void
}

export function ListSheet({
  items,
  groups,
  hasPosition,
  savedScroll = 0,
  savedTab = 'all',
  onSaveScroll,
  onSaveTab,
  onSelect,
  onDelete,
  onToggleFavorite,
  onClose,
}: ListSheetProps) {
  const [tab, setTab] = useState<'all' | 'favorite' | 'mine'>(savedTab)
  const [subFilter, setSubFilter] = useState<'unopened' | 'opened'>('unopened')
  const listRef = useRef<HTMLUListElement>(null)

  // マウント時にスクロール位置を復元
  useEffect(() => {
    if (savedScroll > 0) {
      const body = listRef.current?.closest('.sheet__body') as HTMLElement | null
      if (body) body.scrollTop = savedScroll
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    let filtered = items
    if (tab === 'mine') {
      filtered = items.filter((k) => k.mine)
    } else if (tab === 'favorite') {
      filtered = items.filter((k) => k.favoritedByCurrentUser)
    } else {
      // tab === 'all': 自分が書いたことづてを除外
      filtered = items.filter((k) => !k.mine)

      // サブフィルター
      if (subFilter === 'unopened') {
        filtered = filtered.filter((k) => !k.openedByCurrentUser)
      } else if (subFilter === 'opened') {
        filtered = filtered.filter((k) => k.openedByCurrentUser)
      }
    }

    return [...filtered].sort((a, b) => {
      if (tab === 'favorite') {
        if (!!a.openedByCurrentUser !== !!b.openedByCurrentUser) {
          return a.openedByCurrentUser ? 1 : -1
        }
      }
      const distA = a.distance ?? Infinity
      const distB = b.distance ?? Infinity
      if (distA !== distB) {
        return distA - distB
      }
      return b.createdAt - a.createdAt
    })
  }, [items, tab, subFilter])

  const getGroupName = (groupId?: string) => {
    if (!groupId) return 'グループ限定'
    const group = groups.find((g) => g.id === groupId)
    return group ? group.name : 'グループ限定'
  }

  return (
    <Sheet title="ことづて一覧" onClose={onClose}>
      <div className="segmented" role="tablist">
        <button
          role="tab"
          aria-pressed={tab === 'all'}
          onClick={() => setTab('all')}
        >
          みんなの
        </button>
        <button
          role="tab"
          aria-pressed={tab === 'mine'}
          onClick={() => setTab('mine')}
        >
          わたしの
        </button>
        <button
          role="tab"
          aria-pressed={tab === 'favorite'}
          onClick={() => setTab('favorite')}
        >
          お気に入り
        </button>
      </div>

      {tab === 'all' && (
        <div className="sub-segmented" role="tablist">
          <button
            role="tab"
            aria-pressed={subFilter === 'unopened'}
            onClick={() => setSubFilter('unopened')}
          >
            未開封
          </button>
          <button
            role="tab"
            aria-pressed={subFilter === 'opened'}
            onClick={() => setSubFilter('opened')}
          >
            開封済
          </button>
        </div>
      )}

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
        <ul className="cz-list" ref={listRef}>
          {list.map((k) => {
            const group =
              k.visibility === 'group' && k.groupId
                ? groups.find((g) => g.id === k.groupId)
                : undefined
            const statusText =
              k.openedByCurrentUser
                ? '開封済'
                : k.distance != null
                  ? formatDistance(k.distance)
                  : '距離不明'
            const subText = k.mine
              ? '— あなたのことづて'
              : k.authorName ? `— ${k.authorName}` : 'なまえのない誰かから'
            return (
              <li key={k.id}>
                <button className="cz-row" onClick={() => {
                  const body = listRef.current?.closest('.sheet__body') as HTMLElement | null
                  onSaveScroll?.(body?.scrollTop ?? 0)
                  onSaveTab?.(tab)
                  onSelect(k.id)
                }}>

                  <span className="cz-row__main">
                    <span className="cz-row__place" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {k.placeLabel ?? 'この場所のことづて'}
                      </span>
                      {k.visibility === 'group' && (
                        <span className="friend-only-badge" style={{ flexShrink: 0 }}>
                          <LockIcon width={10} height={10} style={{ marginRight: 2, display: 'inline-block', verticalAlign: 'middle' }} />
                          {getGroupName(k.groupId)}
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
