// One call that backs the staff rail's badges. See AttentionService on the
// backend: a null is "not your page", which the rail draws as no badge at all,
// while a number is what that page will report when it opens.

import { apiFetch } from '#/lib/api'

export interface AttentionCounts {
  indicators: number | null
  reports: number | null
  roster: number | null
}

export function fetchAttentionCounts(): Promise<AttentionCounts> {
  return apiFetch<AttentionCounts>('/api/v1/dashboard/attention')
}
