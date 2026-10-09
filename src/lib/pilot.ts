// Pilot analytics — aggregate-only reads for the super-admin dashboard.
//   GET /api/v1/admin/pilot           envelope-wrapped JSON snapshot
//   GET /api/v1/admin/pilot/report    raw CSV attachment (envelope bypassed)

import { API_BASE_URL, ApiError, apiFetch } from '#/lib/api'

/**
 * Window selector: a `days` preset, or an explicit `from`/`to` pair
 * (YYYY-MM-DD, inclusive). Optional `schoolId` scopes to one school.
 */
export interface PilotQuery {
  days?: number
  from?: string
  to?: string
  schoolId?: string
}

export interface PilotWindow {
  /** ISO timestamp at UTC midnight of the first day. */
  from: string
  /** Last day, YYYY-MM-DD inclusive. */
  to: string
  days: number
}

export interface PilotSchool {
  id: string
  name: string
  shortCode: string
}

export interface PilotSuppression {
  threshold: number
  note: string
}

export interface PilotOverview {
  studentsOnboarded: number
  newStudents: number
  activeStudents: number
  checkIns: number
  aiInteractions: number
  voiceInteractions: number
  resourcesAccessed: number
  supportRequests: number
  completedReferrals: number
  avgSatisfaction: { available: boolean; reason: string }
}

export interface PilotEngagementPoint {
  date: string
  activeUsers: number
  checkIns: number
}

export interface PilotEngagement {
  active: number
  dau: number
  wau: number
  mau: number
  new: number
  returning: number
  /** null when the previous window is empty — rendered as "—". */
  returnRate: number | null
  checkInsPerActiveStudent: number | null
  avgSessionsPerStudent: number | null
  avgSessionMinutes: number | null
  textVsVoice: { text: number; voice: number }
  series: PilotEngagementPoint[]
}

export interface PilotFeatureUsageRow {
  id: string
  label: string
  uses: number | null
  students: number | null
  suppressed: boolean
  available: boolean
  note?: string
}

export interface PilotWellbeingThemeRow {
  id: string
  label: string
  mentions: number
  students: number | null
  suppressed: boolean
}

export interface PilotOutcomes {
  available: boolean
  reason: string
}

export interface PilotResourceRow {
  id: string
  title: string
  saves: number
  students: number | null
  suppressed: boolean
}

export interface PilotResourceCategoryRow {
  category: string
  saves: number
  students: number | null
  suppressed: boolean
}

export interface PilotResources {
  note: string
  mostSaved: PilotResourceRow[]
  byCategory: PilotResourceCategoryRow[]
  savesSeries: { date: string; saves: number }[]
  activities: { started: number; completed: number; completionRate: number | null }
}

export interface PilotSupport {
  requests: { total: number; urgent: number; byStatus: Record<string, number> }
  referrals: { created: number; claimed: number; closed: number; avgClaimHours: number | null }
  followUps: { completed: number; open: number }
  unresolved: number
  series: { date: string; requests: number; threads: number }[]
}

export interface PilotSafeguarding {
  flags: {
    total: number
    bySeverity: Record<string, number>
    byStatus: Record<string, number>
  }
  escalations: number
  urgentRequests: number
  followUpStatus: { open: number; resolved: number }
  avgResolutionHours: number | null
}

export interface PilotAnalytics {
  generatedAt: string
  window: PilotWindow
  school: PilotSchool | null
  suppression: PilotSuppression
  overview: PilotOverview
  engagement: PilotEngagement
  featureUsage: PilotFeatureUsageRow[]
  wellbeingThemes: PilotWellbeingThemeRow[]
  outcomes: PilotOutcomes
  resources: PilotResources
  support: PilotSupport
  safeguarding: PilotSafeguarding
}

function queryString(query: PilotQuery): string {
  const params = new URLSearchParams()
  if (query.from && query.to) {
    params.set('from', query.from)
    params.set('to', query.to)
  } else if (query.days) {
    params.set('days', String(query.days))
  }
  if (query.schoolId) params.set('schoolId', query.schoolId)
  return params.size > 0 ? `?${params.toString()}` : ''
}

export function fetchPilotAnalytics(query: PilotQuery = {}): Promise<PilotAnalytics> {
  return apiFetch<PilotAnalytics>(`/api/v1/admin/pilot${queryString(query)}`)
}

/** Mirrors the backend's `soul-nurture-pilot-…` attachment name. */
export function pilotReportFilename(payload: PilotAnalytics): string {
  const from = payload.window.from.slice(0, 10)
  const suffix = payload.school ? `-${payload.school.shortCode}` : ''
  return `soul-nurture-pilot-${from}_${payload.window.to}${suffix}.csv`
}

/**
 * Downloads the CSV attachment. The report route bypasses the JSON envelope
 * and Content-Disposition is not CORS-readable cross-origin, so this is a raw
 * fetch with a client-built filename.
 */
export async function downloadPilotReport(
  query: PilotQuery,
  filename: string,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(
      `${API_BASE_URL}/api/v1/admin/pilot/report${queryString(query)}`,
      { credentials: 'include' },
    )
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0)
  }
  if (!response.ok) {
    throw new ApiError(`The report could not be generated (${response.status}).`, response.status)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
