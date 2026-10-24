// Reviewer-facing read of GET /api/v1/ai/config — the guardrails, safeguarding
// intents and language lane the server enforces right now. Every statement on
// the AI-boundaries guide is rendered from this response, so the page can never
// claim more than the running configuration actually does.

import { apiFetch } from '#/lib/api'

export type BannedClaimSeverity = 'severe' | 'soft'

export interface BannedClaimSpec {
  id: string
  severity: BannedClaimSeverity
  patterns: string[]
  reason: string
  replacement: string | null
}

export interface InjectionPatternSpec {
  id: string
  pattern: string
  note: string
}

export interface AiGuardrailConfig {
  input: {
    maxMessageChars: number
    truncationNote: string
    injectionPatterns: InjectionPatternSpec[]
    promptHardeningLine: string
  }
  output: {
    maxReplyChars: number
    truncationNote: string
    bannedClaims: BannedClaimSpec[]
    fallbackCopy: string
  }
  rate: {
    perStudentDaily: number
    perStudentPerMinute: number
    limitMessage: string
  }
}

export type IntentSeverity = 'TIER_1_MODERATE' | 'TIER_2_HIGH' | 'TIER_3_ACUTE'

export interface AiIntentSpec {
  id: string
  label: string
  description: string
  severity: IntentSeverity
  keywords: string[]
  aiCategories: string[]
  actions: string[]
}

export interface AiConfigResponse {
  guardrails: AiGuardrailConfig
  intents: AiIntentSpec[]
  language: {
    supported: string[]
    offerEnabled: boolean
    vernacularReplyMode: string
  }
}

export function fetchAiConfig() {
  return apiFetch<AiConfigResponse>('/api/v1/ai/config')
}
