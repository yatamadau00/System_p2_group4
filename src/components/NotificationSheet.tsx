import { useState } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { Sheet } from './Sheet'
import { BellIcon, LockIcon, PigeonIcon, TrashIcon, CheckIcon, EnvelopeIcon, CloseIcon } from './icons'
import './NotificationSheet.css'

interface NotificationSheetProps {
  onSelectKotozute: (id: string) => void
  onClose: () => void
}

const DENIED_NOTICE_DISMISSED_KEY = 'kotozute_notification_denied_notice_dismissed'

export function NotificationSheet({ onSelectKotozute, onClose }: NotificationSheetProps) {
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [deniedNoticeDismissed, setDeniedNoticeDismissed] = useState(() => {
    try {
      return localStorage.getItem(DENIED_NOTICE_DISMISSED_KEY) === 'true'
    } catch {
      return false
    }
  })
  const {
    notifications,
    permission,
    browserNotificationSupported,
    requestPermission,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications()

  const handleSelect = (notif: typeof notifications[0]) => {
    markAsRead(notif.id)
    if (notif.relatedId) {
      onSelectKotozute(notif.relatedId)
    }
  }

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp
    if (diff < 60000) return 'たった今'
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}分前`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}時間前`
    const days = Math.floor(hours / 24)
    return `${days}日前`
  }

  const renderIcon = (type: string) => {
    switch (type) {
      case 'near':
        return <PigeonIcon className="notif-item__icon notif-item__icon--near" />
      case 'unlockable':
        return <LockIcon className="notif-item__icon notif-item__icon--unlock" />
      case 'received':
        return <EnvelopeIcon className="notif-item__icon notif-item__icon--received" />
      default:
        return <BellIcon className="notif-item__icon notif-item__icon--system" />
    }
  }

  const handleRequestPermission = async () => {
    setRequestingPermission(true)
    try {
      await requestPermission()
    } finally {
      setRequestingPermission(false)
    }
  }

  const dismissDeniedNotice = () => {
    setDeniedNoticeDismissed(true)
    try {
      localStorage.setItem(DENIED_NOTICE_DISMISSED_KEY, 'true')
    } catch {
      // localStorage が使えない環境では、この表示中のシート内だけ閉じる。
    }
  }

  return (
    <Sheet title="通知" onClose={onClose}>
      <div className="notif-sheet">
        {/* ブラウザ通知設定への促しバナー */}
        {!browserNotificationSupported && (
          <div className="notif-permission-banner notif-permission-banner--muted">
            <div className="notif-permission-banner__text">
              <h4>ブラウザ通知は利用できません</h4>
              <p>この環境では通知 API が使えないため、アプリ内の通知一覧で確認してください。</p>
            </div>
          </div>
        )}

        {browserNotificationSupported && permission === 'default' && (
          <div className="notif-permission-banner">
            <div className="notif-permission-banner__text">
              <h4>プッシュ通知を有効にする</h4>
              <p>近くにことづてがあるときに、画面を閉じていても通知を受け取れます。</p>
            </div>
            <button
              className="notif-permission-banner__btn btn-primary"
              onClick={handleRequestPermission}
              disabled={requestingPermission}
            >
              {requestingPermission ? '確認中...' : '有効にする'}
            </button>
          </div>
        )}

        {browserNotificationSupported && permission === 'denied' && !deniedNoticeDismissed && (
          <div className="notif-permission-banner notif-permission-banner--muted">
            <div className="notif-permission-banner__text">
              <h4>ブラウザ通知がブロックされています</h4>
              <p>通知を受け取るには、ブラウザのサイト設定から通知を許可してください。</p>
            </div>
            <button
              className="notif-permission-banner__dismiss"
              onClick={dismissDeniedNotice}
              aria-label="通知ブロック案内を閉じる"
            >
              <CloseIcon width={16} height={16} />
            </button>
          </div>
        )}

        {/* コントロールバー */}
        {notifications.length > 0 && (
          <div className="notif-sheet__controls">
            <button className="notif-control-btn" onClick={markAllAsRead}>
              <CheckIcon width={16} height={16} />
              すべて既読にする
            </button>
            <button className="notif-control-btn notif-control-btn--danger" onClick={clearAll}>
              <TrashIcon width={16} height={16} />
              すべてクリア
            </button>
          </div>
        )}

        {/* 通知リスト */}
        {notifications.length === 0 ? (
          <div className="notif-sheet__empty">
            <BellIcon className="notif-sheet__empty-icon" width={48} height={48} />
            <p className="notif-sheet__empty-title">通知はありません</p>
            <p className="notif-sheet__empty-desc">
              ことづての近くを通りかかったときや、新しいことづてが残されたときに通知が届きます。
            </p>
          </div>
        ) : (
          <div className="notif-sheet__list">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`notif-item ${n.read ? 'notif-item--read' : 'notif-item--unread'} ${
                  n.relatedId ? 'notif-item--interactive' : ''
                }`}
                onClick={() => handleSelect(n)}
                role={n.relatedId ? 'button' : 'document'}
                tabIndex={n.relatedId ? 0 : undefined}
                onKeyDown={
                  n.relatedId
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleSelect(n)
                        }
                      }
                    : undefined
                }
              >
                {!n.read && <span className="notif-item__unread-dot" aria-label="未読" />}
                <div className="notif-item__icon-wrapper">{renderIcon(n.type)}</div>
                <div className="notif-item__content">
                  <div className="notif-item__header">
                    <span className="notif-item__title">{n.title}</span>
                    <span className="notif-item__time">{formatTime(n.createdAt)}</span>
                  </div>
                  <p className="notif-item__msg">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}
