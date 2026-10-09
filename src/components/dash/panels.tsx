// Shared dashboard panels — mood, weekday, activity, onboarding, chat
// threads and recent users. Built once here so the platform console and the
// school portal (and the admin's school inspector) render identically.

import type { ReactNode } from 'react'
import { MessagesSquare, Smile, Users } from 'lucide-react'

import { Bars7, DonutStat, ProgressBar, type MoodId } from '#/components/dash/charts'
import {
  AvatarInitials,
  Card,
  EmptyState,
  FeedPanel,
  Segmented,
  Skeleton,
  Tag,
  type TagTone,
} from '#/components/dash/ui'
import { describeActivity, type ActivityItem } from '#/lib/activity'
import type {
  ActivityFeedKind,
  SchoolChatThread,
  SchoolUserRow,
} from '#/lib/admin'
import { roleLabel } from '#/lib/auth'
import { formatNumber, timeAgo } from '#/lib/dash'

export function PanelCard({
  title,
  action,
  className = '',
  children,
}: {
  title: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-meta uppercase tracking-wider text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  )
}

// --- Roster composition ------------------------------------------------------

/** Students / staff / admins split bar with a plain-language caption. */
export function CompositionBar({
  students,
  professionals,
  admins,
  className = '',
}: {
  students: number
  professionals: number
  admins: number
  className?: string
}) {
  const total = students + professionals + admins
  const segments = [
    { key: 'students', count: students, className: 'bg-brand-4' },
    { key: 'professionals', count: professionals, className: 'bg-mint' },
    { key: 'admins', count: admins, className: 'bg-accent' },
  ]
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-pill bg-panel-2">
        {total > 0 &&
          segments.map((segment) =>
            segment.count > 0 ? (
              <span
                key={segment.key}
                title={`${segment.count} ${segment.key}`}
                className={`h-full ${segment.className}`}
                style={{ width: `${(segment.count / total) * 100}%` }}
              />
            ) : null,
          )}
      </div>
      <p className="text-caption text-muted">
        {formatNumber(students)} students · {formatNumber(professionals)} staff ·{' '}
        {formatNumber(admins)} admins
      </p>
    </div>
  )
}

// --- Mood ------------------------------------------------------------------

export function MoodPanel({
  mood,
  loading = false,
  title = 'Mood mix',
  className = '',
}: {
  mood: { total: number; distribution: Record<MoodId, number> } | null
  loading?: boolean
  title?: string
  className?: string
}) {
  return (
    <PanelCard title={title} className={className}>
      {loading || !mood ? (
        <div className="flex flex-wrap items-center gap-7">
          <Skeleton className="size-40 rounded-full" />
          <div className="flex min-w-44 flex-1 flex-col gap-2">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : mood.total === 0 ? (
        <EmptyState
          icon={Smile}
          title="No check-ins yet"
          body="The mood mix appears once students start checking in."
        />
      ) : (
        <DonutStat distribution={mood.distribution} />
      )}
    </PanelCard>
  )
}

// --- Weekday ---------------------------------------------------------------

export function WeekdayPanel({
  weekday,
  loading = false,
  title = 'Check-ins by weekday',
  className = '',
}: {
  weekday: { weekday: string; count: number }[] | null
  loading?: boolean
  title?: string
  className?: string
}) {
  return (
    <PanelCard title={title} className={className}>
      {loading || !weekday ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Bars7 weekday={weekday} />
      )}
    </PanelCard>
  )
}

// --- Activity feed ---------------------------------------------------------

const FEED_TABS: readonly { value: ActivityFeedKind; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'schools', label: 'Schools' },
  { value: 'people', label: 'People' },
  { value: 'chat', label: 'Chat' },
]

export function ActivityPanel({
  items,
  kind,
  onKindChange,
  loading = false,
  scope = 'platform',
  title = 'Activity',
  className = '',
}: {
  items: ActivityItem[]
  kind: ActivityFeedKind
  onKindChange: (next: ActivityFeedKind) => void
  loading?: boolean
  /** Platform scope names the school as the subject; school scope the actor. */
  scope?: 'platform' | 'school'
  title?: string
  className?: string
}) {
  const rows = items.map((item) => describeActivity(item, { scope }))
  return (
    <PanelCard
      title={title}
      className={className}
      action={<Segmented options={FEED_TABS} value={kind} onChange={onKindChange} />}
    >
      <FeedPanel rows={rows} loading={loading} bare />
    </PanelCard>
  )
}

