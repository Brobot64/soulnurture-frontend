// The 72px icon rail — dashboards' only navigation. Role decides the items.

import { useEffect } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  HeartHandshake,
  CircleSlash,
  Flag,
  Inbox,
  LayoutDashboard,
  LineChart,
  School,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

import logoUrl from '#/assets/soul-nurture-logo.png'
import { isChatStaff, useSession } from '#/lib/auth'
import { refreshChatPool, useChatPoolCount, watchChatUnread } from '#/lib/chat'
import { REVIEWER_ROLES } from '#/lib/ai-response-reports'

type RailPath =
  | '/admin'
  | '/admin/schools'
  | '/admin/users'
  | '/admin/pilot'
  | '/admin/access-log'
  | '/school'
  | '/school/users'
  | '/school/settings'
  | '/school/inbox'
  | '/school/requests'
  | '/school/indicators'
  | '/school/reports'
  | '/school/ai-boundaries'

interface RailItem {
  to: RailPath
  label: string
  icon: LucideIcon
}

function itemsForRole(role?: string | null): RailItem[] {
  if (role === 'PLATFORM_ADMIN') {
    return [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard },
      { to: '/admin/schools', label: 'Schools', icon: School },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/pilot', label: 'Pilot analytics', icon: LineChart },
      { to: '/admin/access-log', label: 'Access activity', icon: ScrollText },
    ]
  }
  if (role === 'SCHOOL_ADMIN') {
    return [
      { to: '/school', label: 'Overview', icon: LayoutDashboard },
      { to: '/school/users', label: 'Users', icon: Users },
      { to: '/school/settings', label: 'Settings', icon: Settings },
    ]
  }
  if (isChatStaff(role)) {
    return [
      { to: '/school', label: 'Overview', icon: LayoutDashboard },
      { to: '/school/inbox', label: 'Inbox', icon: Inbox },
      { to: '/school/requests', label: 'Support requests', icon: HeartHandshake },
      ...(REVIEWER_ROLES.some((reviewer) => reviewer === role)
        ? [
            { to: '/school/indicators' as const, label: 'Support indicators', icon: ShieldCheck },
            { to: '/school/reports' as const, label: 'AI reply reports', icon: Flag },
            { to: '/school/ai-boundaries' as const, label: 'Where the AI stops', icon: CircleSlash },
          ]
        : []),
    ]
  }
  return []
}

export function RailNav() {
  const { user } = useSession()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const poolCount = useChatPoolCount()
  const items = itemsForRole(user?.role)

  useEffect(() => {
    watchChatUnread()
    void refreshChatPool()
  }, [])

  // Longest-prefix match so /admin never lights up while on /admin/schools.
  const active = [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))

  return (
    <nav
      aria-label="Dashboard"
      className="flex w-full shrink-0 items-center justify-center gap-2 overflow-x-auto border-t border-brand-4 bg-brand-2 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:w-[72px] lg:flex-col lg:justify-start lg:overflow-y-auto lg:border-t-0 lg:px-0 lg:py-5"
    >
      <img src={logoUrl} alt="Soul Nurture AI" className="mb-3 hidden size-10 shrink-0 lg:block" />
      {items.map((item) => {
        const isActive = active?.to === item.to
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            title={item.label}
            className={`relative flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors focus-visible:outline-white ${
              isActive
                ? 'bg-brand-4 text-white ring-1 ring-brand-8/40'
                : 'text-brand-10 hover:bg-brand-4 hover:text-white'
            }`}
          >
            <Icon aria-hidden="true" className="size-5" />
            {item.to === '/school/inbox' && poolCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
                {poolCount > 99 ? '99+' : poolCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
