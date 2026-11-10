// The 72px icon rail — dashboards' only navigation. Role decides the items,
// and each item decides for itself whether it carries a number.

import { useEffect } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  CircleSlash,
  Flag,
  HeartHandshake,
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
import { useChatUnread, watchChatUnread } from '#/lib/chat'
import { fetchAttentionCounts } from '#/lib/attention'
import {
  SUPPORT_REQUESTS_CHANGED,
  fetchSupportQueueCounts,
} from '#/lib/support-queue'
import { useApiQuery } from '#/lib/dash'
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

/**
 * What a badge is counting, in the words that page uses for it. A number on an
 * icon is a promise about the page behind it, so it has to be the same number
 * that page prints — and said the same way, because a screen reader reads the
 * icon out loud as its only label.
 */
type BadgeKey = 'requests' | 'inbox' | 'indicators' | 'reports' | 'roster'

const BADGE_WORDS: Record<BadgeKey, string> = {
  requests: 'awaiting action',
  inbox: 'unread messages',
  indicators: 'open indicators',
  reports: 'reports awaiting review',
  roster: 'accounts not fully set up',
}

interface RailItem {
  to: RailPath
  label: string
  icon: LucideIcon
  badge?: BadgeKey
}

function itemsForRole(role?: string | null): RailItem[] {
  if (role === 'PLATFORM_ADMIN') {
    return [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard },
      { to: '/admin/schools', label: 'Schools', icon: School },
      { to: '/admin/users', label: 'Users', icon: Users, badge: 'roster' },
      { to: '/admin/pilot', label: 'Pilot analytics', icon: LineChart },
      { to: '/admin/access-log', label: 'Access activity', icon: ScrollText },
    ]
  }
  if (role === 'SCHOOL_ADMIN') {
    return [
      { to: '/school', label: 'Overview', icon: LayoutDashboard },
      { to: '/school/users', label: 'Users', icon: Users, badge: 'roster' },
      { to: '/school/settings', label: 'Settings', icon: Settings },
    ]
  }
  if (isChatStaff(role)) {
    return [
      { to: '/school', label: 'Overview', icon: LayoutDashboard, badge: 'requests' },
      { to: '/school/inbox', label: 'Inbox', icon: Inbox, badge: 'inbox' },
      { to: '/school/requests', label: 'Support requests', icon: HeartHandshake, badge: 'requests' },
      ...(REVIEWER_ROLES.some((reviewer) => reviewer === role)
        ? [
            {
              to: '/school/indicators' as const,
              label: 'Support indicators',
              icon: ShieldCheck,
              badge: 'indicators' as const,
            },
            {
              to: '/school/reports' as const,
              label: 'AI reply reports',
              icon: Flag,
              badge: 'reports' as const,
            },
            {
              to: '/school/ai-boundaries' as const,
              label: 'Where the AI stops',
              icon: CircleSlash,
            },
          ]
        : []),
    ]
  }
  return []
}

export function RailNav() {
  const { user } = useSession()
  if (!user) return null
  return <RailNavContent key={user.id} />
}

function RailNavContent() {
  const { user } = useSession()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const chatUnread = useChatUnread()
  const role = user?.role
  const staff = isChatStaff(role)
  // School and platform admins have a rail to badge but no review queue, so the
  // aggregate is fetched for anyone whose rail exists at all.
  const hasRail = staff || role === 'SCHOOL_ADMIN' || role === 'PLATFORM_ADMIN'
  const queue = useApiQuery(
    () => (staff ? fetchSupportQueueCounts() : Promise.resolve(null)),
    [staff, user?.id, pathname],
  )
  const attention = useApiQuery(
    () => (hasRail ? fetchAttentionCounts() : Promise.resolve(null)),
    [hasRail, user?.id, pathname],
  )
  const reloadQueue = queue.reload

  useEffect(() => {
    if (staff) void watchChatUnread()
  }, [staff])

  useEffect(() => {
    if (!staff) return
    const refresh = () => reloadQueue()
    window.addEventListener(SUPPORT_REQUESTS_CHANGED, refresh)
    return () => window.removeEventListener(SUPPORT_REQUESTS_CHANGED, refresh)
  }, [staff, reloadQueue])

  const items = itemsForRole(role)
  const unreadRequestCount = queue.data?.unread ?? 0
  // The overview reports everything waiting on a professional, not only what
  // this one has not opened, so it can read higher than the requests icon.
  const awaitingUnreadCount = queue.data?.awaitingUnread ?? unreadRequestCount

  // Longest-prefix match so /admin never lights up while on /admin/schools.
  const active = [...items]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))

  function countFor(item: RailItem): number | null {
    switch (item.badge) {
      case 'requests':
        return item.to === '/school' ? awaitingUnreadCount : unreadRequestCount
      case 'inbox':
        return chatUnread.total
      case 'indicators':
        return attention.data?.indicators ?? null
      case 'reports':
        return attention.data?.reports ?? null
      case 'roster':
        return attention.data?.roster ?? null
      case undefined:
        // An icon without a badge stays without one. "0" would claim the page
        // behind it is clean, which nobody has measured.
        return null
    }
  }

  return (
    <nav
      aria-label="Dashboard"
      className="flex w-full shrink-0 items-center justify-center gap-2 overflow-x-auto border-t border-brand-4 bg-brand-2 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:w-[72px] lg:flex-col lg:justify-start lg:overflow-y-auto lg:border-t-0 lg:px-0 lg:py-5"
    >
      <img src={logoUrl} alt="Soul Nurture AI" className="mb-3 hidden size-10 shrink-0 lg:block" />
      {items.map((item) => {
        const isActive = active?.to === item.to
        const Icon = item.icon
        const count = countFor(item)
        const words = item.badge ? BADGE_WORDS[item.badge] : ''
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={count ? `${item.label} — ${count} ${words}` : item.label}
            aria-current={isActive ? 'page' : undefined}
            title={count ? `${item.label} (${count} ${words})` : item.label}
            className={`relative flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors focus-visible:outline-white ${
              isActive
                ? 'bg-brand-4 text-white ring-1 ring-brand-8/40'
                : 'text-brand-10 hover:bg-brand-4 hover:text-white'
            }`}
          >
            <Icon aria-hidden="true" className="size-5" />
            {!!count && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
