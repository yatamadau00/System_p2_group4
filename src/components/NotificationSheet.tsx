import { useNotifications } from '../hooks/useNotifications'
import { Sheet } from './Sheet'
import { BellIcon, LockIcon, PigeonIcon, TrashIcon, CheckIcon, EnvelopeIcon } from './icons'
import './NotificationSheet.css'

interface NotificationSheetProps {
  onSelectKotozute: (id: string) => void
  onClose: () => void
}

export function NotificationSheet({ onSelectKotozute, onClose }: NotificationSheetProps) {
  const {
    notifications,
    permission,
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

  return (
    <Sheet title="通知" onClose={onClose}>
      <div className="notif-sheet">
        {/* ブラウザ通知設定への促しバナー */}
        {permission === 'default' && (
          <div className="notif-permission-banner">
            <div className="notif-permission-banner__text">
              <h4>プッシュ通知を有効にする</h4>
              <p>近くに言伝があるときに、画面を閉じていても通知を受け取れます。</p>
            </div>
            <button
              className="notif-permission-banner__btn btn-primary"
              onClick={requestPermission}
            >
              有効にする
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
              言伝の近くを通りかかったときや、新しい言伝が残されたときに通知が届きます。
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
