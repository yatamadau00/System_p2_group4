import type { AppNotification } from '../types'
import { isSupabaseConfigured, supabase } from './supabaseClient'

interface NotificationRow {
  id: string
  recipient_id: string
  title: string
  message: string
  type: AppNotification['type']
  related_id: string | null
  read: boolean
  created_at: string
}

function rowToNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    relatedId: row.related_id ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    read: row.read,
  }
}

export function canUseRemoteNotifications(userId?: string | null) {
  return isSupabaseConfigured && !!userId
}

export async function listRemoteNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase!
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as NotificationRow[]).map(rowToNotification)
}

export async function createRemoteNotification(
  userId: string,
  notification: AppNotification,
) {
  const { error } = await supabase!
    .from('notifications')
    .insert({
      id: notification.id,
      recipient_id: userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      related_id: notification.relatedId ?? null,
      read: notification.read,
      created_at: new Date(notification.createdAt).toISOString(),
    })
  if (error) throw error
}

export async function markRemoteNotificationAsRead(userId: string, id: string) {
  const { error } = await supabase!
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('id', id)
  if (error) throw error
}

export async function markAllRemoteNotificationsAsRead(userId: string) {
  const { error } = await supabase!
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('read', false)
  if (error) throw error
}

export async function removeRemoteNotification(userId: string, id: string) {
  const { error } = await supabase!
    .from('notifications')
    .delete()
    .eq('recipient_id', userId)
    .eq('id', id)
  if (error) throw error
}

export async function clearRemoteNotifications(userId: string) {
  const { error } = await supabase!
    .from('notifications')
    .delete()
    .eq('recipient_id', userId)
  if (error) throw error
}
