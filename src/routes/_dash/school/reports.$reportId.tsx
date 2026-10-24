import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Check } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { messageOf } from '#/components/dash/school-dialogs'
import { Button, ErrorNote, Skeleton, Tag } from '#/components/dash/ui'
import {
  fetchAiResponseReport,
  fetchReviewContext,
  recordAiResponseReportReview,
  REVIEW_OUTCOME_LABELS,
  REVIEW_OUTCOMES,
  REVIEWER_ROLES,
  type AiResponseReport,
  type ReviewOutcome,
} from '#/lib/ai-response-reports'
import { formatDateTime, useApiQuery, useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/school/reports/$reportId')({
  head: () => ({ meta: [{ title: 'AI reply report · Soul Nurture AI' }] }),
  component: ReportPage,
})

function ReportPage() {
  const user = useRoleGuard(REVIEWER_ROLES)
  const { reportId } = Route.useParams()
  return user ? <ReportDetail key={`${user.id}:${user.schoolId}:${reportId}`} reportId={reportId} /> : null
}

function ReportDetail({ reportId }: { reportId: string }) {
  const query = useApiQuery(() => fetchAiResponseReport(reportId), [reportId])
  const [recorded, setRecorded] = useState<AiResponseReport | null>(null)
  const [showContext, setShowContext] = useState(false)
  const report = recorded ?? query.data
  const { error, loading, reload } = query
  return (
    <>
      <DashHeader title="AI reply report" subtitle="The submitted reply is kept as it was when reported." />
      <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-6 p-6 lg:p-8">
        <Link to="/school/reports" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-pill text-chip font-medium text-action hover:text-brand-4">
          <ArrowLeft aria-hidden="true" className="size-4" />Back to AI reply reports
        </Link>
        {error ? (
          <div className="flex flex-col items-start gap-3"><ErrorNote>{error.message}</ErrorNote><Button onClick={reload}>Try again</Button></div>
        ) : loading || !report ? (
          <div aria-label="Loading report" className="flex flex-col gap-4"><Skeleton className="h-44" /><Skeleton className="h-24" /></div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3"><Tag>Reported reply is fixed</Tag><time dateTime={report.createdAt} className="text-caption text-muted">Submitted {formatDateTime(report.createdAt)}</time></div>
            <section className="rounded-panel border border-hairline bg-white p-5 sm:p-7">
              <h2 className="text-title-sm text-heading">Reported reply</h2>
              <blockquote className="mt-5 whitespace-pre-wrap break-words border-l-4 border-action pl-5 text-copy text-body">{report.responseContent}</blockquote>
              <h3 className="mt-7 text-card text-heading">Student’s note</h3>
              <p className="mt-3 whitespace-pre-wrap break-words text-copy-sm text-body">{report.note ?? 'No note added.'}</p>
            </section>
            <ReviewDecision report={report} onRecorded={setRecorded} />
            <p className="text-copy-sm text-muted">Reporting a reply does not create a support request or send the student any message. The linked conversation may already show a newer version of the reply.</p>
            <div>
              <Button variant="ghost" aria-expanded={showContext} aria-controls="report-context" onClick={() => setShowContext((value) => !value)}>{showContext ? 'Hide linked conversation' : 'View linked conversation'}</Button>
            </div>
            {showContext && <LinkedContext report={report} />}
          </>
        )}
      </main>
    </>
  )
}

/**
 * The reviewer's decision on a reported reply. Record-only, exactly as the
 * backend implements it: saving writes the outcome, the reviewer and the
 * timestamp on the report — it never edits the reply, touches the student's
 * conversation, opens a support request or notifies anyone.
 */
