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
  /** Null far more often than not: see `HistoryPage` — never read as "no request". */
  checkInId: string | null
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
  /**
   * The student's requests read from `support_request` by student, not through
   * the check-in link. The link is nullable and the escalation path never fills
   * it, so counting requests off `items` reported zero for students who had
   * asked for help.
   */
  supportRequests: HistorySupportRequest[]
  counts: {
    all: number
    checkIns: number
    reflections: number
    supportRequests: number
  }
  page: { take: number; hasMore: boolean; nextBefore: string | null }
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

/**
 * One page of the timeline. `before` is the cursor the previous response handed
 * back: the list is walked backwards a page at a time rather than fetched whole,
 * which is what let a long history grow the page forever.
 */
export function fetchHistory(cursor?: { before?: string | null }): Promise<HistoryResponse> {
  const params = new URLSearchParams()
  if (cursor?.before) params.set('before', cursor.before)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return apiFetch<HistoryResponse>(`/api/v1/history${suffix}`)
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
 * A student's ask, read back with the state it reached. The decision is the
 * student's: a person at the school is told, not asked to approve, and there is
 * deliberately no "reviewed"/"approved" field to invent. What the server
 * actually reports is a schedule (`scheduledPurgeAt`), the undo (`cancelledAt`),
 * the outcome (`purgedAt` and the counts it removed), `holdReason` when the
 * account could not be erased, and `alertedAt` — whether a person was told.   */

export const DELETION_SCOPES = ['ALL_HISTORY', 'BEFORE_DATE', 'SELECTED_CHECK_INS'] as const
export type DeletionScope = (typeof DELETION_SCOPES)[number]

export const DELETION_SCOPE_LABELS: Record<DeletionScope, string> = {
  ALL_HISTORY: 'All of my history',
  BEFORE_DATE: 'Check-ins before a date I choose',
  SELECTED_CHECK_INS: 'Only the check-ins I select',
}

/**
 * What "all of my history" really takes, said in full wherever it is offered.
 * The account-wide erasure is the one ask that cannot be answered casually: it
 * goes the login, the safeguarding record and all of it.
 */
export const DELETION_ACCOUNT_WARNING =
  'This removes the whole account — every check-in, reflection, chat, journal entry, support request and safeguarding record, and your login itself. A person at your school is told, not asked to approve. After the 24 hours are up it cannot be undone.'

export interface DeletionReceipt {
  id: string
  scope: DeletionScope
  beforeDate: string | null
  checkInIds: string[]
  note: string | null
  alertedAt: string | null
  /** When the removal runs. While this is in the future, the student can stop it. */
  scheduledPurgeAt: string | null
  cancelledAt: string | null
  purgedAt: string | null
  holdReason: string | null
  removedCheckIns: number
  removedConversations: number
  createdAt: string
}

export type DeletionState = 'scheduled' | 'cancelled' | 'removed' | 'held'

/** `purgedAt` wins the ordering: a cancel that arrived late is still an erasure. */
export function deletionState(receipt: DeletionReceipt): DeletionState {
  if (receipt.purgedAt) return 'removed'
  if (receipt.cancelledAt) return 'cancelled'
  if (receipt.holdReason) return 'held'
  return 'scheduled'
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

export function cancelHistoryDeletion(requestId: string): Promise<DeletionReceipt> {
  return apiFetch<DeletionReceipt>(`/api/v1/history/deletion-requests/${requestId}/cancel`, {
    method: 'POST',
  })
}

/** Whole minutes the student still has, floored at zero. */
export function undoMinutesLeft(scheduledPurgeAt: string | null, now: number): number {
  if (!scheduledPurgeAt) return 0
  const at = new Date(scheduledPurgeAt).getTime()
  if (Number.isNaN(at)) return 0
  return Math.max(0, Math.floor((at - now) / 60_000))
}

function formatUndoWindow(minutes: number): string {
  if (minutes <= 0) return 'any moment now'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const tail = rest ? ` ${rest} minute${rest === 1 ? '' : 's'}` : ''
  return hours ? `${hours} hour${hours === 1 ? '' : 's'}${tail}` : `${rest} minute${rest === 1 ? '' : 's'}`
}

function deletionDay(iso: string): string {
  const when = new Date(iso)
  return Number.isNaN(when.getTime())
    ? iso
    : when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const HOLD_LINES: Record<string, string> = {
  ACCOUNT_INACTIVE:
    'On hold, and nothing was erased. This account cannot sign in right now, so cancelling would not have been possible — we do not remove history from someone who cannot reach the undo.',
  SCHOOL_SUSPENDED:
    'On hold, and nothing was erased. Your school is suspended right now, so the ask stays scheduled until it is back.',
}

/** The one line that says where this ask actually got to. */
export function deletionStateLine(receipt: DeletionReceipt, now: number): string {
  switch (deletionState(receipt)) {
    case 'removed':
      return `Removed on ${deletionDay(receipt.purgedAt ?? '')} — ${receipt.removedCheckIns} check-in(s) and ${receipt.removedConversations} reflection(s) went.`
    case 'cancelled':
      return `Cancelled on ${deletionDay(receipt.cancelledAt ?? '')}. Nothing was removed.`
    case 'held':
      return HOLD_LINES[receipt.holdReason ?? ''] ?? 'On hold — the removal was not carried out, and nothing was erased.'
    case 'scheduled':
      return `Removal runs in ${formatUndoWindow(undoMinutesLeft(receipt.scheduledPurgeAt, now))}. You can cancel it until then.`
  }
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
 * your school's retention period") is still NOT here, because no expiry of that
 * kind runs. What does exist is the student's own scheduled erasure: a request
 * they file, that fires 24 hours later, that they can cancel until it fires.
 */
export const HISTORY_RETENTION_TRUTH =
  'Nothing here is removed on its own — there is no automatic expiry in this product. An entry stays until you file a deletion request yourself. That request is yours to make and yours to undo: it runs 24 hours after you send it, and you can cancel it any time before then. A person at your school is told, not asked to approve. Once it has run, it cannot be brought back.'

export const HISTORY_DELETION_NOTICE =
  'Filing this schedules the removal 24 hours out — it does not need anyone’s approval, and nothing is removed the moment you send it. You can cancel it on this page until the window closes. A request that names part of your history leaves your account and your school’s safeguarding record standing; only “all of my history” removes the account.'

export const HISTORY_NOT_EMERGENCY =
  'Soul Nurture AI is not an emergency service and does not dispatch emergency help. If you are in danger right now, tell a trusted adult near you or use your school’s emergency contact.'
