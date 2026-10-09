// Notifications REST + the live unread badge store (same pattern as auth:
// module-level store, no provider).

import { useSyncExternalStore } from 'react'

import { apiFetch } from '#/lib/api'
import { getSocket, onRealtimeEvent } from '#/lib/socket'

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  data?: { threadId?: string; [key: string]: unknown } | null
  readAt?: string | null
  createdAt: string
}

let unreadCount = 0
const listeners = new Set<() => void>()

function setUnreadCount(count: number) {
  if (count === unreadCount) return
  unreadCount = count
  listeners.forEach((listener) => listener())
}

export async function fetchNotifications(
  unreadOnly = false,
): Promise<NotificationItem[]> {
  const { items } = await apiFetch<{ items: NotificationItem[] }>(
    `/api/v1/notifications${unreadOnly ? '?unread=true' : ''}`,
  )
  return items
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count } = await apiFetch<{ count: number }>(
    '/api/v1/notifications/unread-count',
  )
  return count
}

export async function refreshUnreadNotificationCount(): Promise<void> {
  try {
    setUnreadCount(await fetchUnreadNotificationCount())
  } catch {
    // Keep the last known count — the socket push will correct it.
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch(`/api/v1/notifications/${id}/read`, { method: 'POST' })
  void refreshUnreadNotificationCount()
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch('/api/v1/notifications/read-all', { method: 'POST' })
  void refreshUnreadNotificationCount()
}

export function useUnreadNotificationCount(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => unreadCount,
    () => 0,
  )
}

let watched = false

/** Idempotent boot: live count + fresh count on every (re)connect. */
export function watchNotifications(): void {
  if (watched || typeof window === 'undefined') return
  watched = true
  onRealtimeEvent('notification.unread.updated', (payload) =>
    setUnreadCount(payload.count),
  )
  getSocket()?.on('connect', () => {
    void refreshUnreadNotificationCount()
  })
  void refreshUnreadNotificationCount()
}
