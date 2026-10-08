import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronDown, ChevronRight, Loader2, Mic, RefreshCw, Square, UserRound, X } from 'lucide-react'

import { CheckInSummary } from '#/components/CheckInSummary'
import { ConsentGate, useAiConsent } from '#/components/ConsentGate'
import { Flash, useFlash } from '#/components/Flash'
import { ProgressRow } from '#/components/ProgressRow'
import { Reveal } from '#/components/Reveal'
import { StatusBadge } from '#/components/StatusBadge'
import { StreamText } from '#/components/StreamText'
import { ThinkLine } from '#/components/ThinkLine'
import { ApiError } from '#/lib/api'
import { useSession } from '#/lib/auth'
import { isConsentRequired } from '#/lib/consent'
import {
  QUICK_REPLIES,
  clearPendingOpening,
  closeConversation,
  fetchCheckInHistory,
  fetchConversation,
  getCheckIn,
  newId,
  readPendingOpening,
  sendMessage,
  type CheckIn,
  type CheckInHistoryEntry,
  type ConversationDetail,
  type ConversationStatus,
  type HumanCareRecommendation,
  type Message,
  type QuickReplyValue,
} from '#/lib/journey'
import { VoiceRecorder, isVoiceSupported, transcribeVoice } from '#/lib/voice'

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

/** Voice notes stop automatically at this length. */
const VOICE_MAX_SECONDS = 120

/** Mirrors the backend guided budget: 3 free-text turns (5 once "Tell you more" was used), hard-capped at 5 total turns — quick-reply taps count toward the cap. */
const BASE_TURN_BUDGET = 3
const EXTENDED_TURN_BUDGET = 5

/** aiPending polling: refetch the conversation on this interval until the assistant reply is COMPLETE. */
const POLL_INTERVAL_MS = 4000
const POLL_MAX_MS = 90_000

// Guards against a double mount re-sending the stashed opening message.
const openingInFlight = new Set<string>()

