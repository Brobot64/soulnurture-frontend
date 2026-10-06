// Mock journey transport.
//
// Mirrors the Natlas backend contract so a real fetch client can replace this
// module later without touching the screens:
//   POST /v1/check-ins                   CreateCheckInDto
//   POST /v1/conversations               { checkInId }
//   POST /v1/conversations/:id/messages  SendMessageDto
//   POST /v1/conversations/:id/close     queues the AI session summary
//
// State lives in sessionStorage so a refresh inside the same tab keeps the
// flow. No auth is wired yet — swap this for the authenticated client once
// the better-auth session lands.

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

export interface CreateCheckInDto {
  feeling: FeelingLabel
  intensity: FeelingIntensity
  description?: string
  triggers?: string[]
}

export interface SendMessageDto {
  content: string
  language?: string
}

export interface CheckIn {
  id: string
  feeling: FeelingLabel
  intensity: FeelingIntensity
  description?: string
  triggers: string[]
  createdAt: string
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface Conversation {
  id: string
  checkInId: string
  status: ConversationStatus
  messages: Message[]
  /** Mock-only bookkeeping — the real backend tracks the bounded flow server-side. */
  turns: number
  done: boolean
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

export const QUICK_REPLIES = [
  'Tell you more',
  'Show me an idea',
  'I would like to talk to someone',
]

export function getMoodByFeeling(feeling: FeelingLabel): MoodOption | undefined {
  return MOODS.find((mood) => mood.feeling === feeling)
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/* ── Store ──────────────────────────────────────────────────────────────── */

interface JourneyDb {
  checkIns: CheckIn[]
  conversations: Conversation[]
}

const DB_KEY = 'soul-nurture.journey'
let db: JourneyDb | null = null

function loadDb(): JourneyDb {
  if (typeof window === 'undefined') return { checkIns: [], conversations: [] }
  try {
    const raw = sessionStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw) as JourneyDb
  } catch {
    // corrupted or unavailable storage — start fresh
  }
  return { checkIns: [], conversations: [] }
}

function store(): JourneyDb {
  if (!db) db = loadDb()
  return db
}

function persist(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(DB_KEY, JSON.stringify(store()))
  } catch {
    // storage full or blocked — the in-memory store still works for this tab
  }
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

/* ── API ────────────────────────────────────────────────────────────────── */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function createCheckIn(dto: CreateCheckInDto): CheckIn {
  const checkIn: CheckIn = {
    id: newId('chk'),
    feeling: dto.feeling,
    intensity: dto.intensity,
    description: dto.description,
    triggers: dto.triggers ?? [],
    createdAt: new Date().toISOString(),
  }
  store().checkIns.push(checkIn)
  persist()
  return checkIn
}

export function getCheckIn(id: string): CheckIn | undefined {
  return store().checkIns.find((checkIn) => checkIn.id === id)
}

export function createConversation(checkInId: string): Conversation {
  const conversation: Conversation = {
    id: newId('cnv'),
    checkInId,
    status: 'ACTIVE',
    messages: [],
    turns: 0,
    done: false,
  }
  store().conversations.push(conversation)
  persist()
  return conversation
}

export function getConversation(id: string): Conversation | undefined {
  return store().conversations.find((conversation) => conversation.id === id)
}

export function closeConversation(id: string): void {
  const conversation = getConversation(id)
  if (!conversation) return
  conversation.status = 'CLOSED'
  persist()
}

/* ── Bounded reflection script ──────────────────────────────────────────── */

function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function openingMessage(checkIn: CheckIn): string {
  const mood = getMoodByFeeling(checkIn.feeling)
  const label = (mood?.label ?? checkIn.feeling).toLowerCase()
  const triggers = checkIn.triggers.map((trigger) => trigger.toLowerCase())
  const onMind = triggers.length > 0 ? `, with ${listPhrase(triggers)} on your mind` : ''
  return `Thanks for sharing. You said you're feeling ${label}${onMind}. What part feels heaviest right now?`
}

const REPLIES = {
  more: "I'm listening. There's no rush at all — you can put it in your own words, or just sit with it for a moment.",
  idea: 'One small idea many students find helpful: pick the easiest task you can finish tonight, and let the rest wait until tomorrow. Does that sound doable?',
  person:
    "That's a brave step to take. I've noted that you'd like to talk with someone — a school counsellor can meet you in person, and they are there to help, not to judge.",
  generic: [
    'Thank you for telling me that. What would feel most useful right now — saying a little more, or thinking about one small next step?',
    "That makes sense. You don't have to solve everything tonight; noticing it is already a real step.",
    'I hear you. If it helps, we can stay with this a little longer, or think about one thing that could make tonight feel a bit lighter.',
  ],
  closing:
    'Thanks for taking this time. Your check-in is saved to your wellbeing history, and you can come back to it any time.',
}

function assistantMessage(content: string): Message {
  return { id: newId('msg'), role: 'ASSISTANT', content, createdAt: new Date().toISOString() }
}

export async function openConversation(conversationId: string): Promise<Message> {
  const conversation = getConversation(conversationId)
  if (!conversation) throw new Error('Conversation not found')
  const existing = conversation.messages.find((message) => message.role === 'ASSISTANT')
  if (existing) return existing

  await delay(900)
  const checkIn = getCheckIn(conversation.checkInId)
  const message = assistantMessage(
    checkIn ? openingMessage(checkIn) : 'Thanks for sharing. What part feels heaviest right now?',
  )
  conversation.messages.push(message)
  persist()
  return message
}

export async function sendMessage(
  conversationId: string,
  dto: SendMessageDto,
): Promise<{ messages: Message[]; done: boolean }> {
  const conversation = getConversation(conversationId)
  if (!conversation) throw new Error('Conversation not found')

  const content = dto.content.trim()
  conversation.messages.push({
    id: newId('msg'),
    role: 'USER',
    content,
    createdAt: new Date().toISOString(),
  })
  conversation.turns += 1
  persist()

  await delay(1100 + Math.random() * 500)

  const lowered = content.toLowerCase()
  const replies: string[] = []
  if (lowered.includes('talk to someone') || lowered.includes('talk to a person')) {
    replies.push(REPLIES.person)
    conversation.done = true
  } else if (lowered.includes('idea')) {
    replies.push(REPLIES.idea)
  } else if (lowered.includes('tell you more')) {
    replies.push(REPLIES.more)
  } else {
    replies.push(REPLIES.generic[conversation.turns % REPLIES.generic.length])
  }
  if (!conversation.done && conversation.turns >= 3) conversation.done = true
  if (conversation.done) replies.push(REPLIES.closing)

  const messages = replies.map((reply) => assistantMessage(reply))
  conversation.messages.push(...messages)
  persist()
  return { messages, done: conversation.done }
}
