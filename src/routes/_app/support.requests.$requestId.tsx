import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, CalendarDays, LockKeyhole, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'

import { useApiQuery } from '#/lib/dash'
import { SUPPORT_EMERGENCY_NOTICE, SUPPORT_RESPONSE_NOTICE, TYPE_LABELS, useStudentSupportAccess } from '#/lib/support'
import { fetchStudentSupportRequest, SUPPORT_TIMING_LABELS, supportStatusInfo, supportTimestamp, type StudentSupportRequest } from '#/lib/support-requests'

export const Route = createFileRoute('/_app/support/requests/$requestId')({
  head: () => ({ meta: [{ title: 'Support request details · Soul Nurture AI' }] }),
  component: SupportRequestDetails,
})

function SupportRequestDetails() {
  const { requestId } = Route.useParams()
  const student = useStudentSupportAccess(`/support/requests/${encodeURIComponent(requestId)}`)
  if (!student) {
    return <p role="status" className="mx-auto w-full max-w-[1160px] px-6 py-12 text-copy text-body">Checking your access to this request…</p>
  }
  // Changing either identity or URL discards the previous request's data immediately.
  return <StudentRequestDetails key={`${student.id}:${requestId}`} requestId={requestId} />
}

function StudentRequestDetails({ requestId }: { requestId: string }) {
  const query = useApiQuery(() => fetchStudentSupportRequest(requestId), [requestId])
  const unavailable = query.error?.status === 403 || query.error?.status === 404

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8 lg:py-12">
      <Link to="/support/requests" className="inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline"><ArrowLeft aria-hidden="true" className="size-4" /> My support requests</Link>
      <header className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div><h1 className="text-title text-heading lg:text-title-lg">Request details</h1><p className="mt-3 text-copy text-body">What you shared and the current status of your request.</p></div>
        <Link to="/support" className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4">Ask to talk <ArrowRight aria-hidden="true" className="size-4" /></Link>
      </header>

      <div className="mt-7" aria-busy={query.loading}>
        {query.loading ? (
          <p role="status" className="rounded-panel border border-hairline p-6 text-copy text-body">Loading request details…</p>
        ) : query.error ? (
          <section className="rounded-panel border border-hairline bg-white p-8 text-center">
            <LockKeyhole aria-hidden="true" className="mx-auto size-8 text-action" />
            <h2 className="mt-4 text-section text-heading">{unavailable ? 'Request unavailable' : 'Could not load this request'}</h2>
            <p role="alert" className="mt-3 text-copy text-body">{unavailable ? 'This request is unavailable. You can view your own requests from My support requests.' : query.error.status === 401 ? 'Your session has expired. Sign in again to view your request.' : 'Check your connection and try again.'}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link to="/support/requests" className="inline-flex min-h-11 items-center rounded-pill bg-surface px-6 text-button-sm text-brand-4 hover:bg-neutral-10">My support requests</Link>
              {query.error.status === 401 ? (
                <Link to="/signin" search={{ redirect: `/support/requests/${encodeURIComponent(requestId)}` }} className="inline-flex min-h-11 items-center rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4">Sign in</Link>
              ) : (
                <button type="button" onClick={query.reload} className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-hairline px-6 text-button-sm text-action hover:bg-panel"><RefreshCw aria-hidden="true" className="size-4" /> Try again</button>
              )}
            </div>
          </section>
        ) : query.data ? (
          <RequestContent request={query.data} onRefresh={query.reload} />
        ) : <p role="status" className="text-copy text-body">Request unavailable. Return to My support requests to try again.</p>}
      </div>
    </div>
  )
}

