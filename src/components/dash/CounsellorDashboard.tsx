import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, CircleAlert, Flag, RefreshCw, Siren, Smile } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { PanelCard } from '#/components/dash/panels'
import { Button, Card, EmptyState, ErrorNote, Skeleton, StatCard, Tag } from '#/components/dash/ui'
import type { SessionUser } from '#/lib/auth'
import {
  fetchCounsellorDashboard,
  type CounsellorDashboardData,
  type CounsellorFlag,
  type CounsellorRequestRow,
} from '#/lib/counsellor-dashboard'
import { formatDateTime, formatNumber, useApiQuery } from '#/lib/dash'
import { getSocket, onRealtimeEvent } from '#/lib/socket'
import {
  REQUEST_STATUS_LABELS,
  SUPPORT_REQUESTS_CHANGED,
  TIMING_LABELS,
  URGENCY_LABELS,
  shortName,
} from '#/lib/support-queue'

export function CounsellorDashboard({ user }: { user: SessionUser }) {
  const query = useApiQuery(fetchCounsellorDashboard)
  const reload = query.reload
  const [accessBlocked, setAccessBlocked] = useState(false)
  const permissionError = query.error?.status === 401 || query.error?.status === 403

  // Keep stale data hidden during retries after access denial.
  useEffect(() => {
    if (permissionError) setAccessBlocked(true)
    else if (query.data && !query.loading && !query.error) setAccessBlocked(false)
  }, [permissionError, query.data, query.loading, query.error])

  useEffect(() => {
    const offNotification = onRealtimeEvent('notification.new', reload)
    const offSocketChanged = () => reload()
    getSocket()?.on('connect', offSocketChanged)
    window.addEventListener(SUPPORT_REQUESTS_CHANGED, reload)
    return () => {
      offNotification()
      getSocket()?.off('connect', offSocketChanged)
      window.removeEventListener(SUPPORT_REQUESTS_CHANGED, reload)
    }
  }, [reload])

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
            <UrgentRequestList
              requests={data.supportRequests.filter((request) => request.urgency === 'URGENT')}
              total={data.urgentRequestCount}
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Urgent awaiting action"
                value={formatNumber(data.urgentRequestCount)}
                hint="Requests the student called urgent, or whose stored status is escalated and nobody has progressed yet."
              />
              <StatCard
                label="Unread awaiting action"
                value={formatNumber(data.unreadRequestCount)}
                hint="Requests you have not opened yet. Opening one records it for you without changing its lifecycle or urgency."
              />
              <StatCard
                label="Escalated requests"
                value={formatNumber(data.escalatedRequestCount)}
                hint="Requests whose stored status is escalated, including those already progressed."
              />
              <StatCard
                label="Awaiting a first action"
                value={formatNumber(data.pendingRequestCount)}
                hint="Pending and escalated requests across your school, including the urgent ones above."
              />
            </div>

            <AttentionList
              requests={data.supportRequests.filter((request) => request.urgency !== 'URGENT')}
              total={Math.max(0, data.pendingRequestCount - data.urgentRequestCount)}
            />

            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
              <FlagList flags={data.flags} openCount={data.openFlagCount} />
              <SchoolBarometer barometer={data.barometer} />
            </div>
          </>
        )}
      </main>
    </>
  )
}

function UrgentRequestList({
  requests,
  total,
}: {
  requests: CounsellorRequestRow[]
  total: number
}) {
  return (
    <PanelCard
      title="Review these first"
      className="min-w-0 border-l-4 border-l-destructive"
      action={
        <Link
          to="/school/requests"
          aria-label="Open all support requests"
          className="inline-flex min-h-11 items-center gap-2 text-chip font-medium text-action hover:text-brand-4"
        >
          All requests
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      }
    >
      <RequestRows
        requests={requests}
        emptyTitle="No urgent request is waiting for a first action"
        emptyBody="New urgent or escalated requests appear here immediately. This empty state is not evidence that students are safe."
        caption="Showing the urgent rows in this snapshot; each row opens directly for review."
        total={total}
      />
    </PanelCard>
  )
}

/** Remaining requests awaiting a first action. Urgent requests are handled by
 * the panel above and kept separate so a routine request cannot displace the
 * most pressing rows. */
function AttentionList({
  requests,
  total,
}: {
  requests: CounsellorRequestRow[]
  total: number
}) {
  return (
    <PanelCard
      title="Other requests awaiting a first action"
      className="min-w-0"
      action={
        <Link
          to="/school/requests"
          aria-label="Open the full support request queue"
          className="inline-flex min-h-11 items-center gap-2 text-chip font-medium text-action hover:text-brand-4"
        >
          All requests
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      }
    >
      <RequestRows
        requests={requests}
        emptyTitle="Nothing else is waiting for a first action"
        emptyBody="No routine pending request remains in this snapshot. It is not evidence that students are safe — new requests appear here as they arrive."
        caption={`Showing ${formatNumber(requests.length)} of ${formatNumber(total)} routine awaiting requests.`}
        total={total}
      />
    </PanelCard>
  )
}

