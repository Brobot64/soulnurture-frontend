import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, TriangleAlert } from 'lucide-react'

import { SUPPORT_EMERGENCY_NOTICE, useStudentSupportAccess } from '#/lib/support'
import {
  SUPPORT_REQUEST_STATUSES,
  SUPPORT_STEPS,
  SUPPORT_STEP_INFO,
  supportStatusInfo,
  supportStepOf,
  type SupportStep,
} from '#/lib/support-requests'

/** Which record statuses the design's four stages actually stand for. */
const STATUSES_PER_STEP: Record<SupportStep, string[]> = SUPPORT_STEPS.reduce(
  (acc, step) => {
    acc[step] = SUPPORT_REQUEST_STATUSES.filter((status) => supportStepOf(status) === step)
      .map((status) => supportStatusInfo(status).label)
    return acc
  },
  {} as Record<SupportStep, string[]>,
)

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
      <header className="mt-6 max-w-[900px]">
        <h1 className="text-title text-heading lg:text-title-lg">What each status means</h1>
        <p className="mt-4 text-copy text-body">The same four steps school professionals use, explained for you. Each one shows where your request is and what you can do.</p>
        <p className="mt-3 text-copy-sm text-muted">A request can also be marked <strong className="font-semibold text-ink">Cancelled</strong>, which sits outside these steps. The step tells you where a request is now — it is not a promise about what happens next.</p>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SUPPORT_STEPS.map((step, index) => {
          const info = SUPPORT_STEP_INFO[step]
          return (
            <section key={step} aria-labelledby={`status-${step}`} className="rounded-card border border-hairline bg-white p-6">
              <h2 id={`status-${step}`} className={`inline-flex rounded-pill px-3.5 py-1.5 text-chip font-semibold ${info.className}`}>{info.label}</h2>
              <div className="mt-5 flex gap-1.5" aria-hidden="true">
                {SUPPORT_STEPS.map((segment, position) => (
                  <span key={segment} className={`h-1.5 flex-1 rounded-full ${position <= index ? 'bg-action' : 'bg-surface'}`} />
                ))}
              </div>
              <h3 className="mt-5 text-caption text-muted">What it means</h3>
              <p className="mt-2 text-copy-sm text-body">{info.meaning}</p>
              <h3 className="mt-5 text-caption text-muted">What you can do</h3>
              <p className="mt-2 text-copy-sm text-body">{info.guidance}</p>
              {STATUSES_PER_STEP[step].length > 0 && (
                <p className="mt-5 border-t border-hairline pt-3 text-caption text-muted">Record statuses shown here: {STATUSES_PER_STEP[step].join(', ')}.</p>
              )}
            </section>
          )
        })}
      </div>

      <footer className="mt-8 space-y-4">
        <Link to="/privacy" className="inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline">Read about privacy <ArrowRight aria-hidden="true" className="size-4" /></Link>
        <p className="flex items-start gap-3 rounded-card border border-apricot-10 bg-peach p-5 text-copy-sm text-peach-ink">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{SUPPORT_EMERGENCY_NOTICE} Neither “Urgent / feeling unsafe” nor “Escalated” confirms that emergency help is on its way.</span>
        </p>
      </footer>

      <nav aria-label="Support options" className="mt-8 flex flex-wrap gap-3">
        <Link to="/support/requests" className="inline-flex min-h-11 items-center rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4">My support requests</Link>
        <Link to="/support" className="inline-flex min-h-11 items-center rounded-pill bg-surface px-6 text-button-sm text-brand-4 hover:bg-neutral-10">Ask to talk</Link>
      </nav>
    </div>
  )
}
