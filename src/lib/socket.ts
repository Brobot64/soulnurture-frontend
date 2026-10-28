// Socket.IO push channel — the backend pushes chat + notification events over
// an httpOnly-cookie handshake at /api/socket.io. Push-only: all mutations are REST.

import { io, type Socket } from 'socket.io-client'

import { API_BASE_URL } from '#/lib/api'

export const SOCKET_PATH = '/api/socket.io'

export interface ChatMessagePush {
  id: string
  role: string
  content: string
  viaVoice: boolean
  createdAt: string
}

export interface ChatRequestCreatedPush {
  threadId: string
  student: { firstName: string; classLabel: string | null }
  pendingCount: number
}

export interface ChatThreadClaimedPush {
  threadId: string
  professionalName: string
}

export interface ChatThreadClosedPush {
  threadId: string
}

export interface ChatUnreadPush {
  total: number
  byThread: Record<string, number>
}

/** An AI placeholder was rewritten in place: the reply landed or failed. */
export interface ConversationMessageUpdatedPush {
  conversationId: string
  messageId: string
  asyncState: 'COMPLETE' | 'FAILED'
}

/** An AI check-in ended — the student completed it, or idle expiry closed it. */
export interface ConversationClosedPush {
  conversationId: string
  checkInId: string | null
  reason: 'MANUAL' | 'IDLE'
}

export interface NotificationPush {
  id: string
  type: string
  title: string
  body: string
  data?: { threadId?: string; [key: string]: unknown } | null
}

export interface NotificationUnreadPush {
  count: number
}

export interface RealtimeEventMap {
  'chat.request.created': ChatRequestCreatedPush
  'chat.thread.claimed': ChatThreadClaimedPush
  'chat.message.new': { threadId: string; message: ChatMessagePush }
  'chat.thread.closed': ChatThreadClosedPush
  'chat.unread.updated': ChatUnreadPush
  'conversation.message.updated': ConversationMessageUpdatedPush
  'conversation.closed': ConversationClosedPush
  'notification.new': NotificationPush
  'notification.unread.updated': NotificationUnreadPush
}

export type RealtimeEvent = keyof RealtimeEventMap

let socket: Socket | null = null

export function getSocket(): Socket | null {
  if (typeof window === 'undefined') return null
  if (!socket) {
    socket = io(API_BASE_URL || window.location.origin, {
      path: SOCKET_PATH,
      withCredentials: true,
      // Server is websocket-only: engine.io's long-polling cannot intercept
      // requests through Fastify, so polling handshakes 404 by design.
      transports: ['websocket'],
    })
  }
  return socket
}

/// socket.io's typed emitter cannot resolve a generic event name
/// (socketio/socket.io#3833), so listeners go through an untyped view while
/// the public signature above stays fully typed.
type UntypedListener = (...args: unknown[]) => void
interface UntypedEmitter {
  on(event: string, listener: UntypedListener): unknown
  off(event: string, listener: UntypedListener): unknown
}

export function onRealtimeEvent<E extends RealtimeEvent>(
  event: E,
  handler: (payload: RealtimeEventMap[E]) => void,
): () => void {
  const active = getSocket()
  if (!active) return () => {}
  const emitter = active as unknown as UntypedEmitter
  const listener = handler as unknown as UntypedListener
  emitter.on(event, listener)
  return () => {
    emitter.off(event, listener)
  }
}
