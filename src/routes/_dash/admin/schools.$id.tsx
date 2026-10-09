// School inspector — the platform console's window into one school: the same
// roster / mood / onboarding / activity panels the school portal will mount,
// read through the school-scoped endpoints platform admins are allowed to hit.

import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Pause,
  Pencil,
  Play,
  School as SchoolIcon,
  UserPlus,
} from 'lucide-react'

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
import {
  CreateSchoolAdminDialog,
  RenameSchoolDialog,
  SchoolStatusDialog,
} from '#/components/dash/school-dialogs'
import {
  Card,
  EmptyState,
  ErrorNote,
  RowMenu,
  Segmented,
  Skeleton,
  Tag,
  type RowMenuItem,
} from '#/components/dash/ui'
import {
  fetchActivity,
  fetchSchoolAnalytics,
  fetchSchoolChatThreads,
  fetchSchoolSettings,
  fetchSchoolUsers,
  type ActivityFeedKind,
  type AnalyticsDays,
} from '#/lib/admin'
import {
  formatDateTime,
  formatNumber,
  useApiQuery,
  useRoleGuard,
} from '#/lib/dash'

export const Route = createFileRoute('/_dash/admin/schools/$id')({
  head: () => ({ meta: [{ title: 'School · Soul Nurture AI' }] }),
  component: SchoolInspectorPage,
})

const DAY_OPTIONS: readonly { value: AnalyticsDays; label: string }[] = [
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
]

function SchoolInspectorPage() {
  const user = useRoleGuard(['PLATFORM_ADMIN'])
  const { id } = Route.useParams()
  const [days, setDays] = useState<AnalyticsDays>(14)
  const [feedKind, setFeedKind] = useState<ActivityFeedKind>('all')
  const [renameOpen, setRenameOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)

  const settings = useApiQuery(() => fetchSchoolSettings(id), [id])
  const analytics = useApiQuery(
    () => fetchSchoolAnalytics(id, days),
    [id, days],
  )
  const threads = useApiQuery(
    () => fetchSchoolChatThreads(id, { limit: 8 }),
    [id],
  )
  const users = useApiQuery(() => fetchSchoolUsers(id), [id])
  const activity = useApiQuery(
    () => fetchActivity({ schoolId: id, kind: feedKind, limit: 12 }),
    [id, feedKind],
  )

  if (!user) return null

  const school = settings.data

  if (settings.error?.status === 404) {
    return (
      <>
        <DashHeader title="School" subtitle="Not found" />
        <main className="flex flex-1 flex-col gap-5 p-6 lg:p-8">
          <EmptyState
            icon={SchoolIcon}
            title="School not found"
            body="This school may have been removed, or the link is out of date."
            action={
              <Link
                to="/admin/schools"
                className="inline-flex h-11 items-center gap-2 rounded-pill border border-hairline bg-white px-6 text-button-sm text-heading transition-colors hover:bg-panel"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                All schools
              </Link>
            }
          />
        </main>
      </>
    )
  }

  const error =
    settings.error ?? analytics.error ?? threads.error ?? users.error ?? activity.error
  const roster = analytics.data?.roster

  const menuItems: RowMenuItem[] = school
    ? [
        { label: 'Rename', icon: Pencil, onSelect: () => setRenameOpen(true) },
        {
          label: 'Add school admin',
          icon: UserPlus,
          onSelect: () => setAdminOpen(true),
        },
        school.status === 'SUSPENDED'
          ? {
              label: 'Reactivate',
              icon: Play,
              onSelect: () => setStatusOpen(true),
            }
          : {
              label: 'Suspend',
              icon: Pause,
              tone: 'danger' as const,
              onSelect: () => setStatusOpen(true),
            },
      ]
    : []

  return (
    <>
      <DashHeader
        title={school?.name ?? 'School'}
        subtitle={
          school
            ? `${school.shortCode} · created ${formatDateTime(school.createdAt)}`
            : undefined
        }
        actions={
          <>
            {school &&
              (school.hasDefaultPassword ? (
                <Tag tone="info">Default password set</Tag>
              ) : (
                <Tag tone="accent">No default password</Tag>
              ))}
            <Segmented options={DAY_OPTIONS} value={days} onChange={setDays} />
            {school && (
              <RowMenu label={`Actions for ${school.name}`} items={menuItems} />
            )}
          </>
        }
      />
      <main className="flex flex-1 flex-col gap-5 p-6 lg:p-8">
        <Link
          to="/admin/schools"
          className="inline-flex w-fit items-center gap-1.5 text-chip font-medium text-action transition-colors hover:text-brand-4"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          All schools
        </Link>

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

      {renameOpen && school && (
        <RenameSchoolDialog
          school={school}
          onClose={() => setRenameOpen(false)}
          onRenamed={() => settings.reload()}
        />
      )}
      {statusOpen && school && (
        <SchoolStatusDialog
          school={school}
          onClose={() => setStatusOpen(false)}
          onDone={() => settings.reload()}
        />
      )}
      {adminOpen && school && (
        <CreateSchoolAdminDialog
          school={school}
          onClose={() => setAdminOpen(false)}
          onCreated={() => {
            users.reload()
            activity.reload()
          }}
        />
      )}
    </>
  )
}
