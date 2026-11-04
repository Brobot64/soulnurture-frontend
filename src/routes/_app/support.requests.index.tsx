import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Check, ClipboardList, Clock3, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'

import { useApiQuery } from '#/lib/dash'
import { SUPPORT_EMERGENCY_NOTICE, SUPPORT_RESPONSE_NOTICE, TYPE_LABELS, useStudentSupportAccess } from '#/lib/support'
import { fetchStudentSupportRequests, SUPPORT_REQUEST_STATUSES, SUPPORT_STEPS, SUPPORT_STEP_INFO, supportStatusInfo, supportStepOf, supportTimestamp, type StudentSupportRequest, type SupportRequestStatus } from '#/lib/support-requests'

export const Route = createFileRoute('/_app/support/requests/')({
  head: () => ({ meta: [{ title: 'My support requests · Soul Nurture AI' }] }),
  component: SupportRequests,
})

function SupportRequests() {
  const student = useStudentSupportAccess('/support/requests')
  if (!student) {
    return <p role="status" className="mx-auto w-full max-w-[1160px] px-6 py-12 text-copy text-body">Checking your access to support requests…</p>
  }
  return <StudentRequests key={student.id} />
}

function StudentRequests() {
  const requests = useApiQuery(fetchStudentSupportRequests)
  const [filter, setFilter] = useState<SupportRequestStatus | 'ALL'>('ALL')
  const sorted = [...(requests.data ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  const filtered = sorted.filter((request) => filter === 'ALL' || request.status === filter)
  const [latest, ...earlier] = filtered

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8 lg:py-12">
      <Link to="/support" className="inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline"><ArrowLeft aria-hidden="true" className="size-4" /> Back to support</Link>
      <header className="mt-6 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-[720px]">
          <h1 className="text-title text-heading lg:text-title-lg">My support requests</h1>
          <p className="mt-3 text-copy text-body">Track the requests you’ve sent to your school’s counsellors.</p>
          <p className="mt-2 text-copy-sm text-body">{SUPPORT_RESPONSE_NOTICE}</p>
        </div>
        <Link to="/support" className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4">New request</Link>
      </header>

      <div className="mt-6 rounded-card border border-hairline bg-panel px-5 py-4 text-copy-sm text-body">
        <p>Request records and chat history are separate. Asking to talk opens a secure chat; it does not create a record in this list. An active chat does not mean a request has been reviewed.</p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
          <Link to="/support" hash="conversations" className="inline-flex min-h-11 items-center text-button-sm text-action hover:underline">View chat history</Link>
          <Link to="/support/status-guide" className="inline-flex min-h-11 items-center text-button-sm text-action hover:underline">What each status means <ArrowRight aria-hidden="true" className="ml-2 size-4" /></Link>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor="request-status" className="block text-button-sm text-heading">Filter by status</label>
          <select id="request-status" value={filter} onChange={(event) => setFilter(event.target.value as SupportRequestStatus | 'ALL')} className="mt-2 min-h-11 w-full rounded-card border border-hairline bg-white px-4 py-2 text-copy-sm text-ink sm:min-w-56">
            <option value="ALL">All statuses</option>
            {SUPPORT_REQUEST_STATUSES.map((status) => <option key={status} value={status}>{supportStatusInfo(status).label}</option>)}
          </select>
        </div>
        <button type="button" onClick={requests.reload} disabled={requests.loading} className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-hairline px-5 text-button-sm text-action hover:bg-panel disabled:opacity-60"><RefreshCw aria-hidden="true" className="size-4" /> {requests.loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <div aria-busy={requests.loading} className="mt-5">
        {requests.loading && <p role="status" className="mb-4 text-copy-sm text-body">{requests.data ? 'Refreshing support requests…' : 'Loading support requests…'}</p>}
        {requests.error ? (
          <section className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
            <h2 className="text-section text-heading">Support requests unavailable</h2>
            <p role="alert" className="mt-3 text-copy text-body">{requests.error.status === 401 ? 'Your session has expired. Sign in again to view your requests.' : "We couldn't load your support requests. Please try again."}</p>
            {requests.error.status === 401 ? (
              <Link to="/signin" search={{ redirect: '/support/requests' }} className="mt-5 inline-flex min-h-11 items-center rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4">Sign in</Link>
            ) : (
              <button type="button" onClick={requests.reload} disabled={requests.loading} className="mt-5 inline-flex min-h-11 items-center rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4 disabled:opacity-60">Try again</button>
            )}
          </section>
        ) : requests.loading ? null : requests.data && !latest ? (
          <section className="rounded-panel border border-hairline bg-white p-6 text-center lg:p-10">
            <ClipboardList aria-hidden="true" className="mx-auto size-8 text-action" />
            <h2 className="mt-4 text-section text-heading">{sorted.length === 0 ? 'No support request records yet' : 'No requests with this status'}</h2>
            <p role="status" className="mx-auto mt-3 max-w-[540px] text-copy text-body">{sorted.length === 0 ? 'If you have asked to talk, check your chat history for that conversation. You can also ask your school about support.' : 'Choose another status or show all your requests.'}</p>
            {sorted.length === 0 ? (
              <Link to="/support" hash="conversations" className="mt-5 inline-flex min-h-11 items-center rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4">View chat history</Link>
            ) : (
              <button type="button" onClick={() => setFilter('ALL')} className="mt-5 inline-flex min-h-11 items-center rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4">Show all requests</button>
            )}
          </section>
        ) : latest ? (
          <>
            <p role="status" className="mb-4 text-caption text-muted">{filtered.length} {filtered.length === 1 ? 'request' : 'requests'}{filter === 'ALL' ? '' : ` · ${supportStatusInfo(filter).label}`}</p>
            <LatestRequest request={latest} filtered={filter !== 'ALL'} />
            {earlier.length > 0 && (
              <section className="mt-8" aria-labelledby="earlier-requests">
                <h2 id="earlier-requests" className="text-card text-heading">{filter === 'ALL' ? 'Earlier requests' : 'Earlier matching requests'}</h2>
                <div className="mt-4 overflow-x-auto rounded-panel border border-hairline">
                  <table className="w-full min-w-[520px] border-collapse text-left">
                    <caption className="sr-only">Your earlier support requests</caption>
                    <thead className="bg-panel text-caption text-muted">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-semibold">Sent</th>
                        <th scope="col" className="px-5 py-3 font-semibold">Last update</th>
                        <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                        <th scope="col" className="w-12 px-5 py-3"><span className="sr-only">Open</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {earlier.map((request) => <EarlierRequest key={request.id} request={request} />)}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>

      <footer className="mt-8 space-y-4">
        <p className="flex items-start gap-2 text-caption text-muted"><ShieldCheck aria-hidden="true" className="size-4 shrink-0" />Only you and authorised school professionals can see your requests. An active chat does not mean a request has been reviewed.</p>
        <p className="flex items-start gap-3 rounded-card border border-apricot-10 bg-peach p-5 text-copy-sm text-peach-ink"><TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{SUPPORT_EMERGENCY_NOTICE}</p>
      </footer>
    </div>
  )
}

function LatestRequest({ request, filtered }: { request: StudentSupportRequest; filtered: boolean }) {
  const info = supportStatusInfo(request.status)
  return (
    <section aria-labelledby="latest-request" className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="latest-request" className="sr-only">{filtered ? 'Latest matching request' : 'Latest request'}</h2>
          <span className={`rounded-pill px-3.5 py-1.5 text-chip font-semibold ${info.className}`}>{info.label}</span>
          <p className="flex items-center gap-2 text-copy-sm text-muted">
            <Clock3 aria-hidden="true" className="size-4 shrink-0" />
            Sent <time dateTime={request.createdAt}>{supportTimestamp(request.createdAt)}</time> · Updated <time dateTime={request.updatedAt}>{supportTimestamp(request.updatedAt)}</time>
          </p>
        </div>
        <Link to="/support/requests/$requestId" params={{ requestId: request.id }} className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-hairline px-5 text-button-sm text-action hover:bg-panel">View details</Link>
      </div>

      <RequestTimeline status={request.status} />

      <p className="mt-5 text-copy-sm text-body">{request.supportPerson.name} · {TYPE_LABELS[request.supportPerson.type] ?? 'School support contact'}{request.supportPerson.title ? ` · ${request.supportPerson.title}` : ''}</p>
      <p className="mt-4 text-copy text-body">{info.description}</p>
      <p className="mt-2 text-copy-sm text-muted">{info.guidance}</p>
    </section>
  )
}

/**
 * The design's four-stage track. CANCELLED sits outside it, so an off-track
 * request shows no progress rather than a bar stuck at the start.
 */
function RequestTimeline({ status }: { status: SupportRequestStatus }) {
  const current = supportStepOf(status)
  if (!current) {
    return <p className="mt-6 text-copy-sm text-muted">This request is outside the usual steps, so there is no progress to show.</p>
  }
  const currentIndex = SUPPORT_STEPS.indexOf(current)

  return (
    <ol className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-0">
      {SUPPORT_STEPS.map((step, index) => {
        const done = index < currentIndex
        const active = index === currentIndex
        const info = SUPPORT_STEP_INFO[step]
        return (
          <li key={step} className="flex min-w-0 flex-1 items-center gap-3">
            <span
              aria-hidden="true"
              className={`grid size-7 shrink-0 place-items-center rounded-full border text-caption ${
                active ? 'border-action bg-action text-white' : done ? 'border-action bg-action/10 text-action' : 'border-hairline bg-white text-muted'
              }`}
            >
              {done ? <Check className="size-4" /> : active ? <span className="size-2 rounded-full bg-white" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-button-sm ${active || done ? 'text-heading' : 'text-muted'}`}>{info.label}</span>
              {active && <span className="sr-only"> (current step)</span>}
            </span>
            {index < SUPPORT_STEPS.length - 1 && (
              <span aria-hidden="true" className={`hidden h-px w-6 shrink-0 sm:block ${done ? 'bg-action' : 'bg-hairline'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function EarlierRequest({ request }: { request: StudentSupportRequest }) {
  const info = supportStatusInfo(request.status)
  return (
    <tr className="relative hover:bg-panel">
      <td className="px-5 py-5">
        <p className="break-words text-button-sm text-heading">{request.supportPerson.name}</p>
        <p className="mt-1 text-caption text-muted">Sent <time dateTime={request.createdAt}>{supportTimestamp(request.createdAt)}</time></p>
      </td>
      <td className="px-5 py-5"><time dateTime={request.updatedAt} className="text-copy-sm text-body">{supportTimestamp(request.updatedAt)}</time></td>
      <td className="px-5 py-5"><span className={`rounded-pill px-3 py-1 text-chip ${info.className}`}>{info.label}</span></td>
      <td className="px-5 py-5">
        <Link to="/support/requests/$requestId" params={{ requestId: request.id }} className="grid size-7 place-items-center rounded-full border border-hairline text-action">
          <ArrowRight aria-hidden="true" className="size-4" />
          <span className="sr-only">View the request sent {supportTimestamp(request.createdAt)}</span>
        </Link>
      </td>
    </tr>
  )
}
