import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import { Flash, useFlash } from '#/components/Flash'
import { ProgressRow } from '#/components/ProgressRow'
import { TextsReveal } from '#/components/TextsReveal'
import { MOODS, TRIGGERS, clearMoodDraft, createCheckIn, createConversation, readMoodDraft } from '#/lib/journey'

export const Route = createFileRoute('/check-in/why')({
  head: () => ({
    meta: [
      { title: 'Why do you think you feel that way? · Soul Nurture AI' },
      {
        name: 'description',
        content:
          'Choose anything that might be behind how you feel — school, friends, relationship, family, sleep, feeling alone, or something else.',
      },
    ],
  }),
  component: WhyCheckIn,
})

function WhyCheckIn() {
  const navigate = useNavigate()
  const { message, hiding } = useFlash()
  const [selected, setSelected] = useState<string[]>([])
  const [note, setNote] = useState('')

  const toggle = (trigger: string) => {
    setSelected((prev) =>
      prev.includes(trigger) ? prev.filter((item) => item !== trigger) : [...prev, trigger],
    )
  }

  const handleNext = () => {
    const draft = readMoodDraft()
    const mood = draft ? MOODS.find((item) => item.id === draft.moodId) : undefined
    if (!draft || !mood) {
      navigate({ to: '/check-in', replace: true })
      return
    }
    const checkIn = createCheckIn({
      feeling: mood.feeling,
      intensity: mood.intensity,
      description: [draft.note, note.trim()].filter(Boolean).join('\n\n') || undefined,
      triggers: selected.length > 0 ? selected : undefined,
    })
    const conversation = createConversation(checkIn.id)
    clearMoodDraft()
    navigate({ to: '/reflection/$conversationId', params: { conversationId: conversation.id } })
  }

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-6 py-8 lg:px-8 lg:py-14">
      <ProgressRow step={1} backTo="/check-in" />

      <div className="mt-10 lg:mt-14">
        <TextsReveal>
          <h1 className="t-stagger-line t-stagger-line--1 text-title text-heading lg:text-hero-sm">
            Why do you think you feel that way?
          </h1>
          <p className="t-stagger-line t-stagger-line--2 mt-3 text-copy text-body lg:text-lede">
            Choose any that fit.
          </p>
        </TextsReveal>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 lg:mt-12 lg:gap-4">
        {TRIGGERS.map((trigger) => {
          const active = selected.includes(trigger)
          return (
            <button
              key={trigger}
              type="button"
              role="checkbox"
              aria-checked={active}
              onClick={() => toggle(trigger)}
              className={`t-check inline-flex h-[58px] items-center whitespace-nowrap rounded-pill border px-6 text-button lg:h-[52px] lg:px-7 lg:text-button-sm ${
                active
                  ? 'border-action bg-action text-white'
                  : 'border-hairline bg-white text-ink hover:border-action/40'
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-flex items-center overflow-hidden transition-all duration-200 ${
                  active ? 'mr-2 w-4 opacity-100' : 'mr-0 w-0 opacity-0'
                }`}
              >
                <svg viewBox="0 0 10.1668 10.1668" className="size-4 shrink-0">
                  <path
                    d="M1 5.52L3.92 9.17L9.17 1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {trigger}
            </button>
          )
        })}
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={2000}
        placeholder="Add a few words if you want to (optional)"
        aria-label="Add a few words if you want to (optional)"
        className="mt-8 min-h-[130px] w-full resize-none rounded-3xl border border-hairline bg-white px-6 py-5 text-copy text-ink outline-none transition-colors placeholder:text-neutral-8 focus:border-action lg:mt-10"
      />

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Link
          to="/support"
          className="order-2 text-center text-button-sm text-action transition-colors hover:text-brand-4 lg:order-1 lg:inline-flex lg:h-[52px] lg:items-center lg:rounded-pill lg:bg-surface lg:px-8 lg:text-brand-4 lg:hover:bg-neutral-10 lg:hover:text-brand-4"
        >
          I would rather talk to a person
        </Link>
        <button
          type="button"
          onClick={handleNext}
          className="order-1 inline-flex h-[52px] w-full items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 lg:order-2 lg:h-[60px] lg:w-auto lg:px-16 lg:text-button"
        >
          Next
        </button>
      </div>

      <Flash message={message} hiding={hiding} />
    </div>
  )
}