function RequestRows({
  requests,
  total,
  caption,
  emptyTitle,
  emptyBody,
}: {
  requests: CounsellorRequestRow[]
  total: number
  caption: string
  emptyTitle: string
  emptyBody: string
}) {
  return (
    <>
      <p className="text-caption text-muted">
        {caption} {formatNumber(total)} request{total === 1 ? '' : 's'} counted in total.
        Viewing a request marks it read for you only; it does not acknowledge escalation or change its status.
      </p>
      {requests.length === 0 ? (
        <EmptyState
          icon={Siren}
          title={emptyTitle}
          body={emptyBody}
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex min-w-0 flex-col gap-3 py-5 first:pt-0 last:pb-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-card text-heading">
                    {shortName(request.student)}
                  </h3>
                  <p className="mt-1 break-words text-caption text-muted">
                    {[request.student.classLabel, request.student.studentCode]
                      .filter(Boolean)
                      .join(' · ') || 'Class not recorded'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {request.readAt === null && <Tag tone="accent">Unread by you</Tag>}
                  <Tag tone={request.urgency === 'URGENT' ? 'danger' : 'neutral'}>
                    {URGENCY_LABELS[request.urgency]}
                  </Tag>
                  <Tag tone={request.status === 'ESCALATED' ? 'danger' : 'accent'}>
                    {REQUEST_STATUS_LABELS[request.status]}
                  </Tag>
                </div>
              </div>
              <p className="whitespace-pre-wrap break-words text-copy-sm text-body">
                {TIMING_LABELS[request.timing]}
              </p>
              {request.initialMessage && (
                <blockquote className="whitespace-pre-wrap break-words border-l-2 border-hairline pl-3 text-copy-sm text-body">
                  {request.initialMessage}
                </blockquote>
              )}
              {request.note && (
                <p className="whitespace-pre-wrap break-words text-copy-sm text-muted">
                  Student note: {request.note}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex flex-col gap-1">
                  <time dateTime={request.createdAt} className="text-caption text-muted">
                    Requested {formatDateTime(request.createdAt)}
                  </time>
                  <p className="text-caption text-muted">
                    Support person: {request.supportPerson.name}
                  </p>
                </div>
                <Link
                  to="/school/requests"
                  search={{ requestId: request.id }}
                  aria-label={`Review request from ${shortName(request.student)}`}
                  className="inline-flex min-h-11 items-center gap-2 text-chip font-medium text-action hover:text-brand-4"
                >
                  Review request
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function FlagList({
  flags,
  openCount,
}: {
  flags: CounsellorFlag[]
  openCount: number
}) {
  return (
    <PanelCard title="Flags for human review" className="min-w-0 xl:col-span-7">
      <p className="flex items-start gap-2 text-copy-sm text-body">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted" />
        AI flags are suggestions for human review, not diagnoses or decisions. This list is read-only.
      </p>
      <p className="text-caption text-muted">
        Showing {formatNumber(flags.length)} flags, up to 20. Includes open, in-review and acknowledged flags.
      </p>
      {/* An indicator count, kept apart from the request tiles above: these are
          two different records with two different lifecycles. It also counts the
          whole school, not the 20 rows listed here. */}
      <p className="text-caption text-muted">
        {formatNumber(openCount)} indicators school-wide are still Open. This counts
        indicators, not the support requests above.
      </p>
      <Link
        to="/school/indicators"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-chip font-medium text-action hover:text-brand-4"
      >
        Review indicators with full context
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
      {flags.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No flags to show"
          body="There are no open, in-review or acknowledged flags to display for your school. An empty list is not evidence that students are safe."
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
                  {/* The level is a separate axis from the tier, and every level
                      wears the same neutral chip: U is unclear, not mild. */}
                  <Tag>{flag.level ? `Level ${flag.level}` : 'Unclassified'}</Tag>
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
                    // PE-05 (owner): the consent instrument tells the student the
                    // alert carries a snippet, so the alert surface shows a snippet.
                    // Kept in the DOM, not rendered — the thread itself is unchanged.
                    style={{ display: 'none' }}
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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <Card key={key} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-40 max-w-full motion-reduce:animate-none" />
            <Skeleton className="h-12 w-20 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-full motion-reduce:animate-none" />
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48 max-w-full motion-reduce:animate-none" />
        {[0, 1].map((key) => (
          <Skeleton key={key} className="h-24 w-full motion-reduce:animate-none" />
        ))}
      </Card>
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-24 w-full motion-reduce:animate-none" />
      </Card>
    </div>
  )
}
