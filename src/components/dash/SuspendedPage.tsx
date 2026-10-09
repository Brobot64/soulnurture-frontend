// Full-page notice when any API call hit 403 SCHOOL_SUSPENDED.

import { useNavigate } from '@tanstack/react-router'
import { ShieldAlert } from 'lucide-react'

import { Button } from '#/components/dash/ui'
import { signOut, useSession } from '#/lib/auth'
import { clearSchoolSuspended } from '#/lib/dash'

export function SuspendedPage() {
  const navigate = useNavigate()
  const { user } = useSession()

  const handleSignOut = async () => {
    try {
      await signOut()
    } finally {
      clearSchoolSuspended()
      void navigate({ to: '/signin' })
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page px-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-destructive-soft text-destructive">
        <ShieldAlert aria-hidden="true" className="size-7" />
      </span>
      <h1 className="text-title text-heading">This school is suspended</h1>
      <p className="max-w-md text-copy text-body">
        {user?.school?.name ? `${user.school.name} is` : 'Your school is'} currently
        suspended, so the dashboard and chat are paused. Contact your school
        administrator or the Soul Nurture team.
      </p>
      <Button variant="danger" onClick={handleSignOut} className="mt-2">
        Sign out
      </Button>
    </div>
  )
}
