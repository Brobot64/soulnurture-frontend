// Thin client for the Natlas backend.
// Nest routes respond wrapped in { success, statusCode, message, data, path, timestamp };
// better-auth routes (/api/auth/*) respond raw. Both are handled here.

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function extractMessage(payload: unknown): { message?: string; code?: string } {
  if (!payload || typeof payload !== 'object') return {}
  const body = payload as {
    message?: string | string[]
    code?: string
    error?: { message?: string | string[]; code?: string }
  }
  const raw = body.message ?? body.error?.message
  const message = Array.isArray(raw) ? raw.join(' ') : raw
  return { message, code: body.code ?? body.error?.code }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData bodies must let the browser set Content-Type itself (multipart boundary).
  const jsonBody = init?.body !== undefined && !(init.body instanceof FormData)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0)
  }

  const payload: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const { message, code } = extractMessage(payload)
    throw new ApiError(message ?? `Request failed (${response.status}).`, response.status, code)
  }

  if (payload && typeof payload === 'object' && 'success' in payload) {
    const envelope = payload as { success: boolean; data?: T }
    if (envelope.success) return envelope.data as T
  }
  return payload as T
}
