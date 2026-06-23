import { createContext, useCallback, useEffect, useState, ReactNode } from 'react'
import type { AppNotification } from '../types'

interface NotificationContextType {
  notifications: AppNotification[]
  unreadCount: number
  permission: NotificationPermission
  requestPermission: () => Promise<NotificationPermission>
  addNotification: (
    title: string,
    message: string,
    type: 'near' | 'unlockable' | 'system' | 'received',
    relatedId?: string
  ) => AppNotification
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

export const NotificationContext = createContext<NotificationContextType | null>(null)

const LOCAL_STORAGE_KEY = 'kotozute_notifications'

export function NotificationProvider({ children }: { children: ReactNode }) {
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

  // 永続化
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notifications))
  }, [notifications])

  // 未読件数
  const unreadCount = notifications.filter((n) => !n.read).length

  // 通知許可のリクエスト
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'default'
    }
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  // 通知の追加とブラウザ通知の送信
  const addNotification = useCallback(
    (
      title: string,
      message: string,
      type: 'near' | 'unlockable' | 'system' | 'received',
      relatedId?: string
    ) => {
      const newNotif: AppNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title,
        message,
        type,
        relatedId,
        createdAt: Date.now(),
        read: false,
      }

      setNotifications((prev) => [newNotif, ...prev])

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
    []
  )

  // 既読化
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  // すべて既読
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })))
  }, [])

  // 削除
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  // すべて削除
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        permission,
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
