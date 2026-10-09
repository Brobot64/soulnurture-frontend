// Student support door: ask to talk and the school's counsellors pick it up in
// chat. The WhatsApp handoff stays as a quieter second option.

import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, MessageCircle, RefreshCw, SendHorizontal } from 'lucide-react'

import { ChatStatusTag } from '#/components/chat/ThreadView'
import { ErrorNote } from '#/components/dash/ui'
import { Flash, useFlash } from '#/components/Flash'
import { Reveal } from '#/components/Reveal'
import { TextsReveal } from '#/components/TextsReveal'
import { ThinkLine } from '#/components/ThinkLine'
import { ApiError } from '#/lib/api'
import { roleLabel, useSession } from '#/lib/auth'
import {
  createChatThread,
  fetchChatThreads,
  useChatUnread,
  type ChatThreadListItem,
} from '#/lib/chat'
import { timeAgo, useApiQuery } from '#/lib/dash'
import { onRealtimeEvent } from '#/lib/socket'
import {
  TYPE_LABELS,
  fetchSupportPeople,
  handoffMessage,
  initialsOf,
  pickRandomPerson,
  whatsappHandoffLink,
  type SupportPerson,
} from '#/lib/support'

export const Route = createFileRoute('/_app/support/')({
  head: () => ({
    meta: [
      { title: 'Talk to a real person · Soul Nurture AI' },
      {
        name: 'description',
        content:
          'Ask to talk and someone at your school — a counsellor or psychologist — will pick up your request. You chat right here.',
      },
    ],
  }),
  component: Support,
})

const LOADING_STATES = ['Looking for your conversations', 'Checking for a counsellor'] as const

