// The staff "Support requests" review queue (figma PNA-4, node 146:914):
// stat tiles, filter chips with live counts, student search, and the review
// table with prompt + queue-status pills. Rows open a review dialog that
// drives the existing PATCH /v1/support-requests/:id (status + note) and
// PATCH /v1/follow-ups/:id (complete a follow-up).

import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, CircleAlert, Inbox } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import {
  AvatarInitials,
  Button,
  Dialog,
  ErrorNote,
  Skeleton,
  Tag,
} from '#/components/dash/ui'
import { CHAT_STAFF_ROLES } from '#/lib/auth'
import { useApiQuery, useRoleGuard } from '#/lib/dash'
import { ApiError } from '#/lib/api'
import {
  completeFollowUp,
  fetchSupportQueue,
  QUEUE_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  reviewSupportRequest,
  shortName,
  TIMING_LABELS,
  type QueueStatus,
  type ReviewStatus,
  type SupportQueueItem,
  type SupportQueueResponse,
} from '#/lib/support-queue'

export const Route = createFileRoute('/_dash/school/requests/')({
  head: () => ({ meta: [{ title: 'Support requests · Soul Nurture AI' }] }),
  component: SupportRequestsPage,
})

const CHIPS: { value: QueueStatus | 'ALL'; label: string; countKey: keyof SupportQueueResponse['counts'] }[] = [
  { value: 'ALL', label: 'All', countKey: 'all' },
  { value: 'NEW', label: 'New', countKey: 'new' },
  { value: 'REVIEWED', label: 'Reviewed', countKey: 'reviewed' },
  { value: 'FOLLOW_UP_REQUIRED', label: 'Follow-Up Required', countKey: 'followUpRequired' },
  { value: 'FOLLOW_UP_COMPLETED', label: 'Follow-Up Completed', countKey: 'followUpCompleted' },
]

const STATUS_PILLS: Record<QueueStatus, string> = {
  NEW: 'bg-peach text-peach-ink',
  REVIEWED: 'bg-panel-2 text-body',
  FOLLOW_UP_REQUIRED: 'bg-blush text-apricot-4',
  FOLLOW_UP_COMPLETED: 'bg-action text-white',
}

function SupportRequestsPage() {
  const user = useRoleGuard([...CHAT_STAFF_ROLES])
  const [chip, setChip] = useState<QueueStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  if (!user) return null

  const schoolName = user.school?.name ?? 'your school'

  return (
    <>
      <DashHeader
        title="Support requests"
        subtitle={`Requests from students at ${schoolName} that need your review.`}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by Student ID/email',
        }}
      />
      <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <QueuePanels
          chip={chip}
          onChipChange={setChip}
          search={debouncedSearch}
          schoolName={schoolName}
        />
      </main>
    </>
  )
}

function QueuePanels({
  chip,
  onChipChange,
  search,
  schoolName,
}: {
  chip: QueueStatus | 'ALL'
  onChipChange: (next: QueueStatus | 'ALL') => void
  search: string
  schoolName: string
}) {
  const queue = useApiQuery(
    () => fetchSupportQueue({ status: chip === 'ALL' ? undefined : chip, q: search }),
    [chip, search],
  )
  const [selected, setSelected] = useState<SupportQueueItem | null>(null)

  const counts = queue.data?.counts

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile dotClass="bg-accent" label="New requests" value={counts?.new} />
        <StatTile dotClass="bg-action" label="Follow-up required" value={counts?.followUpRequired} />
        <StatTile dotClass="bg-action" label="Completed this week" value={counts?.followUpCompleted} />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {CHIPS.map((option) => {
          const active = chip === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChipChange(option.value)}
              className={`h-10 whitespace-nowrap rounded-pill border px-4 text-chip transition-colors ${
                active
                  ? 'border-action bg-action font-semibold text-white'
                  : 'border-hairline bg-white text-body hover:border-muted'
              }`}
            >
              {option.label} ({counts?.[option.countKey] ?? 0})
            </button>
          )
        })}
      </div>

      {queue.error && !queue.data ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorNote>{queue.error.message}</ErrorNote>
          <Button type="button" variant="ghost" onClick={queue.reload}>
            Try again
          </Button>
        </div>
      ) : queue.loading && !queue.data ? (
        <TableSkeleton />
      ) : (
        <RequestsTable items={queue.data?.items ?? []} schoolName={schoolName} onSelect={setSelected} />
      )}

      <ReviewDialog
        item={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          setSelected(null)
          queue.reload()
        }}
      />

      <p className="flex items-start gap-2 text-caption text-muted">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Support prompts are suggestions for human review. They are not diagnoses or
        decisions. You only see requests you are authorised to view.
      </p>
    </>
  )
}

