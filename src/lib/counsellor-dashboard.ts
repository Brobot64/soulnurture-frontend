// School-scoped, read-only staff overview. Counts are independent of row limits.

import { apiFetch } from '#/lib/api'
import type { IndicatorLevel } from '#/lib/indicators'
import type { RequestStatus, SupportTiming, Urgency } from '#/lib/support-queue'

export interface CounsellorFlag {
  id: string
  studentRef: string
  classLabel: string | null
  triggerLabel: string
  category: string | null
  severity: 'TIER_1_MODERATE' | 'TIER_2_HIGH' | 'TIER_3_ACUTE'
  /** Doc A level, on its own axis: null means no rule graded it, not a mild one. */
  level: IndicatorLevel | null
  status: 'OPEN' | 'IN_REVIEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED'
  conversationId: string | null
  createdAt: string
}

/** A request awaiting a first action, as the overview shows it. */
export interface CounsellorRequestRow {
  id: string
  status: RequestStatus
  timing: SupportTiming
  urgency: Urgency
  note: string | null
  initialMessage: string | null
  initialMessageAt: string | null
  createdAt: string
  /** The current staff member's read receipt, independent of workflow status. */
  readAt: string | null
  conversationId: string | null
  supportPerson: { id: string; name: string; type: string; title: string | null }
  student: {
    firstName: string
    lastName: string | null
    displayName: string | null
    classLabel: string | null
    studentCode: string | null
    studentRef: string | null
  }
}

export interface CounsellorDashboardData {
  flags: CounsellorFlag[]
  barometer: {
    total: number
    dominant: string | null
    distribution: Record<string, number>
    notes: string
  }
  /** Most pressing first — urgent rows, then newest — capped at 20. */
  supportRequests: CounsellorRequestRow[]
  /** Every PENDING + ESCALATED request, not the capped rows above. */
  pendingRequestCount: number
  /** Every URGENT awaiting request, before the row cap and regardless of read state. */
  urgentRequestCount: number
  /** Every awaiting request unread by the current staff member, before the row cap. */
  unreadRequestCount: number
  /** Every request with stored status ESCALATED, before the row cap. */
  escalatedRequestCount: number
  /** Flags with status OPEN only; the list below also shows in-review and
   * acknowledged ones. Renamed from `escalatedFlagCount`, which never counted
   * escalated flags. */
  openFlagCount: number
  upcomingDropIn: null
}

export function fetchCounsellorDashboard(): Promise<CounsellorDashboardData> {
  return apiFetch<CounsellorDashboardData>('/api/v1/dashboard/counsellor')
}
