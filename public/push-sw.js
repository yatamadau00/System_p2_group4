/* eslint-disable no-undef */
// Web Push 用のハンドラ。vite-plugin-pwa が生成する sw.js から
// importScripts で読み込まれる（vite.config.ts の workbox.importScripts）。

// サーバー(/api/send-push)から送られたプッシュを受け取り、通知を表示する。
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'ことづて', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'ことづて'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // 同じ関連IDの通知はまとめる（連打防止）
    tag: data.tag || (data.relatedId ? `push_${data.relatedId}` : undefined),
    data: {
      url: data.url || '/',
      relatedId: data.relatedId || null,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// 通知タップで、既存タブがあればフォーカス、なければ開く。
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
        return undefined
      }),
  )
})
