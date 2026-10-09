// Role landing: signed-in users head to their dashboard, guests to /welcome.

import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Spinner } from '#/components/StatusBadge'
import { homeForRole, useSession } from '#/lib/auth'

export const Route = createFileRoute('/_app/')({
  head: () => ({
    meta: [{ title: 'Soul Nurture AI' }],
  }),
  component: Landing,
})

function Landing() {
  const navigate = useNavigate()
  const { user, status } = useSession()

  useEffect(() => {
    if (status !== 'ready') return
    void navigate({ to: user ? homeForRole(user) : '/welcome', replace: true })
  }, [status, user, navigate])

  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Spinner className="size-8 text-brand-4" />
    </div>
  )
}