function Support() {
  const navigate = useNavigate()
  const { message, hiding } = useFlash()
  const { user, status: authStatus } = useSession()
  const threads = useApiQuery(fetchChatThreads)
  const unread = useChatUnread()
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { reload } = threads

  useEffect(() => {
    if (authStatus !== 'ready') return
    if (!user) {
      void navigate({ to: '/signin', search: { redirect: '/support' }, replace: true })
    }
  }, [authStatus, user, navigate])

  useEffect(() => {
    if (threads.error?.status === 401) {
      void navigate({ to: '/signin', search: { redirect: '/support' }, replace: true })
    }
  }, [threads.error, navigate])

  useEffect(() => {
    const unsubscribes = [
      onRealtimeEvent('chat.thread.claimed', () => reload()),
      onRealtimeEvent('chat.message.new', () => reload()),
      onRealtimeEvent('chat.thread.closed', () => reload()),
    ]
    return () => unsubscribes.forEach((off) => off())
  }, [reload])

  const handleAsk = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const note = draft.trim()
      const thread = await createChatThread(note ? { note } : {})
      void navigate({
        to: '/support/$threadId',
        params: { threadId: thread.id },
      })
    } catch (caught) {
      setSubmitting(false)
      setSubmitError(
        caught instanceof ApiError ? caught.message : 'Could not send your request.',
      )
      reload()
    }
  }

  const isStudent = user?.role === 'STUDENT'
  const list = threads.data ?? []
  const pending = list.find((thread) => thread.status === 'PENDING') ?? null
  const conversations = list.filter((thread) => thread.id !== pending?.id)

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
          Ask to talk and someone at your school — a counsellor or psychologist — will pick up
          your request. You'll chat right here, and you can end the conversation whenever you
          like.
        </p>
      </TextsReveal>

      <div className="mt-10 flex flex-col gap-6">
        {!user ? (
          <div className="rounded-panel border border-hairline bg-white p-8">
            <p className="text-copy text-body">
              <ThinkLine states={LOADING_STATES} />
            </p>
          </div>
        ) : !isStudent ? (
          <section className="rounded-panel border border-hairline bg-white p-8">
            <p className="text-copy text-ink">
              You're signed in as {roleLabel(user.role)} — this door is how students ask to talk.
            </p>
            <Link
              to={user.role === 'PLATFORM_ADMIN' ? '/admin' : user.role === 'SCHOOL_ADMIN' ? '/school' : '/school/inbox'}
              className="mt-6 inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4"
            >
              Open your dashboard
            </Link>
          </section>
        ) : threads.loading && !threads.data ? (
          <div className="rounded-panel border border-hairline bg-white p-8">
            <p className="text-copy text-body">
              <ThinkLine states={LOADING_STATES} />
            </p>
          </div>
        ) : threads.error && !threads.data ? (
          <div className="rounded-panel border border-hairline bg-white p-8">
            <p className="text-copy text-ink">We couldn't load your conversations right now.</p>
            <p className="mt-2 text-copy-sm text-muted">
              Check your connection and try again in a moment.
            </p>
            <button
              type="button"
              onClick={reload}
              className="mt-6 inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4"
            >
              <RefreshCw className="size-5" />
              Try again
            </button>
          </div>
        ) : pending ? (
          <section className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
            <div className="flex items-center gap-3">
              <ChatStatusTag status="PENDING" />
              <span className="text-caption text-muted">{timeAgo(pending.updatedAt)}</span>
            </div>
            <h2 className="mt-3 text-section text-heading">Your request is with the counsellors</h2>
            <p className="mt-2 text-copy text-body">
              Someone at your school will pick it up soon. You'll be able to write back and forth
              right here once they do.
            </p>
            <Link
              to="/support/$threadId"
              params={{ threadId: pending.id }}
              className="mt-6 inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pill border border-hairline bg-white px-8 text-button text-ink transition-colors hover:bg-panel"
            >
              Open your conversation
            </Link>
          </section>
        ) : (
          <section className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
            <form onSubmit={(event) => void handleAsk(event)}>
              <label htmlFor="ask-note" className="text-copy text-ink">
                Would you like to tell them anything first? (optional)
              </label>
              <textarea
                id="ask-note"
                rows={4}
                maxLength={500}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="e.g. I've been finding it hard to sleep and I'd like to talk."
                className="mt-3 w-full rounded-card border border-hairline bg-panel px-4 py-3 text-copy text-ink outline-none transition-colors placeholder:text-muted focus:border-brand-4"
              />
              {submitError && <ErrorNote className="mt-4">{submitError}</ErrorNote>}
              <button
                type="submit"
                disabled={submitting}
                className="mt-5 inline-flex h-[52px] w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4 disabled:opacity-60"
              >
                <SendHorizontal className="size-5" />
                {submitting ? 'Sending…' : 'Ask to talk'}
              </button>
              <p className="mt-3 text-caption text-muted">
                A counsellor or psychologist at your school will see this request.
              </p>
            </form>
          </section>
        )}

        {isStudent && conversations.length > 0 && (
          <section className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
            <h2 className="text-meta uppercase tracking-wider text-muted">Your conversations</h2>
            <ul className="mt-4 flex flex-col divide-y divide-hairline">
              {conversations.map((thread) => (
                <ConversationRow
                  key={thread.id}
                  thread={thread}
                  unread={unread.byThread[thread.id] ?? 0}
                />
              ))}
            </ul>
          </section>
        )}

        {isStudent && <WhatsAppCard userName={user.name} />}
      </div>

      <p className="mt-10 text-caption text-muted">
        Only what you write in this chat is shared with your counsellor. If you are in danger,
        tell a trusted adult right away.
      </p>

      <Flash message={message} hiding={hiding} />
    </div>
  )
}

