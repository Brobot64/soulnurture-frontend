// Support-person matching and WhatsApp handoff.
// Mirrors GET /api/v1/support-requests/people from the Natlas backend.
// The WhatsApp number is frontend-side config: VITE_WHATSAPP_NUMBER, with a
// sample fallback until the production line is provisioned.

import { apiFetch } from '#/lib/api'

export type SupportPersonType =
  | 'COUNSELLOR'
  | 'PSYCHOLOGIST'
  | 'TRUSTED_TEACHER'
  | 'PARENT_GUARDIAN'

export interface SupportPerson {
  id: string
  professionalId?: string | null
  name: string
  type: SupportPersonType
  title?: string | null
  availabilityLabel?: string | null
  availableToday: boolean
  imageUrl?: string | null
  active: boolean
}

export const TYPE_LABELS: Record<SupportPersonType, string> = {
  COUNSELLOR: 'School counsellor',
  PSYCHOLOGIST: 'Psychologist',
  TRUSTED_TEACHER: 'Trusted teacher',
  PARENT_GUARDIAN: 'Parent or guardian',
}

export const WHATSAPP_NUMBER =
  (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? '2348130388321'

export async function fetchSupportPeople(): Promise<SupportPerson[]> {
  return apiFetch<SupportPerson[]>('/api/v1/support-requests/people')
}

export function pickRandomPerson(
  people: SupportPerson[],
  excludeId?: string,
): SupportPerson | null {
  const pool = excludeId ? people.filter((person) => person.id !== excludeId) : people
  if (pool.length === 0) return people[0] ?? null
  return pool[Math.floor(Math.random() * pool.length)]
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function handoffMessage(person: SupportPerson, studentName?: string): string {
  const who = studentName?.trim() ? `I'm ${studentName.trim()}, a student` : `I'm a student`
  const hello = person.title ? `Hi ${person.name} (${person.title})` : `Hi ${person.name}`
  return `${hello}, ${who} using Soul Nurture AI. I'd like to talk to someone about how I've been feeling. Is there a good time to talk?`
}

export function whatsappHandoffLink(person: SupportPerson, studentName?: string): string {
  const digits = WHATSAPP_NUMBER.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(handoffMessage(person, studentName))}`
}
