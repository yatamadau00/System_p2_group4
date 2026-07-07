import type { EnrichedKotozute } from '../lib/enrich'
import { formatDistance } from '../lib/geo'
import { primaryKind } from '../lib/media'
import {
  AudioIcon,
  ImageIcon,
  PigeonIcon,
  TextIcon,
  VideoIcon,
  LockIcon,
} from './icons'

const KIND_ICON = {
  text: TextIcon,
  image: ImageIcon,
  video: VideoIcon,
  audio: AudioIcon,
}

const KIND_NAME = {
  text: 'ことば',
  image: '写真',
  video: '映像',
  audio: '声',
}

interface PinProps {
  kotozute: EnrichedKotozute
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
export function Pin({ kotozute, highlighted = false, onClick }: PinProps) {
  const { proximity, distance, mine, visibility } = kotozute
  const kind = primaryKind(kotozute)
  const KindIcon = KIND_ICON[kind]
  const unlockable = proximity === 'unlockable'
  const multi = (kotozute.media ?? []).length > 1
  const isGroupOnly = visibility === 'group'

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
      <span className="pin__bulb">
        {unlockable && <span className="pin__halo" aria-hidden />}
        <PigeonIcon className="pin__pigeon" />
        <span className="pin__kind" aria-hidden>
          {isGroupOnly ? (
            <LockIcon width={12} height={12} style={{ strokeWidth: 2.2 }} />
          ) : multi ? (
            <span className="pin__kind-multi">＋</span>
          ) : (
            <KindIcon />
          )}
        </span>
      </span>
    </button>
  )
}
