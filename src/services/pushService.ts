import { VAPID_PUBLIC_KEY } from '../config'
import { isSupabaseConfigured, supabase } from './supabaseClient'

/**
 * Web Push の購読管理。
 * - 購読: Service Worker + PushManager でサブスクリプションを作り Supabase に保存
 * - 送信: /api/send-push（Vercel Function）に依頼
 *
 * 秘密鍵はサーバー側にのみ存在し、ここでは公開鍵しか扱わない。
 */

/** VAPID公開鍵(base64url) を Uint8Array に変換する（PushManager が要求する形式）。 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

/** この環境でプッシュ購読が使えるか（対応API・Supabase設定・VAPID鍵の有無）。 */
export function canUsePush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    isSupabaseConfigured &&
    VAPID_PUBLIC_KEY.trim().length > 0
  )
}

/**
 * 現在の端末をプッシュ購読し、Supabase に保存する。
 * すでに購読済みならその購読を再利用する。通知許可は事前に得ている前提。
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!canUsePush() || !supabase) return false
  if (Notification.permission !== 'granted') return false

  const registration = await navigator.serviceWorker.ready

  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })
  }

  const json = subscription.toJSON()
  const endpoint = json.endpoint
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!endpoint || !p256dh || !auth) return false

  // endpoint は端末ごとにユニーク。既存なら user_id を更新する。
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, endpoint, p256dh, auth },
      { onConflict: 'endpoint' },
    )
  if (error) {
    console.warn('Push subscription could not be saved:', error)
    return false
  }
  return true
}

/** 現在の端末の購読を解除し、保存済みレコードも削除する。 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!canUsePush() || !supabase) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  const endpoint = subscription.toJSON().endpoint
  await subscription.unsubscribe().catch(() => undefined)
  if (endpoint) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .then(undefined, (e) => console.warn('Push subscription cleanup failed:', e))
  }
}

interface PushPayload {
  title: string
  body: string
  url?: string
  relatedId?: string
}

/**
 * 指定ユーザーの全端末へプッシュ送信を依頼する（送信は /api/send-push が行う）。
 * fire-and-forget。失敗してもアプリ内通知は別途保存されるので致命的ではない。
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!VAPID_PUBLIC_KEY.trim()) return
  try {
    await fetch('/api/send-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...payload }),
    })
  } catch (e) {
    console.warn('Push send request failed:', e)
  }
}
