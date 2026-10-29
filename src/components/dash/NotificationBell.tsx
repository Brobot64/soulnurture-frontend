// Bell with a live unread badge and a popover of the latest notifications.

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Bell, X } from 'lucide-react'

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
  const [popoverTop, setPopoverTop] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const popoverId = useId()

  const closePopover = () => {
    setOpen(false)
    buttonRef.current?.focus({ preventScroll: true })
  }

  useLayoutEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const button = buttonRef.current
      if (!button) return
      const header = button.closest('header')
      setPopoverTop(Math.max(button.getBoundingClientRect().bottom, header?.getBoundingClientRect().bottom ?? 0) + 8)
    }
    updatePosition()
    const mobile = window.matchMedia('(width < 40rem)')
    const restoreDesktopFocus = () => {
      if (!mobile.matches) buttonRef.current?.focus({ preventScroll: true })
    }
    if (mobile.matches) closeButtonRef.current?.focus({ preventScroll: true })
    mobile.addEventListener('change', restoreDesktopFocus)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      mobile.removeEventListener('change', restoreDesktopFocus)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus({ preventScroll: true })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

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
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-haspopup="dialog"
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
            onClick={closePopover}
            className="fixed inset-0 z-40 touch-none bg-scrim/20 sm:bg-transparent"
          />
          <div
            id={popoverId}
            role="dialog"
            aria-label="Notifications"
            style={{ '--notifications-top': `${popoverTop}px` } as CSSProperties}
            className="fixed inset-x-3 top-[var(--notifications-top)] z-50 flex max-h-[min(70dvh,calc(100dvh-var(--notifications-top)-1rem-env(safe-area-inset-bottom)))] flex-col overflow-hidden rounded-panel border border-hairline bg-white shadow-xl sm:absolute sm:inset-auto sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[calc(100dvh-7rem)] sm:w-[360px] sm:max-w-[calc(100vw-2rem)]"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-4 py-2 sm:px-5 sm:py-3.5">
              <span className="text-card text-heading">Notifications</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={busy || unread === 0}
                  className="min-h-11 whitespace-nowrap text-chip text-action transition-colors hover:text-brand-4 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0"
                >
                  Mark all read
                </button>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={closePopover}
                  aria-label="Close notifications"
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-panel hover:text-heading sm:hidden"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="min-h-0 max-h-[420px] divide-y divide-hairline overflow-y-auto overscroll-contain">
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
                      <span className="mt-0.5 line-clamp-2 text-caption text-muted">
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
