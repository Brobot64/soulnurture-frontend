// Staff "Support requests" review queue — mirrors
// GET /api/v1/support-requests/queue (Natlas backend, figma PNA-4 node 146:914).
// A row carries four independent facts and renders each one separately: the
// stored lifecycle (`requestStatus`), the coarse NEW/REVIEWED chip split, the
// follow-up state, and the urgency the student asked for themselves. Collapsing
// any of them into another is what made statuses read wrong.

import { useEffect, useState } from 'react'

import { apiFetch } from '#/lib/api'

export const SUPPORT_REQUESTS_CHANGED = 'support-requests:changed'

function notifySupportRequestsChanged(): void {
  window.dispatchEvent(new Event(SUPPORT_REQUESTS_CHANGED))
}

/** The coarse chip split: has a professional acted on this yet? */
export type QueueStatus = 'NEW' | 'REVIEWED'

/** What `?status=` accepts. Chips are filters, not a partition — one row can
 * sit under "New" and "Follow-Up Required" at the same time. */
export type QueueFilter = QueueStatus | 'UNREAD' | 'FOLLOW_UP_REQUIRED' | 'FOLLOW_UP_COMPLETED'

export type FollowUpState = 'NONE' | 'REQUIRED' | 'COMPLETED'

export type Urgency = 'URGENT' | 'NORMAL'

export type SupportPrompt = 'REVIEW_SUGGESTED' | 'NONE'

export type SupportTiming =
  | 'GENTLE_1_2_DAYS'
  | 'TODAY_STUDY_PERIOD'
  | 'URGENT_UNSAFE'

/** Every stored lifecycle value, including the system-managed ones. */
export type RequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ESCALATED'

/** Statuses the review PATCH accepts (PENDING/ESCALATED are system-managed). */
export type ReviewStatus =
  | 'ACCEPTED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export interface SupportQueueStudent {
  id: string
  firstName: string
  lastName: string | null
  displayName: string | null
  classLabel: string | null
  studentCode: string | null
  studentRef: string | null
  email: string
}

export interface SupportQueueItem {
  id: string
  readAt: string | null
  requestedAt: string
  timing: SupportTiming
  note: string | null
  initialMessage: string | null
  initialMessageAt: string | null
  reviewNote: string | null
  /** The stored lifecycle — what actually happened to this request. */
  requestStatus: RequestStatus
  /** Coarse chip split only: NEW vs REVIEWED. */
  queueStatus: QueueStatus
  /** Independent of the chip split: is a follow-up open, done, or never booked. */
  followUpState: FollowUpState
  /** Did the student say they do not feel safe. Sorts the table. */
  urgency: Urgency
  prompt: SupportPrompt
  /** The arrangement the student already sees on their request page. */
  scheduledAt: string | null
  locationLabel: string | null
  followUpId: string | null
  followUpStatus: 'PENDING' | 'SCHEDULED' | null
  canManageFollowUp: boolean
  followUpDueAt: string | null
  followUpCompletedAt: string | null
  conversationId: string | null
  student: SupportQueueStudent
  supportPerson: { id: string; name: string; type: string } | null
}

export interface SupportQueueCounts {
  all: number
  unread: number
  awaitingUnread: number
  new: number
  reviewed: number
  followUpRequired: number
  /** Every completed follow-up, i.e. exactly the rows the chip shows. */
  followUpCompleted: number
  /** The tile: a narrower rolling 7-day window, so it can read lower. */
  completedThisWeek: number
}

export interface SupportQueueResponse {
  items: SupportQueueItem[]
  counts: SupportQueueCounts
}

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  NEW: 'New',
  REVIEWED: 'Reviewed',
}

export const FOLLOW_UP_STATE_LABELS: Record<FollowUpState, string> = {
  NONE: 'No follow-up',
  REQUIRED: 'Follow-up required',
  COMPLETED: 'Follow-up completed',
}

export const URGENCY_LABELS: Record<Urgency, string> = {
  URGENT: 'Urgent',
  NORMAL: 'Normal',
}

