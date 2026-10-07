import { useState, type FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { AuthField, AuthShell } from '#/components/AuthShell'
import { Spinner, StatusBadge } from '#/components/StatusBadge'
import { ApiError } from '#/lib/api'
import { signUp } from '#/lib/auth'

export const Route = createFileRoute('/signup')({
  head: () => ({
    meta: [
      { title: 'Create your account · Soul Nurture AI' },
      {
        name: 'description',
        content:
          'Create a private account so your check-ins and reflections stay yours. All you need is a name, an email and a password — it takes less than a minute.',
      },
    ],
  }),
  component: SignUp,
})

function SignUp() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
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
      await signUp({
        name: name.trim(),
        email: trimmedEmail,
        password,
        phone: phone.trim() || undefined,
      })
      navigate({ to: '/verify', search: { email: trimmedEmail, created: '1' } })
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null
      if (apiError?.code === 'USER_ALREADY_EXISTS' || apiError?.status === 422) {
        setError('An account with this email already exists. Try signing in instead.')
      } else {
        setError(apiError?.message ?? 'Something went wrong. Please try again.')
      }
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="A private space to check in with how you feel. Your check-ins and reflections stay yours."
      footer={
        <p className="mt-7 text-copy text-body">
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-action transition-colors hover:text-brand-4">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {error && <StatusBadge tone="error">{error}</StatusBadge>}

        <AuthField
          id="name"
          label="Your name"
          value={name}
          onChange={setName}
          placeholder="e.g. Amina Yusuf"
          autoComplete="name"
          required
        />
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
          id="phone"
          label="Phone (optional)"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="e.g. 0801 234 5678"
          autoComplete="tel"
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
        />

        <button
          type="submit"
          disabled={busy}
          className="mt-1 inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4 disabled:opacity-50 lg:h-[56px]"
        >
          {busy ? (
            <>
              <Spinner />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>
    </AuthShell>
  )
}
