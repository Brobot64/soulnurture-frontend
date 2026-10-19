import { ApiError, apiFetch } from '#/lib/api'

interface PasswordResetResponse {
  status: boolean
}

export async function requestPasswordReset(email: string): Promise<void> {
  // Never accept a callback from search parameters or callers.
  const redirectTo = new URL('/reset-password', window.location.origin).href
  const response = await apiFetch<PasswordResetResponse | null>(
    '/api/auth/request-password-reset',
    {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), redirectTo }),
    },
  )
  if (response?.status !== true) {
    throw new ApiError('Could not request a password reset. Please try again.', 502)
  }
}

export async function resetPassword(input: {
  token: string
  newPassword: string
}): Promise<void> {
  const response = await apiFetch<PasswordResetResponse | null>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: input.token, newPassword: input.newPassword }),
  })
  if (response?.status !== true) {
    throw new ApiError('Could not reset your password. Please try again.', 502)
  }
}
