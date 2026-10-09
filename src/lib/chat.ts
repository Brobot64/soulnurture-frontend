// Chat REST wrappers + unread badge store. Mutations are REST; live updates
// arrive over Socket.IO (see lib/socket.ts).

import { useSyncExternalStore } from 'react'

import { apiFetch } from '#/lib/api'
import { getSocket, onRealtimeEvent } from '#/lib/socket'

export type ChatThreadStatus = 'PENDING' | 'ACTIVE' | 'CLOSED'
export type ChatMessageRole = 'SYSTEM' | 'STUDENT' | 'PROFESSIONAL'

export interface ChatStudentBrief {
  userId?: string
  firstName: string
  lastName: string
  classLabel: string | null
  studentCode: string
}

export interface ChatProfessionalBrief {
  userId?: string
  title: string | null
  department: string | null
  user: { name: string }
}

export interface ChatMessagePreview {
  content: string
  role: ChatMessageRole
  createdAt: string
}

export interface ChatMessage {
  id: string
  threadId: string
  senderUserId: string | null
  role: ChatMessageRole
  content: string
  viaVoice: boolean
  meta?: Record<string, unknown> | null
  createdAt: string
}

export interface ChatThreadListItem {
  id: string
  schoolId: string
  status: ChatThreadStatus
  aiEntrySummary: string | null
  createdAt: string
  updatedAt: string
  claimedAt: string | null
  closedAt: string | null
  studentId?: string
  professionalId?: string | null
  student?: ChatStudentBrief
  professional?: ChatProfessionalBrief | null
  /** Latest message first (backend take: 1); absent on rows with none. */
  messages?: ChatMessagePreview[]
}

export interface ChatThreadDetail {
  id: string
  schoolId: string
  studentId: string
  professionalId: string | null
  entryCheckInId: string | null
  aiEntrySummary: string | null
  status: ChatThreadStatus
  studentReadAt: string | null
  professionalReadAt: string | null
  claimedAt: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  student: ChatStudentBrief & { userId: string }
  professional: (ChatProfessionalBrief & { userId: string }) | null
  messages: ChatMessage[]
}

export interface ChatUnreadSummary {
  total: number
  byThread: Record<string, number>
}

export async function fetchChatInbox(): Promise<ChatThreadListItem[]> {
  const { items } = await apiFetch<{ items: ChatThreadListItem[] }>(
    '/api/v1/chat/inbox',
  )
  return items
}

export async function fetchChatThreads(): Promise<ChatThreadListItem[]> {
  const { items } = await apiFetch<{ items: ChatThreadListItem[] }>(
    '/api/v1/chat/threads',
  )
  return items
}

export async function fetchChatThread(id: string): Promise<ChatThreadDetail> {
  return apiFetch<ChatThreadDetail>(`/api/v1/chat/threads/${id}`)
}

export async function createChatThread(
  input: { note?: string; checkInId?: string } = {},
): Promise<ChatThreadDetail> {
  return apiFetch<ChatThreadDetail>('/api/v1/chat/threads', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function claimChatThread(id: string): Promise<ChatThreadDetail> {
  return apiFetch<ChatThreadDetail>(`/api/v1/chat/threads/${id}/claim`, {
    method: 'POST',
  })
}

export async function sendChatMessage(
  threadId: string,
  input: { content: string; viaVoice?: boolean },
): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(`/api/v1/chat/threads/${threadId}/messages`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function markChatThreadRead(threadId: string): Promise<void> {
  await apiFetch(`/api/v1/chat/threads/${threadId}/read`, { method: 'POST' })
}

export async function closeChatThread(threadId: string): Promise<void> {
  await apiFetch(`/api/v1/chat/threads/${threadId}/close`, { method: 'POST' })
}

export async function fetchChatUnread(): Promise<ChatUnreadSummary> {
  return apiFetch<ChatUnreadSummary>('/api/v1/chat/unread')
}

const EMPTY_UNREAD: ChatUnreadSummary = { total: 0, byThread: {} }

let unread: ChatUnreadSummary = EMPTY_UNREAD
const unreadListeners = new Set<() => void>()

function emitUnread() {
  unreadListeners.forEach((listener) => listener())
}

export function setChatUnread(next: ChatUnreadSummary) {
  unread = next
  emitUnread()
}

export async function refreshChatUnread(): Promise<void> {
  try {
    setChatUnread(await fetchChatUnread())
  } catch {
    // Keep the last known summary — a reconnect or the next push corrects it.
  }
}

export function useChatUnread(): ChatUnreadSummary {
  return useSyncExternalStore(
    (listener) => {
      unreadListeners.add(listener)
      return () => {
        unreadListeners.delete(listener)
      }
    },
    () => unread,
    () => EMPTY_UNREAD,
  )
}

/** The school's shared PENDING pool size — the inbox badge for staff. */
let poolCount = 0
const poolListeners = new Set<() => void>()

function setPoolCount(next: number) {
  if (next === poolCount) return
  poolCount = next
  poolListeners.forEach((listener) => listener())
}

export async function refreshChatPool(): Promise<void> {
  try {
    const items = await fetchChatInbox()
    setPoolCount(items.length)
  } catch {
    // 403 for non-staff callers, or offline — keep the last known count.
  }
}

export function useChatPoolCount(): number {
  return useSyncExternalStore(
    (listener) => {
      poolListeners.add(listener)
      return () => {
        poolListeners.delete(listener)
      }
    },
    () => poolCount,
    () => 0,
  )
}

let watched = false

/** Idempotent boot: live counters + a fresh unread count on every (re)connect. */
export function watchChatUnread(): void {
  if (watched || typeof window === 'undefined') return
  watched = true
  onRealtimeEvent('chat.unread.updated', (payload) => setChatUnread(payload))
  onRealtimeEvent('chat.request.created', (payload) =>
    setPoolCount(payload.pendingCount),
  )
  // A claim always moves one thread PENDING → ACTIVE; the push carries no
  // count, so mirror the pool shrink locally (refreshed on the next load).
  onRealtimeEvent('chat.thread.claimed', () =>
    setPoolCount(Math.max(0, poolCount - 1)),
  )
  getSocket()?.on('connect', () => {
    void refreshChatUnread()
  })
  void refreshChatUnread()
}
