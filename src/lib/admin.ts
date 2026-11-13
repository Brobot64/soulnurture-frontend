// Platform-admin register + analytics/activity REST calls, plus the
// school-scoped reads the admin console mounts for inspection.

import { apiFetch } from '#/lib/api'
import type { ActivityItem } from '#/lib/activity'
import type { MoodId } from '#/components/dash/charts'

// --- Analytics --------------------------------------------------------------

export type AnalyticsDays = 14 | 30 | 90

export interface AnalyticsPoint {
  date: string
  newUsers: number
  checkIns: number
  chatThreads: number
  chatMessages: number
}

export interface MetricDelta {
  current: number
  previous: number
  /** null when the previous window is empty — rendered as "—". */
  pct: number | null
}

export interface AnalyticsData {
  windowDays: number
  series: AnalyticsPoint[]
  deltas: {
    newUsers: MetricDelta
    checkIns: MetricDelta
    chatThreads: MetricDelta
    chatMessages: MetricDelta
  }
  mood: { total: number; distribution: Record<MoodId, number> }
  weekday: { weekday: string; count: number }[]
}

export interface SchoolAnalyticsData extends AnalyticsData {
  roster: {
    students: number
    professionals: number
    admins: number
    deactivated: number
  }
  onboarding: { incomplete: number; percentComplete: number }
}

export function fetchAdminAnalytics(days: AnalyticsDays): Promise<AnalyticsData> {
  return apiFetch<AnalyticsData>(`/api/v1/admin/analytics?days=${days}`)
}

export function fetchSchoolAnalytics(
  schoolId: string,
  days: AnalyticsDays,
): Promise<SchoolAnalyticsData> {
  return apiFetch<SchoolAnalyticsData>(
    `/api/v1/schools/${schoolId}/analytics?days=${days}`,
  )
}

// --- Activity feed ----------------------------------------------------------

export type ActivityFeedKind = 'all' | 'schools' | 'people' | 'chat'

export function fetchActivity(opts: {
  kind: ActivityFeedKind
  schoolId?: string
  limit?: number
}): Promise<{ items: ActivityItem[] }> {
  const params = new URLSearchParams({
    kind: opts.kind,
    limit: String(opts.limit ?? 50),
  })
  const base = opts.schoolId
    ? `/api/v1/schools/${opts.schoolId}/activity`
    : '/api/v1/admin/activity'
  return apiFetch(`${base}?${params.toString()}`)
}

// --- Platform overview ------------------------------------------------------

export interface PlatformOverview {
  schools: { total: number; active: number; suspended: number }
  users: {
    total: number
    students: number
    professionals: number
    admins: number
    newLast7d: number
    newLast30d: number
  }
  chat: { pendingRequests: number }
}

export function fetchAdminOverview(): Promise<PlatformOverview> {
  return apiFetch<PlatformOverview>('/api/v1/admin/overview')
}

// --- Schools register -------------------------------------------------------

export type SchoolStatus = 'ACTIVE' | 'SUSPENDED'

export interface SchoolRow {
  id: string
  name: string
  shortCode: string
  status: SchoolStatus
  createdAt: string
  _count: { users: number }
  students: number
  professionals: number
  pendingChats: number
  lastActivityAt: string | null
}

export interface SchoolsResponse {
  items: SchoolRow[]
  /** Schools matching the filters, across every page — not this page's rows. */
  total: number
  page: { take: number; hasMore: boolean; nextBefore: string | null }
}

/**
 * One page of the register. Search and status are server-side because a filter
 * applied to one page of 25 silently hides the schools that did not make the
 * page — which is what the "no schools match" state used to mean.
 */
export function fetchSchools(opts: {
  before?: string | null
  q?: string
  status?: SchoolStatus
} = {}): Promise<SchoolsResponse> {
  const params = new URLSearchParams()
  if (opts.before) params.set('before', opts.before)
  if (opts.q?.trim()) params.set('q', opts.q.trim())
  if (opts.status) params.set('status', opts.status)
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return apiFetch<SchoolsResponse>(`/api/v1/schools${suffix}`)
}

export interface CreatedSchool {
  id: string
  name: string
  shortCode: string
  status: SchoolStatus
}

