import type { EnrichedKotozute } from '../lib/enrich'
import { formatDistance } from '../lib/geo'
import {
  AudioIcon,
  ImageIcon,
  LockIcon,
  TextIcon,
  VideoIcon,
} from './icons'

const KIND_ICON = {
  text: TextIcon,
  image: ImageIcon,
  video: VideoIcon,
  audio: AudioIcon,
}

interface PinProps {
  kotozute: EnrichedKotozute
  onClick: () => void
}

/**
 * ことづてのピン。近接状態（far / near / unlockable）で見た目と挙動が変わる。
 * 遠い＝くすんだ施錠、近い＝脈打つ琥珀、開封可能＝光輪をまとって灯る。
 */
export function Pin({ kotozute, onClick }: PinProps) {
  const { proximity, distance, mediaKind, mine } = kotozute
  const KindIcon = KIND_ICON[mediaKind]
  const unlockable = proximity === 'unlockable'

  const label = unlockable
    ? 'ことづてを開ける'
    : distance != null
      ? `ことづて（あと約${formatDistance(distance)}）`
      : 'ことづて'

  return (
    <button
      type="button"
      className={`pin pin--${proximity}${mine ? ' pin--mine' : ''}`}
      onClick={onClick}
      aria-label={label}
    >
      {unlockable && <span className="pin__halo" aria-hidden />}
      {distance != null && (
        <span className="pin__distance">{formatDistance(distance)}</span>
      )}
      <span className="pin__body">
        {unlockable ? (
          <KindIcon className="pin__icon" />
        ) : (
          <LockIcon className="pin__icon" />
        )}
      </span>
    </button>
  )
}
