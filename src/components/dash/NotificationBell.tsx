// Bell with a live unread badge and a popover of the latest notifications.

import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Bell } from 'lucide-react'

import { Spinner } from '#/components/StatusBadge'
import { isChatStaff, refreshSession, useSession } from '#/lib/auth'
import { timeAgo } from '#/lib/dash'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  useUnreadNotificationCount,
  watchNotifications,
  type NotificationItem,
} from '#/lib/notifications'
import { onRealtimeEvent } from '#/lib/socket'

export function NotificationBell() {
  const navigate = useNavigate()
  const { user } = useSession()
  const unread = useUnreadNotificationCount()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    watchNotifications()
  }, [])

  useEffect(() => {
    if (!open) return
    let alive = true
    setBusy(true)
    fetchNotifications(false)
      .then((rows) => {
        if (alive) setItems(rows)
      })
      .catch(() => {
        if (alive) setItems([])
      })
      .finally(() => {
        if (alive) setBusy(false)
      })
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    return onRealtimeEvent('notification.new', (push) => {
      setItems((current) => {
        if (!current || current.some((item) => item.id === push.id)) return current
        return [
          { ...push, createdAt: new Date().toISOString(), readAt: null },
          ...current,
        ]
      })
    })
  }, [])

  const handleOpen = (item: NotificationItem) => {
    setOpen(false)
    if (!item.readAt) {
      void markNotificationRead(item.id)
      setItems(
        (current) =>
          current?.map((row) =>
            row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row,
          ) ?? current,
      )
    }
    if (item.type === 'SCHOOL_SUSPENDED') {
      void refreshSession()
      return
    }
    if (item.type.startsWith('CHAT')) {
      const threadId = item.data?.threadId
      if (isChatStaff(user?.role)) {
        // A PENDING request isn't the professional's thread yet — the pool is where it lives.
        if (threadId && item.type !== 'CHAT_REQUEST') {
          void navigate({ to: '/school/inbox/$threadId', params: { threadId } })
        } else {
          void navigate({ to: '/school/inbox' })
        }
      } else if (threadId) {
        void navigate({ to: '/support/$threadId', params: { threadId } })
      } else {
        void navigate({ to: '/support' })
      }
    }
  }

  const handleMarkAll = async () => {
    setBusy(true)
    try {
      await markAllNotificationsRead()
      const now = new Date().toISOString()
      setItems((current) => current?.map((row) => ({ ...row, readAt: now })) ?? current)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        className="relative flex size-11 items-center justify-center rounded-full border border-hairline bg-white text-heading transition-colors hover:bg-panel"
      >
        <Bell aria-hidden="true" className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-panel border border-hairline bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
              <span className="text-card text-heading">Notifications</span>
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={busy || unread === 0}
                className="text-chip text-action transition-colors hover:text-brand-4 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark all read
              </button>
            </div>

            <div className="max-h-[420px] divide-y divide-hairline overflow-y-auto">
              {items === null ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner className="size-5 text-brand-4" />
                </div>
              ) : items.length === 0 ? (
                <p className="px-5 py-10 text-center text-copy-sm text-muted">
                  You&rsquo;re all caught up.
                </p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleOpen(item)}
                    className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-panel/60"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        item.readAt ? 'bg-transparent' : 'bg-action'
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-copy-sm font-medium text-heading">
                        {item.title}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-caption text-muted">
                        {item.body}
                      </span>
                      <span className="mt-1 block text-caption text-muted">
                        {timeAgo(item.createdAt)}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
