// Vercel Serverless Function（Node ランタイム）。
// 指定ユーザーの購読端末すべてへ Web Push を送信する。
//
// 必要な環境変数（Vercel の Project Settings > Environment Variables）:
//   VAPID_PRIVATE_KEY       … VAPID 秘密鍵（絶対公開しない）
//   VITE_VAPID_PUBLIC_KEY   … VAPID 公開鍵（クライアントと共通）
//   VAPID_SUBJECT           … mailto:あなたのメール など
//   VITE_SUPABASE_URL       … Supabase プロジェクト URL（クライアントと共通）
//   VITE_SUPABASE_ANON_KEY  … Supabase anon キー（クライアントと共通）

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:example@example.com'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    res.status(500).json({ error: 'VAPID keys are not configured' })
    return
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ error: 'Supabase env is not configured' })
    return
  }

  // req.body は Vercel が JSON パース済み。文字列で来た場合にも備える。
  let payload = req.body
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }
  }

  const { userId, title, body, url, relatedId } = payload || {}
  if (!userId || !title) {
    res.status(400).json({ error: 'userId and title are required' })
    return
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (error) {
    res.status(500).json({ error: 'Failed to load subscriptions' })
    return
  }
  if (!subs || subs.length === 0) {
    res.status(200).json({ sent: 0, note: 'no subscriptions' })
    return
  }

  const notificationPayload = JSON.stringify({
    title,
    body: body || '',
    url: url || '/',
    relatedId: relatedId || null,
  })

  let sent = 0
  const staleEndpoints = []

  await Promise.all(
    subs.map(async (s) => {
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }
      try {
        await webpush.sendNotification(subscription, notificationPayload)
        sent += 1
      } catch (err) {
        // 404/410 は購読が無効。DBから掃除する。
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          staleEndpoints.push(s.endpoint)
        } else {
          console.warn('Push send failed:', err?.statusCode, err?.body)
        }
      }
    }),
  )

  if (staleEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints)
  }

  res.status(200).json({ sent, removed: staleEndpoints.length })
}