function ReviewDecision({
  report,
  onRecorded,
}: {
  report: AiResponseReport
  onRecorded: (next: AiResponseReport) => void
}) {
  const [outcome, setOutcome] = useState<ReviewOutcome>(report.reviewOutcome ?? REVIEW_OUTCOMES[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      onRecorded(await recordAiResponseReportReview(report.id, outcome))
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-panel border border-hairline bg-white p-5 sm:p-7" aria-label="Review decision">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-title-sm text-heading">Your decision</h2>
        {report.reviewOutcome ? (
          <Tag tone="success">
            <Check aria-hidden="true" className="mr-1.5 size-3.5" />
            {REVIEW_OUTCOME_LABELS[report.reviewOutcome]}
          </Tag>
        ) : (
          <Tag tone="neutral">Not reviewed yet</Tag>
        )}
      </div>
      {report.reviewOutcome && (
        <p className="mt-2 text-caption text-muted">
          {reviewerLine(report)}
        </p>
      )}
      <fieldset className="mt-5 flex flex-col gap-2">
        <legend className="text-chip font-medium text-heading">What did you conclude about this reply?</legend>
        {REVIEW_OUTCOMES.map((value) => {
          const picked = value === outcome
          return (
            <label
              key={value}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-copy-sm transition-colors ${
                picked ? 'border-action bg-panel text-heading' : 'border-hairline text-body hover:bg-panel'
              }`}
            >
              <input
                type="radio"
                name="review-outcome"
                value={value}
                checked={picked}
                onChange={() => setOutcome(value)}
                disabled={busy}
                className="size-4 shrink-0 accent-brand-4"
              />
              {REVIEW_OUTCOME_LABELS[value]}
            </label>
          )
        })}
      </fieldset>
      {error && <ErrorNote className="mt-4">{error}</ErrorNote>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy || outcome === report.reviewOutcome}>
          {busy ? 'Saving…' : report.reviewOutcome ? 'Save a new decision' : 'Save decision'}
        </Button>
        <p className="text-caption text-muted">
          Saving records your decision for your school’s reviewers only. The reply, the student’s conversation and the reported text stay untouched.
        </p>
      </div>
    </section>
  )
}

function reviewerLine(report: AiResponseReport): string {
  const when = report.reviewedAt ? formatDateTime(report.reviewedAt) : ''
  const who = report.reviewedBy ? `${report.reviewedBy.name} (${report.reviewedBy.role.toLowerCase()})` : 'a reviewer'
  return `Recorded by ${who}${when ? ` on ${when}` : ''}. Changing it replaces the previous decision.`
}

function LinkedContext({ report }: { report: AiResponseReport }) {
  const { data, error, loading, reload } = useApiQuery(() => fetchReviewContext(report.conversationId), [report.conversationId])
  return (
    <section id="report-context" aria-label="Linked conversation" className="flex flex-col gap-5">
      <h2 className="text-title-sm text-heading">Linked conversation</h2>
      {error ? <div className="flex flex-col items-start gap-3"><ErrorNote>{error.message}</ErrorNote><Button onClick={reload}>Try again</Button></div> : loading || !data ? (
        <div aria-label="Loading linked conversation"><Skeleton className="h-44" /></div>
      ) : (
        <>
          <div className="rounded-panel border border-hairline bg-white p-5 sm:p-7">
            <h3 className="text-card text-heading">AI-generated summary</h3>
            <p className="mt-2 text-caption text-muted">AI-generated context, not a human review or a diagnosis.</p>
            {data.summary ? <>
              <p className="mt-4 whitespace-pre-wrap break-words text-copy-sm text-body">{data.summary.summaryLocalized || data.summary.summary}</p>
              {data.summary.summaryLocalized && data.summary.summaryLocalized !== data.summary.summary && <details className="mt-3 text-copy-sm text-muted"><summary className="cursor-pointer">Source summary</summary><p className="mt-2 whitespace-pre-wrap break-words">{data.summary.summary}</p></details>}
            </> : <p className="mt-4 text-copy-sm text-muted">No AI summary is available.</p>}
          </div>
          {data.messages.length ? <ol className="flex flex-col gap-4">
            {data.messages.map((message) => {
              const selected = message.id === report.messageId
              return <li key={message.id} className={`max-w-[90%] rounded-panel border p-5 ${message.role === 'USER' ? 'self-end border-hairline bg-panel' : 'self-start bg-white'} ${selected ? 'border-action' : 'border-hairline'}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-caption text-muted"><span>{message.role === 'USER' ? 'Student' : 'AI reply'}</span><time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>{selected && <Tag>{message.content === report.responseContent ? 'Reported reply' : 'Changed since report'}</Tag>}</div>
                <p className="whitespace-pre-wrap break-words text-copy-sm text-body">{message.content}</p>
              </li>
            })}
          </ol> : <p className="text-copy-sm text-muted">No visible messages in this conversation.</p>}
        </>
      )}
    </section>
  )
}
