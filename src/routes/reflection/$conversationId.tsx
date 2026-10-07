import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, RefreshCw, UserRound } from 'lucide-react'

import { CheckInSummary } from '#/components/CheckInSummary'
import { Flash, useFlash } from '#/components/Flash'
import { ProgressRow } from '#/components/ProgressRow'
import { Reveal } from '#/components/Reveal'
import { StatusBadge } from '#/components/StatusBadge'
import { StreamText } from '#/components/StreamText'
import { ThinkLine } from '#/components/ThinkLine'
import { ApiError } from '#/lib/api'
import { useSession } from '#/lib/auth'
import {
  QUICK_REPLIES,
  clearPendingOpening,
  closeConversation,
  fetchConversation,
  getCheckIn,
  newId,
  readPendingOpening,
  sendMessage,
  type CheckIn,
  type ConversationDetail,
  type ConversationStatus,
  type HumanCareRecommendation,
  type Message,
} from '#/lib/journey'

export const Route = createFileRoute('/reflection/$conversationId')({
  head: () => ({
    meta: [
      { title: 'Your reflection · Soul Nurture AI' },
      {
        name: 'description',
        content:
          'A gentle AI-guided reflection based on your check-in. Reflection prompts only — not medical advice, therapy, or an emergency service.',
      },
    ],
  }),
  component: Reflection,
})

const THINK_STATES = ['Thinking', 'Reflecting', 'Finding the right words'] as const
const LOAD_STATES = ['Opening your check-in', 'Finding where you left off'] as const

/** The bounded flow wraps up after this many student turns. */
const FULL_FLOW_TURNS = 3

// Guards against a double mount re-sending the stashed opening message.
const openingInFlight = new Set<string>()

