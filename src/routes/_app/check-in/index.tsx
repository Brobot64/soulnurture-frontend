import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { Flash, useFlash } from '#/components/Flash'
import { ConsentGate, useAiConsent } from '#/components/ConsentGate'
import { ProgressRow } from '#/components/ProgressRow'
import { TextsReveal } from '#/components/TextsReveal'
import { useSession } from '#/lib/auth'
import {
  MOODS,
  readMoodDraft,
  saveMoodDraft,
  fetchCheckInHistory,
  type CheckInHistoryEntry,
} from '#/lib/journey'

export const Route = createFileRoute('/_app/check-in/')({
  head: () => ({
    meta: [
      { title: 'How are you feeling right now? · Soul Nurture AI' },
      {
        name: 'description',
        content:
          'Tap the face that feels closest to how you are right now and add a few words if you want to. It takes less than a minute, and you can change your answer any time.',
      },
    ],
  }),
  component: MoodCheckIn,
})

function MoodCheckIn() {
  const navigate = useNavigate()
  const { flash, message, hiding } = useFlash()
  const { user, status: authStatus } = useSession()
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  // Previous conversations stay reachable from the very first step — the
  // student never has to start a new check-in to get back to a past one.
  const [history, setHistory] = useState<CheckInHistoryEntry[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  // Pre-chat consent gate — the journey cannot reach the AI without it.
  const consent = useAiConsent(authStatus === 'ready' && !!user)

  useEffect(() => {
    if (authStatus !== 'ready') return
    if (!user) {
      navigate({ to: '/signin', search: { redirect: '/check-in' }, replace: true })
    }
  }, [authStatus, user, navigate])

  useEffect(() => {
    if (authStatus !== 'ready' || !user) return
    let cancelled = false
    fetchCheckInHistory()
      .then((result) => {
        if (!cancelled) {
          setHistory(result.items)
          setHistoryLoaded(true)
        }
      })
      .catch(() => {
        // the history strip is optional — the check-in works without it
      })
    return () => {
      cancelled = true
    }
  }, [authStatus, user])

  useEffect(() => {
    const draft = readMoodDraft()
    if (!draft) return
    if (MOODS.some((mood) => mood.id === draft.moodId)) setSelected(draft.moodId)
    if (draft.note) setNote(draft.note)
  }, [])

  const handleContinue = () => {
    if (!selected) {
      flash('Pick the face that feels closest first.')
      return
    }
    saveMoodDraft({ moodId: selected, note: note.trim() })
    navigate({ to: '/check-in/why' })
  }

  if (authStatus !== 'ready' || !user) {
    return (
      <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-6 py-8 lg:max-w-[1440px] lg:px-12 lg:py-10 xl:px-[120px]">
        <ProgressRow step={1} backTo="/welcome" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-6 py-8 lg:max-w-[1440px] lg:px-12 lg:py-10 xl:px-[120px]">
      <ProgressRow step={1} backTo="/welcome" />

      <div className="mt-10 lg:mt-7">
        <TextsReveal>
          <h1 className="t-stagger-line t-stagger-line--1 text-title text-heading lg:text-title-lg">
            How are you feeling right now?
          </h1>
          <p className="t-stagger-line t-stagger-line--2 mt-3 text-copy text-body lg:mt-6 lg:text-lede">
            Tap the face that feels closest. You can change it any time.
          </p>
        </TextsReveal>
      </div>

      <div
        role="radiogroup"
        aria-label="How are you feeling right now?"
        className="mt-8 grid grid-cols-4 gap-3 lg:mt-6 lg:grid-cols-8 lg:gap-4 xl:flex xl:justify-between"
      >
        {MOODS.map((mood) => {
          const active = selected === mood.id
          return (
            <button
              key={mood.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(mood.id)}
              className={`t-check relative flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 lg:aspect-auto lg:h-[168px] lg:rounded-xl xl:w-[104px] xl:shrink-0 ${mood.tone} ${
                active ? 'border-action' : 'border-black/[0.04] hover:border-action/25'
              }`}
            >
              <svg
                viewBox="0 0 10.1668 10.1668"
                aria-hidden="true"
                className="absolute left-1/2 top-2 size-3.5 -translate-x-1/2 text-action"
              >
                <path
                  d="M1 5.52L3.92 9.17L9.17 1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[30px] leading-none lg:text-[48px]">{mood.emoji}</span>
              <span className="text-bubble font-bold text-ink lg:text-card">{mood.label}</span>
            </button>
          )
        })}
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={2000}
        placeholder="Describe how you feel (optional)"
        aria-label="Describe how you feel (optional)"
        className="mt-8 min-h-[130px] w-full resize-none rounded-3xl border border-hairline bg-white px-6 py-5 text-copy text-ink outline-none transition-colors placeholder:text-neutral-8 focus:border-action lg:mt-6 lg:min-h-[120px] lg:bg-page lg:p-4"
      />

      <div className="mt-8 flex flex-col gap-4 lg:mt-6 lg:flex-row lg:items-center lg:justify-between">
        <Link
          to="/support"
          className="order-2 text-center text-button-sm text-action transition-colors hover:text-brand-4 lg:order-1 lg:text-button"
        >
          I would rather talk to a person
        </Link>
        <button
          type="button"
          onClick={handleContinue}
          className="order-1 inline-flex h-[52px] w-full items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 lg:order-2 lg:h-14 lg:w-auto lg:px-6 lg:text-button"
        >
          Continue
        </button>
      </div>

      <Flash message={message} hiding={hiding} />

      {historyLoaded && (
        <section className="mt-12 lg:mt-16" aria-label="Past reflections">
          <h2 className="text-section text-heading">Past reflections</h2>
          <div className="mt-4 flex flex-col gap-2.5">
            {history.length === 0 && (
              <p className="text-copy-sm text-muted">
                No past reflections yet — your closed conversations will show up here.
              </p>
            )}
            {history.map((entry) => {
              const when = new Date(entry.createdAt)
              const label = Number.isNaN(when.getTime())
                ? entry.createdAt
                : when.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
              const body = (
                <>
                  <p className="text-chip font-semibold text-ink lg:text-copy">{label}</p>
                  <p className="mt-1 line-clamp-2 text-copy-sm text-muted lg:line-clamp-3">
                    {entry.summary?.trim() || 'Summary on its way — check back soon.'}
                  </p>
                </>
              )
              return entry.conversationId ? (
                <Link
                  key={entry.checkInId}
                  to="/reflection/$conversationId"
                  params={{ conversationId: entry.conversationId }}
                  className="rounded-2xl border border-hairline bg-white px-3.5 py-2.5 text-left transition-colors hover:border-action/40 lg:px-4 lg:py-3"
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={entry.checkInId}
                  className="rounded-2xl border border-hairline bg-white px-3.5 py-2.5 lg:px-4 lg:py-3"
                >
                  {body}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {consent.state === 'required' && (
        <ConsentGate
          onAccepted={consent.accept}
          onDeclined={() => navigate({ to: '/welcome', replace: true })}
        />
      )}
    </div>
  )
}