// --- Onboarding ------------------------------------------------------------

export function OnboardingCard({
  onboarding,
  loading = false,
  className = '',
}: {
  onboarding: { incomplete: number; percentComplete: number } | null
  loading?: boolean
  className?: string
}) {
  return (
    <PanelCard title="Onboarding" className={className}>
      {loading || !onboarding ? (
        <>
          <Skeleton className="h-12 w-28" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-3.5 w-48" />
        </>
      ) : (
        <>
          <span className="text-title-lg tabular-nums text-heading">
            {onboarding.percentComplete}%
          </span>
          <ProgressBar value={onboarding.percentComplete} />
          <p className="text-caption text-muted">
            {onboarding.incomplete === 0
              ? 'Every account has a personal password and a verified email.'
              : `${onboarding.incomplete} account${
                  onboarding.incomplete === 1 ? '' : 's'
                } still on the default password or unverified.`}
          </p>
        </>
      )}
    </PanelCard>
  )
}

// --- Chat threads ----------------------------------------------------------

export const THREAD_STATUS_LABEL: Record<SchoolChatThread['status'], string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
}

const THREAD_STATUS_TONES: Record<SchoolChatThread['status'], TagTone> = {
  PENDING: 'accent',
  ACTIVE: 'success',
  CLOSED: 'neutral',
}

export function ChatThreadsPanel({
  threads,
  loading = false,
  title = 'Chat threads',
  className = '',
  emptyBody = 'Requests appear here the moment a student asks to talk.',
}: {
  threads: SchoolChatThread[]
  loading?: boolean
  title?: string
  className?: string
  emptyBody?: string
}) {
  return (
    <PanelCard title={title} className={className}>
      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : threads.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="No chat threads yet" body={emptyBody} />
      ) : (
        <ul className="divide-y divide-hairline">
          {threads.map((thread) => (
            <li key={thread.id} className="flex items-center gap-3 py-3.5">
              <AvatarInitials name={thread.student.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-card text-heading">
                    {thread.student.name}
                  </span>
                  <Tag tone={THREAD_STATUS_TONES[thread.status]}>
                    {THREAD_STATUS_LABEL[thread.status]}
                  </Tag>
                </div>
                <p className="mt-0.5 truncate text-copy-sm text-muted">
                  {thread.professional
                    ? `with ${thread.professional.name}`
                    : 'Awaiting a counsellor'}
                  {' · '}
                  {thread.messageCount} message{thread.messageCount === 1 ? '' : 's'}
                </p>
              </div>
              <span className="whitespace-nowrap text-caption text-muted">
                {timeAgo(thread.lastMessageAt ?? thread.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  )
}

// --- Recent users ----------------------------------------------------------

/** The one-line identity detail shown for a school user — code·class or title·dept. */
export function userDetail(user: SchoolUserRow): string | null {
  if (user.studentProfile) {
    return (
      [user.studentProfile.studentCode, user.studentProfile.classLabel]
        .filter(Boolean)
        .join(' · ') || null
    )
  }
  if (user.professionalProfile) {
    return (
      [user.professionalProfile.title, user.professionalProfile.department]
        .filter(Boolean)
        .join(' · ') || null
    )
  }
  return null
}

export function RecentUsersPanel({
  users,
  loading = false,
  title = 'Recent users',
  className = '',
}: {
  users: SchoolUserRow[]
  loading?: boolean
  title?: string
  className?: string
}) {
  return (
    <PanelCard title={title} className={className}>
      {loading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users yet"
          body="Onboard students and staff to see them here."
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {users.map((user) => {
            const detail = userDetail(user)
            return (
              <li key={user.id} className="flex items-center gap-3 py-3.5">
                <AvatarInitials name={user.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-card text-heading">{user.name}</span>
                    <Tag tone="neutral">{roleLabel(user.role)}</Tag>
                    {user.deactivatedAt && <Tag tone="danger">Deactivated</Tag>}
                    {!user.deactivatedAt && user.mustChangePassword && (
                      <Tag tone="accent">Default password</Tag>
                    )}
                    {!user.deactivatedAt && !user.emailVerified && (
                      <Tag tone="info">Unverified</Tag>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-copy-sm text-muted">
                    {detail ?? user.email}
                  </p>
                </div>
                <span className="whitespace-nowrap text-caption text-muted">
                  {timeAgo(user.createdAt)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </PanelCard>
  )
}
