import { createContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react'
import type { AppNotification } from '../types'
import { useAuthContext } from './AuthContext'
import {
  canUseRemoteNotifications,
  clearRemoteNotifications,
  createRemoteNotification,
  listRemoteNotifications,
  markAllRemoteNotificationsAsRead,
  markRemoteNotificationAsRead,
  removeRemoteNotification,
} from '../services/notificationService'
import { canUsePush, sendPushToUser, subscribeToPush } from '../services/pushService'

interface NotificationContextType {
  notifications: AppNotification[]
  unreadCount: number
  permission: NotificationPermission
  browserNotificationSupported: boolean
  requestPermission: () => Promise<NotificationPermission>
  addNotification: (
    title: string,
    message: string,
    type: 'near' | 'unlockable' | 'system' | 'received',
    relatedId?: string,
    recipientUserId?: string
  ) => AppNotification
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

export const NotificationContext = createContext<NotificationContextType | null>(null)

const LOCAL_STORAGE_KEY = 'kotozute_notifications'

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuthContext()
  const remoteUserId = currentUser?.id ?? null
  const useRemote = useMemo(
    () => canUseRemoteNotifications(remoteUserId),
    [remoteUserId],
  )

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'default'
  })
  const browserNotificationSupported =
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window

  // 保存先を切り替える。ログイン中かつSupabase設定ありならDB、そうでなければ端末内。
  useEffect(() => {
    if (!useRemote || !remoteUserId) {
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
        setNotifications(stored ? JSON.parse(stored) : [])
      } catch {
        setNotifications([])
      }
      return
    }

    let cancelled = false
    listRemoteNotifications(remoteUserId)
      .then((list) => {
        if (!cancelled) setNotifications(list)
      })
      .catch((e) => {
        console.warn('Remote notifications could not be loaded:', e)
      })

    return () => {
      cancelled = true
    }
  }, [remoteUserId, useRemote])

  useEffect(() => {
    if (useRemote) return
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notifications))
  }, [notifications, useRemote])

  useEffect(() => {
    if (!browserNotificationSupported) return

    const syncPermission = () => setPermission(Notification.permission)
    window.addEventListener('focus', syncPermission)
    document.addEventListener('visibilitychange', syncPermission)
    return () => {
      window.removeEventListener('focus', syncPermission)
      document.removeEventListener('visibilitychange', syncPermission)
    }
  }, [browserNotificationSupported])

  // ログイン中かつ通知許可済みなら、この端末をWeb Pushに購読させる。
  // （閉じている間もサーバーからプッシュを受け取れるようにする）
  useEffect(() => {
    if (!remoteUserId || permission !== 'granted' || !canUsePush()) return
    subscribeToPush(remoteUserId).catch((e) => {
      console.warn('Push subscription failed:', e)
    })
  }, [remoteUserId, permission])

  // 未読件数
  const unreadCount = notifications.filter((n) => !n.read).length

  // 通知許可のリクエスト
  const requestPermission = useCallback(async () => {
    if (!browserNotificationSupported) {
      return 'default'
    }
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [browserNotificationSupported])

  // 通知の追加とブラウザ通知の送信
  const addNotification = useCallback(
    (
      title: string,
      message: string,
      type: 'near' | 'unlockable' | 'system' | 'received',
      relatedId?: string,
      recipientUserId?: string
    ) => {
      const targetUserId = recipientUserId ?? remoteUserId
      const newNotif: AppNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        message,
        type,
        relatedId,
        createdAt: Date.now(),
        read: false,
      }

      const shouldStoreLocally = !useRemote || !targetUserId || targetUserId === remoteUserId
      if (shouldStoreLocally) {
        setNotifications((prev) => [newNotif, ...prev])
      }

      if (useRemote && targetUserId) {
        createRemoteNotification(targetUserId, newNotif).catch((e) => {
          console.warn('Remote notification could not be saved:', e)
        })

        // 他ユーザー宛ての通知は、その人の端末へバックグラウンドプッシュも送る
        // （アプリを閉じていても届くように）。自分宛ては起動中に出るため送らない。
        if (targetUserId !== remoteUserId) {
          void sendPushToUser(targetUserId, {
            title,
            body: message,
            relatedId,
          })
        }
      }

      // ブラウザ標準の通知を送信する
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(title, {
            body: message,
            tag: relatedId ? `${type}_${relatedId}` : undefined,
          })


          // 通知クリックでアプリにフォーカスを当てるなど
          n.onclick = () => {
            window.focus()
            n.close()
          }
        } catch (e) {
          console.warn('Notification construction failed, might be in a mobile browser restriction:', e)
        }
      }

      return newNotif
    },
    [remoteUserId, useRemote]
  )

  // 既読化
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    if (useRemote && remoteUserId) {
      markRemoteNotificationAsRead(remoteUserId, id).catch((e) => {
        console.warn('Remote notification could not be marked as read:', e)
      })
    }
  }, [remoteUserId, useRemote])

  // すべて既読
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })))
    if (useRemote && remoteUserId) {
      markAllRemoteNotificationsAsRead(remoteUserId).catch((e) => {
        console.warn('Remote notifications could not be marked as read:', e)
      })
    }
  }, [remoteUserId, useRemote])

  // 削除
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (useRemote && remoteUserId) {
      removeRemoteNotification(remoteUserId, id).catch((e) => {
        console.warn('Remote notification could not be removed:', e)
      })
    }
  }, [remoteUserId, useRemote])

  // すべて削除
  const clearAll = useCallback(() => {
    setNotifications([])
    if (useRemote && remoteUserId) {
      clearRemoteNotifications(remoteUserId).catch((e) => {
        console.warn('Remote notifications could not be cleared:', e)
      })
    }
  }, [remoteUserId, useRemote])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        permission,
        browserNotificationSupported,
        requestPermission,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
