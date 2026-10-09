// School-portal writes — onboarding students and professionals, profile
// edits, account lifecycle, credential reset and the school default password.

import { apiFetch } from '#/lib/api'
import type { ProvisionedUser } from '#/lib/admin'
import { CHAT_STAFF_ROLES, roleLabel } from '#/lib/auth'

export type StaffRole = (typeof CHAT_STAFF_ROLES)[number]

export const STAFF_ROLE_OPTIONS = CHAT_STAFF_ROLES.map((role) => ({
  value: role,
  label: roleLabel(role),
}))

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'yo', label: 'Yorùbá' },
  { value: 'ha', label: 'Hausa' },
  { value: 'ig', label: 'Igbo' },
]

// --- Onboarding -------------------------------------------------------------

export interface OnboardedStudent {
  user: { id: string; name: string; email: string; role: string | null }
  studentCode: string
  verificationEmailSent: boolean
}

export function onboardStudent(
  schoolId: string,
  input: {
    email: string
    firstName: string
    lastName?: string
    classLabel?: string
    phone?: string
    preferredLanguage?: string
  },
): Promise<OnboardedStudent> {
  return apiFetch<OnboardedStudent>(`/api/v1/schools/${schoolId}/students`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function onboardProfessional(
  schoolId: string,
  input: {
    email: string
    name: string
    role: StaffRole
    title?: string
    department?: string
  },
): Promise<ProvisionedUser> {
  return apiFetch<ProvisionedUser>(
    `/api/v1/schools/${schoolId}/professionals`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

// --- Profile edits ----------------------------------------------------------

export interface UpdateSchoolUserInput {
  name?: string
  phone?: string
  classLabel?: string
  preferredLanguage?: string
  title?: string
  department?: string
}

export function updateSchoolUser(
  schoolId: string,
  userId: string,
  input: UpdateSchoolUserInput,
): Promise<{ updated: true }> {
  return apiFetch<{ updated: true }>(
    `/api/v1/schools/${schoolId}/users/${userId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
}

// --- Lifecycle --------------------------------------------------------------

export function deactivateSchoolUser(
  schoolId: string,
  userId: string,
): Promise<{ id: string; deactivated: boolean }> {
  return apiFetch(`/api/v1/schools/${schoolId}/users/${userId}`, {
    method: 'DELETE',
  })
}

export function reactivateSchoolUser(
  schoolId: string,
  userId: string,
): Promise<{ id: string; deactivated: boolean }> {
  return apiFetch(`/api/v1/schools/${schoolId}/users/${userId}/reactivate`, {
    method: 'POST',
  })
}

export function resetSchoolUserPassword(
  schoolId: string,
  userId: string,
): Promise<{ id: string; passwordReset: true }> {
  return apiFetch(
    `/api/v1/schools/${schoolId}/users/${userId}/reset-password`,
    { method: 'POST' },
  )
}

// --- Settings ---------------------------------------------------------------

export function updateSchoolDefaultPassword(
  schoolId: string,
  defaultPassword: string,
): Promise<{ defaultPasswordUpdated: true }> {
  return apiFetch(`/api/v1/schools/${schoolId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify({ defaultPassword }),
  })
}
