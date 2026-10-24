import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, CircleAlert, Flag, RefreshCw, Smile } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { PanelCard } from '#/components/dash/panels'
import { Button, Card, EmptyState, ErrorNote, Skeleton, StatCard, Tag } from '#/components/dash/ui'
import type { SessionUser } from '#/lib/auth'
import {
  fetchCounsellorDashboard,
  type CounsellorDashboardData,
  type CounsellorFlag,
} from '#/lib/counsellor-dashboard'
import { formatDateTime, formatNumber, useApiQuery } from '#/lib/dash'

export function CounsellorDashboard({ user }: { user: SessionUser }) {
  const query = useApiQuery(fetchCounsellorDashboard)
  const [accessBlocked, setAccessBlocked] = useState(false)
  const permissionError = query.error?.status === 401 || query.error?.status === 403

  // Keep stale data hidden during retries after access denial.
  useEffect(() => {
    if (permissionError) setAccessBlocked(true)
    else if (query.data && !query.loading && !query.error) setAccessBlocked(false)
  }, [permissionError, query.data, query.loading, query.error])

  const data = permissionError || accessBlocked ? null : query.data
  const hasSchool = !!(user.schoolId || user.school?.id)

  return (
    <>
      <DashHeader
        title="Staff overview"
        subtitle={user.school ? `${user.school.name} · support at a glance` : 'Your school support overview'}
        actions={
          <Button variant="ghost" onClick={query.reload} disabled={query.loading}>
            <RefreshCw aria-hidden="true" className="size-4" />
            {query.loading ? 'Refreshing…' : query.error ? 'Retry' : 'Refresh'}
          </Button>
        }
      />
      <main className="flex flex-1 flex-col gap-5 p-6 lg:p-8">
        {!hasSchool && (
          <p className="rounded-card border border-hairline bg-panel px-4 py-3 text-copy-sm text-body">
            No school is linked to your account. School data will appear once a school is assigned.
          </p>
        )}
        {query.error && (
          <ErrorNote>
            {data
              ? 'Could not refresh the overview. Previously loaded results are shown and may be out of date. '
              : 'Could not load the overview. '}
            {query.error.message}
          </ErrorNote>
        )}
        {query.loading && (
          <p role="status" className="text-copy-sm text-muted">
            {data ? 'Refreshing overview; showing previous results.' : 'Loading overview…'}
          </p>
        )}

        {!data ? (
          query.loading && !accessBlocked ? <OverviewSkeleton /> : null
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <StatCard
                label="Pending support requests"
                value={formatNumber(data.pendingRequestCount)}
                hint="Pending and escalated requests across your school."
              >
                <Link
                  to="/school/requests"
                  className="mt-auto inline-flex min-h-11 w-fit items-center gap-2 text-chip font-medium text-action hover:text-brand-4"
                >
                  View support requests
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </StatCard>
              <StatCard
                label="Open flags"
                value={formatNumber(data.escalatedFlagCount)}
                hint="Open status only. The list below also includes flags in review and acknowledged flags."
              />
              <StatCard
                label="School check-in sample"
                value={formatNumber(data.barometer.total)}
                hint="Latest 100 school check-ins, or fewer. Not a count of unique students or a fixed time window."
              />
            </div>

            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
              <FlagList flags={data.flags} />
              <SchoolBarometer barometer={data.barometer} />
            </div>
          </>
        )}
      </main>
    </>
  )
}

function FlagList({ flags }: { flags: CounsellorFlag[] }) {
  return (
    <PanelCard title="Flags for human review" className="min-w-0 xl:col-span-7">
      <p className="flex items-start gap-2 text-copy-sm text-body">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
        AI flags are suggestions for human review, not diagnoses or decisions. This list is read-only.
      </p>
      <p className="text-caption text-muted">
        Showing {formatNumber(flags.length)} flags, up to 20. Includes open, in-review and acknowledged flags.
      </p>
      {flags.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No flags to show"
          body="There are no open, in-review or acknowledged flags to display for your school."
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {flags.map((flag) => (
            <li key={flag.id} className="flex min-w-0 flex-col gap-3 py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-card text-heading">{flag.studentRef}</h3>
                  <p className="mt-1 break-words text-caption text-muted">
                    {flag.classLabel || 'Class not recorded'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tag tone={flag.severity === 'TIER_1_MODERATE' ? 'accent' : 'danger'}>
                    {labelize(flag.severity)}
                  </Tag>
                  <Tag>{labelize(flag.status)}</Tag>
                </div>
              </div>
              <p className="whitespace-pre-wrap break-words text-copy-sm text-body">{flag.triggerLabel}</p>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <time dateTime={flag.createdAt} className="text-caption text-muted">
                  {formatDateTime(flag.createdAt)}
                </time>
                {flag.conversationId && (
                  <Link
                    to="/school/requests/$conversationId"
                    params={{ conversationId: flag.conversationId }}
                    aria-label={`View conversation for ${flag.studentRef}`}
                    className="inline-flex min-h-11 items-center gap-2 text-chip font-medium text-action hover:text-brand-4"
                  >
                    View conversation
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  )
}

function SchoolBarometer({ barometer }: { barometer: CounsellorDashboardData['barometer'] }) {
  const distribution = Object.entries(barometer.distribution).sort((a, b) => b[1] - a[1])

  return (
    <PanelCard title="School check-in barometer" className="min-w-0 xl:col-span-5">
      <p className="text-copy-sm text-body">
        Feelings reported in the latest {formatNumber(barometer.total)} school check-ins (up to 100).
        Each check-in counts once; a student may check in more than once. No fixed time window.
      </p>
      {barometer.total === 0 ? (
        <EmptyState
          icon={Smile}
          title="No check-ins yet"
          body="The distribution will appear when school check-ins are available."
        />
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Check-in feeling distribution">
          {distribution.map(([feeling, count]) => (
            <li key={feeling} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-4 text-copy-sm">
                <span className="min-w-0 break-words text-heading">{labelize(feeling)}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {formatNumber(count)} · {Math.round((count / barometer.total) * 100)}%
                </span>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-pill bg-panel-2">
                <div
                  className="h-full rounded-pill bg-action"
                  style={{ width: `${Math.min(100, Math.max(0, (count / barometer.total) * 100))}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  )
}

function labelize(value: string): string {
  const label = value.toLowerCase().replaceAll('_', ' ')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function OverviewSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <Card key={key} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-40 max-w-full motion-reduce:animate-none" />
            <Skeleton className="h-12 w-20 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-full motion-reduce:animate-none" />
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-24 w-full motion-reduce:animate-none" />
        <Skeleton className="h-24 w-full motion-reduce:animate-none" />
      </Card>
    </div>
  )
}
