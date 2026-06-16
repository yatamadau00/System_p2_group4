import type { MediaItem } from '../types'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { AudioIcon } from './icons'

/** 開封後の中身でメディアを種別ごとに描画する（1点ぶん） */
export function MediaView({ media }: { media: MediaItem }) {
  const url = useObjectUrl(media.blob, media.url)

  if (!url) return null

  if (media.kind === 'image') {
    return (
      <div className="letter__media">
        <img src={url} alt="このことづてに添えられた写真" />
      </div>
    )
  }

  if (media.kind === 'video') {
    return (
      <div className="letter__media">
        <video src={url} controls playsInline preload="metadata" />
      </div>
    )
  }

  if (media.kind === 'audio') {
    return (
      <div className="letter__audio">
        <AudioIcon width={32} height={32} style={{ color: 'var(--c-amber-deep)' }} />
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={url} controls preload="metadata" />
      </div>
    )
  }

  return null
}
