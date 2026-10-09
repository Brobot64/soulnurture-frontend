// The 72px icon rail — dashboards' only navigation. Role decides the items.

import { useEffect } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  Inbox,
  LayoutDashboard,
  School,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react'

import logoUrl from '#/assets/soul-nurture-logo.png'
import { isChatStaff, useSession } from '#/lib/auth'
import { refreshChatPool, useChatPoolCount, watchChatUnread } from '#/lib/chat'

type RailPath =
  | '/admin'
  | '/admin/schools'
  | '/admin/users'
  | '/school'
  | '/school/users'
  | '/school/settings'
  | '/school/inbox'

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
    return [{ to: '/school/inbox', label: 'Inbox', icon: Inbox }]
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
      className="flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-brand-2 py-5"
    >
      <img src={logoUrl} alt="Soul Nurture AI" className="mb-3 size-10 shrink-0" />
      {items.map((item) => {
        const isActive = active?.to === item.to
        const Icon = item.icon
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={item.label}
            title={item.label}
            className={`relative flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors ${
              isActive
                ? 'bg-brand-4 text-brand-11'
                : 'text-brand-4/70 hover:bg-white/70 hover:text-brand-4'
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