function Reflection() {
  const { conversationId } = Route.useParams()
  const navigate = useNavigate()
  const { flash, message: flashMessage, hiding } = useFlash()
  const { user, status: authStatus } = useSession()

  const [messages, setMessages] = useState<Message[]>([])
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null)
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('ACTIVE')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [input, setInput] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<HumanCareRecommendation | null>(null)
  const [closing, setClosing] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  // Only messages added this session stream word by word; restored ones render settled.
  const streamIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (authStatus !== 'ready') return
    if (!user) {
      navigate({
        to: '/signin',
        search: { redirect: `/reflection/${conversationId}` },
        replace: true,
      })
      return
    }
    let cancelled = false
    setLoadFailed(false)
    setLoading(true)

    void (async () => {
      let conversation: ConversationDetail | null
      try {
        conversation = await fetchConversation(conversationId)
      } catch (caught) {
        if (cancelled) return
        if (caught instanceof ApiError && caught.status === 401) {
          navigate({
            to: '/signin',
            search: { redirect: `/reflection/${conversationId}` },
            replace: true,
          })
          return
        }
        setLoading(false)
        setLoadFailed(true)
        return
      }
      if (cancelled) return
      if (!conversation) {
        navigate({ to: '/check-in', replace: true })
        return
      }

      setCheckInId(conversation.checkInId)
      setConversationStatus(conversation.status)
      setMessages(conversation.messages)
      setLoading(false)

      if (conversation.checkInId) {
        getCheckIn(conversation.checkInId)
          .then((found) => {
            if (!cancelled) setCheckIn(found)
          })
          .catch(() => {
            // the sidebar summary is optional — the chat works without it
          })
      }

      // The composed "why" travels as the student's first message.
      const pending =
        conversation.messages.length === 0 ? readPendingOpening(conversationId) : null
      if (!pending || openingInFlight.has(conversationId)) return

      openingInFlight.add(conversationId)
      const tempId = newId('msg')
      setMessages([
        { id: tempId, role: 'USER', content: pending, createdAt: new Date().toISOString() },
      ])
      setThinking(true)
      try {
        const result = await sendMessage(conversationId, { content: pending, language: 'en' })
        if (cancelled) return
        clearPendingOpening()
        streamIds.current.add(result.assistantMessage.id)
        setMessages((prev) => [
          ...prev.map((entry) => (entry.id === tempId ? result.userMessage : entry)),
          result.assistantMessage,
        ])
        if (result.humanCareRecommendation?.show) setRecommendation(result.humanCareRecommendation)
        if (result.aiPending) flash('The AI is taking a moment — its reply will arrive shortly.')
      } catch (caught) {
        if (cancelled) return
        setMessages([])
        if (caught instanceof ApiError && caught.status === 401) {
          navigate({
            to: '/signin',
            search: { redirect: `/reflection/${conversationId}` },
            replace: true,
          })
          return
        }
        setSendError(
          caught instanceof ApiError
            ? caught.message
            : 'Your reflection could not start. Please try again.',
        )
      } finally {
        openingInFlight.delete(conversationId)
        if (!cancelled) setThinking(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authStatus, user, conversationId, navigate, flash, attempt])

  useEffect(() => {
    const el = scrollRef.current
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  const userTurns = messages.filter((entry) => entry.role === 'USER').length
  const done = conversationStatus !== 'ACTIVE' || (!thinking && userTurns >= FULL_FLOW_TURNS)
  const last = messages[messages.length - 1]

  const send = async (raw: string) => {
    const content = raw.trim()
    if (!content || thinking || done) return
    setInput('')
    setSendError(null)
    const tempId = newId('msg')
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'USER', content, createdAt: new Date().toISOString() },
    ])
    setThinking(true)
    try {
      const result = await sendMessage(conversationId, { content, language: 'en' })
      streamIds.current.add(result.assistantMessage.id)
      setMessages((prev) => [
        ...prev.map((entry) => (entry.id === tempId ? result.userMessage : entry)),
        result.assistantMessage,
      ])
      if (result.humanCareRecommendation?.show) setRecommendation(result.humanCareRecommendation)
      if (result.aiPending) flash('The AI is taking a moment — its reply will arrive shortly.')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        navigate({
          to: '/signin',
          search: { redirect: `/reflection/${conversationId}` },
          replace: true,
        })
        return
      }
      setMessages((prev) => prev.filter((entry) => entry.id !== tempId))
      setInput(content)
      setSendError(
        caught instanceof ApiError
          ? caught.message
          : 'Your message could not be sent. Please try again.',
      )
    } finally {
      setThinking(false)
    }
  }

  const handleContinue = async () => {
    if (closing) return
    setClosing(true)
    try {
      await closeConversation(conversationId)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        navigate({
          to: '/signin',
          search: { redirect: `/reflection/${conversationId}` },
          replace: true,
        })
        return
      }
      // completing does not depend on the close call — the summary can queue later
    }
    if (checkInId) {
      navigate({ to: '/complete/$checkInId', params: { checkInId } })
    } else {
      navigate({ to: '/welcome' })
    }
  }

  if (authStatus !== 'ready' || !user) {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col px-6 py-6 lg:px-10 lg:py-8">
        <ProgressRow step={2} backTo="/check-in/why" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col px-6 py-6 lg:px-10 lg:py-8">
      <ProgressRow step={2} backTo="/check-in/why" />

      <div className="mt-6 flex min-h-0 flex-1 flex-col lg:mt-8 lg:flex-row lg:gap-12">
        <div className="flex min-h-0 flex-1 flex-col">
          <p className="mx-auto flex w-fit items-center gap-2.5 rounded-pill bg-peach px-5 py-2 text-chip text-peach-ink">
            <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
            AI-guided reflection · not a therapist or doctor
          </p>

          <div ref={scrollRef} role="log" className="mt-6 min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-7 pb-4">
              {loading && (
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-blush lg:size-9"
                    aria-hidden="true"
                  >
                    <span className="size-2.5 rounded-full bg-accent" />
                  </span>
                  <p className="min-w-0 flex-1 pt-1 text-copy text-body sm:text-lede">
                    <ThinkLine states={LOAD_STATES} />
                  </p>
                </div>
              )}

              {loadFailed && (
                <div className="mx-auto mt-4 w-full max-w-[440px] rounded-panel border border-hairline bg-white p-8">
                  <p className="text-copy text-ink">We couldn't open your reflection right now.</p>
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

              {!loading && !loadFailed && !thinking && !sendError && messages.length === 0 && (
                <p className="mx-auto mt-10 max-w-[440px] text-center text-copy text-body">
                  You're in a private reflection. When you're ready, say whatever is on your mind —
                  there's no right way to start.
                </p>
              )}

              {!loading &&
                messages.map((entry) =>
                  entry.role === 'USER' ? (
                    <Reveal key={entry.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-[20px] bg-action px-5 py-3.5 text-copy text-white sm:text-lede">
                        {entry.content}
                      </div>
                    </Reveal>
                  ) : (
                    <div key={entry.id} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-blush lg:size-9"
                        aria-hidden="true"
                      >
                        <span className="size-2.5 rounded-full bg-accent" />
                      </span>
                      {streamIds.current.has(entry.id) ? (
                        <p className="min-w-0 flex-1 text-copy text-ink sm:text-lede">
                          <StreamText text={entry.content} />
                        </p>
                      ) : (
                        <Reveal className="min-w-0 flex-1">
                          <p className="text-copy text-ink sm:text-lede">{entry.content}</p>
                        </Reveal>
                      )}
                    </div>
                  ),
                )}

              {thinking && !loading && (
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-blush lg:size-9"
                    aria-hidden="true"
                  >
                    <span className="size-2.5 rounded-full bg-accent" />
                  </span>
                  <p className="min-w-0 flex-1 pt-1 text-copy text-body sm:text-lede">
                    <ThinkLine states={THINK_STATES} />
                  </p>
                </div>
              )}

              {!loading && !loadFailed && !thinking && !done && last?.role === 'ASSISTANT' && (
                <div className="pl-11 lg:pl-12">
                  <p className="text-copy font-medium text-body">Choose a reply</p>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {QUICK_REPLIES.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => void send(reply)}
                        className={`inline-flex h-[46px] items-center whitespace-nowrap rounded-pill border bg-white px-6 text-button-sm transition-colors ${
                          reply.includes('talk to someone')
                            ? 'border-[1.5px] border-accent text-peach-ink hover:bg-peach/50'
                            : 'border-hairline text-ink hover:border-action/40'
                        }`}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 shrink-0">
            {recommendation?.show && (
              <div className="mb-4 rounded-panel bg-peach px-6 py-5">
                <p className="text-copy text-peach-ink">
                  {recommendation.message ??
                    'It might help to talk with someone at your school.'}
                </p>
                <Link
                  to="/support"
                  className="mt-3 inline-flex text-button-sm text-action transition-colors hover:text-brand-4"
                >
                  Talk to a person on WhatsApp
                </Link>
              </div>
            )}

            {sendError && (
              <div className="mb-4">
                <StatusBadge tone="error">{sendError}</StatusBadge>
              </div>
            )}

            {!loading && !loadFailed && done && (
              <div className="flex flex-col items-center gap-4 py-4">
                <button
                  type="button"
                  onClick={() => void handleContinue()}
                  disabled={closing}
                  className="inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-pill bg-action px-10 text-button text-white transition-colors hover:bg-brand-4 disabled:opacity-50"
                >
                  {closing ? 'Finishing…' : 'Continue'}
                </button>
                <Link
                  to="/support"
                  className="text-button-sm text-action transition-colors hover:text-brand-4"
                >
                  Or talk to a person on WhatsApp
                </Link>
              </div>
            )}

            {!loading && !loadFailed && !done && (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void send(input)
                }}
                className="relative"
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={4000}
                  placeholder="Type a reply…"
                  aria-label="Type a reply"
                  className="h-[60px] w-full rounded-pill border border-hairline bg-white pl-7 pr-16 text-copy text-ink outline-none transition-colors placeholder:text-neutral-8 focus:border-action"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || thinking}
                  aria-label="Send"
                  className="absolute right-2.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-action text-white transition-colors hover:bg-brand-4 disabled:opacity-40"
                >
                  <ArrowRight className="size-5" />
                </button>
              </form>
            )}

            <p className="mt-5 text-center text-caption text-muted">
              Reflection prompts only. Not medical advice or therapy.
            </p>
          </div>
        </div>

        <aside className="hidden w-[356px] shrink-0 lg:block">
          <h2 className="text-section text-heading">Your check-in</h2>
          {checkIn && <CheckInSummary checkIn={checkIn} circle className="mt-8" />}
          <Link
            to="/support"
            className="mt-12 flex w-full items-center gap-5 rounded-card bg-peach px-6 py-6 text-left transition-colors hover:bg-blush/70"
          >
            <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-counsellor text-white">
              <UserRound className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-button font-bold text-peach-ink">
                Talk to a school counsellor
              </span>
              <span className="mt-0.5 block text-copy text-peach-ink/80">
                Send a request to a real person who can help
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-peach-ink/70" />
          </Link>
        </aside>
      </div>

      <Flash message={flashMessage} hiding={hiding} />
    </div>
  )
}
