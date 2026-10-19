import { useRef, useState, type FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { LockKeyhole } from 'lucide-react'

import { AuthField, AuthShell } from '#/components/AuthShell'
import { Spinner, StatusBadge } from '#/components/StatusBadge'
import { ApiError } from '#/lib/api'
import { resetPassword } from '#/lib/password-reset'

export const Route = createFileRoute('/_app/reset-password')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { token?: string; error?: 'INVALID_TOKEN' } => ({
    // Only check syntax here. The backend determines validity and expiry on submit.
    token:
      typeof search.token === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(search.token)
        ? search.token
        : undefined,
    // Any error from the callback blocks the form; never display untrusted query text.
    error: search.error === undefined ? undefined : 'INVALID_TOKEN',
  }),
  head: () => ({
    meta: [
      { title: 'Reset password · Soul Nurture AI' },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: ResetPassword,
})

function ResetPassword() {
  const navigate = useNavigate()
  const { token, error: linkError } = Route.useSearch()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [invalidToken, setInvalidToken] = useState(false)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const blocked = !token || !!linkError || invalidToken

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current || blocked || !token) return
    setError(null)
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }
    if (password !== confirmation) {
      setError('Your passwords don’t match. Enter the same password in both fields.')
      return
    }
    submitting.current = true
    setBusy(true)
    try {
      await resetPassword({ token, newPassword: password })
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null
      if (apiError?.code === 'INVALID_TOKEN' || apiError?.code === 'USER_NOT_FOUND') {
        setInvalidToken(true)
        setPassword('')
        setConfirmation('')
      } else if (apiError?.code === 'PASSWORD_TOO_SHORT') {
        setError('Use at least 8 characters for your new password.')
      } else if (apiError?.code === 'PASSWORD_TOO_LONG') {
        setError('That password is too long. Try a shorter password with at least 8 characters.')
      } else if (apiError?.status === 429) {
        setError('Too many requests. Please wait a little before trying again.')
      } else {
        setError('We couldn’t reset your password right now. Check your connection and try again.')
      }
      submitting.current = false
      setBusy(false)
      return
    }

    setPassword('')
    setConfirmation('')
    // Replace the entire search (and hash), not just the token, once the API succeeds.
    // Keep submission locked until this screen unmounts: reset tokens are single-use.
    void navigate({ to: '/signin', search: { reset: true }, hash: '', replace: true })
  }

  return (
    <AuthShell
      title={blocked ? 'This link can’t be used' : 'Choose a new password'}
      subtitle={
        blocked
          ? 'Request a new reset link to get back to your account.'
          : 'Choose a password you haven’t used before. You’ll use it the next time you sign in.'
      }
      footer={
        <Link
          to="/signin"
          search={{}}
          replace
          className="mt-7 inline-flex min-h-11 items-center font-medium text-action transition-colors hover:text-brand-4"
        >
          Back to sign in
        </Link>
      }
    >
      {blocked ? (
        <div className="flex flex-col gap-5 rounded-panel border border-hairline bg-white p-6">
          <span
            aria-hidden="true"
            className="grid size-[72px] place-items-center rounded-full bg-panel text-action"
          >
            <LockKeyhole className="size-8" />
          </span>
          <StatusBadge tone="error">
            This reset link is missing, invalid or expired. It may have already been used.
          </StatusBadge>
          <Link
            to="/forgot-password"
            search={{}}
            replace
            className="inline-flex min-h-[52px] items-center justify-center rounded-pill bg-action px-6 py-3 text-center text-button text-white transition-colors hover:bg-brand-4 lg:min-h-[56px]"
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} aria-busy={busy}>
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
            <legend className="sr-only">Set your new password</legend>
            {error && <StatusBadge tone="error">{error}</StatusBadge>}
            <AuthField
              id="new-password"
              label="New password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={8}
              hint="Use at least 8 characters."
              required
            />
            <AuthField
              id="confirm-password"
              label="Confirm new password"
              type="password"
              value={confirmation}
              onChange={setConfirmation}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-1 inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-pill bg-action px-6 py-3 text-button text-white transition-colors hover:bg-brand-4 disabled:opacity-50 lg:min-h-[56px]"
            >
              {busy ? (
                <>
                  <Spinner />
                  Resetting password…
                </>
              ) : (
                'Reset password'
              )}
            </button>
          </fieldset>
        </form>
      )}
    </AuthShell>
  )
}
