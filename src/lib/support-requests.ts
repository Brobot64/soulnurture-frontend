// Student-owned, read-only support requests. Creation stays on the secure chat API.
import { apiFetch } from '#/lib/api'
import type { SupportPersonType } from '#/lib/support'

export const SUPPORT_REQUEST_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'ESCALATED',
] as const

export type SupportRequestStatus = (typeof SUPPORT_REQUEST_STATUSES)[number]
export type SupportRequestTiming = 'GENTLE_1_2_DAYS' | 'TODAY_STUDY_PERIOD' | 'URGENT_UNSAFE'

export const SUPPORT_STATUS_INFO: Record<SupportRequestStatus, {
  label: string
  description: string
  guidance: string
  className: string
}> = {
  PENDING: {
    label: 'Pending',
    description: 'Your request is waiting for a school professional to review it.',
    guidance: 'You can return here to check its current status. There is no guaranteed response time.',
    className: 'bg-peach text-peach-ink',
  },
  ACCEPTED: {
    label: 'Accepted',
    description: 'A school professional has accepted your request.',
    guidance: 'Acceptance does not mean an appointment has been scheduled. Check the request for any schedule details.',
    className: 'bg-panel text-brand-4',
  },
  SCHEDULED: {
    label: 'Scheduled',
    description: 'Your request has been marked as scheduled.',
    guidance: 'Check your request for a time and location, if provided. Ask your school if you need to confirm arrangements.',
    className: 'bg-panel text-brand-4',
  },
  IN_PROGRESS: {
    label: 'In progress',
    description: 'A school professional has marked support for this request as in progress.',
    guidance: 'Follow the arrangements you have agreed with your school. This status does not mean someone is online.',
    className: 'bg-surface text-brand-4',
  },
  COMPLETED: {
    label: 'Completed',
    description: 'A school professional has marked this request as completed.',
    guidance: 'You can still ask to talk if you need more support.',
    className: 'bg-action text-white',
  },
  CANCELLED: {
    label: 'Cancelled',
    description: 'This request has been marked as cancelled.',
    guidance: 'You can ask to talk again if you still need support.',
    className: 'bg-surface text-body',
  },
  ESCALATED: {
    label: 'Escalated',
    description: 'This request has been flagged for additional attention.',
    guidance: 'This does not confirm an emergency response or that help has been dispatched. In immediate danger, seek help directly.',
    className: 'bg-peach text-peach-ink',
  },
}

export const SUPPORT_TIMING_LABELS: Record<SupportRequestTiming, string> = {
  GENTLE_1_2_DAYS: 'Within 1–2 days',
  TODAY_STUDY_PERIOD: 'Today, during a study period',
  URGENT_UNSAFE: 'Urgent / feeling unsafe',
}

/** Only student-visible fields are retained; staff notes and extra person data are excluded. */
export interface StudentSupportRequest {
  id: string
  personType: SupportPersonType
  timing: SupportRequestTiming
  note: string | null
  status: SupportRequestStatus
  scheduledAt: string | null
  locationLabel: string | null
  createdAt: string
  updatedAt: string
  supportPerson: {
    id: string
    name: string
    type: SupportPersonType
    title: string | null
  }
}

function studentVisibleRequest(request: StudentSupportRequest): StudentSupportRequest {
  return {
    id: request.id,
    personType: request.personType,
    timing: request.timing,
    note: request.note,
    status: request.status,
    scheduledAt: request.scheduledAt,
    locationLabel: request.locationLabel,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    supportPerson: {
      id: request.supportPerson.id,
      name: request.supportPerson.name,
      type: request.supportPerson.type,
      title: request.supportPerson.title,
    },
  }
}

export async function fetchStudentSupportRequests(): Promise<StudentSupportRequest[]> {
  const { items } = await apiFetch<{ items: StudentSupportRequest[] }>('/api/v1/support-requests')
  return items.map(studentVisibleRequest)
}

export async function fetchStudentSupportRequest(id: string): Promise<StudentSupportRequest> {
  const request = await apiFetch<StudentSupportRequest>(
    `/api/v1/support-requests/${encodeURIComponent(id)}`,
  )
  return studentVisibleRequest(request)
}

export function supportStatusInfo(status: SupportRequestStatus) {
  return SUPPORT_STATUS_INFO[status] ?? {
    label: 'Status unavailable',
    description: 'The current request status could not be recognised.',
    guidance: 'Refresh this page or contact your school for clarification.',
    className: 'bg-surface text-body',
  }
}

/** Include the year and local time zone; do not turn missing dates into invented events. */
export function supportTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  }).format(date)
}
