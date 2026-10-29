// The shared conversation surface — the staff inbox thread page and the
// student request page both mount this. REST for mutations, socket for live
// arrivals (deduped by message id), read receipts fired on load + on arrival.

import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { MessagesSquare, SendHorizontal, X } from 'lucide-react'

import {
  AvatarInitials,
  Button,
  Card,
  Dialog,
  ErrorNote,
  Skeleton,
  Tag,
  type TagTone,
} from '#/components/dash/ui'
import { ApiError } from '#/lib/api'
import {
  closeChatThread,
  fetchChatThread,
  markChatThreadRead,
  refreshChatUnread,
  sendChatMessage,
  type ChatMessage,
  type ChatMessageRole,
  type ChatThreadDetail,
  type ChatThreadStatus,
} from '#/lib/chat'
import { formatDay, formatTime } from '#/lib/dash'
import { onRealtimeEvent } from '#/lib/socket'

export const CHAT_STATUS_META: Record<
  ChatThreadStatus,
  { label: string; tone: TagTone }
> = {
  PENDING: { label: 'Waiting', tone: 'accent' },
  ACTIVE: { label: 'Active', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
}

export function ChatStatusTag({ status }: { status: ChatThreadStatus }) {
  const meta = CHAT_STATUS_META[status]
  return <Tag tone={meta.tone}>{meta.label}</Tag>
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dayLabel(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(date, now)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  return formatDay(iso)
}

export function ThreadView({
  threadId,
  viewer,
}: {
  threadId: string
  /** Which side of the conversation the viewer is on — flips bubbles. */
  viewer: 'student' | 'staff'
}) {
  const [thread, setThread] = useState<ChatThreadDetail | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const composerId = useId()
  const composerHintId = `${composerId}-hint`

  const myRole: ChatMessageRole = viewer === 'staff' ? 'PROFESSIONAL' : 'STUDENT'

  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(null)
    fetchChatThread(threadId)
      .then((detail) => {
        if (!alive) return
        setThread(detail)
        setMessages(detail.messages)
        setLoading(false)
        void markChatThreadRead(threadId)
          .then(() => refreshChatUnread())
          .catch(() => {})
      })
      .catch((error: unknown) => {
        if (!alive) return
        setLoadError(
          error instanceof ApiError ? error : new ApiError('Something went wrong.', 0),
        )
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [threadId, attempt])

  useEffect(() => {
    const offMessage = onRealtimeEvent('chat.message.new', (payload) => {
      if (payload.threadId !== threadId) return
      const incoming: ChatMessage = {
        id: payload.message.id,
        threadId,
        senderUserId: null,
        role: payload.message.role as ChatMessageRole,
        content: payload.message.content,
        viaVoice: payload.message.viaVoice,
        meta: null,
        createdAt: payload.message.createdAt,
      }
      setMessages((current) =>
        current.some((message) => message.id === incoming.id)
          ? current
          : [...current, incoming],
      )
      if (incoming.role !== myRole) {
        void markChatThreadRead(threadId)
          .then(() => refreshChatUnread())
          .catch(() => {})
      }
    })
    const offClaimed = onRealtimeEvent('chat.thread.claimed', (payload) => {
      if (payload.threadId !== threadId) return
      // A student's PENDING request just got picked up — refetch for the brief.
      void fetchChatThread(threadId)
        .then((detail) => {
          setThread(detail)
          setMessages(detail.messages)
        })
        .catch(() => {})
    })
    const offClosed = onRealtimeEvent('chat.thread.closed', (payload) => {
      if (payload.threadId !== threadId) return
      setThread((current) =>
        current
          ? { ...current, status: 'CLOSED', closedAt: new Date().toISOString() }
          : current,
      )
    })
    return () => {
      offMessage()
      offClaimed()
      offClosed()
    }
  }, [threadId, myRole])

  useEffect(() => {
    const end = endRef.current
    if (!end) return
    // Scroll the transcript box to its true bottom: `block:'end'` on the marker
    // only aligns it with the viewport, which is not the bottom of the box.
    let scroller: HTMLElement | null = end.parentElement
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement
    }
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight })
    else end.scrollIntoView({ block: 'end' })
  }, [messages.length, loading])

  const handleSend = () => {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setSendError(null)
    sendChatMessage(threadId, { content })
      .then((message) => {
        setMessages((current) =>
          current.some((row) => row.id === message.id) ? current : [...current, message],
        )
        setDraft('')
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError) {
          setSendError(error.message)
          if (error.code === 'CHAT_THREAD_CLOSED') {
            setThread((current) =>
              current ? { ...current, status: 'CLOSED' } : current,
            )
          }
        } else {
          setSendError('Something went wrong.')
        }
      })
      .finally(() => setSending(false))
  }

  const handleClose = () => {
    setClosing(true)
    setCloseError(null)
    closeChatThread(threadId)
      .then(() => {
        setThread((current) =>
          current
            ? { ...current, status: 'CLOSED', closedAt: new Date().toISOString() }
            : current,
        )
        setCloseOpen(false)
      })
      .catch((error: unknown) => {
        setCloseError(
          error instanceof ApiError ? error.message : 'Something went wrong.',
        )
      })
      .finally(() => setClosing(false))
  }

  if (loading) {
    return (
      <Card className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-16 w-2/3 self-end" />
        <Skeleton className="h-16 w-3/4" />
      </Card>
    )
  }

  if (loadError || !thread) {
    return (
      <Card className="flex flex-col gap-4">
        <ErrorNote>{loadError?.message ?? 'Something went wrong.'}</ErrorNote>
        <Button variant="ghost" className="w-fit" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </Button>
      </Card>
    )
  }

  const studentName = `${thread.student.firstName} ${thread.student.lastName}`.trim()
  const headerTitle =
    viewer === 'staff' ? studentName : thread.professional?.user.name ?? 'Waiting for a counsellor'
  const headerSubtitle =
    viewer === 'staff'
      ? [thread.student.classLabel, thread.student.studentCode].filter(Boolean).join(' · ')
      : thread.professional
        ? [thread.professional.title, thread.professional.department]
            .filter(Boolean)
            .join(' · ')
        : 'Response times depend on staff availability.'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* `min-h-0` on this card is what keeps the page still: without it the
          card's minimum is its content, so the transcript's full history height
          propagated up and the page became the scroller. Nothing here carries a
          height floor — the chrome is kept thin instead (see the mobile
          composer), because a floor plus a short screen only moves the clipping
          somewhere less obvious.
          `p-0!` because every child here carries its own padding, and the plain
          `p-0` lost to Card's base `p-6`: Tailwind emits padding utilities in
          ascending order, so the later class wins regardless of attribute
          order. The dead override left a 24px inset that cut the header's
          bottom border short of the card edges. */}
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0!">
        <div className="flex shrink-0 items-center gap-3 border-b border-hairline px-5 py-4">
          <AvatarInitials name={headerTitle} />
          <div className="min-w-0 flex-1">
            {/* One line for the name at every width: sharing it with the status
                tag left "A. Counsellor" truncated to "A…" on a 320px screen,
                which is the one thing a student needs to read here. */}
            <span className="block truncate text-card text-heading">{headerTitle}</span>
            <span className="mt-0.5 flex min-w-0 items-center gap-2">
              <span className="shrink-0">
                <ChatStatusTag status={thread.status} />
              </span>
              {/* The subtitle is the counsellor's title and department — worth a
                  line from sm up, but on a phone that line came off the
                  transcript. */}
              <span className="hidden min-w-0 truncate text-copy-sm text-muted sm:block">{headerSubtitle}</span>
            </span>
          </div>
          {thread.status !== 'CLOSED' && (
            // Icon-only below sm: the worded button left ~58px for the name, so
            // the header truncated to "A. …" and pushed the transcript down.
            <Button
              variant="ghost"
              aria-label={thread.status === 'PENDING' ? 'Cancel request' : 'Close chat'}
              className="h-9 shrink-0 px-3 sm:px-4"
              onClick={() => setCloseOpen(true)}
            >
              <X aria-hidden="true" className="size-4 sm:hidden" />
              <span className="hidden sm:inline">
                {thread.status === 'PENDING' ? 'Cancel request' : 'Close chat'}
              </span>
            </Button>
          )}
        </div>

        {/* The transcript: whatever the card has left after its header, and it
            scrolls here. `overscroll-contain` so reaching the top or bottom of
            the history does not start dragging the page. */}
        <div role="log" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-5">
          {messages.map((message, index) => {
            const previous = messages[index - 1]
            const newDay =
              !previous || previous.createdAt.slice(0, 10) !== message.createdAt.slice(0, 10)
            if (message.role === 'SYSTEM') {
              return (
                <Fragment key={message.id}>
                  {newDay && <DaySeparator label={dayLabel(message.createdAt)} />}
                  <div className="mx-auto max-w-[90%] rounded-card bg-panel px-4 py-2.5 text-center text-caption text-muted">
                    {message.content}
                  </div>
                </Fragment>
              )
            }
            const mine = message.role === myRole
            return (
              <Fragment key={message.id}>
                {newDay && <DaySeparator label={dayLabel(message.createdAt)} />}
                <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-copy-sm ${
                      mine ? 'bg-action text-white' : 'bg-panel text-ink'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                  <span className="mt-1 flex items-center gap-2 px-1 text-caption text-muted">
                    {formatTime(message.createdAt)}
                    {message.viaVoice && <Tag tone="info">Voice</Tag>}
                  </span>
                </div>
              </Fragment>
            )
          })}
          <div ref={endRef} />
        </div>
      </Card>

      {sendError && <ErrorNote>{sendError}</ErrorNote>}

      {thread.status === 'ACTIVE' ? (
        <Card className="shrink-0 flex flex-col gap-2 p-4">
          {/* The placeholder already reads "Write a message…", so the label is
              for the screen reader on a phone and for the eye from sm up. */}
          <label htmlFor={composerId} className="sr-only text-chip font-medium text-heading sm:not-sr-only">
            {viewer === 'staff' ? 'Write a reply' : 'Write a message'}
          </label>
          <div className="flex items-end gap-3">
            <textarea
              id={composerId}
              aria-describedby={composerHintId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSend()
                }
              }}
              rows={2}
              placeholder={viewer === 'staff' ? 'Write a reply…' : 'Write a message…'}
              className="min-h-11 min-w-0 flex-1 resize-none rounded-card border border-hairline bg-white px-4 py-3 text-copy-sm text-heading outline-none transition-colors placeholder:text-muted focus:border-brand-4"
            />
            <Button
              type="submit"
              disabled={!draft.trim() || sending}
              onClick={handleSend}
              aria-label={sending ? 'Sending' : viewer === 'staff' ? 'Send reply' : 'Send message'}
              className="shrink-0 px-4 sm:px-5"
            >
              <SendHorizontal aria-hidden="true" className="size-4" />
              {/* The worded button left the textarea ~110px wide on a 320px
                  screen, which wrapped its own placeholder to three lines. */}
              <span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span>
            </Button>
          </div>
          {/* The keyboard shortcut only exists on a keyboard, and the two rows
              it cost on a phone came straight off the transcript. */}
          <p id={composerHintId} className="hidden text-caption text-muted sm:block">
            Enter to send. Shift + Enter for a new line.
          </p>
        </Card>
      ) : thread.status === 'PENDING' ? (
        <>
          <Card className="flex shrink-0 items-center gap-3 p-5">
            <MessagesSquare aria-hidden="true" className="size-5 shrink-0 text-muted" />
            <p className="text-copy-sm text-muted">
              Waiting for a counsellor to pick up your request — you&rsquo;ll be able to
              write here as soon as they do.
            </p>
          </Card>
          {viewer === 'student' && (
            <Card className="flex shrink-0 flex-col gap-3 p-5">
              <h2 className="text-card text-heading">While you wait</h2>
              <Link to="/resources" className="inline-flex min-h-11 w-fit items-center rounded-pill text-button-sm text-action hover:underline underline-offset-4">
                Wellbeing resources
              </Link>
              <p className="text-copy-sm text-body">
                Soul Nurture AI is not an emergency service. If you are in danger, tell a trusted adult right away.
              </p>
            </Card>
          )}
        </>
      ) : (
        <Card className="flex shrink-0 items-center gap-3 p-5">
          <MessagesSquare aria-hidden="true" className="size-5 shrink-0 text-muted" />
          <p className="text-copy-sm text-muted">
            This chat has been closed. The history stays here for you to read.
          </p>
        </Card>
      )}

      <Dialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title={thread.status === 'PENDING' ? 'Cancel request' : 'Close chat'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>
              {thread.status === 'PENDING' ? 'Keep waiting' : 'Keep chatting'}
            </Button>
            <Button variant="danger" disabled={closing} onClick={handleClose}>
              {closing
                ? 'Closing…'
                : thread.status === 'PENDING'
                  ? 'Cancel request'
                  : 'Close chat'}
            </Button>
          </>
        }
      >
        <p className="text-copy-sm text-body">
          {thread.status === 'PENDING'
            ? 'This withdraws your request — no professional will pick it up.'
            : 'The conversation history stays readable, but no new messages can be sent.'}
        </p>
        {closeError && <ErrorNote className="mt-3">{closeError}</ErrorNote>}
      </Dialog>
    </div>
  )
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="mx-auto my-1 rounded-pill bg-panel-2 px-3 py-1 text-caption text-muted">
      {label}
    </div>
  )
}
