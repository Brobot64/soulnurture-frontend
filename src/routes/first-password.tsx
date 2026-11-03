import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check, KeyRound } from 'lucide-react'

import { AuthField, AuthShell } from '#/components/AuthShell'
import { Spinner, StatusBadge } from '#/components/StatusBadge'
import { ApiError } from '#/lib/api'
import { firstPassword, homeForRole, refreshSession, useSession } from '#/lib/auth'

export const Route = createFileRoute('/first-password')({
  head: () => ({
    meta: [
      { title: 'Choose a new password · Soul Nurture AI' },
      {
        name: 'description',
        content:
          'Your school set a temporary password for your first sign-in. Choose your own before continuing.',
      },
    ],
  }),
  component: FirstPassword,
})

/// The three rules the design shows ticking off as the student types. The
/// server only enforces length, so the client is the stricter of the two.
const RULES: { id: string; label: string; ok: (value: string) => boolean }[] = [
  { id: 'length', label: 'At least 8 characters', ok: (value) => value.length >= 8 },
  { id: 'letter', label: 'At least one letter', ok: (value) => /[A-Za-z]/.test(value) },
  { id: 'number', label: 'At least one number', ok: (value) => /\d/.test(value) },
]

function RequirementList({ password }: { password: string }) {
  return (
    <ul className="mt-3 flex flex-col gap-1.5" aria-label="Password requirements">
      {RULES.map((rule) => {
        const met = rule.ok(password)
        return (
          <li
            key={rule.id}
            className={`flex items-center gap-2 text-caption ${met ? 'font-medium text-action' : 'text-muted'}`}
          >
            {met ? (
              <Check className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <span className="size-4 shrink-0 rounded-full border border-hairline" aria-hidden="true" />
            )}
            {rule.label}
            <span className="sr-only">{met ? 'met' : 'not met yet'}</span>
          </li>
        )
      })}
    </ul>
  )
}

/// Standalone (no app/dash chrome): accounts land here mid-onboarding, on the
/// school's default password, and leave with their own.
function FirstPassword() {
  const navigate = useNavigate()
  const { user, status } = useSession()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const forced = status === 'ready' && !!user?.mustChangePassword

  useEffect(() => {
    if (status !== 'ready') return
    if (!user) {
      void navigate({ to: '/signin', replace: true })
      return
    }
    if (!user.mustChangePassword) {
      void navigate({ to: homeForRole(user), replace: true })
    }
  }, [status, user, navigate])

  if (!forced) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page">
        <Spinner className="size-8 text-brand-4" />
      </div>
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError(null)
    if (RULES.some((rule) => !rule.ok(password))) {
      setError('Use at least 8 characters, with one letter and one number.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const fresh = await firstPassword(password)
      void navigate({ to: homeForRole(fresh), replace: true })
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null
      if (apiError?.code === 'PASSWORD_CHANGE_NOT_REQUIRED') {
        // Already changed elsewhere — refresh so the stale flag drops, then go home.
        const fresh = await refreshSession()
        void navigate({ to: homeForRole(fresh), replace: true })
        return
      }
      setError(apiError?.message ?? 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <AuthShell
        illustrated
        standalone
        panel={{
          Icon: KeyRound,
          heading: 'A password just for you',
          caption: 'Your school account stays the same. Your password is the key only you hold.',
        }}
        title="Create unique password"
        subtitle="Create a unique password you can remember."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && <StatusBadge tone="error">{error}</StatusBadge>}

          <div>
            <AuthField
              id="new-password"
              label="Create your new password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={8}
              required
            />
            <RequirementList password={password} />
          </div>
          <div>
            <AuthField
              id="confirm-password"
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              required
            />
            {confirm && (
              <p
                className={`mt-2 flex items-center gap-2 text-caption ${
                  password === confirm ? 'font-medium text-action' : 'text-destructive'
                }`}
              >
                {password === confirm && <Check className="size-4" aria-hidden="true" />}
                {password === confirm ? 'Passwords match' : 'Passwords do not match yet'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-1 inline-flex h-[52px] w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4 disabled:opacity-50 lg:h-[56px] lg:w-fit lg:self-start"
          >
            {busy ? (
              <>
                <Spinner />
                Saving…
              </>
            ) : (
              'Activate my account'
            )}
          </button>
          <p className="text-caption text-muted">
            You will be signed in automatically and taken to your dashboard.
          </p>
        </form>
      </AuthShell>
    </div>
  )
}
