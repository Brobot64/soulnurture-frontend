import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { ConsentGate } from '#/components/ConsentGate'
import { Spinner } from '#/components/StatusBadge'
import { homeForRole, useSession } from '#/lib/auth'

export const Route = createFileRoute('/_app/consent')({
  head: () => ({
    meta: [
      { title: 'Read before you start · Soul Nurture AI' },
      {
        name: 'description',
        content: 'Read about Soul Nurture AI and review your agreement before choosing whether to start.',
      },
    ],
  }),
  component: ConsentPage,
})

function ConsentPage() {
  const { user, status } = useSession()
  const navigate = useNavigate()

  if (status !== 'ready') {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-5 py-12 lg:px-10">
        <p role="status" className="flex items-center gap-3 text-copy text-muted">
          <Spinner /> Loading your session…
        </p>
      </div>
    )
  }

  const isStudent = !!user && (!user.role || user.role === 'STUDENT')

  return (
    <ConsentGate
      key={`${user?.id ?? 'guest'}:${user?.role ?? ''}`}
      presentation="page"
      audience={!user ? 'guest' : isStudent ? 'student' : 'reader'}
      onAccepted={() => navigate({ to: user?.mustChangePassword ? '/first-password' : '/check-in' })}
      onDeclined={() => navigate({ to: user ? homeForRole(user) : '/welcome' })}
    />
  )
}
