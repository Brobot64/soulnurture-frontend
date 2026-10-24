// School-scoped, read-only staff overview. Counts are independent of row limits.

import { apiFetch } from '#/lib/api'

export interface CounsellorFlag {
  id: string
  studentRef: string
  classLabel: string | null
  triggerLabel: string
  category: string | null
  severity: 'TIER_1_MODERATE' | 'TIER_2_HIGH' | 'TIER_3_ACUTE'
  status: 'OPEN' | 'IN_REVIEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED'
  conversationId: string | null
  createdAt: string
}

export interface CounsellorDashboardData {
  flags: CounsellorFlag[]
  barometer: {
    total: number
    dominant: string | null
    distribution: Record<string, number>
    notes: string
  }
  // The overview links to the request queue rather than displaying these rows.
  supportRequests: unknown[]
  /** Despite the API name, this counts OPEN flags only. */
  escalatedFlagCount: number
  upcomingDropIn: null
  /** All PENDING + ESCALATED requests, not the capped supportRequests length. */
  pendingRequestCount: number
}

export function fetchCounsellorDashboard(): Promise<CounsellorDashboardData> {
  return apiFetch<CounsellorDashboardData>('/api/v1/dashboard/counsellor')
}