function RequestContent({ request, onRefresh }: { request: StudentSupportRequest; onRefresh: () => void }) {
  const info = supportStatusInfo(request.status)
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] lg:gap-8">
      <div className="min-w-0 space-y-5">
        <section className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-section text-heading">Current status</h2>
            <span className={`rounded-pill px-3 py-1 text-chip ${info.className}`}>{info.label}</span>
          </div>
          <p className="mt-4 text-copy text-body">{info.description}</p>
          <p className="mt-2 text-copy-sm text-body">{info.guidance}</p>
          <dl className="mt-5 grid gap-4 border-t border-hairline pt-5 text-copy-sm sm:grid-cols-2">
            <div><dt className="text-muted">Sent</dt><dd className="mt-1 text-ink"><time dateTime={request.createdAt}>{supportTimestamp(request.createdAt)}</time></dd></div>
            <div><dt className="text-muted">Last updated</dt><dd className="mt-1 text-ink"><time dateTime={request.updatedAt}>{supportTimestamp(request.updatedAt)}</time></dd></div>
          </dl>
          <p className="mt-4 text-caption text-muted">This is the current recorded status, not a timeline of reviews or follow-ups. The update time does not say what changed.</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <button type="button" onClick={onRefresh} className="inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline"><RefreshCw aria-hidden="true" className="size-4" /> Refresh status</button>
            <Link to="/support/status-guide" className="inline-flex min-h-11 items-center text-button-sm text-action hover:underline">What each status means</Link>
          </div>
        </section>

        <section className="rounded-panel border border-hairline p-6 lg:p-8">
          <h2 className="text-section text-heading">What you shared</h2>
          <dl className="mt-5 space-y-5">
            <div>
              <dt className="text-button-sm text-heading">Your note</dt>
              <dd className="mt-2 whitespace-pre-wrap rounded-card bg-panel p-4 text-copy text-body [overflow-wrap:anywhere]">{request.note?.trim() ? request.note : 'You did not include a note.'}</dd>
            </div>
            <div>
              <dt className="text-button-sm text-heading">Requested timing</dt>
              <dd className="mt-2 text-copy-sm text-body">{SUPPORT_TIMING_LABELS[request.timing] ?? 'Timing unavailable'}</dd>
              <dd className="mt-2 text-caption text-muted">This is the preference submitted with your request, not a confirmed response time or appointment.</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-panel border border-hairline p-6 lg:p-8">
          <div className="flex items-center gap-3"><CalendarDays aria-hidden="true" className="size-5 text-action" /><h2 className="text-section text-heading">Schedule details</h2></div>
          <dl className="mt-5 grid gap-5 text-copy-sm sm:grid-cols-2">
            <div><dt className="text-muted">Time</dt><dd className="mt-2 text-ink">{request.scheduledAt ? <time dateTime={request.scheduledAt}>{supportTimestamp(request.scheduledAt)}</time> : 'No time provided'}</dd></div>
            <div><dt className="text-muted">Location</dt><dd className="mt-2 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{request.locationLabel?.trim() ? request.locationLabel : 'No location provided'}</dd></div>
          </dl>
          <p className="mt-4 text-caption text-muted">Dates and times are shown in your device's local time zone. If arrangements are unclear, confirm them with your school.</p>
        </section>
      </div>

      <aside aria-label="Request contact and safety information" className="min-w-0 space-y-4">
        <section className="rounded-card border border-hairline p-5">
          <h2 className="text-card text-heading">Support contact on this request</h2>
          <p className="mt-3 break-words text-copy text-heading">{request.supportPerson.name}</p>
          <p className="mt-1 text-copy-sm text-body">{TYPE_LABELS[request.supportPerson.type] ?? 'School support contact'}</p>
          {request.supportPerson.title && <p className="mt-1 break-words text-copy-sm text-muted">{request.supportPerson.title}</p>}
          <p className="mt-4 text-copy-sm text-body">{SUPPORT_RESPONSE_NOTICE}</p>
        </section>
        <section className="rounded-card border border-hairline p-5">
          <div className="flex items-center gap-3"><ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-action" /><h2 className="text-card text-heading">Who can see this?</h2></div>
          <p className="mt-3 text-copy-sm text-body">You can view only your own requests here. Authorised school professionals can access requests as part of their work. Other students cannot see this request.</p>
          <p className="mt-3 text-copy-sm text-body">Private staff notes are not shown on this page.</p>
        </section>
        <section className="rounded-card border border-hairline p-5">
          <h2 className="text-card text-heading">Looking for your conversation?</h2>
          <p className="mt-3 text-copy-sm text-body">Chat history is separate from these request details. Chat status is not a request review status.</p>
          <Link to="/support" hash="conversations" className="mt-3 inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline">View chat history <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </section>
        <section className="rounded-card border border-apricot-10 bg-peach p-5 text-peach-ink">
          <div className="flex items-center gap-3"><TriangleAlert aria-hidden="true" className="size-5 shrink-0" /><h2 className="text-card">Not for emergencies</h2></div>
          <p className="mt-3 text-copy-sm">{SUPPORT_EMERGENCY_NOTICE}</p>
        </section>
      </aside>
    </div>
  )
}
