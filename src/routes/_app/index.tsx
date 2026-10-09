// Public home: guests see the marketing landing; signed-in users fan out to
// their dashboard. The landing renders during session bootstrap too, so the
// served HTML carries the marketing body for first paint and crawlers.

import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Landing } from '#/components/Landing'
import { Spinner } from '#/components/StatusBadge'
import { homeForRole, useSession } from '#/lib/auth'

export const Route = createFileRoute('/_app/')({
  head: () => ({
    meta: [
      { title: 'Soul Nurture AI — Your space to check in, reflect, and find support' },
      {
        name: 'description',
        content:
          'A youth-friendly AI wellbeing space that helps you check in, express your feelings, reflect, and find helpful resources.',
      },
    ],
  }),
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const { user, status } = useSession()

  useEffect(() => {
    if (status !== 'ready' || !user) return
    void navigate({ to: homeForRole(user), replace: true })
  }, [status, user, navigate])

  if (status === 'ready' && user) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner className="size-8 text-brand-4" />
      </div>
    )
  }

  return <Landing />
}
