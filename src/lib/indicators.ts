// Staff "Support indicators" review surface — mirrors
// GET /api/v1/support-flags[?level=&severity=&status=&q=], GET /:id and
// POST /:id/review-decision (Natlas backend, Doc A US-D02/D10).
//
// A level is a dimension of its own: it is never derived from `severity`, never
// inferred from an emotion word, and never filled in when no approved rule graded
// the flag. So `level: null` renders as "Unclassified" — a real bucket a reviewer
// can filter — and `Level U` renders as unclear evidence, not a milder Level A.

import { apiFetch } from '#/lib/api'
import type { RequestStatus } from '#/lib/support-queue'

/** The newest student-initiated request sharing this flag’s conversation, when
 * one exists. A reference across two records — its status never moves the
 * indicator’s own, and `null` means none was found (US-D05). */
export interface LinkedRequestRef {
  id: string
  status: RequestStatus
}

export const INDICATOR_LEVELS = ['A', 'B', 'C', 'U'] as const
export type IndicatorLevel = (typeof INDICATOR_LEVELS)[number]

/** A level chip can also ask for the rows no graded rule produced. */
export type LevelFilter = IndicatorLevel | 'UNCLASSIFIED'

export type FlagSeverity = 'TIER_1_MODERATE' | 'TIER_2_HIGH' | 'TIER_3_ACUTE'

export type FlagStatus = 'OPEN' | 'IN_REVIEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED'

export type FlagSource = 'AI_CANDIDATE' | 'SERVER_POLICY' | 'PROFESSIONAL' | 'SELF_REPORT'

/** The three reviewer decisions the server accepts. There is no fourth
 * "closed" value here: recording a decision must not close the record. */
export const REVIEW_DECISIONS = [
  'NO_FURTHER_ACTION',
  'FOLLOW_UP_WITH_STUDENT',
  'FOLLOW_SAFEGUARDING_PROCEDURE',
] as const

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number]

export const REVIEW_DECISION_LABELS: Record<ReviewDecision, string> = {
  NO_FURTHER_ACTION: 'No further action',
  FOLLOW_UP_WITH_STUDENT: 'Follow up with student',
  FOLLOW_SAFEGUARDING_PROCEDURE: 'Follow safeguarding procedure',
}

export interface IndicatorFlagRow {
  id: string
  studentRef: string
  classLabel: string | null
  triggerLabel: string
  category: string | null
  intentId: string | null
  severity: FlagSeverity
  level: IndicatorLevel | null
  ruleId: string | null
  ruleVersion: string | null
  reviewDecision: ReviewDecision | null
  studentStatementSnapshot: string | null
  status: FlagStatus
  source: FlagSource
  aiContextSummary: string | null
  autoActions: string[]
  conversationId: string | null
  linkedRequest: LinkedRequestRef | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

export interface LevelCounts {
  A: number
  B: number
  C: number
  U: number
  UNCLASSIFIED: number
}

export interface IndicatorFlagList {
  items: IndicatorFlagRow[]
  /** Open work school-wide — a separate fact from what the current filter shows. */
  openCount: number
  levelCounts: LevelCounts
}

/** US-D02: the four kinds of content arrive as four named sections, never merged. */
export interface IndicatorFlagDetail {
  studentReported: { statement: string | null; triggerLabel: string }
  systemMetadata: {
    id: string
    level: IndicatorLevel | null
    severity: FlagSeverity
    status: FlagStatus
    source: FlagSource
    category: string | null
    intentId: string | null
    autoActions: string[]
    createdAt: string
    updatedAt: string
    resolvedAt: string | null
    conversationId: string | null
    linkedRequest: LinkedRequestRef | null
    ruleId: string | null
    ruleVersion: string | null
    ruleLabel: string | null
    ruleConfigured: boolean | null
    ruleBlockedOn: string | null
    /** What graded `level`. No IND-* rule is switched on, so the automatic
     * writers are `INTENT_MAPPING` — the §3 condition that fired — and
     * `AI_TIER`, the alert tier the AI asserted for a flag no condition graded.
     * Both name a mapping no reviewer has signed, never a clinical assessment.
     * Null means the flag has no level. */
    levelSource: 'INDICATOR_RULE' | 'INTENT_MAPPING' | 'AI_TIER' | null
    levelSourceVersion: string | null
  }
  aiSummary: string | null
  humanDecision: { reviewDecision: ReviewDecision | null; decisions: ReviewDecision[] }
  student: { ref: string; classLabel: string | null }
}

export const LEVEL_CHIPS: { value: LevelFilter | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'A', label: 'Level A' },
  { value: 'B', label: 'Level B' },
  { value: 'C', label: 'Level C' },
  { value: 'U', label: 'Level U' },
  { value: 'UNCLASSIFIED', label: 'Unclassified' },
]

/** The number on the "All" chip is the same set the chip returns: every level
 * bucket under the current severity/status filters. */
export function levelTotal(counts: LevelCounts): number {
  return counts.A + counts.B + counts.C + counts.U + counts.UNCLASSIFIED
}

export function levelCountFor(counts: LevelCounts, chip: LevelFilter | 'ALL'): number {
  return chip === 'ALL' ? levelTotal(counts) : counts[chip]
}

/** Server enum names are the only copy here; de-snake-casing them adds no claim. */
export function enumLabel(value: string | null | undefined): string {
  if (!value) return 'Not recorded'
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')
}

const root = '/api/v1/support-flags'

export function fetchIndicatorFlags(filters: {
  level?: LevelFilter
  severity?: FlagSeverity
  status?: FlagStatus
  q?: string
}): Promise<IndicatorFlagList> {
  const params = new URLSearchParams()
  if (filters.level) params.set('level', filters.level)
  if (filters.severity) params.set('severity', filters.severity)
  if (filters.status) params.set('status', filters.status)
  if (filters.q?.trim()) params.set('q', filters.q.trim())
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return apiFetch<IndicatorFlagList>(`${root}${suffix}`)
}

export function fetchIndicatorFlag(id: string): Promise<IndicatorFlagDetail> {
  return apiFetch<IndicatorFlagDetail>(`${root}/${encodeURIComponent(id)}`)
}

/** Records the reviewer’s read. Moves no workflow status (Doc A G4). */
export function recordIndicatorDecision(id: string, decision: ReviewDecision) {
  return apiFetch<{
    message: string
    decision: ReviewDecision
    /** Server write time, so the confirmation does not quote the reviewer’s clock. */
    recordedAt: string
    /** The status this write left untouched — the confirmation has to name it. */
    status: FlagStatus
  }>(`${root}/${encodeURIComponent(id)}/review-decision`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  })
}

export function acknowledgeIndicator(id: string) {
  return apiFetch<{ message: string }>(
    `${root}/${encodeURIComponent(id)}/acknowledge`,
    { method: 'POST' },
  )
}

export function markIndicatorInReview(id: string) {
  return apiFetch<{ message: string }>(
    `${root}/${encodeURIComponent(id)}/in-review`,
    { method: 'POST' },
  )
}
