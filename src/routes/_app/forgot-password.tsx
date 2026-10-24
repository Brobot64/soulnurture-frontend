import { useRef, useState, type FormEvent } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'

import { AuthField, AuthShell } from '#/components/AuthShell'
import { Spinner, StatusBadge } from '#/components/StatusBadge'
import { ApiError } from '#/lib/api'
import { requestPasswordReset } from '#/lib/password-reset'

export const Route = createFileRoute('/_app/forgot-password')({
  head: () => ({
    meta: [
      { title: 'Forgot password · Soul Nurture AI' },
      { name: 'description', content: 'Request a link to reset your account password.' },
    ],
  }),
  component: ForgotPassword,
})

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [requested, setRequested] = useState(false)
  const submitting = useRef(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current || requested) return
    setError(null)
    if (!email.trim()) {
      setError('Enter the email you use to sign in.')
      return
    }
    submitting.current = true
    setBusy(true)
    try {
      await requestPasswordReset(email)
      setEmail('')
      setRequested(true)
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 429
          ? 'Too many requests. Please wait a little before trying again.'
          : 'We couldn’t request a reset link right now. Check your connection and try again.',
      )
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <AuthShell
      illustrated
      title={requested ? 'Check your inbox' : 'Forgot your password?'}
      subtitle={
        requested
          ? 'Here’s what to do next.'
          : 'Enter the email you use to sign in to request a password reset link.'
      }
      footer={
        <Link
          to="/signin"
          search={{}}
          className="mt-7 inline-flex min-h-11 items-center font-medium text-action transition-colors hover:text-brand-4"
        >
          Back to sign in
        </Link>
      }
    >
      {requested ? (
        <div className="flex flex-col gap-5 rounded-panel border border-hairline bg-white p-6">
          <span
            aria-hidden="true"
            className="grid size-[72px] place-items-center rounded-full bg-panel text-action"
          >
            <MailCheck className="size-8" />
          </span>
          <StatusBadge tone="success">
            If an account matches that email, you’ll receive a link to reset your password.
          </StatusBadge>
          <p className="text-copy text-body">
            It may take a few minutes. Check your spam or junk folder too.
          </p>
          <p className="text-copy text-body">
            If you can’t access your email or still need help, contact your school administrator.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} aria-busy={busy}>
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-5">
            <legend className="sr-only">Request a password reset link</legend>
            {error && <StatusBadge tone="error">{error}</StatusBadge>}
            <AuthField
              id="reset-email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="mt-1 inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-pill bg-action px-6 py-3 text-button text-white transition-colors hover:bg-brand-4 disabled:opacity-50 lg:min-h-[56px] lg:w-fit lg:self-start"
            >
              {busy ? (
                <>
                  <Spinner />
                  Requesting link…
                </>
              ) : (
                'Send reset link'
              )}
            </button>
          </fieldset>
        </form>
      )}
    </AuthShell>
  )
}
