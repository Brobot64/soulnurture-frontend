import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

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
    if (password.length < 8) {
      setError('Use at least 8 characters.')
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
        title="Choose a new password"
        subtitle="You signed in with a temporary password. Pick one only you know — you'll use it from now on."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {error && <StatusBadge tone="error">{error}</StatusBadge>}

          <AuthField
            id="new-password"
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters."
            required
          />
          <AuthField
            id="confirm-password"
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            required
          />

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
              'Save and continue'
            )}
          </button>
        </form>
      </AuthShell>
    </div>
  )
}