function StatTile({
  dotClass,
  label,
  value,
}: {
  dotClass: string
  label: string
  value: number | undefined
}) {
  return (
    <div className="flex flex-col gap-2 rounded-panel border border-hairline bg-white p-5">
      <span className="flex items-center gap-2 text-chip text-muted">
        <span aria-hidden="true" className={`size-2 rounded-full ${dotClass}`} />
        {label}
      </span>
      {value === undefined ? (
        <Skeleton className="h-10 w-16" />
      ) : (
        <span className="text-title-lg tabular-nums text-heading">{value}</span>
      )}
    </div>
  )
}

function RequestsTable({
  items,
  schoolName,
  onSelect,
}: {
  items: SupportQueueItem[]
  schoolName: string
  onSelect: (item: SupportQueueItem) => void
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-hairline bg-panel-2/40 px-6 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-white text-muted">
          <Inbox aria-hidden="true" className="size-5" />
        </span>
        <p className="text-card text-heading">No requests in this view</p>
        <p className="max-w-md text-copy-sm text-muted">
          New student requests for {schoolName} land here as soon as they are raised.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-panel border border-hairline bg-white">
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_1.5rem] items-center gap-4 bg-panel px-6 py-3 text-chip font-medium text-body">
        <span>Student</span>
        <span>Requested</span>
        <span>Support prompt</span>
        <span>Status</span>
        <span aria-hidden="true" />
      </div>
      <ul className="flex flex-col divide-y divide-hairline">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_1.5rem] items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-panel-2/50"
            >
              <span className="flex min-w-0 items-center gap-3">
                <AvatarInitials name={shortName(item.student)} className="size-10" />
                <span className="min-w-0">
                  <span className="block truncate text-card text-heading">
                    {shortName(item.student)}
                  </span>
                  <span className="block truncate text-caption text-muted">
                    {[item.student.classLabel, item.student.studentCode]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </span>
              <span className="truncate text-copy-sm text-body">
                {requestedLabel(item.requestedAt)}
              </span>
              <span>
                {item.prompt === 'REVIEW_SUGGESTED' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-peach px-3 py-1 text-chip font-medium text-peach-ink">
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
                    Review suggested
                  </span>
                ) : (
                  <span className="text-copy-sm text-muted">No prompt</span>
                )}
              </span>
              <span>
                <span
                  className={`inline-flex items-center rounded-pill px-3 py-1 text-chip font-medium ${STATUS_PILLS[item.queueStatus]}`}
                >
                  {QUEUE_STATUS_LABELS[item.queueStatus]}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReviewDialog({
  item,
  onClose,
  onChanged,
}: {
  item: SupportQueueItem | null
  onClose: () => void
  onChanged: () => void
}) {
  const [status, setStatus] = useState<ReviewStatus>('ACCEPTED')
  const [reviewNote, setReviewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!item) return
    setStatus(
      item.requestStatus in REVIEW_STATUS_LABELS
        ? (item.requestStatus as ReviewStatus)
        : 'ACCEPTED',
    )
    setReviewNote(item.reviewNote ?? '')
    setError(null)
    setSaving(false)
  }, [item])

  if (!item) return null

  const studentName = shortName(item.student)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await reviewSupportRequest(item.id, {
        status,
        reviewNote: reviewNote.trim() || undefined,
      })
      onChanged()
      // Accepting opens the staff↔student chat — land straight in it.
      if (status === 'ACCEPTED' && result.chatThreadId) {
        void navigate({
          to: '/school/inbox/$threadId',
          params: { threadId: result.chatThreadId },
        })
      }
    } catch (caught) {
      setSaving(false)
      setError(caught instanceof ApiError ? caught.message : 'Could not save the review.')
    }
  }

  const handleCompleteFollowUp = async () => {
    if (!item.followUpId) return
    setSaving(true)
    setError(null)
    try {
      await completeFollowUp(item.followUpId)
      onChanged()
    } catch (caught) {
      setSaving(false)
      setError(
        caught instanceof ApiError ? caught.message : 'Could not complete the follow-up.',
      )
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Review request · ${studentName}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save review'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-copy-sm">
          <dt className="text-muted">Student</dt>
          <dd className="text-heading">
            {studentName}
            <span className="ml-2 text-caption text-muted">
              {[item.student.classLabel, item.student.studentCode].filter(Boolean).join(' · ')}
            </span>
          </dd>
          <dt className="text-muted">Email</dt>
          <dd className="truncate text-heading">{item.student.email}</dd>
          <dt className="text-muted">Requested</dt>
          <dd className="text-heading">{requestedLabel(item.requestedAt)}</dd>
          <dt className="text-muted">Timing</dt>
          <dd className="text-heading">{TIMING_LABELS[item.timing]}</dd>
          <dt className="text-muted">Support person</dt>
          <dd className="text-heading">{item.supportPerson?.name ?? '—'}</dd>
          <dt className="text-muted">Queue status</dt>
          <dd>
            <Tag tone="neutral">{QUEUE_STATUS_LABELS[item.queueStatus]}</Tag>
          </dd>
        </dl>

        {item.note && (
          <blockquote className="rounded-card bg-panel-2/60 px-4 py-3 text-copy-sm text-body">
            “{item.note}”
          </blockquote>
        )}

        {item.conversationId && (
          <Link
            to="/school/requests/$conversationId"
            params={{ conversationId: item.conversationId }}
            className="inline-flex items-center gap-1.5 text-chip font-medium text-action transition-colors hover:text-brand-4"
          >
            View the conversation this request came from
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}

        {item.followUpId && item.queueStatus === 'FOLLOW_UP_REQUIRED' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline px-4 py-3">
            <span className="text-copy-sm text-body">
              Follow-up due{' '}
              <span className="font-semibold text-heading">
                {item.followUpDueAt ? requestedLabel(item.followUpDueAt) : 'not scheduled'}
              </span>
            </span>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => void handleCompleteFollowUp()}
            >
              Mark follow-up complete
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-chip font-medium text-heading">Review status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ReviewStatus)}
              className="h-11 rounded-card border border-hairline bg-white px-4 text-copy-sm text-heading outline-none transition-colors focus:border-brand-4"
            >
              {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map((value) => (
                <option key={value} value={value}>
                  {REVIEW_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-chip font-medium text-heading">Review note</span>
            <textarea
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              rows={1}
              maxLength={500}
              placeholder="What did you do about this request?"
              className="min-h-11 resize-none rounded-card border border-hairline bg-white px-4 py-2.5 text-copy-sm text-heading outline-none transition-colors placeholder:text-muted focus:border-brand-4"
            />
          </label>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Dialog>
  )
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="flex items-center gap-3 rounded-panel border border-hairline bg-white px-6 py-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-24 rounded-pill" />
        </div>
      ))}
    </div>
  )
}

/** "Today, 09:14" · "Yesterday, 15:40" · "Mon 28 Sep". */
function requestedLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfThat = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diffDays = Math.round((startOfToday - startOfThat) / dayMs)
  if (diffDays === 0) {
    return `Today, ${timeOf(date)}`
  }
  if (diffDays === 1) {
    return `Yesterday, ${timeOf(date)}`
  }
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date)
  const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
  return `${weekday} ${dayMonth}`
}

function timeOf(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date)
}
