import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Clock3, ShieldCheck, TriangleAlert } from 'lucide-react'

import { SUPPORT_EMERGENCY_NOTICE, SUPPORT_RESPONSE_NOTICE, useStudentSupportAccess } from '#/lib/support'
import { SUPPORT_REQUEST_STATUSES, supportStatusInfo } from '#/lib/support-requests'

export const Route = createFileRoute('/_app/support/status-guide')({
  head: () => ({ meta: [{ title: 'Support request status guide · Soul Nurture AI' }] }),
  component: SupportStatusGuide,
})

function SupportStatusGuide() {
  const student = useStudentSupportAccess('/support/status-guide')
  if (!student) {
    return <p role="status" className="mx-auto w-full max-w-[1160px] px-6 py-12 text-copy text-body">Checking your access to student support…</p>
  }

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8 lg:py-12">
      <Link to="/support/requests" className="inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline"><ArrowLeft aria-hidden="true" className="size-4" /> My support requests</Link>
      <header className="mt-6 max-w-[760px]">
        <h1 className="text-title text-heading lg:text-title-lg">What each status means</h1>
        <p className="mt-4 text-copy text-body">These are the seven statuses available for support request records. They show the current state of a request, not a guaranteed sequence or a history of what happened.</p>
        <p className="mt-3 text-copy-sm text-body">Chat conversations have their own statuses. An active chat does not mean a request has been reviewed. These records do not show a separate follow-up stage.</p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUPPORT_REQUEST_STATUSES.map((status) => {
          const info = supportStatusInfo(status)
          return (
            <section key={status} aria-labelledby={`status-${status}`} className="rounded-card border border-hairline bg-white p-6">
              <h2 id={`status-${status}`} className={`inline-flex rounded-pill px-3 py-1 text-chip ${info.className}`}>{info.label}</h2>
              <h3 className="mt-5 text-button-sm text-heading">What it means</h3>
              <p className="mt-2 text-copy-sm text-body">{info.description}</p>
              <h3 className="mt-5 text-button-sm text-heading">What you can do</h3>
              <p className="mt-2 text-copy-sm text-body">{info.guidance}</p>
            </section>
          )
        })}
      </div>

      <div className="mt-8 grid items-start gap-4 lg:grid-cols-3">
        <section className="rounded-card border border-hairline bg-panel p-6">
          <div className="flex items-center gap-3"><Clock3 aria-hidden="true" className="size-5 shrink-0 text-action" /><h2 className="text-card text-heading">Response times</h2></div>
          <p className="mt-3 text-copy-sm text-body">{SUPPORT_RESPONSE_NOTICE}</p>
          <p className="mt-3 text-copy-sm text-body">A timing preference on a request is not a promised response time. Check the request for any schedule details and contact your school directly if you need to confirm arrangements.</p>
        </section>
        <section className="rounded-card border border-hairline p-6">
          <div className="flex items-center gap-3"><ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-action" /><h2 className="text-card text-heading">Access and privacy</h2></div>
          <p className="mt-3 text-copy-sm text-body">You can view only your own requests. Authorised school professionals can access requests as part of their work; other students cannot view them. Private staff notes are not shown here.</p>
          <Link to="/privacy" className="mt-3 inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline">Read about privacy <ArrowRight aria-hidden="true" className="size-4" /></Link>
        </section>
        <section className="rounded-card border border-apricot-10 bg-peach p-6 text-peach-ink">
          <div className="flex items-center gap-3"><TriangleAlert aria-hidden="true" className="size-5 shrink-0" /><h2 className="text-card">Not for emergencies</h2></div>
          <p className="mt-3 text-copy-sm">{SUPPORT_EMERGENCY_NOTICE}</p>
          <p className="mt-3 text-copy-sm">Neither “Urgent / feeling unsafe” nor “Escalated” confirms that emergency help is on its way.</p>
        </section>
      </div>

      <nav aria-label="Support options" className="mt-8 flex flex-wrap gap-3">
        <Link to="/support/requests" className="inline-flex min-h-11 items-center rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4">My support requests</Link>
        <Link to="/support" className="inline-flex min-h-11 items-center rounded-pill bg-surface px-6 text-button-sm text-brand-4 hover:bg-neutral-10">Ask to talk</Link>
      </nav>
    </div>
  )
}
