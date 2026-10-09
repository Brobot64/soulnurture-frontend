import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { ProgressBar, Sparkline } from '#/components/dash/charts'
import {
  ActivityPanel,
  CompositionBar,
  MoodPanel,
  PanelCard,
  WeekdayPanel,
} from '#/components/dash/panels'
import { SchoolsTable } from '#/components/dash/SchoolsTable'
import {
  CreateSchoolAdminDialog,
  CreateSchoolDialog,
  RenameSchoolDialog,
  SchoolStatusDialog,
} from '#/components/dash/school-dialogs'
import {
  Button,
  Card,
  DeltaChip,
  ErrorNote,
  Segmented,
  Skeleton,
} from '#/components/dash/ui'
import {
  fetchAdminAnalytics,
  fetchAdminOverview,
  fetchActivity,
  fetchSchools,
  type ActivityFeedKind,
  type AnalyticsDays,
  type SchoolRow,
} from '#/lib/admin'
import { useApiQuery, useRoleGuard, formatNumber } from '#/lib/dash'

export const Route = createFileRoute('/_dash/admin/')({
  head: () => ({ meta: [{ title: 'Overview · Soul Nurture AI' }] }),
  component: AdminOverviewPage,
})

const DAY_OPTIONS: readonly { value: AnalyticsDays; label: string }[] = [
  { value: 14, label: '14d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
]

function AdminOverviewPage() {
  const user = useRoleGuard(['PLATFORM_ADMIN'])
  const [days, setDays] = useState<AnalyticsDays>(14)
  const [feedKind, setFeedKind] = useState<ActivityFeedKind>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SchoolRow | null>(null)
  const [statusTarget, setStatusTarget] = useState<SchoolRow | null>(null)
  const [adminTarget, setAdminTarget] = useState<SchoolRow | null>(null)

  const overview = useApiQuery(() => fetchAdminOverview(), [])
  const analytics = useApiQuery(() => fetchAdminAnalytics(days), [days])
  const schools = useApiQuery(() => fetchSchools(), [])
  const activity = useApiQuery(
    () => fetchActivity({ kind: feedKind, limit: 12 }),
    [feedKind],
  )

  if (!user) return null

  const error =
    overview.error ?? analytics.error ?? schools.error ?? activity.error
  const schoolItems = schools.data?.items ?? []
  const pendingSchools = schoolItems.filter((school) => school.pendingChats > 0).length
  const pendingShare =
    schoolItems.length > 0 ? (pendingSchools / schoolItems.length) * 100 : 0

  const reloadSchools = () => {
    schools.reload()
    overview.reload()
  }

  return (
    <>
      <DashHeader
        title="Overview"
        subtitle="Platform activity at a glance"
        actions={
          <>
            <Segmented options={DAY_OPTIONS} value={days} onChange={setDays} />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" className="size-4" />
              New school
            </Button>
          </>
        }
      />
      <main className="flex flex-1 flex-col gap-5 p-6 lg:p-8">
        {error && <ErrorNote>{error.message}</ErrorNote>}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Card className="flex flex-col gap-3 lg:col-span-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-meta uppercase tracking-wider text-muted">
                Users
              </span>
              <span className="flex items-center gap-2">
                <DeltaChip pct={analytics.data?.deltas.newUsers.pct ?? null} />
                <span className="text-caption text-muted">signups, 7d vs previous</span>
              </span>
            </div>
            {overview.loading ? (
              <Skeleton className="h-12 w-32" />
            ) : (
              <span className="text-title-lg tabular-nums text-heading">
                {formatNumber(overview.data?.users.total ?? 0)}
              </span>
            )}
            {analytics.loading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <Sparkline
                values={(analytics.data?.series ?? []).map((point) => point.newUsers)}
              />
            )}
            {overview.data && (
              <CompositionBar
                className="mt-auto"
                students={overview.data.users.students}
                professionals={overview.data.users.professionals}
                admins={overview.data.users.admins}
              />
            )}
          </Card>

          <MoodPanel
            className="lg:col-span-4"
            mood={analytics.data?.mood ?? null}
            loading={analytics.loading}
          />

          <Card className="flex flex-col gap-3 lg:col-span-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-meta uppercase tracking-wider text-muted">
                Pending chats
              </span>
              <span className="flex items-center gap-2">
                <DeltaChip pct={analytics.data?.deltas.chatThreads.pct ?? null} />
                <span className="text-caption text-muted">threads, 7d vs previous</span>
              </span>
            </div>
            {overview.loading ? (
              <Skeleton className="h-12 w-24" />
            ) : (
              <span className="text-title-lg tabular-nums text-heading">
                {formatNumber(overview.data?.chat.pendingRequests ?? 0)}
              </span>
            )}
            <span className="text-caption text-muted">
              Requests waiting for a counsellor
            </span>
            <ProgressBar value={pendingShare} className="mt-1" />
            <span className="text-caption text-muted">
              {pendingSchools} of {schoolItems.length} school
              {schoolItems.length === 1 ? '' : 's'} with open requests
            </span>
          </Card>
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
          />
        </div>

        <PanelCard
          title="Schools"
          action={
            <Link
              to="/admin/schools"
              className="text-chip font-medium text-action transition-colors hover:text-brand-4"
            >
              View all →
            </Link>
          }
        >
          <SchoolsTable
            schools={schoolItems.slice(0, 5)}
            loading={schools.loading}
            actions={{
              onRename: setRenameTarget,
              onToggleStatus: setStatusTarget,
              onAddAdmin: setAdminTarget,
            }}
            emptyAction={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden="true" className="size-4" />
                New school
              </Button>
            }
          />
        </PanelCard>
      </main>

      {createOpen && (
        <CreateSchoolDialog
          onClose={() => setCreateOpen(false)}
          onCreated={reloadSchools}
        />
      )}
      {renameTarget && (
        <RenameSchoolDialog
          school={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRenamed={reloadSchools}
        />
      )}
      {statusTarget && (
        <SchoolStatusDialog
          school={statusTarget}
          onClose={() => setStatusTarget(null)}
          onDone={reloadSchools}
        />
      )}
      {adminTarget && (
        <CreateSchoolAdminDialog
          school={adminTarget}
          onClose={() => setAdminTarget(null)}
          onCreated={() => activity.reload()}
        />
      )}
    </>
  )
}
