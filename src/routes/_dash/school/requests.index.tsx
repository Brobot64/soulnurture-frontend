// The staff "Support requests" review queue (figma PNA-4, node 146:914):
// stat tiles, filter chips with live counts, student search, and the review
// table. Each row shows the four facts the backend keeps separate — the stored
// lifecycle, the NEW/REVIEWED split, the follow-up state and the student's own
// urgency — instead of collapsing them into one pill. Rows open a review dialog
// that drives PATCH /v1/support-requests/:id (status, note, and the time and
// place once a request is scheduled) plus PATCH /v1/follow-ups/:id.

import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, CircleAlert, Inbox, TriangleAlert } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import {
  AvatarInitials,
  Button,
  Dialog,
  ErrorNote,
  Skeleton,
  TextField,
} from '#/components/dash/ui'
import { CHAT_STAFF_ROLES } from '#/lib/auth'
import { useApiQuery, useRoleGuard } from '#/lib/dash'
import { ApiError } from '#/lib/api'
import { supportTimestamp } from '#/lib/support-requests'
import {
  bookFollowUp,
  completeFollowUp,
  scheduleFollowUp,
  fetchSupportQueue,
  FOLLOW_UP_STATE_LABELS,
  QUEUE_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  reviewSupportRequest,
  shortName,
  TIMING_LABELS,
  type QueueFilter,
  type RequestStatus,
  type ReviewStatus,
  type ReviewSupportRequestBody,
  type SupportQueueItem,
  type SupportQueueResponse,
} from '#/lib/support-queue'

export const Route = createFileRoute('/_dash/school/requests/')({
  head: () => ({ meta: [{ title: 'Support requests · Soul Nurture AI' }] }),
  component: SupportRequestsPage,
})

const CHIPS: { value: QueueFilter | 'ALL'; label: string; countKey: keyof SupportQueueResponse['counts'] }[] = [
  { value: 'ALL', label: 'All', countKey: 'all' },
  { value: 'NEW', label: 'New', countKey: 'new' },
  { value: 'REVIEWED', label: 'Reviewed', countKey: 'reviewed' },
  { value: 'FOLLOW_UP_REQUIRED', label: 'Follow-Up Required', countKey: 'followUpRequired' },
  { value: 'FOLLOW_UP_COMPLETED', label: 'Follow-Up Completed', countKey: 'followUpCompleted' },
]

/** The stored lifecycle, colour-coded. A completed request must not read like
 * one that merely started, so the pill is the real status, not the chip. */
const REQUEST_STATUS_PILLS: Record<RequestStatus, string> = {
  PENDING: 'bg-peach text-peach-ink',
  ACCEPTED: 'bg-panel text-brand-4',
  SCHEDULED: 'bg-panel text-brand-4',
  IN_PROGRESS: 'bg-surface text-brand-4',
  COMPLETED: 'bg-action text-white',
  CANCELLED: 'bg-surface text-body',
  ESCALATED: 'bg-blush text-apricot-4',
}