export function createSchool(input: {
  name: string
  defaultPassword?: string
}): Promise<CreatedSchool> {
  return apiFetch<CreatedSchool>('/api/v1/schools', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function renameSchool(id: string, name: string): Promise<CreatedSchool> {
  return apiFetch<CreatedSchool>(`/api/v1/schools/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export function setSchoolSuspended(
  id: string,
  suspend: boolean,
): Promise<{ id: string; status: SchoolStatus }> {
  return apiFetch(`/api/v1/schools/${id}/${suspend ? 'suspend' : 'reactivate'}`, {
    method: 'POST',
  })
}

export interface ProvisionedUser {
  user: { id: string; name: string; email: string; role: string | null }
  verificationEmailSent: boolean
}

export function onboardSchoolAdmin(
  schoolId: string,
  input: { name: string; email: string },
): Promise<ProvisionedUser> {
  return apiFetch<ProvisionedUser>(`/api/v1/schools/${schoolId}/admins`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// --- School-scoped reads (admin inspection + school portal) -----------------

export interface SchoolSettings {
  id: string
  name: string
  shortCode: string
  status: SchoolStatus
  createdAt: string
  hasDefaultPassword: boolean
}

export function fetchSchoolSettings(id: string): Promise<SchoolSettings> {
  return apiFetch<SchoolSettings>(`/api/v1/schools/${id}/settings`)
}

export interface SchoolOverviewCounts {
  students: number
  professionals: number
  totalUsers: number
  pendingChatRequests: number
}

export function fetchSchoolOverview(id: string): Promise<SchoolOverviewCounts> {
  return apiFetch<SchoolOverviewCounts>(`/api/v1/schools/${id}/overview`)
}

export type ChatThreadStatus = 'PENDING' | 'ACTIVE' | 'CLOSED'

export interface SchoolChatThread {
  id: string
  status: ChatThreadStatus
  createdAt: string
  claimedAt: string | null
  closedAt: string | null
  student: { id: string; name: string }
  professional: { id: string; name: string } | null
  lastMessageAt: string | null
  messageCount: number
}

export function fetchSchoolChatThreads(
  id: string,
  opts: { status?: ChatThreadStatus; limit?: number } = {},
): Promise<{ items: SchoolChatThread[] }> {
  const params = new URLSearchParams()
  if (opts.status) params.set('status', opts.status)
  if (opts.limit) params.set('limit', String(opts.limit))
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return apiFetch<{ items: SchoolChatThread[] }>(
    `/api/v1/schools/${id}/chat-threads${suffix}`,
  )
}

export interface SchoolUserRow {
  id: string
  name: string
  email: string
  role: string | null
  emailVerified: boolean
  mustChangePassword: boolean | null
  deactivatedAt: string | null
  createdAt: string
  studentProfile: {
    studentCode: string
    firstName: string
    lastName: string | null
    classLabel: string | null
    preferredLanguage: string | null
  } | null
  professionalProfile: {
    title: string | null
    department: string | null
    available: boolean
  } | null
}

export function fetchSchoolUsers(
  id: string,
  role?: string,
): Promise<{ items: SchoolUserRow[] }> {
  const suffix = role ? `?role=${role}` : ''
  return apiFetch<{ items: SchoolUserRow[] }>(`/api/v1/schools/${id}/users${suffix}`)
}

// --- Users register (platform-wide) -----------------------------------------

export interface AdminUserRow {
  id: string
  name: string
  email: string
  role: string | null
  schoolId: string | null
  emailVerified: boolean
  createdAt: string
  school: { id: string; name: string; shortCode: string } | null
}

export function fetchAdminUsers(params: {
  q?: string
  role?: string
  schoolId?: string
  limit?: number
  offset?: number
}): Promise<{ items: AdminUserRow[]; total: number }> {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.role) search.set('role', params.role)
  if (params.schoolId) search.set('schoolId', params.schoolId)
  if (params.limit) search.set('limit', String(params.limit))
  if (params.offset) search.set('offset', String(params.offset))
  const suffix = search.size > 0 ? `?${search.toString()}` : ''
  return apiFetch<{ items: AdminUserRow[]; total: number }>(
    `/api/v1/admin/users${suffix}`,
  )
}

/**
 * Delete any account platform-wide — the same irreversible erasure the
 * backend runs for a student's own deletion request, on the owner's
 * authority. Refused for the caller's own account and for the last platform
 * admin left.
 */
export function erasePlatformUser(
  userId: string,
): Promise<{
  id: string
  erased: boolean
  removedCheckIns: number
  removedConversations: number
}> {
  return apiFetch(`/api/v1/admin/users/${userId}/erase`, {
    method: 'POST',
    body: JSON.stringify({ confirm: true }),
  })
}

export function resendPlatformUserVerification(
  userId: string,
): Promise<{ id: string; sent: boolean; alreadyVerified: boolean }> {
  return apiFetch(`/api/v1/admin/users/${userId}/resend-verification`, {
    method: 'POST',
  })
}

// --- Hosted inference endpoints ---------------------------------------------

/**
 * What an endpoint answered to a probe. The backend can only see the data
 * plane, so `waking` covers "still scaling up" as much as "configured but
 * broken" — the two are told apart by trying again, not by this call.
 */
export type AiEndpointState =
  | 'awake'
  | 'waking'
  | 'reached'
  | 'unreachable'
  | 'not_configured'

interface AiEndpointIdentity {
  id: string
  purpose: 'asr' | 'llm'
  language: string | null
  label: string
  model: string
}

export interface AiEndpointInfo extends AiEndpointIdentity {
  configured: boolean
}

export interface AiEndpointStatus extends AiEndpointIdentity {
  state: AiEndpointState
  httpStatus: number | null
  latencyMs: number | null
}

/** Reads configuration only — contacts nothing, so it cannot wake a replica. */
export function fetchAiEndpoints(): Promise<AiEndpointInfo[]> {
  return apiFetch<AiEndpointInfo[]>('/api/v1/admin/ai/endpoints')
}

/**
 * Ask every endpoint for a replica. This is the paid action: it starts GPU that
 * then bills until it idles back to zero, and the backend records it in the
 * audit trail. Returns what each endpoint said straight away — the replicas
 * themselves take minutes to load.
 */
export function wakeAiEndpoints(): Promise<AiEndpointStatus[]> {
  return apiFetch<AiEndpointStatus[]>('/api/v1/admin/ai/endpoints/wake', {
    method: 'POST',
  })
}
