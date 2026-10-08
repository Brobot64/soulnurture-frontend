// Journey transport — authenticated against the Natlas backend.
//   POST /v1/check-ins                   CreateCheckInDto
//   GET  /v1/check-ins/:id
//   POST /v1/conversations               { checkInId }
//   GET  /v1/conversations/:id           conversation + messages (asc)
//   POST /v1/conversations/:id/messages  SendMessageDto — AI orchestrated
//   POST /v1/conversations/:id/close     queues the AI session summary

import { apiFetch, ApiError } from '#/lib/api'

export type FeelingLabel =
  | 'OVERWHELMED'
  | 'ANXIOUS'
  | 'TIRED'
  | 'SAD_LOW'
  | 'CALM'
  | 'HOPEFUL'
  | 'GREAT'
  | 'HAPPY'
  | 'PEACEFUL'
  | 'STRESSED'
  | 'DOWN'
  | 'ANGRY'

export type FeelingIntensity = 'A_LITTLE' | 'SOMEWHAT' | 'A_LOT'
export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM'
export type ConversationStatus = 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
/** Mirrors the backend QUICK_REPLY_VALUES enum on SendMessageDto. */
export type QuickReplyValue = 'TELL_MORE' | 'SHOW_IDEA' | 'TALK_TO_SOMEONE'

export interface CreateCheckInDto {
  feeling: FeelingLabel
  intensity: FeelingIntensity
  description?: string
  triggers?: string[]
}

export interface SendMessageDto {
  content: string
  language?: string
  /** Guided-reply marker — the backend reads the enum while content stays required. */
  quickReply?: QuickReplyValue
}

export interface CheckIn {
  id: string
  feeling: FeelingLabel
  intensity: FeelingIntensity
  description?: string | null
  triggers: string[]
  createdAt: string
}

/** One row of the guided check-in history — a check-in whose conversation closed. */
export interface CheckInHistoryEntry {
  checkInId: string
  feeling: FeelingLabel
  triggers: string[]
  createdAt: string
  conversationId: string | null
  summary: string | null
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  /** Present on user messages sent via a quick-reply tap; null/absent for free text. */
  quickReply?: string | null
  /** Present on assistant messages — asyncState COMPLETE means the AI reply is final. */
  aiPayload?: { asyncState?: string } | null
  createdAt: string
}

export interface Conversation {
  id: string
  checkInId: string | null
  status: ConversationStatus
}

export interface ConversationDetail extends Conversation {
  messages: Message[]
}

export interface HumanCareRecommendation {
  show: boolean
  message?: string | null
  professionalName?: string | null
  professionalId?: string | null
}

export interface SendMessageResult {
  userMessage: Message
  assistantMessage: Message
  humanCareRecommendation: HumanCareRecommendation | null
  aiPending: boolean
}

export interface MoodOption {
  id: string
  label: string
  emoji: string
  tone: string
  /**
   * Provisional backend mapping: the design's eight faces do not match the
   * backend FeelingLabel enum one-to-one — the check-in format is still open
   * for product validation. Intensities default to SOMEWHAT for the same
   * reason (the design does not collect intensity yet).
   */
  feeling: FeelingLabel
  intensity: FeelingIntensity
}

export const MOODS: MoodOption[] = [
  { id: 'normal', label: 'Normal', emoji: '🙂', tone: 'bg-mood-normal', feeling: 'CALM', intensity: 'SOMEWHAT' },
  { id: 'great', label: 'Great', emoji: '🥰', tone: 'bg-mood-great', feeling: 'GREAT', intensity: 'SOMEWHAT' },
  { id: 'sad', label: 'Sad', emoji: '🙁', tone: 'bg-mood-sad', feeling: 'SAD_LOW', intensity: 'SOMEWHAT' },
  { id: 'angry', label: 'Angry', emoji: '😠', tone: 'bg-mood-angry', feeling: 'ANGRY', intensity: 'SOMEWHAT' },
  { id: 'confused', label: 'Confused', emoji: '😵‍💫', tone: 'bg-mood-confused', feeling: 'OVERWHELMED', intensity: 'SOMEWHAT' },
  { id: 'indifferent', label: 'Indifferent', emoji: '😏', tone: 'bg-mood-indifferent', feeling: 'TIRED', intensity: 'SOMEWHAT' },
  { id: 'strange', label: 'Strange', emoji: '🤪', tone: 'bg-mood-strange', feeling: 'ANXIOUS', intensity: 'SOMEWHAT' },
  { id: 'distraught', label: 'Distraught', emoji: '😣', tone: 'bg-mood-distraught', feeling: 'STRESSED', intensity: 'SOMEWHAT' },
]

