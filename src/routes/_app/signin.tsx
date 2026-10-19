import { useRef, useState, type FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { AuthField, AuthShell } from '#/components/AuthShell'
import { Spinner, StatusBadge } from '#/components/StatusBadge'
import { ApiError } from '#/lib/api'
import { homeForRole, signIn } from '#/lib/auth'

export const Route = createFileRoute('/_app/signin')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; reset?: boolean } => {
    const redirect = search.redirect
    return {
      redirect:
        typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
          ? redirect
          : undefined,
      reset: search.reset === true || search.reset === 'true' ? true : undefined,
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
  const { redirect, reset } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setError(null)
    setBusy(true)
    const trimmedEmail = email.trim()
    try {
      const user = await signIn({ email: trimmedEmail, password })
      const target =
        redirect && redirect !== '/signin' && !user?.mustChangePassword
          ? redirect
          : homeForRole(user)
      void navigate({ to: target as '/welcome', replace: true })
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null
      if (apiError?.code === 'EMAIL_NOT_VERIFIED') {
        void navigate({ to: '/verify', search: { email: trimmedEmail }, replace: true })
        return
      }
      if (
        apiError?.code === 'SCHOOL_SUSPENDED' ||
        apiError?.code === 'ACCOUNT_DEACTIVATED'
      ) {
        void navigate({ to: '/access-unavailable', search: {}, replace: true })
        return
      }
      if (apiError?.status === 401) {
        setError('Email or password is incorrect.')
      } else {
        setError('We couldn’t sign you in right now. Please try again.')
      }
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Students and professionals: sign in with your account email and password."
      footer={
        <p className="mt-7 text-copy text-body">
          New here? Accounts are set up by your school or organisation — ask your administrator.
        </p>
      }
    >
      <form onSubmit={handleSubmit} aria-busy={busy} className="flex flex-col gap-5">
        {reset && !error && (
          <StatusBadge tone="success">
            Your password has been reset. Sign in with your new password.
          </StatusBadge>
        )}
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
        <Link
          to="/forgot-password"
          search={{}}
          className="-mt-3 inline-flex min-h-11 items-center self-end text-copy-sm font-medium text-action transition-colors hover:text-brand-4"
        >
          Forgot password?
        </Link>

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
