// Staff "Support requests" review queue — mirrors
// GET /api/v1/support-requests/queue (Natlas backend, figma PNA-4 node 146:914).
// The backend derives the review-queue status from the schema lifecycles
// (request status + follow-up status); this module only renders it.

import { apiFetch } from '#/lib/api'

export type QueueStatus =
  | 'NEW'
  | 'REVIEWED'
  | 'FOLLOW_UP_REQUIRED'
  | 'FOLLOW_UP_COMPLETED'

export type SupportPrompt = 'REVIEW_SUGGESTED' | 'NONE'

export type SupportTiming =
  | 'GENTLE_1_2_DAYS'
  | 'TODAY_STUDY_PERIOD'
  | 'URGENT_UNSAFE'

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
  requestedAt: string
  timing: SupportTiming
  note: string | null
  initialMessage: string | null
  initialMessageAt: string | null
  reviewNote: string | null
  requestStatus: string
  queueStatus: QueueStatus
  prompt: SupportPrompt
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
  new: number
  reviewed: number
  followUpRequired: number
  followUpCompleted: number
}

export interface SupportQueueResponse {
  items: SupportQueueItem[]
  counts: SupportQueueCounts
}

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  NEW: 'New',
  REVIEWED: 'Reviewed',
  FOLLOW_UP_REQUIRED: 'Follow-Up Required',
  FOLLOW_UP_COMPLETED: 'Follow-Up Completed',
}

export const TIMING_LABELS: Record<SupportTiming, string> = {
  GENTLE_1_2_DAYS: 'In the next day or two',
  TODAY_STUDY_PERIOD: 'Today, during a study period',
  URGENT_UNSAFE: 'Right now — the student does not feel safe',
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  ACCEPTED: 'Accepted',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export async function fetchSupportQueue(filters: {
  status?: QueueStatus
  q?: string
}): Promise<SupportQueueResponse> {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return apiFetch<SupportQueueResponse>(`/api/v1/support-requests/queue${suffix}`)
}

/** ACCEPTED reviews return the staff↔student chat opened for the request. */
export interface ReviewSupportRequestResult {
  chatThreadId?: string | null
}

export async function reviewSupportRequest(
  id: string,
  body: { status: ReviewStatus; reviewNote?: string },
): Promise<ReviewSupportRequestResult> {
  return apiFetch<ReviewSupportRequestResult>(
    `/api/v1/support-requests/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  )
}

export function bookFollowUp(body: {
  studentId: string
  supportRequestId: string
  dueAt: string
}): Promise<unknown> {
  return apiFetch('/api/v1/follow-ups', {
    method: 'POST',
    body: JSON.stringify({ ...body, status: 'SCHEDULED' }),
  })
}

export function scheduleFollowUp(id: string, dueAt: string): Promise<unknown> {
  return apiFetch(`/api/v1/follow-ups/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'SCHEDULED', dueAt }),
  })
}

export async function completeFollowUp(id: string): Promise<unknown> {
  return apiFetch(`/api/v1/follow-ups/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'COMPLETED' }),
  })
}

/** Design format: "Amara N." — first name plus the last-name initial. */
export function shortName(student: SupportQueueStudent): string {
  const first = student.displayName?.trim() || student.firstName
  const initial = student.lastName?.trim()?.[0]
  return initial ? `${first} ${initial.toUpperCase()}.` : first
}
