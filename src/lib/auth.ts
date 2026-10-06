// Live better-auth client for the Natlas backend.
// Session lives in a cookie set by the backend; this module keeps a tiny
// module-level store so components can render signed-in state without a provider.

import { useSyncExternalStore } from 'react'

import { apiFetch } from '#/lib/api'

export interface SessionUser {
  id: string
  name: string
  email: string
  phone?: string | null
  emailVerified: boolean
  image?: string | null
  role?: string
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

export async function fetchMe(): Promise<SessionUser> {
  return apiFetch<SessionUser>('/api/users/me')
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

export async function signUp(input: {
  name: string
  email: string
  password: string
  phone?: string
}): Promise<void> {
  await apiFetch('/api/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function signIn(input: { email: string; password: string }): Promise<void> {
  await apiFetch('/api/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  await refreshSession()
}

export async function signOut(): Promise<void> {
  try {
    await apiFetch('/api/auth/sign-out', { method: 'POST' })
  } finally {
    setState({ user: null, status: 'ready' })
  }
}

export async function resendVerification(email: string): Promise<void> {
  await apiFetch('/api/verification/resend', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}
