import type { GeoStatus } from '../types'
import { LocateIcon } from './icons'
import './GeoBanner.css'

interface GeoBannerProps {
  status: GeoStatus
  onRetry: () => void
}

/**
 * 位置情報の状態に応じた、上部の丁寧なフィードバック。
 * 取得中・拒否・非対応・エラーで、それぞれ専用のコピーとアクションを出す。
 * 'watching'（取得済み）のときは何も表示しない。
 */
export function GeoBanner({ status, onRetry }: GeoBannerProps) {
  if (status === 'watching') return null

  const content = (() => {
    switch (status) {
      case 'prompting':
      case 'idle':
        return {
          tone: 'info' as const,
          text: '現在地をさがしています…',
          action: null,
        }
      case 'denied':
        return {
          tone: 'warn' as const,
          text: '位置情報がオフのため、ことづてに近づけません。',
          sub: 'ブラウザの設定で許可すると、開封できるようになります。',
          action: { label: 'もう一度試す', onClick: onRetry },
        }
      case 'unavailable':
        return {
          tone: 'warn' as const,
          text: 'この端末では位置情報を使えません。',
          sub: '地図とことづては、引き続きご覧いただけます。',
          action: null,
        }
      case 'error':
      default:
        return {
          tone: 'warn' as const,
          text: '現在地をうまく取得できませんでした。',
          action: { label: 'もう一度試す', onClick: onRetry },
        }
    }
  })()

  return (
    <div className={`geo-banner geo-banner--${content.tone}`} role="status">
      <span className="geo-banner__icon">
        {content.tone === 'info' ? <span className="spinner" /> : <LocateIcon />}
      </span>
      <div className="geo-banner__text">
        <span>{content.text}</span>
        {'sub' in content && content.sub && (
          <small>{content.sub}</small>
        )}
      </div>
      {content.action && (
        <button className="geo-banner__action" onClick={content.action.onClick}>
          {content.action.label}
        </button>
      )}
    </div>
  )
}
