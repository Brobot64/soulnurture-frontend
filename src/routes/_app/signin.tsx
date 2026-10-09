import { useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { AuthField, AuthShell } from '#/components/AuthShell'
import { Spinner, StatusBadge } from '#/components/StatusBadge'
import { ApiError } from '#/lib/api'
import { homeForRole, signIn } from '#/lib/auth'

export const Route = createFileRoute('/_app/signin')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = search.redirect
    return {
      redirect:
        typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
          ? redirect
          : undefined,
    }
  },
  head: () => ({
    meta: [
      { title: 'Sign in · Soul Nurture AI' },
      {
        name: 'description',
        content:
          'Sign in to pick up where you left off — your check-ins, reflections and the people you can talk to are waiting.',
      },
    ],
  }),
  component: SignIn,
})

function SignIn() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    const trimmedEmail = email.trim()
    try {
      const user = await signIn({ email: trimmedEmail, password })
      const target =
        redirect && redirect !== '/signin' && !user?.mustChangePassword
          ? redirect
          : homeForRole(user)
      navigate({ to: target as '/welcome', replace: true })
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null
      if (apiError?.code === 'EMAIL_NOT_VERIFIED' || apiError?.status === 403) {
        navigate({ to: '/verify', search: { email: trimmedEmail }, replace: true })
        return
      }
      if (apiError?.status === 401) {
        setError('Email or password is incorrect.')
      } else {
        setError(apiError?.message ?? 'Something went wrong. Please try again.')
      }
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <p className="mt-7 text-copy text-body">
          New here? Accounts are set up by your school — ask your school office.
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <StatusBadge tone="error">{error}</StatusBadge>}

        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          disabled={busy}
          className="mt-1 inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4 disabled:opacity-50 lg:h-[56px]"
        >
          {busy ? (
            <>
              <Spinner />
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </AuthShell>
  )
}