function SupportRequestsPage() {
  const user = useRoleGuard([...CHAT_STAFF_ROLES])
  const [chip, setChip] = useState<QueueFilter | 'ALL'>('ALL')
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
          key={`${user.id}:${user.schoolId ?? user.school?.id ?? 'no-school'}`}
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
  chip: QueueFilter | 'ALL'
  onChipChange: (next: QueueFilter | 'ALL') => void
  search: string
  schoolName: string
}) {
  const queue = useApiQuery(
    () => fetchSupportQueue({ status: chip === 'ALL' ? undefined : chip, q: search }),
    [chip, search],
  )
  const [selected, setSelected] = useState<SupportQueueItem | null>(null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  const counts = queue.data?.counts

  return (
    <>
      {confirmation && <p role="status" className="text-copy-sm text-action">{confirmation}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile dotClass="bg-accent" label="New requests" value={counts?.new} />
        <StatTile dotClass="bg-action" label="Follow-up required" value={counts?.followUpRequired} />
        <StatTile dotClass="bg-action" label="Completed this week" value={counts?.completedThisWeek} />
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

      {counts && (
        <p className="text-caption text-muted">
          Each number is exactly the rows that chip shows. They overlap — a request can be
          New and still need a follow-up — so they do not add up to All.
        </p>
      )}

      {queue.error && (
        <div className="flex flex-col items-start gap-3">
          <ErrorNote>
            {queue.error.message}{queue.data ? ' Showing the last loaded requests.' : ''}
          </ErrorNote>
          <Button type="button" variant="ghost" onClick={queue.reload} disabled={queue.loading}>
            Try again
          </Button>
        </div>
      )}
      {queue.loading && !queue.data ? (
        <TableSkeleton />
      ) : queue.data ? (
        <RequestsTable
          items={queue.data.items}
          schoolName={schoolName}
          onSelect={(item) => {
            setConfirmation(null)
            setSelected(item)
          }}
        />
      ) : null}

      <ReviewDialog
        item={selected}
        onClose={() => setSelected(null)}
        onChanged={(message) => {
          setSelected(null)
          setConfirmation(message)
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
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_1.5rem] items-center gap-4 bg-panel px-6 py-3 text-chip font-medium text-body md:grid">
        <span>Student · urgency</span>
        <span>Requested</span>
        <span>Support prompt</span>
        <span>Request status</span>
        <span aria-hidden="true" />
      </div>
      <ul className="flex flex-col divide-y divide-hairline">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              // One row, two shapes. Below md the five columns cannot each hold
              // a pill, so the row stacks: identity on top, the meta fields on
              // a wrapped line under it. At md+ both wrapper spans become
              // `display: contents`, which hands their children to the grid and
              // restores the aligned table columns.
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-panel-2/50 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_1.5rem] md:gap-4 md:px-6"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-2 md:contents">
                <span className="flex min-w-0 items-center gap-3 md:flex-none">
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
                    {item.urgency === 'URGENT' && (
                      <span className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-blush px-2.5 py-0.5 text-chip font-medium text-apricot-4">
                        <TriangleAlert aria-hidden="true" className="size-3 shrink-0" />
                        Does not feel safe
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2 md:contents">
                  <span className="text-copy-sm text-body md:min-w-0 md:truncate">
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
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-pill px-3 py-1 text-chip font-medium ${REQUEST_STATUS_PILLS[item.requestStatus] ?? 'bg-surface text-body'}`}
                    >
                      {REQUEST_STATUS_LABELS[item.requestStatus] ?? item.requestStatus}
                    </span>
                    {item.followUpState !== 'NONE' && (
                      <span className="inline-flex items-center rounded-pill border border-hairline px-3 py-1 text-chip text-body">
                        {FOLLOW_UP_STATE_LABELS[item.followUpState]}
                      </span>
                    )}
                  </span>
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Everything the review dialog can change, in one snapshot, so “did this
 * professional actually change anything?” is one comparison. */
interface ReviewDraft {
  status: ReviewStatus | ''
  reviewNote: string
  scheduledAt: string
  locationLabel: string
}

function emptyDraft(): ReviewDraft {
  return { status: '', reviewNote: '', scheduledAt: '', locationLabel: '' }
}

/** What the row already says. PENDING and ESCALATED are not choices a
 * professional makes, so they open as “nothing picked yet”. */
function draftOf(item: SupportQueueItem): ReviewDraft {
  const stored = item.requestStatus as string
  return {
    status: stored in REVIEW_STATUS_LABELS ? (stored as ReviewStatus) : '',
    reviewNote: item.reviewNote ?? '',
    scheduledAt: item.scheduledAt ? localDateTime(item.scheduledAt) : '',
    locationLabel: item.locationLabel ?? '',
  }
}

function isUnchangedDraft(a: ReviewDraft, b: ReviewDraft): boolean {
  return (
    a.status === b.status &&
    a.reviewNote === b.reviewNote &&
    a.scheduledAt === b.scheduledAt &&
    a.locationLabel === b.locationLabel
  )
}

function ReviewDialog({
  item,
  onClose,
  onChanged,
}: {
  item: SupportQueueItem | null
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft)
  const [baseline, setBaseline] = useState<ReviewDraft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [dueAt, setDueAt] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!item) return
    const initial = draftOf(item)
    setDraft(initial)
    setBaseline(initial)
    setDueAt(item.followUpDueAt ? localDateTime(item.followUpDueAt) : '')
    setEditingSchedule(false)
    setError(null)
    setSaving(false)
  }, [item])

  if (!item) return null

  const studentName = shortName(item.student)
  const changed = !isUnchangedDraft(draft, baseline)
  const arrangementMissing =
    draft.status === 'SCHEDULED' && (!draft.scheduledAt || !draft.locationLabel.trim())
  const canSave =
    draft.status !== '' && changed && !arrangementMissing && !saving && !editingSchedule

  const patchDraft = (patch: Partial<ReviewDraft>) =>
    setDraft((current) => ({ ...current, ...patch }))

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setError(null)
    try {
      const body: ReviewSupportRequestBody = {
        status: draft.status as ReviewStatus,
        reviewNote: draft.reviewNote.trim() || undefined,
      }
      if (draft.status === 'SCHEDULED') {
        body.scheduledAt = new Date(draft.scheduledAt).toISOString()
        body.locationLabel = draft.locationLabel.trim()
      }
      const result = await reviewSupportRequest(item.id, body)
      setBaseline(draft)
      onChanged('Review saved.')
      // Accepting opens the staff↔student chat — land straight in it.
      if (draft.status === 'ACCEPTED' && result.chatThreadId) {
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
    if (saving || !item.followUpId || !item.canManageFollowUp) return
    setSaving(true)
    setError(null)
    try {
      await completeFollowUp(item.followUpId)
      onChanged('Follow-up completed.')
    } catch (caught) {
      setSaving(false)
      setError(
        caught instanceof ApiError ? caught.message : 'Could not complete the follow-up.',
      )
    }
  }

  const handleSchedule = async () => {
    if (saving || (item.followUpId && !item.canManageFollowUp)) return
    const date = new Date(dueAt)
    if (!dueAt || Number.isNaN(date.getTime())) {
      setError('Choose a date and time for the follow-up.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (item.followUpId) {
        await scheduleFollowUp(item.followUpId, date.toISOString())
      } else {
        await bookFollowUp({
          studentId: item.student.id,
          supportRequestId: item.id,
          dueAt: date.toISOString(),
        })
      }
      onChanged('Follow-up scheduled.')
    } catch (caught) {
      setSaving(false)
      setError(caught instanceof ApiError ? caught.message : 'Could not schedule the follow-up.')
    }
  }

  return (
    <Dialog
      open
      onClose={() => { if (!saving) onClose() }}
      title={`Review request · ${studentName}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            // No change, no write: opening the dialog must never leave an
            // accidental status progression one click away.
            disabled={!canSave}
          >
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
          <dt className="text-muted">Support person</dt>
          <dd className="text-heading">{item.supportPerson?.name ?? '—'}</dd>
          <dt className="text-muted">Request status</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-pill px-3 py-1 text-chip font-medium ${REQUEST_STATUS_PILLS[item.requestStatus] ?? 'bg-surface text-body'}`}
            >
              {REQUEST_STATUS_LABELS[item.requestStatus] ?? item.requestStatus}
            </span>
            <span className="text-caption text-muted">
              {QUEUE_STATUS_LABELS[item.queueStatus]}
            </span>
          </dd>
          <dt className="text-muted">Urgency</dt>
          <dd className="flex flex-wrap items-center gap-2 text-heading">
            {item.urgency === 'URGENT' ? (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-blush px-2.5 py-0.5 text-chip font-medium text-apricot-4">
                <TriangleAlert aria-hidden="true" className="size-3 shrink-0" />
                The student does not feel safe
              </span>
            ) : (
              'Normal'
            )}
            <span className="text-caption text-muted">
              Asked for {TIMING_LABELS[item.timing].toLowerCase()}
            </span>
          </dd>
          <dt className="text-muted">Follow-up</dt>
          <dd className="text-heading">{FOLLOW_UP_STATE_LABELS[item.followUpState]}</dd>
        </dl>

        <section className="rounded-card bg-panel-2/60 px-4 py-3">
          <h3 className="text-chip font-medium text-heading">Student’s original message</h3>
          {item.initialMessage ? (
            <>
              {item.initialMessageAt && (
                <time dateTime={item.initialMessageAt} className="mt-1 block text-caption text-muted">
                  {new Date(item.initialMessageAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </time>
              )}
              <blockquote className="mt-2 whitespace-pre-wrap break-words text-copy-sm text-body">{item.initialMessage}</blockquote>
            </>
          ) : (
            <p className="mt-2 text-copy-sm text-muted">No original student message was recorded for this request.</p>
          )}
        </section>

        {item.note?.trim() && item.note.trim() !== item.initialMessage?.trim() && (
          <section className="rounded-card border border-hairline px-4 py-3">
            <h3 className="text-chip font-medium text-heading">Request note</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-copy-sm text-body">{item.note}</p>
          </section>
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

        <section className="flex flex-col gap-3 rounded-card border border-hairline px-4 py-3" aria-label="Follow-up">
          <h3 className="text-chip font-medium text-heading">Follow-up</h3>
          {item.followUpId ? (
            <>
              <p className="text-copy-sm text-body">
                {item.followUpStatus === 'SCHEDULED' ? 'Scheduled' : 'Pending'}
                {item.followUpDueAt ? <> · <time dateTime={item.followUpDueAt}>{supportTimestamp(item.followUpDueAt)}</time></> : ' · No date set'}
              </p>
              {!item.canManageFollowUp && (
                <p className="text-caption text-muted">Only the professional assigned to this follow-up can change or complete it.</p>
              )}
            </>
          ) : (
            <p className="text-copy-sm text-body">
              {item.followUpCompletedAt
                ? `Previous follow-up completed ${supportTimestamp(item.followUpCompletedAt)}.`
                : 'No follow-up booked for this request.'}
            </p>
          )}
          {(!item.followUpId || item.canManageFollowUp) && (
            editingSchedule ? (
              <form onSubmit={(event) => { event.preventDefault(); void handleSchedule() }} className="flex flex-col gap-3">
                <TextField
                  label="Follow-up date and time"
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  required
                  disabled={saving}
                  hint="Times use your device’s time zone."
                />
                <p className="text-caption text-muted">
                  {item.followUpId ? 'This changes your follow-up only.' : 'This follow-up will be assigned to you.'} Review changes are saved separately.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Schedule follow-up'}</Button>
                  <Button variant="ghost" onClick={() => setEditingSchedule(false)} disabled={saving}>Cancel scheduling</Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => { setError(null); setEditingSchedule(true) }} disabled={saving}>
                  {item.followUpId ? 'Change follow-up date' : 'Book follow-up'}
                </Button>
                {item.followUpId && (
                  <Button variant="ghost" disabled={saving} onClick={() => void handleCompleteFollowUp()}>
                    Mark follow-up complete
                  </Button>
                )}
              </div>
            )
          )}
        </section>

        <fieldset disabled={saving || editingSchedule} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
          <label className="flex flex-col gap-1.5">
            <span className="text-chip font-medium text-heading">Review status</span>
            <select
              value={draft.status}
              // Empty is a real state, not a default: nothing is written until a
              // status is chosen deliberately.
              onChange={(event) => patchDraft({ status: event.target.value as ReviewStatus | '' })}
              className="h-11 rounded-card border border-hairline bg-white px-4 text-copy-sm text-heading outline-none transition-colors focus:border-brand-4"
            >
              <option value="">
                {item.requestStatus in REVIEW_STATUS_LABELS
                  ? `Current: ${REVIEW_STATUS_LABELS[item.requestStatus as ReviewStatus]}`
                  : `Current: ${REQUEST_STATUS_LABELS[item.requestStatus] ?? item.requestStatus}`}
              </option>
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
              value={draft.reviewNote}
              onChange={(event) => patchDraft({ reviewNote: event.target.value })}
              rows={1}
              maxLength={500}
              placeholder="What did you do about this request?"
              className="min-h-11 resize-none rounded-card border border-hairline bg-white px-4 py-2.5 text-copy-sm text-heading outline-none transition-colors placeholder:text-muted focus:border-brand-4"
            />
          </label>
        </fieldset>

        {draft.status === 'SCHEDULED' && (
          <fieldset disabled={saving || editingSchedule} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
            <TextField
              label="When you will meet"
              type="datetime-local"
              value={draft.scheduledAt}
              onChange={(event) => patchDraft({ scheduledAt: event.target.value })}
              required
              hint="Shown to the student in their own time zone."
            />
            <TextField
              label="Where"
              value={draft.locationLabel}
              onChange={(event) => patchDraft({ locationLabel: event.target.value })}
              maxLength={200}
              required
              placeholder="e.g. Counselling office, Block C"
              hint="The student sees this exactly as you write it."
            />
          </fieldset>
        )}

        <p className="text-caption text-muted">
          {!changed
            ? 'Nothing has changed yet — Save stays off until you do.'
            : draft.status === ''
              ? 'Choose a review status to save.'
              : arrangementMissing
                ? 'A scheduled request needs a time and a place — that is what the student will see.'
                : `Saves as “${REVIEW_STATUS_LABELS[draft.status as ReviewStatus]}”. The student is told the status changed; your note stays private.`}
        </p>

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

function localDateTime(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
