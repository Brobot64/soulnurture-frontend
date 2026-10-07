import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, MessageCircle, RefreshCw } from 'lucide-react'

import { Flash, useFlash } from '#/components/Flash'
import { Reveal } from '#/components/Reveal'
import { TextsReveal } from '#/components/TextsReveal'
import { ThinkLine } from '#/components/ThinkLine'
import { ApiError } from '#/lib/api'
import { useSession } from '#/lib/auth'
import {
  TYPE_LABELS,
  fetchSupportPeople,
  handoffMessage,
  initialsOf,
  pickRandomPerson,
  whatsappHandoffLink,
  type SupportPerson,
} from '#/lib/support'

export const Route = createFileRoute('/support')({
  head: () => ({
    meta: [
      { title: 'Talk to a real person · Soul Nurture AI' },
      {
        name: 'description',
        content:
          'We match you with someone at your school — a counsellor or psychologist. Continue on WhatsApp with a message already written for you.',
      },
    ],
  }),
  component: Support,
})

const LOADING_STATES = ['Finding someone who is around', 'Matching you with someone kind'] as const

function Support() {
  const navigate = useNavigate()
  const { message, hiding } = useFlash()
  const { user, status: authStatus } = useSession()
  const [people, setPeople] = useState<SupportPerson[] | null>(null)
  const [person, setPerson] = useState<SupportPerson | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (authStatus !== 'ready') return
    if (!user) {
      navigate({ to: '/signin', search: { redirect: '/support' }, replace: true })
      return
    }
    let cancelled = false
    setFailed(false)
    fetchSupportPeople()
      .then((list) => {
        if (cancelled) return
        setPeople(list)
        setPerson((current) => current ?? pickRandomPerson(list))
      })
      .catch((caught) => {
        if (cancelled) return
        if (caught instanceof ApiError && caught.status === 401) {
          navigate({ to: '/signin', search: { redirect: '/support' }, replace: true })
          return
        }
        setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [authStatus, user, navigate, attempt])

  const shuffle = () => {
    if (!people || people.length < 2 || !person) return
    setPerson(pickRandomPerson(people, person.id))
  }

  const loading = !failed && !person && (!people || people.length > 0)

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-6 py-8 lg:px-8 lg:py-14">
      <button
        type="button"
        onClick={() => window.history.back()}
        aria-label="Go back"
        className="grid size-12 w-fit place-items-center rounded-full bg-surface text-ink transition-colors hover:bg-neutral-10 lg:size-11"
      >
        <ChevronLeft className="size-5" />
      </button>

      <TextsReveal>
        <h1 className="t-stagger-line t-stagger-line--1 mt-8 text-title text-heading lg:text-hero-sm">
          Talk to a real person
        </h1>
        <p className="t-stagger-line t-stagger-line--2 mt-3 text-copy text-body lg:text-lede">
          We'll match you with someone at your school. Continue on WhatsApp with a message already
          written for you — you can change it before sending.
        </p>
      </TextsReveal>

      <div className="mt-10">
        {loading && (
          <div className="rounded-panel border border-hairline bg-white p-8">
            <p className="text-copy text-body">
              <ThinkLine states={LOADING_STATES} />
            </p>
          </div>
        )}

        {failed && (
          <div className="rounded-panel border border-hairline bg-white p-8">
            <p className="text-copy text-ink">We couldn't load the list of people right now.</p>
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
          </div>
        )}

        {people && people.length === 0 && !failed && (
          <div className="rounded-panel border border-hairline bg-white p-8">
            <p className="text-copy text-ink">No one is listed right now.</p>
            <p className="mt-2 text-copy-sm text-muted">
              Please try again later — or tell a teacher or another adult you trust today.
            </p>
          </div>
        )}

        {person && !failed && (
          <Reveal key={person.id}>
            <section className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
              <div className="flex items-center gap-5">
                <Avatar person={person} />
                <div className="min-w-0">
                  <span className="inline-flex h-8 items-center rounded-pill bg-panel px-3.5 text-chip text-brand-4">
                    {TYPE_LABELS[person.type]}
                  </span>
                  <h2 className="mt-2 truncate text-section text-heading">{person.name}</h2>
                  {person.title && <p className="mt-0.5 text-copy text-body">{person.title}</p>}
                </div>
              </div>
              <p className="mt-6">
                <span
                  className={`inline-flex h-8 items-center gap-2.5 rounded-pill px-3.5 text-chip ${
                    person.availableToday ? 'bg-brand-11 text-brand-4' : 'bg-panel text-muted'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 shrink-0 rounded-full ${
                      person.availableToday ? 'bg-action' : 'bg-neutral-10'
                    }`}
                  />
                  {person.availabilityLabel ??
                    (person.availableToday ? 'Available today' : 'Usually available on school days')}
                </span>
              </p>
            </section>

            <div className="mt-6 rounded-card bg-panel p-6">
              <p className="text-copy-sm text-muted">
                Your message on WhatsApp — change it if you like
              </p>
              <p className="mt-3 text-copy text-ink">{handoffMessage(person, user?.name)}</p>
            </div>

            <a
              href={whatsappHandoffLink(person, user?.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex h-[56px] w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4"
            >
              <MessageCircle className="size-5" />
              Open WhatsApp
            </a>

            {people && people.length > 1 && (
              <button
                type="button"
                onClick={shuffle}
                className="mt-5 inline-flex w-full items-center justify-center gap-2.5 text-button-sm text-action transition-colors hover:text-brand-4"
              >
                <RefreshCw className="size-5" />
                Show me someone else
              </button>
            )}
          </Reveal>
        )}
      </div>

      <p className="mt-10 text-caption text-muted">
        Nothing from your check-in or reflection is shared here — only the message you send on
        WhatsApp. If you are in danger, tell a trusted adult right away.
      </p>

      <Flash message={message} hiding={hiding} />
    </div>
  )
}

function Avatar({ person }: { person: SupportPerson }) {
  const [broken, setBroken] = useState(false)
  if (person.imageUrl && !broken) {
    return (
      <img
        src={person.imageUrl}
        alt=""
        onError={() => setBroken(true)}
        className="size-16 shrink-0 rounded-full object-cover lg:size-20"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-16 shrink-0 place-items-center rounded-full bg-blush text-[24px] font-bold text-brand-4 lg:size-20"
    >
      {initialsOf(person.name)}
    </span>
  )
}
