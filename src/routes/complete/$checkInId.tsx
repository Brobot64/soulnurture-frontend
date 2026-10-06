import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Shapes, UserRound } from 'lucide-react'

import { CheckInSummary } from '#/components/CheckInSummary'
import { Flash, useFlash } from '#/components/Flash'
import { ProgressRow } from '#/components/ProgressRow'
import { TextsReveal } from '#/components/TextsReveal'
import { getCheckIn, type CheckIn } from '#/lib/journey'

export const Route = createFileRoute('/complete/$checkInId')({
  head: () => ({
    meta: [
      { title: 'Check-in complete · Soul Nurture AI' },
      {
        name: 'description',
        content:
          'Your check-in is saved. See what might help next — wellbeing resources, ideas for exam stress and better sleep, or talking to a school counsellor.',
      },
    ],
  }),
  component: CheckInComplete,
})

function CheckInComplete() {
  const { checkInId } = Route.useParams()
  const navigate = useNavigate()

  const [checkIn, setCheckIn] = useState<CheckIn | null>(null)
  const [checked, setChecked] = useState(false)
  const { flash, message, hiding } = useFlash()

  useEffect(() => {
    const found = getCheckIn(checkInId)
    if (!found) {
      navigate({ to: '/check-in', replace: true })
      return
    }
    setCheckIn(found)
    const timer = window.setTimeout(() => setChecked(true), 150)
    return () => window.clearTimeout(timer)
  }, [checkInId, navigate])

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col px-6 py-10 lg:px-8 lg:py-14">
      <ProgressRow step={3} />

      <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <span
            className="t-success-check size-[72px] place-items-center rounded-full bg-mint ring-8 ring-mint/25"
            style={{ display: 'grid' }}
            data-state={checked ? 'in' : 'out'}
            aria-hidden="true"
          >
            <span className="grid size-12 place-items-center rounded-full bg-action">
              <svg viewBox="0 0 24 24" className="size-6" fill="none">
                <path
                  d="M5 12.5L10 17L19 8"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </span>

          <TextsReveal>
            <h1 className="t-stagger-line t-stagger-line--1 mt-8 text-title text-heading lg:text-hero-sm">
              Thanks for checking in
            </h1>
            <p className="t-stagger-line t-stagger-line--2 mt-3 text-copy text-body lg:text-lede">
              Taking a moment to notice how you feel matters. Here's what you shared:
            </p>
          </TextsReveal>

          {checkIn && <CheckInSummary checkIn={checkIn} className="mt-10" />}
        </div>

        <div>
          <h2 className="text-section text-heading">What would help next?</h2>
          <div className="mt-7 flex flex-col gap-5">
            <button
              type="button"
              onClick={() => flash('Wellbeing resources open in a later step of the journey.')}
              className="flex w-full items-center gap-5 rounded-panel border border-hairline bg-white p-6 text-left transition-colors hover:border-action/30"
            >
              <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-brand-4 text-white">
                <Shapes className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-button font-bold text-heading">
                  See wellbeing resources
                </span>
                <span className="mt-1 block text-copy text-body">
                  Ideas for exam stress and better sleep
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" />
            </button>

            <Link
              to="/support"
              className="flex w-full items-center gap-5 rounded-panel border border-blush bg-peach p-6 text-left transition-colors hover:bg-blush/60"
            >
              <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-counsellor text-white">
                <UserRound className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-button font-bold text-peach-ink">
                  Talk to a school counsellor
                </span>
                <span className="mt-1 block text-copy text-peach-ink/80">
                  Send a request to a real person who can help
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-peach-ink/70" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => navigate({ to: '/welcome' })}
            className="mt-10 inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-pill bg-surface px-10 text-button text-ink transition-colors hover:bg-neutral-10 lg:mt-16"
          >
            I'm done for now
          </button>
        </div>
      </div>

      <Flash message={message} hiding={hiding} />
    </div>
  )
}
