import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, RefreshCw, Shapes, UserRound } from 'lucide-react'

import { CheckInSummary } from '#/components/CheckInSummary'
import { MoodFeedback } from '#/components/MoodFeedback'
import { ProgressRow } from '#/components/ProgressRow'
import { TextsReveal } from '#/components/TextsReveal'
import { ThinkLine } from '#/components/ThinkLine'
import { ApiError } from '#/lib/api'
import { useSession } from '#/lib/auth'
import { getCheckIn, type CheckIn } from '#/lib/journey'

export const Route = createFileRoute('/_app/complete/$checkInId')({
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

const LOAD_STATES = ['Fetching your check-in'] as const

function CheckInComplete() {
  const { checkInId } = Route.useParams()
  const navigate = useNavigate()
  const { user, status: authStatus } = useSession()

  const [checkIn, setCheckIn] = useState<CheckIn | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (authStatus !== 'ready') return
    if (!user) {
      navigate({ to: '/signin', search: { redirect: `/complete/${checkInId}` }, replace: true })
      return
    }
    let cancelled = false
    setFailed(false)
    setLoading(true)
    getCheckIn(checkInId)
      .then((found) => {
        if (cancelled) return
        if (!found) {
          navigate({ to: '/check-in', replace: true })
          return
        }
        setCheckIn(found)
        setLoading(false)
      })
      .catch((caught) => {
        if (cancelled) return
        if (caught instanceof ApiError && caught.status === 401) {
          navigate({ to: '/signin', search: { redirect: `/complete/${checkInId}` }, replace: true })
          return
        }
        setFailed(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [authStatus, user, checkInId, navigate, attempt])

  useEffect(() => {
    if (!checkIn) return
    const timer = window.setTimeout(() => setChecked(true), 150)
    return () => window.clearTimeout(timer)
  }, [checkIn])

  if (authStatus !== 'ready' || !user) {
    return (
      <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col px-6 py-10 lg:max-w-[1440px] lg:px-12 xl:px-[120px]">
        <ProgressRow step={3} />
      </div>
    )
  }

  if (loading || failed) {
    return (
      <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col px-6 py-10 lg:max-w-[1440px] lg:px-12 xl:px-[120px]">
        <ProgressRow step={3} />
        <div className="mt-10 rounded-panel border border-hairline bg-white p-8 lg:mt-14">
          {loading ? (
            <p className="text-copy text-body">
              <ThinkLine states={LOAD_STATES} />
            </p>
          ) : (
            <>
              <p className="text-copy text-ink">We couldn't load your check-in right now.</p>
              <p className="mt-2 text-copy-sm text-muted">
                Check your connection and try again in a moment.
              </p>
              <button
                type="button"
                onClick={() => setAttempt((current) => current + 1)}
                className="mt-6 inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4"
              >
                <RefreshCw className="size-5" />
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col px-6 py-10 lg:max-w-[1440px] lg:px-12 xl:px-[120px]">
      <ProgressRow step={3} />

      <div className="mt-10 grid flex-1 gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:grid-cols-[440px_minmax(0,1fr)] xl:gap-20">
        <div className="min-w-0">
          <span
            className="t-success-check size-[72px] place-items-center rounded-full bg-mint ring-8 ring-mint/25 lg:mx-auto"
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
          {checkIn && <MoodFeedback checkInId={checkIn.id} />}
        </div>

        <div className="flex min-w-0 flex-col items-start">
          <h2 className="text-section text-heading">What would help next?</h2>
          <div className="mt-7 flex w-full flex-col gap-5 lg:mb-10 lg:mt-4 lg:gap-4">
            <Link
              to="/resources"
              search={{}}
              className="flex w-full items-center gap-5 rounded-panel border border-hairline bg-white p-6 text-left transition-colors hover:border-action/30 lg:gap-3.5 lg:bg-page lg:p-4"
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
            </Link>

            <Link
              to="/support"
              className="flex w-full items-center gap-5 rounded-panel border border-accent bg-peach p-6 text-left transition-colors hover:bg-blush/60 lg:gap-3.5 lg:p-4"
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
            className="mt-10 inline-flex h-[52px] shrink-0 items-center justify-center whitespace-nowrap rounded-pill bg-surface px-10 text-button text-ink transition-colors hover:bg-neutral-10 lg:mt-auto lg:h-14 lg:px-6"
          >
            I'm done for now
          </button>
        </div>
      </div>
    </div>
  )
}
