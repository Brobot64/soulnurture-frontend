import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Flag } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { Button, EmptyState, ErrorNote, Skeleton, Tag } from '#/components/dash/ui'
import { fetchAiResponseReports, REVIEW_OUTCOME_LABELS, REVIEWER_ROLES } from '#/lib/ai-response-reports'
import { formatDateTime, useApiQuery, useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/school/reports/')({
  head: () => ({ meta: [{ title: 'AI reply reports · Soul Nurture AI' }] }),
  component: ReportsPage,
})

function ReportsPage() {
  const user = useRoleGuard(REVIEWER_ROLES)
  return user ? <ReportQueue key={`${user.id}:${user.schoolId}`} /> : null
}

function ReportQueue() {
  const [offset, setOffset] = useState(0)
  const { data, error, loading, reload } = useApiQuery(() => fetchAiResponseReports(offset), [offset])

  return (
    <>
      <DashHeader title="AI reply reports" subtitle="Student-submitted concerns about AI replies, separate from support requests." />
      <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col gap-6 p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-copy-sm text-muted">Reports from students currently at your school. A decision recorded on a report shows here; reporting a reply never creates a support request.</p>
          <Button variant="ghost" onClick={reload} disabled={loading}>Refresh</Button>
        </div>
        {error ? (
          <div className="flex flex-col items-start gap-3"><ErrorNote>{error.message}</ErrorNote><Button onClick={reload}>Try again</Button></div>
        ) : loading || !data ? (
          <div aria-label="Loading reports" className="flex flex-col gap-3"><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
        ) : data.items.length === 0 ? (
          <EmptyState icon={Flag} title={offset ? 'No more reports' : 'No AI replies have been reported'} body="Submitted reports will appear here. Personal support requests remain in the support request queue." />
        ) : (
          <ol className="flex flex-col gap-4">
            {data.items.map((report) => (
              <li key={report.id} className="rounded-panel border border-hairline bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-card text-heading">Reported AI reply</h2>
                    {report.reviewOutcome ? (
                      <Tag tone="success">{REVIEW_OUTCOME_LABELS[report.reviewOutcome]}</Tag>
                    ) : (
                      <Tag tone="neutral">Not reviewed</Tag>
                    )}
                  </div>
                  <time dateTime={report.createdAt} className="text-caption text-muted">Submitted {formatDateTime(report.createdAt)}</time>
                </div>
                <p className="mt-4 line-clamp-3 whitespace-pre-wrap break-words border-l-4 border-action pl-4 text-copy-sm text-body">{report.responseContent}</p>
                <p className="mt-4 line-clamp-2 whitespace-pre-wrap break-words text-copy-sm text-muted">{report.note ? `Student note: ${report.note}` : 'No note added.'}</p>
                <Link to="/school/reports/$reportId" params={{ reportId: report.id }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-pill text-chip font-semibold text-action hover:text-brand-4 focus-visible:outline-2 focus-visible:outline-action">
                  View report<ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </li>
            ))}
          </ol>
        )}
        {!loading && !error && data && (offset > 0 || data.nextOffset !== null) && (
          <nav aria-label="Report pages" className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 20))}>Newer reports</Button>
            <span className="text-caption text-muted">Page {offset / 20 + 1}</span>
            <Button variant="ghost" disabled={data.nextOffset === null} onClick={() => { if (data.nextOffset !== null) setOffset(data.nextOffset) }}>Older reports</Button>
          </nav>
        )}
      </main>
    </>
  )
}
