import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { ApiError, apiFetch } from '#/lib/api'
import { homeForRole, useSession } from '#/lib/auth'
import { useApiQuery } from '#/lib/dash'

export const RESOURCE_TYPES = {
  ARTICLE: 'Article',
  AUDIO_GUIDE: 'Audio guide',
  SOMATIC_EXERCISE: 'Body-based exercise',
  INTERACTIVE: 'Interactive activity',
  SOUNDSCAPE: 'Soundscape',
  AFFIRMATION: 'Affirmation',
  TOOLKIT_ITEM: 'Toolbox resource',
} as const

export const RESOURCE_CATEGORIES = {
  EXAM_STRESS: 'Exam stress',
  FRIENDSHIPS: 'Friendships',
  FAMILY: 'Family',
  IDENTITY: 'Identity',
  ANXIETY: 'Anxiety',
  GROUNDING: 'Grounding',
  SLEEP: 'Sleep',
  FOCUS: 'Focus',
  CULTURAL_WISDOM: 'Cultural wisdom',
  PEER_DYNAMICS: 'Peer dynamics',
  GENERAL: 'General wellbeing',
} as const

export type ResourceType = keyof typeof RESOURCE_TYPES
export type ResourceCategory = keyof typeof RESOURCE_CATEGORIES

export interface Resource {
  id: string
  title: string
  description: string
  type: ResourceType
  category: ResourceCategory
  badge: string | null
  durationMinutes: number | null
  durationLabel: string | null
  ctaLabel: string | null
  mediaUrl: string | null
  tags: string[]
  active: boolean
  approved: boolean
  createdAt: string
  updatedAt: string
}

export interface ResourceSearch {
  category?: ResourceCategory
  type?: ResourceType
  search?: string
  savedOnly?: boolean
}

export function validateResourceSearch(search: Record<string, unknown>): ResourceSearch {
  return {
    category:
      typeof search.category === 'string' && Object.hasOwn(RESOURCE_CATEGORIES, search.category)
        ? (search.category as ResourceCategory)
        : undefined,
    type:
      typeof search.type === 'string' && Object.hasOwn(RESOURCE_TYPES, search.type)
        ? (search.type as ResourceType)
        : undefined,
    search: typeof search.search === 'string' ? search.search.trim().slice(0, 200) || undefined : undefined,
    savedOnly:
      search.savedOnly === true || search.savedOnly === 'true'
        ? true
        : search.savedOnly === false || search.savedOnly === 'false'
          ? false
          : undefined,
  }
}

export function isAvailableResource(resource: Resource): boolean {
  return resource.active === true && resource.approved === true
}

export async function fetchResources(filters: ResourceSearch = {}) {
  const params = new URLSearchParams({ savedOnly: String(filters.savedOnly === true) })
  if (filters.category) params.set('category', filters.category)
  if (filters.type) params.set('type', filters.type)
  if (filters.search) params.set('search', filters.search)
  const response = await apiFetch<{ items: Resource[]; savedCount: number }>(
    `/api/v1/resources?${params.toString()}`,
  )
  return { ...response, items: response.items.filter(isAvailableResource) }
}

interface ToolboxResponse {
  items: Resource[]
  count: number
}

function availableToolbox(response: ToolboxResponse): ToolboxResponse {
  // The toolbox endpoint can include resources that are no longer approved.
  const items = response.items.filter(isAvailableResource)
  return { items, count: items.length }
}

export async function fetchResourceToolbox(): Promise<ToolboxResponse> {
  return availableToolbox(await apiFetch<ToolboxResponse>('/api/v1/resources/toolbox'))
}

export async function saveResource(resourceId: string): Promise<ToolboxResponse> {
  return availableToolbox(
    await apiFetch<ToolboxResponse>('/api/v1/resources/toolbox', {
      method: 'POST',
      body: JSON.stringify({ resourceId }),
    }),
  )
}

export function resourceDuration(resource: Resource): string | null {
  if (resource.durationLabel?.trim()) return resource.durationLabel.trim()
  const minutes = resource.durationMinutes
  return minutes !== null && Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : null
}

/** Only link to real, absolute web URLs; never render arbitrary embedded content. */
export function safeResourceUrl(value: string | null): string | null {
  if (!value || !/^https?:\/\//i.test(value.trim())) return null
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    const host = url.hostname.toLowerCase().replace(/\.+$/, '')
    if (
      !host ||
      ['example.com', 'example.org', 'example.net'].some(
        (example) => host === example || host.endsWith(`.${example}`),
      )
    ) return null
    return url.href
  } catch {
    return null
  }
}

/** Routes mount their fetching children only after this guard returns a student. */
export function useResourceStudent() {
  const { user, status } = useSession()
  const navigate = useNavigate()
  useEffect(() => {
    if (status !== 'ready') return
    if (!user) {
      void navigate({ to: '/signin', search: { redirect: '/resources' }, replace: true })
    } else if (user.mustChangePassword || user.role !== 'STUDENT') {
      void navigate({ to: homeForRole(user), replace: true })
    }
  }, [user, status, navigate])
  return status === 'ready' && user?.role === 'STUDENT' && !user.mustChangePassword ? user : null
}

export function useResourceAuthError(error: ApiError | null) {
  const navigate = useNavigate()
  useEffect(() => {
    if (error?.status === 401) {
      void navigate({ to: '/signin', search: { redirect: '/resources' }, replace: true })
    }
  }, [error, navigate])
}

export function useResourceToolbox() {
  const revision = useRef(0)
  const query = useApiQuery(async () => {
    const startedAtRevision = revision.current
    return { ...await fetchResourceToolbox(), revision: startedAtRevision }
  })
  const [confirmed, setConfirmed] = useState<ToolboxResponse | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<{ resourceId: string; error: ApiError } | null>(null)
  const saving = useRef(false)
  // A GET started before a successful POST must not overwrite that confirmed save.
  // A later GET is authoritative, including resources withdrawn from the toolbox.
  const data = query.data?.revision === revision.current ? query.data : confirmed
  const savedIds = new Set((data?.items ?? []).map((item) => item.id))
  useResourceAuthError(saveError?.error.status === 401 ? saveError.error : query.error)

  const save = async (resourceId: string) => {
    if (saving.current || savedIds.has(resourceId) || !data || query.error || query.loading) return
    saving.current = true
    setSavingId(resourceId)
    setSaveError(null)
    try {
      const response = await saveResource(resourceId)
      if (!response.items.some((item) => item.id === resourceId)) {
        throw new ApiError('The server did not confirm this save. Try again.', 0)
      }
      revision.current += 1
      setConfirmed(response)
      query.reload()
    } catch (caught) {
      setSaveError({
        resourceId,
        error: caught instanceof ApiError ? caught : new ApiError('Could not save this resource. Try again.', 0),
      })
    } finally {
      saving.current = false
      setSavingId(null)
    }
  }

  return {
    savedIds,
    count: data ? savedIds.size : null,
    loading: query.loading,
    error: query.error,
    reload: query.reload,
    savingId,
    saveError,
    canSave: !!data && !query.error && !query.loading && !savingId,
    save,
  }
}

export type ResourceToolbox = ReturnType<typeof useResourceToolbox>
