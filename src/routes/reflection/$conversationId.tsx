import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, UserRound } from 'lucide-react'

import { CheckInSummary } from '#/components/CheckInSummary'
import { Flash, useFlash } from '#/components/Flash'
import { ProgressRow } from '#/components/ProgressRow'
import { Reveal } from '#/components/Reveal'
import { StreamText } from '#/components/StreamText'
import { ThinkLine } from '#/components/ThinkLine'
import {
  closeConversation,
  getCheckIn,
  getConversation,
  newId,
  openConversation,
  QUICK_REPLIES,
  sendMessage,
  type CheckIn,
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

function Reflection() {
  const { conversationId } = Route.useParams()
  const navigate = useNavigate()

  const [messages, setMessages] = useState<Message[]>([])
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null)
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [done, setDone] = useState(false)
  const [input, setInput] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  // Only messages added this session stream word by word; restored ones render settled.
  const streamIds = useRef<Set<string>>(new Set())
  const { message: flashMessage, hiding } = useFlash()

  useEffect(() => {
    let cancelled = false
    const conversation = getConversation(conversationId)
    if (!conversation) {
      navigate({ to: '/check-in', replace: true })
      return
    }
    setCheckInId(conversation.checkInId)
    setCheckIn(getCheckIn(conversation.checkInId) ?? null)
    setDone(conversation.done)
    if (conversation.messages.length > 0) {
      setMessages([...conversation.messages])
      return
    }
    setThinking(true)
    openConversation(conversationId)
      .then((opening) => {
        if (cancelled) return
        streamIds.current.add(opening.id)
        setMessages([opening])
        setThinking(false)
      })
      .catch(() => {
        if (!cancelled) setThinking(false)
      })
    return () => {
      cancelled = true
    }
  }, [conversationId, navigate])

  useEffect(() => {
    const el = scrollRef.current
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  const send = (raw: string) => {
    const content = raw.trim()
    if (!content || thinking || done) return
    setInput('')
    setMessages((prev) => [
      ...prev,
      { id: newId('msg'), role: 'USER', content, createdAt: new Date().toISOString() },
    ])
    setThinking(true)
    sendMessage(conversationId, { content, language: 'en' })
      .then(({ messages: replies, done: finished }) => {
        replies.forEach((reply) => streamIds.current.add(reply.id))
        setMessages((prev) => [...prev, ...replies])
        setThinking(false)
        setDone(finished)
      })
      .catch(() => setThinking(false))
  }

  const handleContinue = () => {
    if (!checkInId) return
    closeConversation(conversationId)
    navigate({ to: '/complete/$checkInId', params: { checkInId } })
  }

  const last = messages[messages.length - 1]

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
              {messages.map((entry) =>
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

              {thinking && (
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

              {!thinking && !done && last?.role === 'ASSISTANT' && (
                <div className="pl-11 lg:pl-12">
                  <p className="text-copy font-medium text-body">Choose a reply</p>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {QUICK_REPLIES.map((reply) => (
                      <button
                        key={reply}
                        type="button"
                        onClick={() => send(reply)}
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
            {done ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-pill bg-action px-10 text-button text-white transition-colors hover:bg-brand-4"
                >
                  Continue
                </button>
                <Link
                  to="/support"
                  className="text-button-sm text-action transition-colors hover:text-brand-4"
                >
                  Or talk to a person on WhatsApp
                </Link>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  send(input)
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
