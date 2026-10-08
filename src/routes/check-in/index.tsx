import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { Flash, useFlash } from '#/components/Flash'
import { ConsentGate, useAiConsent } from '#/components/ConsentGate'
import { ProgressRow } from '#/components/ProgressRow'
import { TextsReveal } from '#/components/TextsReveal'
import { useSession } from '#/lib/auth'
import { MOODS, readMoodDraft, saveMoodDraft } from '#/lib/journey'

export const Route = createFileRoute('/check-in/')({
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
  // Pre-chat consent gate — the journey cannot reach the AI without it.
  const consent = useAiConsent(authStatus === 'ready' && !!user)

  useEffect(() => {
    if (authStatus !== 'ready') return
    if (!user) {
      navigate({ to: '/signin', search: { redirect: '/check-in' }, replace: true })
    }
  }, [authStatus, user, navigate])

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
      <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-6 py-8 lg:px-8 lg:py-14">
        <ProgressRow step={1} backTo="/welcome" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-6 py-8 lg:px-8 lg:py-14">
      <ProgressRow step={1} backTo="/welcome" />

      <div className="mt-10 lg:mt-14">
        <TextsReveal>
          <h1 className="t-stagger-line t-stagger-line--1 text-title text-heading lg:text-hero-sm">
            How are you feeling right now?
          </h1>
          <p className="t-stagger-line t-stagger-line--2 mt-3 text-copy text-body lg:text-lede">
            Tap the face that feels closest. You can change it any time.
          </p>
        </TextsReveal>
      </div>

      <div
        role="radiogroup"
        aria-label="How are you feeling right now?"
        className="mt-8 grid grid-cols-4 gap-3 lg:mt-12 lg:grid-cols-8 lg:gap-4"
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
              className={`t-check relative flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 ${mood.tone} ${
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
              <span className="text-[30px] leading-none lg:text-[40px]">{mood.emoji}</span>
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
        className="mt-8 min-h-[130px] w-full resize-none rounded-3xl border border-hairline bg-white px-6 py-5 text-copy text-ink outline-none transition-colors placeholder:text-neutral-8 focus:border-action lg:mt-10"
      />

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Link
          to="/support"
          className="order-2 text-center text-button-sm text-action transition-colors hover:text-brand-4 lg:order-1 lg:text-button"
        >
          I would rather talk to a person
        </Link>
        <button
          type="button"
          onClick={handleContinue}
          className="order-1 inline-flex h-[52px] w-full items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 lg:order-2 lg:h-[60px] lg:w-auto lg:px-16 lg:text-button"
        >
          Continue
        </button>
      </div>

      <Flash message={message} hiding={hiding} />

      {consent.state === 'required' && (
        <ConsentGate
          onAccepted={consent.accept}
          onDeclined={() => navigate({ to: '/welcome', replace: true })}
        />
      )}
    </div>
  )
}