export const TIMING_LABELS: Record<SupportTiming, string> = {
  GENTLE_1_2_DAYS: 'In the next day or two',
  TODAY_STUDY_PERIOD: 'Today, during a study period',
  URGENT_UNSAFE: 'Right now — the student does not feel safe',
}

/** The lifecycle as the student’s own page words it, so both sides agree. */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ESCALATED: 'Escalated',
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  ACCEPTED: 'Accepted',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export async function fetchSupportQueue(filters: {
  status?: QueueFilter
  q?: string
}): Promise<SupportQueueResponse> {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return apiFetch<SupportQueueResponse>(`/api/v1/support-requests/queue${suffix}`)
}

export function fetchSupportQueueCounts(): Promise<SupportQueueCounts> {
  return apiFetch<SupportQueueCounts>('/api/v1/support-requests/queue/counts')
}

export async function markSupportRequestRead(id: string): Promise<{ readAt: string }> {
  const result = await apiFetch<{ readAt: string }>(
    `/api/v1/support-requests/${encodeURIComponent(id)}/read`,
    { method: 'POST' },
  )
  notifySupportRequestsChanged()
  return result
}

/** ACCEPTED reviews return the staff↔student chat opened for the request. */
export interface ReviewSupportRequestResult {
  chatThreadId?: string | null
}

/** SCHEDULED reviews must say when and where — the student page has a
 * "Schedule details" block that would otherwise stay empty forever. */
export type ReviewSupportRequestBody = {
  status: ReviewStatus
  reviewNote?: string
  scheduledAt?: string
  locationLabel?: string
}

export async function reviewSupportRequest(
  id: string,
  body: ReviewSupportRequestBody,
): Promise<ReviewSupportRequestResult> {
  const result = await apiFetch<ReviewSupportRequestResult>(
    `/api/v1/support-requests/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  )
  notifySupportRequestsChanged()
  return result
}

export async function bookFollowUp(body: {
  studentId: string
  supportRequestId: string
  dueAt: string
}): Promise<unknown> {
  const result = await apiFetch('/api/v1/follow-ups', {
    method: 'POST',
    body: JSON.stringify({ ...body, status: 'SCHEDULED' }),
  })
  notifySupportRequestsChanged()
  return result
}

export async function scheduleFollowUp(id: string, dueAt: string): Promise<unknown> {
  const result = await apiFetch(`/api/v1/follow-ups/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'SCHEDULED', dueAt }),
  })
  notifySupportRequestsChanged()
  return result
}

export async function completeFollowUp(id: string): Promise<unknown> {
  const result = await apiFetch(`/api/v1/follow-ups/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'COMPLETED' }),
  })
  notifySupportRequestsChanged()
  return result
}

/** Design format: "Amara N." — first name plus the last-name initial. */
export function shortName(
  student: Pick<SupportQueueStudent, 'firstName' | 'lastName' | 'displayName'>,
): string {
  const first = student.displayName?.trim() || student.firstName
  const initial = student.lastName?.trim()?.[0]
  return initial ? `${first} ${initial.toUpperCase()}.` : first
}

// ---------------------------------------------------------------------------
// Navigation counts: unread requests for the account currently using the rail.
//
// A read receipt says this staff member opened this request. It is distinct
// from NEW/REVIEWED (whether anyone has progressed it) and from urgent status:
// opening an escalation makes it read for one reviewer without acknowledging
// or removing it from the queue.
// ---------------------------------------------------------------------------

export function useSupportQueueCounts(userId: string): SupportQueueCounts | null {
  const [counts, setCounts] = useState<SupportQueueCounts | null>(null)

  useEffect(() => {
    let alive = true
    const refresh = () => {
      void fetchSupportQueueCounts()
        .then((next) => {
          if (alive) setCounts(next)
        })
        .catch(() => {
          // Keep the last known value. A failed refresh must not read as zero
          // unread work waiting for this professional.
        })
    }

    refresh()
    window.addEventListener(SUPPORT_REQUESTS_CHANGED, refresh)
    return () => {
      alive = false
      window.removeEventListener(SUPPORT_REQUESTS_CHANGED, refresh)
    }
  }, [userId])

  return counts
}
