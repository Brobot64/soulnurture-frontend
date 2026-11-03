// ab07: the two support surfaces are one pair, and the design says why — an
// indicator is a prompt the system raised, a request is a student asking. A
// reviewer has to be able to stand on either one and see the other.
//
// It renders nothing for a role that is not a reviewer, because a tab the viewer
// cannot open is a door drawn on a wall. Those roles reach requests from the
// rail, and reach indicators only through the page that says it is not theirs.

import { Link } from '@tanstack/react-router'

import { REVIEWER_ROLES } from '#/lib/ai-response-reports'
import { useSession } from '#/lib/auth'

const TABS = [
  { to: '/school/indicators', label: 'Support indicators' },
  { to: '/school/requests', label: 'Support requests' },
] as const

type TabPath = (typeof TABS)[number]['to']

export function SupportSurfaceTabs({ active }: { active: TabPath }) {
  const { user } = useSession()
  if (!user?.role || !REVIEWER_ROLES.some((role) => role === user.role)) return null

  return (
    <nav
      aria-label="Support surfaces"
      className="flex gap-1 border-b border-hairline px-6 lg:px-10"
    >
      {TABS.map((tab) => {
        const isActive = tab.to === active
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={isActive ? 'page' : undefined}
            className={`-mb-px min-h-11 border-b-2 px-4 text-chip transition-colors ${
              isActive
                ? 'border-action font-semibold text-heading'
                : 'border-transparent text-muted hover:border-hairline hover:text-heading'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
