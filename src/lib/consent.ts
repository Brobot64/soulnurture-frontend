// AI consent gate — mirrors the backend `v1/ai/disclosure` endpoints.
// The disclosure copy lives server-side: it IS the consent instrument, so the
// client renders whatever version the backend serves and never ships its own
// wording. Bumping AI_DISCLOSURE_VERSION re-prompts every student once.

import { apiFetch, ApiError } from '#/lib/api'

export interface AiDisclosureSection {
  id: string
  heading: string
  items: string[]
}

export interface AiDisclosureGroup {
  id: string
  title: string
  summary: string
  sections: AiDisclosureSection[]
}

export interface AiDisclosureAgreement {
  id: string
  label: string
}

export interface AiDisclosure {
  version: string
  consentVersion: string
  title: string
  intro: string
  groups: AiDisclosureGroup[]
  agreements: AiDisclosureAgreement[]
  confirmLabel: string
  declineLabel: string
  /** Flattened plain text of the whole disclosure — for screen readers / logging. */
  text: string
}

export interface AiDisclosureStatus {
  version: string
  accepted: boolean
  acceptedAt: string | null
}

/** Discriminator the backend sends with the 403 that blocks an unconsented AI turn. */
export const CONSENT_REQUIRED_CODE = 'CONSENT_REQUIRED'

export function fetchDisclosure(): Promise<AiDisclosure> {
  return apiFetch<AiDisclosure>('/api/v1/ai/disclosure')
}

export function fetchDisclosureStatus(): Promise<AiDisclosureStatus> {
  return apiFetch<AiDisclosureStatus>('/api/v1/ai/disclosure/status')
}

export function acknowledgeDisclosure(
  agreements: string[],
): Promise<{ acknowledged: boolean }> {
  return apiFetch<{ acknowledged: boolean }>('/api/v1/ai/disclosure/acknowledge', {
    method: 'POST',
    body: JSON.stringify({ agreements }),
  })
}

/**
 * True when the backend refused an AI turn because the current disclosure was
 * never accepted. Checked by code, not by status alone — 403 is also used for
 * "this conversation belongs to another student".
 */
export function isConsentRequired(caught: unknown): boolean {
  return caught instanceof ApiError && caught.code === CONSENT_REQUIRED_CODE
}
