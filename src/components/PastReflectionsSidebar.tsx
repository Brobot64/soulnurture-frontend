import { Link } from '@tanstack/react-router'
import { PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import type { CheckInHistoryEntry } from '#/lib/journey'

function reflectionDate(createdAt: string) {
  const when = new Date(createdAt)
  return Number.isNaN(when.getTime())
    ? createdAt
    : when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function PastReflectionsSidebar({
  entries,
  activeConversationId = null,
  onCollapse,
  className = '',
}: {
  entries: CheckInHistoryEntry[]
  activeConversationId?: string | null
  onCollapse: () => void
  className?: string
}) {
  return (
    <aside
      aria-label="Past reflections"
      className={`hidden shrink-0 flex-col border-l border-hairline bg-white lg:flex lg:w-[320px] xl:w-[360px] ${className}`}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 pl-4 pr-2">
        <h2 className="text-chip font-semibold text-heading">Past reflections</h2>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Hide past reflections"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-panel hover:text-ink"
        >
          <PanelRightClose className="size-[18px]" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <PastReflectionsList activeConversationId={activeConversationId} entries={entries} />
      </div>
    </aside>
  )
}

export function PastReflectionsDrawer({
  entries,
  activeConversationId = null,
}: {
  entries: CheckInHistoryEntry[]
  activeConversationId?: string | null
}) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogId = useId()
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const desktop = window.matchMedia('(min-width: 64rem)')
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    const main = document.getElementById('main-content')
    const overflow = main?.style.overflow ?? ''
    if (main) main.style.overflow = 'hidden'
    dialog.showModal()
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      desktop.removeEventListener('change', closeOnDesktop)
      dialog.close()
      if (main) main.style.overflow = overflow
      if (!desktop.matches && triggerRef.current?.isConnected) {
        triggerRef.current.focus({ preventScroll: true })
      }
    }
  }, [open])

  return (
    <>
      <div className="sticky top-0 z-20 flex shrink-0 justify-end border-b border-hairline bg-page px-4 py-1 lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          aria-label="Show past reflections"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={dialogId}
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-chip font-medium text-action hover:bg-panel"
        >
          <PanelRightOpen className="size-5" aria-hidden="true" />
          Past reflections
        </button>
      </div>
      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        onCancel={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden overscroll-none border-0 bg-transparent p-0 text-body backdrop:bg-scrim/40"
      >
        <div className="ml-auto flex h-full w-[min(340px,calc(100%_-_48px))] flex-col border-l border-hairline bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl">
          <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-hairline pl-4 pr-2">
            <h2 id={titleId} className="text-chip font-semibold text-heading">Past reflections</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close past reflections"
              className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel hover:text-ink"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3"
            onClick={(event) => {
              if ((event.target as Element).closest('a[href]')) setOpen(false)
            }}
          >
            {open && (
              <PastReflectionsList activeConversationId={activeConversationId} entries={entries} />
            )}
          </div>
        </div>
      </dialog>
    </>
  )
}

// The rows every past-reflections surface shares: the check-in rail, the
// mobile drawer and the reflection page's desktop column. `dense` is the
// reflection column's tighter type scale; `activeConversationId` marks the
// reflection currently on screen.
export function PastReflectionsList({
  entries,
  activeConversationId = null,
  dense = false,
}: {
  entries: CheckInHistoryEntry[]
  activeConversationId?: string | null
  dense?: boolean
}) {
  const activeRef = useRef<HTMLAnchorElement | null>(null)
  // A highlight below the fold is invisible: when this list mounts (the drawer
  // opening, or the sidebar rendering), bring the viewed reflection into view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  if (entries.length === 0) {
    return (
      <p className="px-1 text-copy-sm text-muted">
        No past reflections yet — your closed conversations will show up here.
      </p>
    )
  }
  return (
    <div className={`flex flex-col ${dense ? 'gap-2.5' : 'gap-2'}`}>
      {entries.map((entry) => {
        const active = !!entry.conversationId && entry.conversationId === activeConversationId
        const body: ReactNode = (
          <>
            <p className="flex items-center gap-1.5 text-chip font-semibold text-ink">
              {active && (
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-action" />
              )}
              {reflectionDate(entry.createdAt)}
            </p>
            <p
              className={
                dense
                  ? 'mt-1 line-clamp-3 text-caption text-muted'
                  : 'mt-1 line-clamp-3 text-copy-sm text-muted'
              }
            >
              {entry.summary?.trim() || 'Summary on its way — check back soon.'}
            </p>
          </>
        )
        const rowClass = dense
          ? `rounded-2xl border px-4 py-3 ${
              active
                ? 'border-action/40 bg-panel'
                : 'border-hairline bg-white transition-colors hover:border-action/40'
            }`
          : `rounded-xl border px-3 py-2.5 ${
              active
                ? 'border-hairline bg-panel'
                : 'border-transparent transition-colors hover:border-hairline hover:bg-panel'
            }`
        if (!entry.conversationId) {
          return (
            <div key={entry.checkInId} className={rowClass}>
              {body}
            </div>
          )
        }
        return (
          <Link
            key={entry.checkInId}
            ref={active ? activeRef : undefined}
            to="/reflection/$conversationId"
            params={{ conversationId: entry.conversationId }}
            className={rowClass}
          >
            {body}
          </Link>
        )
      })}
    </div>
  )
}