function ConversationRow({
  thread,
  unread,
}: {
  thread: ChatThreadListItem
  unread: number
}) {
  const name = thread.professional?.user.name ?? 'Waiting for a counsellor'
  const latest = thread.messages?.[0]
  const preview = latest
    ? `${latest.role === 'STUDENT' ? 'You: ' : ''}${latest.content}`
    : 'No messages yet'

  return (
    <li>
      <Link
        to="/support/$threadId"
        params={{ threadId: thread.id }}
        className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
      >
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-blush text-[15px] font-bold text-brand-4"
        >
          {initialsOf(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <p className="truncate text-copy text-ink">{name}</p>
            <ChatStatusTag status={thread.status} />
          </div>
          <p className="mt-0.5 truncate text-copy-sm text-muted">{preview}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-caption text-muted">{timeAgo(thread.updatedAt)}</span>
          {unread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold leading-none text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </Link>
    </li>
  )
}

function WhatsAppCard({ userName }: { userName?: string }) {
  const [open, setOpen] = useState(false)
  const [people, setPeople] = useState<SupportPerson[] | null>(null)
  const [person, setPerson] = useState<SupportPerson | null>(null)
  const [failed, setFailed] = useState(false)

  const load = () => {
    fetchSupportPeople()
      .then((list) => {
        setPeople(list)
        setPerson((current) => current ?? pickRandomPerson(list))
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 401) return
        setFailed(true)
      })
  }

  const shuffle = () => {
    if (!people || people.length < 2 || !person) return
    setPerson(pickRandomPerson(people, person.id))
  }

  return (
    <details
      className="rounded-panel border border-hairline bg-white p-6 lg:p-8"
      onToggle={(event) => {
        const expanded = event.currentTarget.open
        setOpen(expanded)
        if (expanded && !people && !failed) load()
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5 text-button-sm text-action">
          <MessageCircle className="size-5" />
          Prefer WhatsApp?
        </span>
        <span className="text-caption text-muted">{open ? 'Hide' : "See who's around"}</span>
      </summary>

      {open && failed && (
        <div className="mt-5">
          <p className="text-copy-sm text-muted">We couldn't load the list of people right now.</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false)
              load()
            }}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2.5 whitespace-nowrap rounded-pill border border-hairline bg-white px-6 text-button-sm text-ink transition-colors hover:bg-panel"
          >
            <RefreshCw className="size-4" />
            Try again
          </button>
        </div>
      )}

      {open && !failed && !person && (
        <p className="mt-5 text-copy-sm text-muted">
          <ThinkLine states={['Finding someone who is around', 'Matching you with someone kind']} />
        </p>
      )}

      {open && !failed && people && people.length === 0 && (
        <p className="mt-5 text-copy-sm text-muted">
          No one is listed right now — please try again later, or tell a teacher or another adult
          you trust today.
        </p>
      )}

      {open && !failed && person && (
        <Reveal key={person.id}>
          <div className="mt-5 flex items-center gap-4">
            <Avatar person={person} />
            <div className="min-w-0">
              <span className="inline-flex h-8 items-center rounded-pill bg-panel px-3.5 text-chip text-brand-4">
                {TYPE_LABELS[person.type]}
              </span>
              <h3 className="mt-2 truncate text-copy text-ink">{person.name}</h3>
              {person.title && <p className="mt-0.5 text-copy-sm text-muted">{person.title}</p>}
            </div>
          </div>
          <div className="mt-5 rounded-card bg-panel p-5">
            <p className="text-copy-sm text-muted">Your message — change it if you like</p>
            <p className="mt-2 text-copy-sm text-ink">{handoffMessage(person, userName)}</p>
          </div>
          <a
            href={whatsappHandoffLink(person, userName)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex h-[52px] w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4"
          >
            <MessageCircle className="size-5" />
            Open WhatsApp
          </a>
          {people && people.length > 1 && (
            <button
              type="button"
              onClick={shuffle}
              className="mt-4 inline-flex w-full items-center justify-center gap-2.5 text-button-sm text-action transition-colors hover:text-brand-4"
            >
              <RefreshCw className="size-4" />
              Show me someone else
            </button>
          )}
        </Reveal>
      )}
    </details>
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
        className="size-14 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-14 shrink-0 place-items-center rounded-full bg-blush text-[20px] font-bold text-brand-4"
    >
      {initialsOf(person.name)}
    </span>
  )
}
