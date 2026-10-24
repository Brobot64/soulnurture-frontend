import { apiFetch } from '#/lib/api'
import type { ConversationStatus } from '#/lib/journey'

export const REVIEWER_ROLES = ['COUNSELLOR', 'PSYCHOLOGIST'] as const

export interface AiResponseReport {
  id: string
  messageId: string
  conversationId: string
  responseContent: string
  responseLanguage: string | null
  note: string | null
  reviewOutcome: ReviewOutcome | null
  reviewedAt: string | null
  reviewedBy: { name: string; role: string } | null
  createdAt: string
}

/** The reviewer's read of a reported reply. Record-only, mirroring the
 * server's AiReportReviewOutcome: none of these changes the AI's reply, the
 * student's conversation or the reported text. */
export const REVIEW_OUTCOMES = ['NO_CHANGE_NEEDED', 'FOLLOWED_UP_WITH_STUDENT', 'CANNOT_ASSESS'] as const

export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number]

export const REVIEW_OUTCOME_LABELS: Record<ReviewOutcome, string> = {
  NO_CHANGE_NEEDED: 'No change needed',
  FOLLOWED_UP_WITH_STUDENT: 'Followed up with the student',
  CANNOT_ASSESS: 'Cannot assess yet',
}

export type ReportReceipt = Pick<AiResponseReport, 'id' | 'messageId' | 'createdAt'>

export interface ReportPage {
  items: AiResponseReport[]
  nextOffset: number | null
}

export interface ReviewContext {
  id: string
  status: ConversationStatus
  language: string | null
  createdAt: string
  updatedAt: string
  messages: {
    id: string
    role: 'USER' | 'ASSISTANT'
    content: string
    language: string | null
    createdAt: string
  }[]
  summary: {
    id: string
    summary: string
    topics: string[]
    followUpHook: string | null
    emotionalTrend: string | null
    summaryLocalized: string | null
    followUpHookLocalized: string | null
    createdAt: string
  } | null
}

const root = '/api/v1/ai-response-reports'

export function submitAiResponseReport(input: { messageId: string; expectedContent: string; note?: string }) {
  return apiFetch<{ report: AiResponseReport; alreadyReported: boolean }>(root, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchReportReceipts(conversationId: string) {
  return apiFetch<{ items: ReportReceipt[] }>(`${root}/mine?conversationId=${encodeURIComponent(conversationId)}`)
}

export function fetchAiResponseReports(offset = 0) {
  return apiFetch<ReportPage>(`${root}?limit=20&offset=${offset}`)
}

export function fetchAiResponseReport(id: string) {
  return apiFetch<AiResponseReport>(`${root}/${encodeURIComponent(id)}`)
}

/** Records the reviewer's decision on the report itself. The server returns
 * the report as a reviewer sees it, so callers can render straight from it. */
export function recordAiResponseReportReview(id: string, outcome: ReviewOutcome) {
  return apiFetch<AiResponseReport>(`${root}/${encodeURIComponent(id)}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ outcome }),
  })
}

export function fetchReviewContext(conversationId: string) {
  return apiFetch<ReviewContext>(`/api/v1/conversations/${encodeURIComponent(conversationId)}/review-context`)
}