export const TRIGGERS = [
  'School',
  'Friends',
  'Relationship',
  'Family',
  'Sleep',
  'Feeling alone',
  'Something else',
]

export interface QuickReply {
  label: string
  value: QuickReplyValue
}

export const QUICK_REPLIES: QuickReply[] = [
  { label: 'Tell you more', value: 'TELL_MORE' },
  { label: 'Show me an idea', value: 'SHOW_IDEA' },
  { label: 'I would like to talk to someone', value: 'TALK_TO_SOMEONE' },
]

export function getMoodByFeeling(feeling: FeelingLabel): MoodOption | undefined {
  return MOODS.find((mood) => mood.feeling === feeling)
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/* ── Check-in draft (carried between the two check-in screens) ──────────── */

export interface MoodDraft {
  moodId: string
  note: string
}

const DRAFT_KEY = 'soul-nurture.mood-draft'

export function saveMoodDraft(draft: MoodDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // ignore — the flow still works without draft persistence
  }
}

export function readMoodDraft(): MoodDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as MoodDraft) : null
  } catch {
    return null
  }
}

export function clearMoodDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}

/* ── Pending opening message ────────────────────────────────────────────── */
// The backend has no server-generated opening turn, so the reflection screen
// sends the composed "why" as the student's first message. It is stashed here
// while the flow navigates from the why screen to the chat.

const OPENING_KEY = 'soul-nurture.pending-opening'

interface PendingOpening {
  conversationId: string
  content: string
}

export function savePendingOpening(opening: PendingOpening): void {
  try {
    sessionStorage.setItem(OPENING_KEY, JSON.stringify(opening))
  } catch {
    // ignore — the reflection screen falls back to an empty chat
  }
}

export function readPendingOpening(conversationId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(OPENING_KEY)
    if (!raw) return null
    const opening = JSON.parse(raw) as PendingOpening
    return opening.conversationId === conversationId ? opening.content : null
  } catch {
    return null
  }
}

export function clearPendingOpening(): void {
  try {
    sessionStorage.removeItem(OPENING_KEY)
  } catch {
    // ignore
  }
}

/* ── Opening message composed from the "why" step ───────────────────────── */

function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export function composeOpeningMessage(input: {
  moodLabel: string
  triggers: string[]
  notes: string[]
}): string {
  const parts = [`I'm feeling ${input.moodLabel.toLowerCase()}.`]
  if (input.triggers.length > 0) {
    parts.push(
      `I think it's because of ${listPhrase(input.triggers.map((trigger) => trigger.toLowerCase()))}.`,
    )
  }
  const note = input.notes
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(' ')
  if (note) parts.push(note)
  return parts.join(' ')
}

/* ── API ────────────────────────────────────────────────────────────────── */

export async function createCheckIn(dto: CreateCheckInDto): Promise<CheckIn> {
  return apiFetch<CheckIn>('/api/v1/check-ins', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function getCheckIn(id: string): Promise<CheckIn | null> {
  try {
    return await apiFetch<CheckIn>(`/api/v1/check-ins/${encodeURIComponent(id)}`)
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) return null
    throw caught
  }
}

export async function fetchCheckInHistory(): Promise<{ items: CheckInHistoryEntry[] }> {
  return apiFetch<{ items: CheckInHistoryEntry[] }>('/api/v1/check-ins/history')
}

export async function startConversation(checkInId: string): Promise<Conversation> {
  return apiFetch<Conversation>('/api/v1/conversations', {
    method: 'POST',
    body: JSON.stringify({ checkInId }),
  })
}

export async function fetchConversation(id: string): Promise<ConversationDetail | null> {
  try {
    return await apiFetch<ConversationDetail>(`/api/v1/conversations/${encodeURIComponent(id)}`)
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) return null
    throw caught
  }
}

export async function sendMessage(id: string, dto: SendMessageDto): Promise<SendMessageResult> {
  return apiFetch<SendMessageResult>(
    `/api/v1/conversations/${encodeURIComponent(id)}/messages`,
    { method: 'POST', body: JSON.stringify(dto) },
  )
}

export async function closeConversation(id: string): Promise<Conversation> {
  const result = await apiFetch<{ conversation: Conversation; summaryQueued: boolean }>(
    `/api/v1/conversations/${encodeURIComponent(id)}/close`,
    { method: 'POST' },
  )
  return result.conversation
}
