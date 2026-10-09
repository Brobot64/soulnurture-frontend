// School overview — the portal's home: roster, mood mix, onboarding
// completeness, weekday check-ins, the school's activity feed, its chat
// threads and the newest users. Rendered from the signed-in admin's own
// school, through the same panels the platform console's inspector mounts.

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { DashHeader } from '#/components/dash/DashHeader'
import {
  ActivityPanel,
  ChatThreadsPanel,
  CompositionBar,
  MoodPanel,
  OnboardingCard,
  RecentUsersPanel,
  WeekdayPanel,
} from '#/components/dash/panels'
import { Card, ErrorNote, Segmented, Skeleton } from '#/components/dash/ui'
import {
  fetchActivity,
  fetchSchoolAnalytics,
  fetchSchoolChatThreads,
  fetchSchoolUsers,
  type ActivityFeedKind,
  type AnalyticsDays,
} from '#/lib/admin'
import type { SchoolBrief } from '#/lib/auth'
import { formatNumber, useApiQuery, useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/school/')({
  head: () => ({ meta: [{ title: 'Overview · Soul Nurture AI' }] }),
  component: SchoolOverviewPage,
})

const DAY_OPTIONS: readonly { value: AnalyticsDays; label: string }[] = [
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
]

function SchoolOverviewPage() {
  const user = useRoleGuard(['SCHOOL_ADMIN'])
  if (!user?.school) return null
  return <SchoolOverviewContent school={user.school} />
}

function SchoolOverviewContent({ school }: { school: SchoolBrief }) {
  const [days, setDays] = useState<AnalyticsDays>(14)
  const [feedKind, setFeedKind] = useState<ActivityFeedKind>('all')

  const analytics = useApiQuery(
    () => fetchSchoolAnalytics(school.id, days),
    [school.id, days],
  )
  const threads = useApiQuery(
    () => fetchSchoolChatThreads(school.id, { limit: 8 }),
    [school.id],
  )
  const users = useApiQuery(() => fetchSchoolUsers(school.id), [school.id])
  const activity = useApiQuery(
    () =>
      fetchActivity({ schoolId: school.id, kind: feedKind, limit: 12 }),
    [school.id, feedKind],
  )

  const error =
    analytics.error ?? threads.error ?? users.error ?? activity.error
  const roster = analytics.data?.roster

  return (
    <>
      <DashHeader
        title={school.name}
        subtitle={`${school.shortCode} · your school at a glance`}
        actions={<Segmented options={DAY_OPTIONS} value={days} onChange={setDays} />}
      />
      <main className="flex flex-1 flex-col gap-5 p-6 lg:p-8">
        {error && <ErrorNote>{error.message}</ErrorNote>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Card className="flex flex-col gap-3 lg:col-span-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-meta uppercase tracking-wider text-muted">
                Roster
              </span>
              {roster && roster.deactivated > 0 && (
                <span className="text-caption text-muted">
                  {formatNumber(roster.deactivated)} deactivated
                </span>
              )}
            </div>
            {!roster ? (
              <>
                <Skeleton className="h-12 w-24" />
                <Skeleton className="h-2.5 w-full" />
                <Skeleton className="h-3.5 w-48" />
              </>
            ) : (
              <>
                <span className="text-title-lg tabular-nums text-heading">
                  {formatNumber(
                    roster.students + roster.professionals + roster.admins,
                  )}
                </span>
                <CompositionBar
                  className="mt-auto"
                  students={roster.students}
                  professionals={roster.professionals}
                  admins={roster.admins}
                />
              </>
            )}
          </Card>

          <MoodPanel
            className="lg:col-span-4"
            mood={analytics.data?.mood ?? null}
            loading={analytics.loading}
          />

          <OnboardingCard
            className="lg:col-span-4"
            onboarding={analytics.data?.onboarding ?? null}
            loading={analytics.loading}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <WeekdayPanel
            className="lg:col-span-5"
            weekday={analytics.data?.weekday ?? null}
            loading={analytics.loading}
          />
          <ActivityPanel
            className="lg:col-span-7"
            items={activity.data?.items ?? []}
            kind={feedKind}
            onKindChange={setFeedKind}
            loading={activity.loading}
            scope="school"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <ChatThreadsPanel
            className="lg:col-span-7"
            threads={threads.data?.items ?? []}
            loading={threads.loading}
          />
          <RecentUsersPanel
            className="lg:col-span-5"
            users={(users.data?.items ?? []).slice(0, 6)}
            loading={users.loading}
          />
        </div>
      </main>
    </>
  )
}
