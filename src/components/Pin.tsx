import type { EnrichedKotozute } from '../lib/enrich'
import type { Group } from '../types'
import { formatDistance } from '../lib/geo'
import { groupBulbStyle, groupColorIndex } from '../lib/groupColor'
import { primaryKind } from '../lib/media'
import { PigeonIcon } from './icons'

const KIND_NAME = {
  text: 'ことば',
  image: '写真',
  video: '映像',
  audio: '声',
}

interface PinProps {
  kotozute: EnrichedKotozute
  /** グループ限定ことづての場合、その所属グループ（アイコン表示用） */
  group?: Pick<Group, 'avatarEmoji' | 'avatarColor' | 'avatarImageUrl'>
  /** 下部リストと連動した選択ハイライト中か */
  highlighted?: boolean
  onClick: () => void
}

/**
 * ことづてのピン（縦型のしずく型・伝書鳩モチーフ）。
 * - 近接状態（far / near / unlockable）で明るさ・脈動・光輪が変わる。
 * - 中身の種類は色アクセントと小さな種別チップで示す（伝書鳩はそのまま）。
 * - 距離ラベルは本体の上に余白をとって配置し、ピンと重ならない。
 */
export function Pin({ kotozute, group, highlighted = false, onClick }: PinProps) {
  const { proximity, distance, mine, visibility, groupId } = kotozute
  const kind = primaryKind(kotozute)
  const unlockable = proximity === 'unlockable'
  const isGroupOnly = visibility === 'group'
  // グループのアイコンをピンに表示する（色分けより分かりやすい）
  const showGroupIcon = isGroupOnly && !!group
  const groupIdx = isGroupOnly && groupId ? groupColorIndex(groupId) : null
  // 写真はバルブいっぱいに敷く。絵文字は周囲をグループ色で塗る（オレンジを見せない）。
  const bulbStyle = showGroupIcon
    ? group!.avatarImageUrl
      ? undefined
      : { background: group!.avatarColor, color: group!.avatarColor }
    : groupIdx !== null
      ? groupBulbStyle(groupIdx, proximity)
      : undefined

  const label = unlockable
    ? `${KIND_NAME[kind]}のことづてを開ける`
    : distance != null
      ? `${KIND_NAME[kind]}のことづて（あと約${formatDistance(distance)}）`
      : `${KIND_NAME[kind]}のことづて`

  return (
    <button
      type="button"
      className={`pin pin--${proximity} pin--kind-${kind}${
        mine ? ' pin--mine' : ''
      }${isGroupOnly ? ' pin--group' : ''}${highlighted ? ' pin--highlighted' : ''}`}
      onClick={onClick}
      aria-label={label}
    >
      {distance != null && proximity !== 'far' && (
        <span className="pin__distance">{formatDistance(distance)}</span>
      )}
      <span className="pin__bulb" style={bulbStyle}>
        {unlockable && <span className="pin__halo" aria-hidden />}
        {showGroupIcon ? (
          group!.avatarImageUrl ? (
            <img
              className="pin__group-img"
              src={group!.avatarImageUrl}
              alt=""
              aria-hidden
            />
          ) : (
            <span className="pin__group-emoji" aria-hidden>
              {group!.avatarEmoji}
            </span>
          )
        ) : (
          <PigeonIcon className="pin__pigeon" />
        )}
      </span>
    </button>
  )
}
