// The shared conversation surface — the staff inbox thread page and the
// student request page both mount this. REST for mutations, socket for live
// arrivals (deduped by message id), read receipts fired on load + on arrival.

import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { MessagesSquare, SendHorizontal } from 'lucide-react'

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
    endRef.current?.scrollIntoView({ block: 'end' })
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
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-5 py-4">
          <AvatarInitials name={headerTitle} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-card text-heading">{headerTitle}</span>
              <ChatStatusTag status={thread.status} />
            </div>
            <p className="mt-0.5 truncate text-copy-sm text-muted">{headerSubtitle}</p>
          </div>
          {thread.status !== 'CLOSED' && (
            <Button
              variant="ghost"
              className="h-9 px-4"
              onClick={() => setCloseOpen(true)}
            >
              {thread.status === 'PENDING' ? 'Cancel request' : 'Close chat'}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 px-5 py-5">
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
        <Card className="sticky bottom-4 z-10 flex flex-col gap-2 p-4">
          <label htmlFor={composerId} className="text-chip font-medium text-heading">
            {viewer === 'staff' ? 'Write a reply' : 'Write a message'}
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
              className="shrink-0 self-end px-5"
            >
              <SendHorizontal aria-hidden="true" className="size-4" />
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
          <p id={composerHintId} className="text-caption text-muted">
            Enter to send. Shift + Enter for a new line.
          </p>
        </Card>
      ) : thread.status === 'PENDING' ? (
        <>
          <Card className="flex items-center gap-3 p-5">
            <MessagesSquare aria-hidden="true" className="size-5 shrink-0 text-muted" />
            <p className="text-copy-sm text-muted">
              Waiting for a counsellor to pick up your request — you&rsquo;ll be able to
              write here as soon as they do.
            </p>
          </Card>
          {viewer === 'student' && (
            <Card className="flex flex-col gap-3 p-5">
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
        <Card className="flex items-center gap-3 p-5">
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
