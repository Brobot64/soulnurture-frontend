// The staff inbox: the school's PENDING pool on the left, the counsellor's own
// conversations on the right. Claiming moves a thread from pool to mine.

import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Inbox, MessagesSquare } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { ChatStatusTag } from '#/components/chat/ThreadView'
import {
  AvatarInitials,
  Button,
  EmptyState,
  ErrorNote,
  Skeleton,
} from '#/components/dash/ui'
import { PanelCard } from '#/components/dash/panels'
import { ApiError } from '#/lib/api'
import { CHAT_STAFF_ROLES } from '#/lib/auth'
import {
  claimChatThread,
  fetchChatInbox,
  fetchChatThreads,
  useChatUnread,
  type ChatThreadListItem,
} from '#/lib/chat'
import { timeAgo, useApiQuery, useRoleGuard } from '#/lib/dash'
import { onRealtimeEvent } from '#/lib/socket'

export const Route = createFileRoute('/_dash/school/inbox/')({
  head: () => ({ meta: [{ title: 'Inbox · Soul Nurture AI' }] }),
  component: SchoolInboxPage,
})

function SchoolInboxPage() {
  const user = useRoleGuard([...CHAT_STAFF_ROLES])
  if (!user) return null

  return (
    <>
      <DashHeader
        title="Inbox"
        subtitle="Student requests waiting for a professional"
      />
      <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <InboxPanels />
      </main>
    </>
  )
}

function InboxPanels() {
  const navigate = useNavigate()
  const pool = useApiQuery(fetchChatInbox)
  const mine = useApiQuery(fetchChatThreads)
  const unread = useChatUnread()
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)

  const { reload: reloadPool } = pool
  const { reload: reloadMine } = mine

  useEffect(() => {
    const unsubscribes = [
      onRealtimeEvent('chat.request.created', () => reloadPool()),
      onRealtimeEvent('chat.thread.claimed', () => {
        reloadPool()
        reloadMine()
      }),
      onRealtimeEvent('chat.message.new', () => reloadMine()),
      onRealtimeEvent('chat.thread.closed', () => reloadMine()),
    ]
    return () => unsubscribes.forEach((off) => off())
  }, [reloadPool, reloadMine])

  const handleClaim = async (thread: ChatThreadListItem) => {
    setClaimingId(thread.id)
    setClaimError(null)
    try {
      await claimChatThread(thread.id)
      void navigate({
        to: '/school/inbox/$threadId',
        params: { threadId: thread.id },
      })
    } catch (caught) {
      setClaimingId(null)
      setClaimError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not claim this request.',
      )
      reloadPool()
      reloadMine()
    }
  }

  return (
    <>
      {claimError && <ErrorNote>{claimError}</ErrorNote>}
      <div className="grid gap-6 lg:grid-cols-2">
        <PanelCard
          title="Waiting for pickup"
          action={
            pool.data && pool.data.length > 0 ? (
              <span className="text-copy-sm text-muted">
                {pool.data.length} {pool.data.length === 1 ? 'request' : 'requests'}
              </span>
            ) : undefined
          }
        >
          {pool.error && !pool.data ? (
            <RetryNote message={pool.error.message} onRetry={pool.reload} />
          ) : pool.loading && !pool.data ? (
            <SkeletonRows />
          ) : pool.data && pool.data.length > 0 ? (
            <ul className="flex flex-col divide-y divide-hairline">
              {pool.data.map((thread) => (
                <li key={thread.id}>
                  <PoolRow
                    thread={thread}
                    claiming={claimingId === thread.id}
                    disabled={claimingId !== null}
                    onClaim={() => void handleClaim(thread)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No requests waiting"
              body="New student requests land here the moment they're raised."
            />
          )}
        </PanelCard>

        <PanelCard title="Your conversations">
          {mine.error && !mine.data ? (
            <RetryNote message={mine.error.message} onRetry={mine.reload} />
          ) : mine.loading && !mine.data ? (
            <SkeletonRows />
          ) : mine.data && mine.data.length > 0 ? (
            <ul className="flex flex-col divide-y divide-hairline">
              {mine.data.map((thread) => (
                <li key={thread.id}>
                  <ConversationRow
                    thread={thread}
                    unread={unread.byThread[thread.id] ?? 0}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title="No conversations yet"
              body="Claim a request and it moves here for you to continue."
            />
          )}
        </PanelCard>
      </div>
    </>
  )
}

function PoolRow({
  thread,
  claiming,
  disabled,
  onClaim,
}: {
  thread: ChatThreadListItem
  claiming: boolean
  disabled: boolean
  onClaim: () => void
}) {
  const student = thread.student
  const name = student ? `${student.firstName} ${student.lastName}` : 'Student'
  const caption = student
    ? [student.classLabel, student.studentCode].filter(Boolean).join(' · ')
    : ''

  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <AvatarInitials name={name} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-card text-heading">{name}</p>
        {caption && <p className="truncate text-caption text-muted">{caption}</p>}
        <p className="mt-0.5 text-caption text-muted">
          {waitedFor(thread.createdAt)}
        </p>
      </div>
      <Button
        type="button"
        className="shrink-0"
        disabled={disabled}
        onClick={onClaim}
      >
        {claiming ? 'Claiming…' : 'Claim'}
      </Button>
    </div>
  )
}

function ConversationRow({
  thread,
  unread,
}: {
  thread: ChatThreadListItem
  unread: number
}) {
  const student = thread.student
  const name = student ? `${student.firstName} ${student.lastName}` : 'Student'
  const latest = thread.messages?.[0]
  const preview = latest
    ? `${latest.role === 'PROFESSIONAL' ? 'You: ' : ''}${latest.content}`
    : 'No messages yet'

  return (
    <Link
      to="/school/inbox/$threadId"
      params={{ threadId: thread.id }}
      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <AvatarInitials name={name} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-card text-heading">{name}</p>
          <ChatStatusTag status={thread.status} />
        </div>
        <p className="mt-0.5 truncate text-copy-sm text-muted">{preview}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-caption text-muted">
          {timeAgo(thread.updatedAt)}
        </span>
        {unread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-action px-1.5 text-[11px] font-semibold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>
    </Link>
  )
}

function RetryNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <ErrorNote>{message}</ErrorNote>
      <Button type="button" variant="ghost" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((key) => (
        <div key={key} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  )
}

function waitedFor(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60_000))
  if (minutes < 1) return 'Raised just now'
  if (minutes < 60) return `Waiting ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Waiting ${hours}h`
  return `Waiting ${Math.floor(hours / 24)}d`
}
