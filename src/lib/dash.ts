// Dashboard shared plumbing: a tiny fetch hook, the school-suspended funnel,
// role guards and date/number formatting.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { ApiError } from '#/lib/api'
import { homeForRole, useSession, type SessionUser } from '#/lib/auth'

export interface ApiQuery<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
  reload: () => void
}

export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): ApiQuery<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetcherRef
      .current()
      .then((result) => {
        if (!alive) return
        setData(result)
        setLoading(false)
      })
      .catch((caught: unknown) => {
        if (!alive) return
        const apiError =
          caught instanceof ApiError
            ? caught
            : new ApiError('Something went wrong.', 0)
        noteApiError(apiError)
        setError(apiError)
        setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  // Focus refetch: dashboards are glanceable — coming back to the tab should
  // show fresh numbers without any polling.
  useEffect(() => {
    const onFocus = () => setTick((n) => n + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { data, error, loading, reload }
}

/** Trailing-edge debounce for search fields — 300ms by default. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// --- School suspended (403 SCHOOL_SUSPENDED) -------------------------------
// Any API call can flip this; the dash layout renders a full-page notice.

let suspended = false
const suspendedListeners = new Set<() => void>()

function setSuspended(next: boolean) {
  if (next === suspended) return
  suspended = next
  suspendedListeners.forEach((listener) => listener())
}

export function noteApiError(error: ApiError): void {
  if (error.code === 'SCHOOL_SUSPENDED') setSuspended(true)
}

export function clearSchoolSuspended(): void {
  setSuspended(false)
}

export function useSchoolSuspended(): boolean {
  return useSyncExternalStore(
    (listener) => {
      suspendedListeners.add(listener)
      return () => {
        suspendedListeners.delete(listener)
      }
    },
    () => suspended,
    () => false,
  )
}

// --- Role guard ------------------------------------------------------------

/**
 * Returns the user when they hold one of `allowed` roles; otherwise redirects
 * to their own home. Client-side by design: SSR cannot forward cookies here.
 */
export function useRoleGuard(allowed: readonly string[]): SessionUser | null {
  const navigate = useNavigate()
  const { user, status } = useSession()
  const permitted = !!user && !!user.role && allowed.includes(user.role)

  useEffect(() => {
    if (status !== 'ready' || !user) return
    if (permitted) return
    void navigate({ to: homeForRole(user), replace: true })
  }, [status, user, permitted, navigate])

  return permitted ? user : null
}

// --- Formatting ------------------------------------------------------------

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDay(iso)
}

export function formatDay(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const numberFormatter = new Intl.NumberFormat('en-GB')

export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}
