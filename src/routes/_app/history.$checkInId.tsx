import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, HeartHandshake, ShieldCheck, UserRound } from 'lucide-react'

import { ErrorNote, Skeleton } from '#/components/dash/ui'
import {
  HISTORY_NOT_EMERGENCY,
  fetchHistoryEntry,
  feelingTitle,
  isNotFound,
  reflectionLane,
  requestStage,
  type HistoryDetail,
} from '#/lib/history'
import { useStudentSupportAccess } from '#/lib/support'

export const Route = createFileRoute('/_app/history/$checkInId')({
  head: () => ({ meta: [{ title: 'Check-in details · Soul Nurture AI' }] }),
  component: CheckInDetailPage,
})

const STAGES = ['New', 'Reviewed', 'Follow-up required', 'Follow-up completed'] as const

function timestamp(iso: string): string {
  const when = new Date(iso)
  return Number.isNaN(when.getTime())
    ? iso
    : when.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
}

function CheckInDetailPage() {
  const student = useStudentSupportAccess('/history')
  const { checkInId } = Route.useParams()
  const [entry, setEntry] = useState<HistoryDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!student) return
    let cancelled = false
    setError(null)
    fetchHistoryEntry(checkInId)
      .then((value) => { if (!cancelled) setEntry(value) })
      .catch((cause) => {
        if (cancelled) return
        if (isNotFound(cause)) setMissing(true)
        else setError(cause instanceof Error ? cause.message : 'This entry could not be loaded.')
      })
    return () => { cancelled = true }
  }, [student, checkInId])

  if (!student) {
    return <p role="status" className="mx-auto w-full max-w-[1160px] px-6 py-12 text-copy text-body">Checking your access…</p>
  }
  if (missing) {
    return (
      <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8">
        <h1 className="text-title-sm text-heading">This entry is not in your history</h1>
        <p className="mt-3 text-copy-sm text-body">It may have been removed, or the link may be from another session.</p>
        <Link to="/history" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-pill bg-action px-6 text-button-sm font-semibold text-white hover:bg-brand-4">
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to my history
        </Link>
      </div>
    )
  }
  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8">
        <ErrorNote>{error}</ErrorNote>
      </div>
    )
  }
  if (!entry) {
    return (
      <div aria-label="Loading this check-in" className="mx-auto w-full max-w-[1160px] flex-1 flex-col gap-4 px-5 py-8 sm:px-8">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const lane = reflectionLane(entry)
  const stage = entry.supportRequest ? requestStage(entry.supportRequest) : null

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8 lg:py-12">
      <Link to="/history" className="inline-flex min-h-11 items-center gap-2 rounded-pill text-chip font-medium text-action hover:text-brand-4">
        <ArrowLeft aria-hidden="true" className="size-4" /> My wellbeing history
      </Link>

      <header className="mt-4 max-w-[760px]">
        <h1 className="text-title text-heading lg:text-title-lg">Check-in details</h1>
        <p className="mt-2 text-copy-sm text-muted">Your check-in — {timestamp(entry.createdAt)}</p>
        <p className="mt-4 text-card text-heading">
          Feeling {feelingTitle(entry.feeling)}
          {lane ? ` · ${lane}` : ' · check-in only'}
        </p>
        {entry.description && (
          <p className="mt-3 whitespace-pre-wrap break-words rounded-card bg-panel px-4 py-3 text-copy-sm text-body">
            {entry.description}
          </p>
        )}
        {entry.triggers.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {entry.triggers.map((trigger) => (
              <li key={trigger} className="rounded-pill bg-surface px-3 py-1 text-chip text-body">{trigger}</li>
            ))}
          </ul>
        )}
      </header>

      {entry.reflection && (
        <section aria-labelledby="reflection-heading" className="mt-10 max-w-[760px]">
          <h2 id="reflection-heading" className="text-title-sm text-heading">Your reflection with Soul Nurture AI</h2>
          <ul className="mt-5 flex flex-col gap-4">
            {entry.messages.map((message) => (
              <li
                key={message.id}
                className={`max-w-[640px] rounded-card border p-4 ${
                  message.role === 'USER' ? 'ml-auto border-action/30 bg-panel text-heading' : 'border-hairline bg-white text-body'
                }`}
              >
                <p className="mb-2 flex items-center gap-2 text-caption text-muted">
                  {message.role === 'USER'
                    ? <><UserRound aria-hidden="true" className="size-3.5" /> You{message.viaVoice ? ' (spoken)' : ''}</>
                    : <><HeartHandshake aria-hidden="true" className="size-3.5" /> Soul Nurture AI</>}
                </p>
                <p className="whitespace-pre-wrap break-words text-copy-sm">{message.content}</p>
              </li>
            ))}
          </ul>
          {entry.messages.length === 0 && (
            <p className="text-copy-sm text-muted">This reflection has no messages left on it.</p>
          )}
          <p className="mt-4 text-caption text-muted">
            AI replies are reflection prompts only. Not medical advice, therapy or emergency help.
          </p>
          <Link
            to="/reflection/$conversationId"
            params={{ conversationId: entry.reflection.conversationId }}
            className="mt-5 inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline"
          >
            Open the conversation
          </Link>
        </section>
      )}

      {/* No "Resources shared with you" block. Nothing in the data records a
          resource being shared with a check-in, so the page would be inventing
          the link the design draws. */}

      {stage && entry.supportRequest && (
        <section aria-labelledby="request-heading" className="mt-10 max-w-[760px] rounded-card border border-hairline bg-white p-6">
          <h2 id="request-heading" className="text-title-sm text-heading">Support request</h2>
          <p className="mt-2 text-copy-sm text-body">
            Status <span className="font-semibold text-heading">{stage.label}</span> — {stage.detail}
          </p>
          <ol className="mt-5 flex flex-col gap-2">
            {STAGES.map((name) => {
              // Only the stage the request is actually at gets marked. A
              // numbered run of "reached" steps would claim a sequence the
              // derived fields never promised — a completed follow-up does not
              // prove the request itself was ever moved to "reviewed".
              const current = name === stage.label
              return (
                <li key={name} className={`flex items-center gap-3 text-copy-sm ${current ? 'text-heading' : 'text-muted'}`}>
                  <span aria-hidden="true" className={`size-2.5 rounded-full ${current ? 'bg-action' : 'bg-surface'}`} />
                  {name}
                  {current && <span className="sr-only">(where the request stands now)</span>}
                </li>
              )
            })}
          </ol>
          <p className="mt-4 text-caption text-muted">
            These stages show where the request stands now, not a sequence every request passes through.
            <Link to="/support/status-guide" className="ml-1 text-action hover:underline">What each status means</Link>
          </p>
        </section>
      )}

      <section className="mt-10 max-w-[760px] rounded-card bg-panel p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-action" />
          <h2 className="text-card text-heading">Approved for you to view</h2>
        </div>
        <p className="mt-3 text-copy-sm text-body">
          Notes and review tools used by school professionals are not shown on this page. If a safeguarding concern exists,
          the information about it stays with the authorised professionals at your school.
        </p>
      </section>

      <div className="mt-6 max-w-[760px] rounded-card border border-apricot-10 bg-peach p-6 text-peach-ink">
        <h2 className="text-card">Not for emergencies</h2>
        <p className="mt-3 text-copy-sm">{HISTORY_NOT_EMERGENCY}</p>
      </div>

      <div className="mt-8">
        <Link
          to="/history"
          className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-surface px-6 text-button-sm text-brand-4 hover:bg-neutral-10"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to my history
        </Link>
      </div>
    </div>
  )
}
