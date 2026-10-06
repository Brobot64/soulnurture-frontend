import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'

import { AuthField, AuthShell } from '#/components/AuthShell'
import { Spinner, StatusBadge, type StatusTone } from '#/components/StatusBadge'
import { refreshSession, resendVerification } from '#/lib/auth'

export const Route = createFileRoute('/verify')({
  validateSearch: (search: Record<string, unknown>): { email?: string; created?: '1' } => ({
    email:
      typeof search.email === 'string' && search.email.includes('@') ? search.email : undefined,
    created: search.created === '1' ? '1' : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Verify your email · Soul Nurture AI' },
      {
        name: 'description',
        content:
          'One more step — open the link we emailed you to switch on your account, or resend the email if it has not arrived.',
      },
    ],
  }),
  component: Verify,
})

interface Notice {
  tone: StatusTone
  text: string
}

function Verify() {
  const navigate = useNavigate()
  const { email: emailParam, created } = Route.useSearch()
  const [email, setEmail] = useState(emailParam ?? '')
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const handleResend = async () => {
    const trimmed = email.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      await resendVerification(trimmed)
      setNotice({ tone: 'success', text: 'Verification email sent again — check your inbox.' })
    } catch {
      setNotice({ tone: 'error', text: "Couldn't send it right now. Try again in a moment." })
    }
    setSending(false)
  }

  const handleCheck = async () => {
    if (checking) return
    setChecking(true)
    const user = await refreshSession()
    setChecking(false)
    if (user?.emailVerified) {
      navigate({ to: '/welcome', replace: true })
      return
    }
    setNotice({
      tone: 'error',
      text: 'Not verified yet. Open the link in our email, then try again.',
    })
  }

  const badge: Notice | null =
    notice ??
    (created && emailParam
      ? {
          tone: 'success',
          text: `Account created — we sent a verification link to ${emailParam}.`,
        }
      : null)

  return (
    <AuthShell
      title="Check your inbox"
      subtitle={
        emailParam ? (
          <>
            We sent a verification link to{' '}
            <span className="font-medium text-heading">{emailParam}</span>. Open it to finish
            setting up your account.
          </>
        ) : (
          'Open the verification link we emailed you to finish setting up your account.'
        )
      }
      footer={
        <p className="mt-7 text-copy text-body">
          Wrong email?{' '}
          <Link to="/signup" className="font-medium text-action transition-colors hover:text-brand-4">
            Create one with a different address
          </Link>
          <span className="text-muted"> · </span>
          <Link to="/signin" className="font-medium text-action transition-colors hover:text-brand-4">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="flex flex-col gap-5">
        <span
          className="grid size-[72px] place-items-center rounded-full bg-panel text-action"
          aria-hidden="true"
        >
          <MailCheck className="size-8" />
        </span>

        {badge && <StatusBadge tone={badge.tone}>{badge.text}</StatusBadge>}

        {!emailParam && (
          <AuthField
            id="email"
            label="Your email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        )}

        <button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          className="inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4 disabled:opacity-50 lg:h-[56px]"
        >
          {checking ? (
            <>
              <Spinner />
              Checking…
            </>
          ) : (
            "I've verified — continue"
          )}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={sending || !email.trim()}
          className="inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-surface px-8 text-button text-ink transition-colors hover:bg-neutral-10 disabled:opacity-50 lg:h-[56px]"
        >
          {sending ? (
            <>
              <Spinner />
              Sending…
            </>
          ) : (
            'Resend verification email'
          )}
        </button>

        <p className="text-caption text-muted">
          It can take a minute to arrive. Check your spam folder if you don't see it.
        </p>
      </div>
    </AuthShell>
  )
}