function Reflection() {
  const { conversationId } = Route.useParams()
  const navigate = useNavigate()
  const { flash, message: flashMessage, hiding } = useFlash()
  const { user, status: authStatus } = useSession()
  // Backstop for the check-in gate: the backend refuses AI turns without an
  // accepted disclosure, so this route re-checks and re-opens the modal.
  const {
    state: consentState,
    accept: acceptConsent,
    recheck: recheckConsent,
  } = useAiConsent(authStatus === 'ready' && !!user)

  const [messages, setMessages] = useState<Message[]>([])
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null)
  const [checkInId, setCheckInId] = useState<string | null>(null)
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('ACTIVE')
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [thinking, setThinking] = useState(false)
  const [input, setInput] = useState('')
  const [composerError, setComposerError] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<HumanCareRecommendation | null>(null)
  const [closing, setClosing] = useState(false)
  const [voiceState, setVoiceState] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [voiceElapsed, setVoiceElapsed] = useState(0)
  const [voiceReady, setVoiceReady] = useState(false)
  const [history, setHistory] = useState<CheckInHistoryEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  // Only messages added this session stream word by word; restored ones render settled.
  const streamIds = useRef<Set<string>>(new Set())
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const voiceTimerRef = useRef<number | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const pollDeadlineRef = useRef(0)
  // True while a send is in flight — the completion poll must not clobber it.
  const sendingRef = useRef(false)

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
    // While the explanation is outstanding the chat stays sealed. Accepting
    // flips consentState and re-runs this effect, which then opens the
    // stashed first message as normal.
    if (consentState === 'required') return
    let cancelled = false
    setLoadFailed(false)
    setLoading(true)

    fetchCheckInHistory()
      .then((result) => {
        if (!cancelled) setHistory(result.items)
      })
      .catch(() => {
        // the history sidebar is optional — the chat works without it
      })

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
        if (result.aiPending) startCompletionPoll()
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
        if (isConsentRequired(caught)) {
          // The gate re-opens; the stashed opening survives for the retry once
          // the student agrees, so nothing is lost and no raw 403 is shown.
          recheckConsent()
          return
        }
        setComposerError(
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
      if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current)
    }
  }, [authStatus, user, conversationId, navigate, flash, attempt, consentState])

  useEffect(() => {
    const el = scrollRef.current
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  useEffect(() => {
    setVoiceReady(isVoiceSupported())
    return () => {
      if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current)
      recorderRef.current?.cancel()
      recorderRef.current = null
    }
  }, [])

  const freeTextTurns = messages.filter(
    (entry) => entry.role === 'USER' && !entry.quickReply,
  ).length
  const totalTurns = messages.filter((entry) => entry.role === 'USER').length
  const hadTellMore = messages.some((entry) => entry.quickReply === 'TELL_MORE')
  const turnBudget = hadTellMore ? EXTENDED_TURN_BUDGET : BASE_TURN_BUDGET
  const readOnly = conversationStatus !== 'ACTIVE'
  const done =
    readOnly ||
    (!thinking &&
      (totalTurns >= EXTENDED_TURN_BUDGET || freeTextTurns >= turnBudget))
  const last = messages[messages.length - 1]

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  // A failed AI generation returns a holding reply with aiPending — the worker
  // regenerates later, so poll until the assistant payload turns COMPLETE.
  const startCompletionPoll = () => {
    stopPolling()
    pollDeadlineRef.current = Date.now() + POLL_MAX_MS
    pollTimerRef.current = window.setInterval(() => {
      if (sendingRef.current) return
      if (Date.now() > pollDeadlineRef.current) {
        stopPolling()
        flash('The AI is still thinking — its full reply will appear here shortly.')
        return
      }
      void (async () => {
        try {
          const conversation = await fetchConversation(conversationId)
          if (!conversation || pollTimerRef.current === null) return
          const latestAssistant = [...conversation.messages]
            .reverse()
            .find((entry) => entry.role === 'ASSISTANT')
          if (latestAssistant?.aiPayload?.asyncState === 'COMPLETE') {
            stopPolling()
            setMessages(conversation.messages)
            setConversationStatus(conversation.status)
          }
        } catch {
          // transient network error — the next tick retries until the deadline
        }
      })()
    }, POLL_INTERVAL_MS)
  }

  const send = async (raw: string, quickReply?: QuickReplyValue) => {
    const content = raw.trim()
    if (!content || thinking || done) return
    stopPolling()
    sendingRef.current = true
    setInput('')
    setComposerError(null)
    const tempId = newId('msg')
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: 'USER',
        content,
        quickReply: quickReply ?? null,
        createdAt: new Date().toISOString(),
      },
    ])
    setThinking(true)
    try {
      const result = await sendMessage(conversationId, {
        content,
        language: 'en',
        ...(quickReply ? { quickReply } : {}),
      })
      streamIds.current.add(result.assistantMessage.id)
      setMessages((prev) => [
        ...prev.map((entry) => (entry.id === tempId ? result.userMessage : entry)),
        result.assistantMessage,
      ])
      if (result.humanCareRecommendation?.show) setRecommendation(result.humanCareRecommendation)
      if (result.aiPending) startCompletionPoll()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        navigate({
          to: '/signin',
          search: { redirect: `/reflection/${conversationId}` },
          replace: true,
        })
        return
      }
      if (isConsentRequired(caught)) {
        // A bumped disclosure version invalidates the earlier acceptance —
        // re-open the gate and hand the half-typed turn back to the student.
        setMessages((prev) => prev.filter((entry) => entry.id !== tempId))
        setInput(content)
        recheckConsent()
        return
      }
      if (caught instanceof ApiError && caught.status === 409) {
        // the conversation was closed elsewhere — flip the screen to read-only
        setConversationStatus('CLOSED')
      }
      setMessages((prev) => prev.filter((entry) => entry.id !== tempId))
      setInput(content)
      setComposerError(
        caught instanceof ApiError
          ? caught.message
          : 'Your message could not be sent. Please try again.',
      )
    } finally {
      sendingRef.current = false
      setThinking(false)
    }
  }

  const stopVoiceTimer = () => {
    if (voiceTimerRef.current !== null) {
      window.clearInterval(voiceTimerRef.current)
      voiceTimerRef.current = null
    }
  }

  const startRecording = async () => {
    if (voiceState !== 'idle' || thinking || done) return
    setComposerError(null)
    let recorder: VoiceRecorder
    try {
      recorder = await VoiceRecorder.start()
    } catch {
      setComposerError(
        'Microphone access was blocked. Allow it in your browser settings, or type your reply instead.',
      )
      return
    }
    recorderRef.current = recorder
    setVoiceElapsed(0)
    setVoiceState('recording')
    voiceTimerRef.current = window.setInterval(() => {
      const active = recorderRef.current
      if (!active) return
      const seconds = active.elapsedSeconds()
      setVoiceElapsed(seconds)
      if (seconds >= VOICE_MAX_SECONDS) void finishRecording()
    }, 250)
  }

  const finishRecording = async () => {
    const recorder = recorderRef.current
    if (!recorder) return
    stopVoiceTimer()
    recorderRef.current = null
    setVoiceState('transcribing')
    const clip = await recorder.stop()
    if (!clip) {
      setVoiceState('idle')
      return
    }
    try {
      const result = await transcribeVoice(clip)
      setVoiceState('idle')
      const text = result.text.trim()
      if (!text) {
        setComposerError(
          "We couldn't make out any speech in that recording — try again or type your reply.",
        )
        return
      }
      // The transcript lands in the composer for review — the student decides to send it.
      setInput((current) => (current ? `${current.trimEnd()} ${text}` : text))
    } catch (caught) {
      setVoiceState('idle')
      if (caught instanceof ApiError && caught.status === 401) {
        navigate({
          to: '/signin',
          search: { redirect: `/reflection/${conversationId}` },
          replace: true,
        })
        return
      }
      setComposerError(
        caught instanceof ApiError
          ? caught.message
          : 'That voice note could not be transcribed. Try again, or type your reply.',
      )
    }
  }

  const cancelRecording = () => {
    stopVoiceTimer()
    const recorder = recorderRef.current
    recorderRef.current = null
    recorder?.cancel()
    setVoiceElapsed(0)
    setVoiceState('idle')
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

  // Shared by the mobile accordion and the desktop sidebar — closed
  // conversations only, each opening read-only in the chat.
  const historyList = (
    <div className="flex flex-col gap-2.5">
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
        const targetId = entry.conversationId
        return targetId ? (
          <button
            key={entry.checkInId}
            type="button"
            onClick={() =>
              navigate({
                to: '/reflection/$conversationId',
                params: { conversationId: targetId },
              })
            }
            className="rounded-2xl border border-hairline bg-white px-3.5 py-2.5 text-left transition-colors hover:border-action/40 lg:px-4 lg:py-3"
          >
            {body}
          </button>
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
  )

  if (authStatus !== 'ready' || !user) {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col px-4 py-4 lg:px-10 lg:py-8">
        <ProgressRow step={2} backTo="/check-in/why" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col px-4 py-4 lg:px-10 lg:py-8">
      <ProgressRow step={2} backTo="/check-in/why" />

      <div className="mt-3 flex min-h-0 flex-1 flex-col lg:mt-8 lg:flex-row lg:gap-12">
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Mobile past-reflections accordion — desktop renders the sidebar in the aside. */}
          <div className="mb-2.5 shrink-0 lg:hidden">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              className="inline-flex h-[40px] w-full items-center justify-between rounded-pill border border-hairline bg-white px-4 text-chip text-ink transition-colors hover:border-action/40"
            >
              Past reflections
              <ChevronDown
                className={`size-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {historyOpen && (
              <div className="mt-2 max-h-[240px] overflow-y-auto rounded-panel border border-hairline bg-white p-2.5">
                {historyList}
              </div>
            )}
          </div>

          <p className="mx-auto flex w-fit items-center gap-2 rounded-pill bg-peach px-4 py-1.5 text-caption text-peach-ink lg:gap-2.5 lg:px-5 lg:py-2 lg:text-chip">
            <span className="size-1.5 rounded-full bg-accent lg:size-2" aria-hidden="true" />
            AI-guided reflection · not a therapist or doctor
          </p>

          <div ref={scrollRef} role="log" className="mt-3 min-h-0 flex-1 overflow-y-auto lg:mt-6">
            <div className="flex flex-col gap-5 pb-4 lg:gap-7">
              {loading && (
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-blush lg:size-9"
                    aria-hidden="true"
                  >
                    <span className="size-2.5 rounded-full bg-accent" />
                  </span>
                  <p className="min-w-0 flex-1 pt-1 text-copy sm:text-lede">
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

              {!loading && !loadFailed && !thinking && !composerError && messages.length === 0 && (
                <p className="mx-auto mt-10 max-w-[440px] text-center text-copy">
                  You're in a private reflection. When you're ready, say whatever is on your mind —
                  there's no right way to start.
                </p>
              )}

              {!loading &&
                messages.map((entry) =>
                  entry.role === 'USER' ? (
                    <Reveal key={entry.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-[16px] bg-action px-4 py-2.5 text-copy text-white sm:text-lede lg:rounded-[20px] lg:px-5 lg:py-3.5">
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
                  <p className="min-w-0 flex-1 pt-1 text-copy sm:text-lede">
                    <ThinkLine states={THINK_STATES} />
                  </p>
                </div>
              )}

              {!loading &&
                !loadFailed &&
                !thinking &&
                !done &&
                voiceState === 'idle' &&
                last?.role === 'ASSISTANT' && (
                <div className="pl-11 lg:pl-12">
                  <p className="text-chip font-medium text-muted lg:text-copy lg:text-ink">
                    Choose a reply
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 lg:mt-3 lg:gap-2.5">
                    {/* Mobile: the two reflection prompts sit side by side as quiet tinted
                        chips and the human-help action drops to its own row. At lg the
                        wrappers dissolve so all three share one row exactly as before. */}
                    <div className="flex flex-wrap gap-2 lg:contents">
                      {QUICK_REPLIES.filter((reply) => reply.value !== 'TALK_TO_SOMEONE').map(
                        (reply) => (
                          <button
                            key={reply.value}
                            type="button"
                            onClick={() => void send(reply.label, reply.value)}
                            className="inline-flex h-[38px] items-center whitespace-nowrap rounded-pill border border-transparent bg-panel px-4 text-chip text-ink transition-colors hover:bg-blush lg:h-[46px] lg:border-hairline lg:bg-white lg:px-6 lg:text-button-sm lg:hover:border-action/40 lg:hover:bg-white"
                          >
                            {reply.label}
                          </button>
                        ),
                      )}
                    </div>
                    <div className="w-full lg:contents">
                      {QUICK_REPLIES.filter((reply) => reply.value === 'TALK_TO_SOMEONE').map(
                        (reply) => (
                          <button
                            key={reply.value}
                            type="button"
                            onClick={() => void send(reply.label, reply.value)}
                            className="inline-flex h-[38px] items-center whitespace-nowrap rounded-pill border-[1.5px] border-accent/40 bg-peach/50 px-4 text-chip text-peach-ink transition-colors hover:bg-peach lg:h-[46px] lg:border-accent lg:bg-white lg:px-6 lg:text-button-sm lg:hover:bg-peach/50"
                          >
                            {reply.label}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 shrink-0 lg:mt-4">
            {recommendation?.show && (
              <div className="mb-4 rounded-panel bg-peach px-5 py-4 lg:px-6 lg:py-5">
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

            {composerError && (
              <div className="mb-4">
                <StatusBadge tone="error">{composerError}</StatusBadge>
              </div>
            )}

            {!loading && !loadFailed && done && !readOnly && (
              <div className="flex flex-col items-center gap-3 py-3 lg:gap-4 lg:py-4">
                <button
                  type="button"
                  onClick={() => void handleContinue()}
                  disabled={closing}
                  className="inline-flex h-[46px] items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 disabled:opacity-50 lg:h-[52px] lg:px-10 lg:text-button"
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

            {!loading && !loadFailed && readOnly && (
              <div className="flex flex-col items-center gap-3 py-3 lg:gap-4 lg:py-4">
                <p className="text-center text-copy text-muted">
                  This conversation has ended — you can read it back any time.
                </p>
                <Link
                  to="/check-in"
                  className="inline-flex h-[46px] items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 lg:h-[52px] lg:px-10 lg:text-button"
                >
                  Start a new check-in
                </Link>
              </div>
            )}

            {!loading && !loadFailed && !done && voiceState === 'recording' && (
              <div className="flex h-[48px] items-center gap-3 rounded-pill border-[1.5px] border-accent bg-white pl-5 pr-2 lg:h-[60px] lg:pl-7 lg:pr-2.5">
                <span className="relative grid size-3 shrink-0 place-items-center" aria-hidden="true">
                  <span className="absolute size-3 animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative size-3 rounded-full bg-accent" />
                </span>
                <span className="tabular-nums text-copy font-medium text-ink">
                  {Math.floor(voiceElapsed / 60)}:{String(Math.floor(voiceElapsed % 60)).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1 truncate text-copy-sm text-muted">
                  Recording your voice note…
                </span>
                <button
                  type="button"
                  onClick={cancelRecording}
                  aria-label="Cancel recording"
                  className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-panel hover:text-ink lg:size-10"
                >
                  <X className="size-4 lg:size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => void finishRecording()}
                  aria-label="Stop and transcribe"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-action text-white transition-colors hover:bg-brand-4 lg:size-10"
                >
                  <Square className="size-4 fill-current" />
                </button>
              </div>
            )}

            {!loading && !loadFailed && !done && voiceState !== 'recording' && (
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
                  disabled={voiceState === 'transcribing'}
                  placeholder={
                    voiceState === 'transcribing' ? 'Transcribing your voice note…' : 'Type a reply…'
                  }
                  aria-label="Type a reply"
                  className={`h-[48px] w-full rounded-pill border border-hairline bg-white pl-5 ${
                    voiceReady ? 'pr-[94px]' : 'pr-[52px]'
                  } text-copy text-ink outline-none transition-colors placeholder:text-neutral-8 focus:border-action disabled:opacity-60 lg:h-[60px] lg:pl-7 ${
                    voiceReady ? 'lg:pr-28' : 'lg:pr-16'
                  }`}
                />
                {voiceReady && (
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={thinking || voiceState === 'transcribing'}
                    aria-label="Record a voice note"
                    title="Record a voice note"
                    className="absolute right-[50px] top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-panel text-action transition-colors hover:bg-blush disabled:opacity-40 lg:right-[60px] lg:size-10"
                  >
                    {voiceState === 'transcribing' ? (
                      <Loader2 className="size-4 animate-spin lg:size-5" />
                    ) : (
                      <Mic className="size-4 lg:size-5" />
                    )}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!input.trim() || thinking || voiceState === 'transcribing'}
                  aria-label="Send"
                  className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-action text-white transition-colors hover:bg-brand-4 disabled:opacity-40 lg:right-2.5 lg:size-10"
                >
                  <ArrowRight className="size-4 lg:size-5" />
                </button>
              </form>
            )}

            <p className="mt-2 text-center text-caption text-muted lg:mt-5">
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
          <div className="mt-10">
            <h3 className="text-section text-heading">Past reflections</h3>
            <div className="mt-4 max-h-[340px] overflow-y-auto pr-1">{historyList}</div>
          </div>
        </aside>
      </div>

      {consentState === 'required' && (
        <ConsentGate
          onAccepted={acceptConsent}
          onDeclined={() => navigate({ to: '/welcome', replace: true })}
        />
      )}

      <Flash message={flashMessage} hiding={hiding} />
    </div>
  )
}
