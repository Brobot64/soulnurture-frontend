import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { useSession } from '#/lib/auth'
import { useSchoolSuspended } from '#/lib/dash'
import { FullPageLoader } from '#/components/dash/ui'
import { RailNav } from '#/components/dash/RailNav'
import { SuspendedPage } from '#/components/dash/SuspendedPage'

export const Route = createFileRoute('/_dash')({
  component: DashLayout,
})

/// Client-side gate for the whole dashboard shell: SSR cannot forward the
/// session cookie into route loading, so access is enforced after mount and
/// every non-staff role is bounced straight to its home.
function DashLayout() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Read via ref: `pathname` must not be an effect dep — the bounce navigation
  // itself changes the location, which would re-fire the effect with the new
  // path (e.g. sending ?redirect=/signin) before this layout unmounts.
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const bounced = useRef(false)
  const { user, status } = useSession()
  const suspended = useSchoolSuspended()

  useEffect(() => {
    if (status !== 'ready' || bounced.current) return
    if (!user) {
      bounced.current = true
      void navigate({ to: '/signin', search: { redirect: pathnameRef.current }, replace: true })
      return
    }
    if (user.mustChangePassword) {
      bounced.current = true
      void navigate({ to: '/first-password', replace: true })
      return
    }
    if (!user.role || user.role === 'STUDENT') {
      bounced.current = true
      void navigate({ to: '/welcome', replace: true })
    }
  }, [status, user, navigate])

  if (status !== 'ready' || !user || user.mustChangePassword) return <FullPageLoader />
  if (!user.role || user.role === 'STUDENT') return <FullPageLoader />
  if (suspended) return <SuspendedPage />

  return (
    <div className="flex h-dvh">
      <RailNav />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-page">
        <Outlet />
      </div>
    </div>
  )
}
