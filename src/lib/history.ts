import { ApiError, apiFetch } from '#/lib/api'
import type { ConversationStatus, FeelingIntensity, FeelingLabel, MessageRole } from '#/lib/journey'

/**
 * Epic H "My wellbeing history". Everything here mirrors what
 * `GET /api/v1/history` actually returns: a check-in, the reflection it led to
 * and the support request it produced. Nothing else is claimable — there is no
 * resource link in the schema, so no row says a resource was shared.
 */

export interface HistoryReflection {
  conversationId: string
  status: ConversationStatus
  startedAt: string
  turnCount: number
  /** True when any of the student's own turns came from a voice transcription. */
  viaVoice: boolean
  /** Only present once the conversation closed; null means it is still open. */
  summary: string | null
}

export interface HistorySupportRequest {
  id: string
  createdAt: string
  /** The raw lifecycle status, for the status chip. */
  status: string
  /** Derived by the server with the same functions the staff queue uses. */
  queueStatus: 'NEW' | 'REVIEWED'
  followUpState: 'NONE' | 'REQUIRED' | 'COMPLETED'
  urgency: 'URGENT' | 'NORMAL'
}

export interface HistoryEntry {
  checkInId: string
  createdAt: string
  feeling: FeelingLabel
  intensity: FeelingIntensity
  triggers: string[]
  reflection: HistoryReflection | null
  supportRequest: HistorySupportRequest | null
}

export interface HistoryResponse {
  items: HistoryEntry[]
  counts: { all: number; checkIns: number; reflections: number; supportRequests: number }
}

export interface HistoryMessage {
  id: string
  role: MessageRole
  content: string
  language: string | null
  viaVoice: boolean
  createdAt: string
}

export interface HistoryDetail extends HistoryEntry {
  description: string | null
  messages: HistoryMessage[]
}

export type HistoryTab = 'all' | 'check-ins' | 'reflections' | 'support'

export const HISTORY_TABS: { id: HistoryTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'check-ins', label: 'Check-ins' },
  { id: 'reflections', label: 'Reflections' },
  { id: 'support', label: 'Support requests' },
]

export function fetchHistory(): Promise<HistoryResponse> {
  return apiFetch<HistoryResponse>('/api/v1/history')
}

export function fetchHistoryEntry(checkInId: string): Promise<HistoryDetail> {
  return apiFetch<HistoryDetail>(`/api/v1/history/${checkInId}`)
}

/**
 * The student's own words for a feeling. `MOODS` in lib/journey covers only the
 * eight faces the check-in collects; a history row must name every stored label,
 * including the ones an older or differently-shaped check-in produced.
 */
const FEELING_TITLES: Record<FeelingLabel, string> = {
  OVERWHELMED: 'overwhelmed',
  ANXIOUS: 'anxious',
  TIRED: 'tired',
  SAD_LOW: 'low',
  CALM: 'calm',
  HOPEFUL: 'hopeful',
  GREAT: 'great',
  HAPPY: 'happy',
  PEACEFUL: 'peaceful',
  STRESSED: 'stressed',
  DOWN: 'down',
  ANGRY: 'angry',
}

export function feelingTitle(feeling: FeelingLabel): string {
  return FEELING_TITLES[feeling] ?? 'not recorded'
}

/** Typed vs voice is read off the stored flag, never inferred from the text. */
export function reflectionLane(entry: HistoryEntry): string | null {
  if (entry.reflection === null) return null
  return entry.reflection.viaVoice ? 'Voice reflection' : 'Typed reflection'
}

/**
 * The request's stage, from the same two derived fields the staff queue sorts
 * on. Phrased as a state, not a step: the app's own status guide says these
 * "show the current state of a request, not a guaranteed sequence", and a
 * numbered stepper would promise stages a request may never reach.
 */
export function requestStage(request: HistorySupportRequest): { label: string; detail: string } {
  if (request.followUpState === 'COMPLETED') {
    return { label: 'Follow-up completed', detail: 'The follow-up a professional planned has been recorded as finished.' }
  }
  if (request.followUpState === 'REQUIRED') {
    return { label: 'Follow-up required', detail: 'A professional has this and next steps are being arranged with you.' }
  }
  if (request.queueStatus === 'REVIEWED') {
    return { label: 'Reviewed', detail: 'A school professional has reviewed your request. A person decides what happens next — the AI does not.' }
  }
  return { label: 'New', detail: 'Your request has been sent and is waiting for a school professional to open it.' }
}

/* ── Deletion requests ─────────────────────────────────────────────────────
 * A student's ask, filed and read back. There is deliberately no status or
 * outcome field in this client or in the response: nothing has been decided,
 * and inventing a "reviewed" flag would be a promise the server cannot keep.
 * What IS reported is `alertedAt` — whether a person was actually told.       */

export const DELETION_SCOPES = ['ALL_HISTORY', 'BEFORE_DATE', 'SELECTED_CHECK_INS'] as const
export type DeletionScope = (typeof DELETION_SCOPES)[number]

export const DELETION_SCOPE_LABELS: Record<DeletionScope, string> = {
  ALL_HISTORY: 'All of my history',
  BEFORE_DATE: 'Check-ins before a date I choose',
  SELECTED_CHECK_INS: 'Only the check-ins I select',
}

export interface DeletionReceipt {
  id: string
  scope: DeletionScope
  beforeDate: string | null
  checkInIds: string[]
  note: string | null
  alertedAt: string | null
  createdAt: string
}

export function fetchDeletionRequests(): Promise<{ items: DeletionReceipt[] }> {
  return apiFetch<{ items: DeletionReceipt[] }>('/api/v1/history/deletion-requests')
}

export function requestHistoryDeletion(input: {
  scope: DeletionScope
  beforeDate?: string
  checkInIds?: string[]
  note?: string
}): Promise<DeletionReceipt> {
  return apiFetch<DeletionReceipt>('/api/v1/history/deletion-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

/* ── Fixed copy, kept in one place so a reviewer reads it once ───────────── */

export const HISTORY_INTRO =
  'Your past check-ins and reflections, and what happened with any support requests you sent. This is read from your own entries only — what a professional writes in their own review tools is never shown here.'

export const HISTORY_EMPTY =
  'After your first check-in, your feelings, reflections and the support requests you sent will appear here, so you can look back at them any time.'

/**
 * The retention line the design shows ("Entries are removed automatically after
 * your school's retention period") is NOT here, because no expiry job exists in
 * the server. Saying so is kinder than leaving a student to wait for a deletion
 * that will never arrive on its own.
 */
export const HISTORY_RETENTION_TRUTH =
  'Nothing here is removed on a timer. There is no automatic expiry running in this product, so an entry stays until a deletion request you make is agreed to by a person at your school.'

export const HISTORY_DELETION_NOTICE =
  'Your request is reviewed before anything is removed. Some information may need to be kept for safeguarding or legal reasons. Filing a request deletes nothing by itself.'

export const HISTORY_NOT_EMERGENCY =
  'Soul Nurture AI is not an emergency service and does not dispatch emergency help. If you are in danger right now, tell a trusted adult near you or use your school’s emergency contact.'
