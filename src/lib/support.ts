import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { homeForRole, useSession } from '#/lib/auth'

export type SupportPersonType =
  | 'COUNSELLOR'
  | 'PSYCHOLOGIST'
  | 'SUPPORT_STAFF'
  | 'TRUSTED_TEACHER'
  | 'PARENT_GUARDIAN'

export const TYPE_LABELS: Record<SupportPersonType, string> = {
  COUNSELLOR: 'School counsellor',
  PSYCHOLOGIST: 'Psychologist',
  SUPPORT_STAFF: 'Support staff',
  TRUSTED_TEACHER: 'Trusted teacher',
  PARENT_GUARDIAN: 'Parent or guardian',
}

export const SUPPORT_RESPONSE_NOTICE =
  'An authorised school professional can review your request. Response times vary.'

export const SUPPORT_EMERGENCY_NOTICE =
  'This is not an emergency service and does not send emergency help. If you or someone else is in immediate danger, tell a trusted adult now or contact local emergency services.'

/** Mount data-fetching children only after this guard returns a student. */
export function useStudentSupportAccess(redirect: string) {
  const navigate = useNavigate()
  const { user, status } = useSession()

  useEffect(() => {
    if (status !== 'ready') return
    if (!user) {
      void navigate({ to: '/signin', search: { redirect }, replace: true })
    } else if (user.mustChangePassword || user.role !== 'STUDENT') {
      void navigate({ to: homeForRole(user), replace: true })
    }
  }, [status, user, redirect, navigate])

  return status === 'ready' && user?.role === 'STUDENT' && !user.mustChangePassword
    ? user
    : null
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** International digits with an optional leading +; no sample or inferred number. */
export function whatsappHandoffLink(): string | null {
  const configured = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.trim()
  if (!configured || !/^\+?[1-9]\d{7,14}$/.test(configured)) return null
  const digits = configured.replace(/^\+/, '')
  const message = "Hello, I'm a student using Soul Nurture AI. I'd like to ask about support at school. Is there a good time to talk?"
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
