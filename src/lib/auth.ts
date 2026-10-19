// Live better-auth client for the Natlas backend.
// Session lives in a cookie set by the backend; this module keeps a tiny
// module-level store so components can render signed-in state without a provider.

import { useSyncExternalStore } from 'react'

import { ApiError, apiFetch } from '#/lib/api'

export const CHAT_STAFF_ROLES = ['COUNSELLOR', 'PSYCHOLOGIST', 'SUPPORT_STAFF'] as const

export interface SchoolBrief {
  id: string
  name: string
  shortCode: string
}

export interface SessionUser {
  id: string
  name: string
  email: string
  phone?: string | null
  emailVerified: boolean
  image?: string | null
  role?: string | null
  schoolId?: string | null
  mustChangePassword?: boolean | null
  school?: SchoolBrief | null
}

interface AuthState {
  user: SessionUser | null
  status: 'loading' | 'ready'
}

let state: AuthState = { user: null, status: 'loading' }
const listeners = new Set<() => void>()
let loaded = false

function setState(next: AuthState) {
  state = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  void ensureLoaded()
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

async function ensureLoaded() {
  if (loaded) return
  loaded = true
  await refreshSession()
}

export function useSession(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function isChatStaff(role?: string | null): boolean {
  return !!role && (CHAT_STAFF_ROLES as readonly string[]).includes(role)
}

export type HomePath =
  | '/admin'
  | '/school'
  | '/school/inbox'
  | '/welcome'
  | '/first-password'
  | '/signin'

/** Where a signed-in account lands; the forced password change wins over everything. */
export function homeForRole(
  user: Pick<SessionUser, 'role' | 'mustChangePassword'> | null,
): HomePath {
  if (!user) return '/signin'
  if (user.mustChangePassword) return '/first-password'
  switch (user.role) {
    case 'PLATFORM_ADMIN':
      return '/admin'
    case 'SCHOOL_ADMIN':
      return '/school'
    default:
      return isChatStaff(user.role) ? '/school/inbox' : '/welcome'
  }
}

export function roleLabel(role?: string | null): string {
  switch (role) {
    case 'PLATFORM_ADMIN':
      return 'Platform admin'
    case 'SCHOOL_ADMIN':
      return 'School admin'
    case 'COUNSELLOR':
      return 'Counsellor'
    case 'PSYCHOLOGIST':
      return 'Psychologist'
    case 'SUPPORT_STAFF':
      return 'Support staff'
    case 'STUDENT':
      return 'Student'
    default:
      return 'Member'
  }
}

export async function fetchMe(): Promise<SessionUser> {
  return apiFetch<SessionUser>('/api/v1/users/me')
}

export async function refreshSession(): Promise<SessionUser | null> {
  loaded = true
  try {
    const user = await fetchMe()
    setState({ user, status: 'ready' })
    return user
  } catch {
    setState({ user: null, status: 'ready' })
    return null
  }
}

export async function signIn(input: {
  email: string
  password: string
}): Promise<SessionUser | null> {
  await apiFetch('/api/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  // The sign-in succeeded but the session did not come back: the browser
  // dropped the cookie. Say so, instead of sending the student back to the
  // sign-in form with no explanation.
  const user = await refreshSession()
  if (!user) {
    throw new ApiError(
      'Signed in, but your browser did not keep the session. Try again, or use a different browser.',
      0,
      'SESSION_NOT_STORED',
    )
  }
  return user
}

/**
 * Forced first password change: no old password, revokes other sessions and
 * refreshes the local session so mustChangePassword flips to false.
 */
export async function firstPassword(
  newPassword: string,
): Promise<SessionUser | null> {
  await apiFetch('/api/v1/auth/first-password', {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  })
  return refreshSession()
}

export async function signOut(): Promise<void> {
  await apiFetch('/api/auth/sign-out', { method: 'POST' })
  setState({ user: null, status: 'ready' })
}

export async function resendVerification(email: string): Promise<void> {
  await apiFetch('/api/verification/resend', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}
