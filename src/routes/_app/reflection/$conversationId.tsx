import { useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Check, ChevronRight, Loader2, Mic, RefreshCw, Square, UserRound, X } from 'lucide-react'

import { BoundaryNotice } from '#/components/BoundaryNotice'
import { CheckInSummary } from '#/components/CheckInSummary'
import { ConsentGate, useAiConsent } from '#/components/ConsentGate'
import { Flash, useFlash } from '#/components/Flash'
import {
  PastReflectionsDrawer,
  PastReflectionsList,
} from '#/components/PastReflectionsSidebar'
import { ProgressRow } from '#/components/ProgressRow'
import { ReportResponseButton } from '#/components/ReportResponseButton'
import { Reveal } from '#/components/Reveal'
import { StatusBadge } from '#/components/StatusBadge'
import { StreamText } from '#/components/StreamText'
import { ProcessingDot } from '#/components/ProcessingDot'
import { ThinkLine } from '#/components/ThinkLine'
import { ApiError } from '#/lib/api'
import { fetchReportReceipts } from '#/lib/ai-response-reports'
import { useSession } from '#/lib/auth'
import { isConsentRequired } from '#/lib/consent'
import { onRealtimeEvent } from '#/lib/socket'
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

export const Route = createFileRoute('/_app/reflection/$conversationId')({
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

/** Poll while any assistant is PENDING_AI; terminal content always comes from the server. */
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
  /** Why this conversation ended: idle expiry gets its own copy, a close from
   * another device (or a 409 on send) stays generic. */
  const [endedByExpiry, setEndedByExpiry] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
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
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const reportScope = `${user?.id}:${conversationId}`
  const [receipts, setReceipts] = useState<{ scope: string; ids: Set<string>; failed: boolean } | null>(null)

  useEffect(() => {
    if (user?.role !== 'STUDENT' || consentState !== 'accepted') return
    let cancelled = false
    fetchReportReceipts(conversationId).then(({ items }) => {
      if (cancelled) return
      setReceipts((previous) => ({
        scope: reportScope,
        ids: new Set([...(previous?.scope === reportScope ? previous.ids : []), ...items.map((item) => item.messageId)]),
        failed: false,
      }))
    }).catch(() => {
      if (!cancelled) setReceipts((previous) => ({ scope: reportScope, ids: previous?.scope === reportScope ? previous.ids : new Set(), failed: true }))
    })
    return () => { cancelled = true }
  }, [user?.role, conversationId, reportScope, consentState, attempt])

  const scrollRef = useRef<HTMLDivElement>(null)
  // Only messages added this session stream word by word; restored ones render settled.
  const streamIds = useRef<Set<string>>(new Set())
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const confirmDialogRef = useRef<HTMLDialogElement>(null)
  // Timers and microphone permission prompts must see the latest consent state.
  const consentStateRef = useRef(consentState)
  consentStateRef.current = consentState
  const voiceTimerRef = useRef<number | null>(null)
  const currentConversationRef = useRef(conversationId)
  currentConversationRef.current = conversationId
  const syncRef = useRef<{
    conversationId: string
    isCurrent: () => boolean
    beginSend: () => boolean
    finishSend: () => void
    watchPending: (entries: Message[]) => void
  } | null>(null)
  // True while the composer holds an unsent transcript — marks the next send
  // as a voice turn for the pilot analytics.
  const voiceDraftRef = useRef(false)

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
    // Loading is also a closed gate: only confirmed consent may open the
    // stashed first message or initiate an AI turn.
    if (consentState !== 'accepted') return
    let cancelled = false
    let loaded = false
    let sending = false
    let sendRevision = 0
    let refreshing = false
    let refreshQueued = false
    let pollTimer: number | null = null
    let pollDeadline = 0
    let pendingIds = new Set<string>()
    const isCurrent = () =>
      !cancelled &&
      currentConversationRef.current === conversationId &&
      consentStateRef.current === 'accepted'
    const stopPolling = () => {
      if (pollTimer !== null) window.clearTimeout(pollTimer)
      pollTimer = null
    }

    // Coalesce pushes during reads/sends; pre-send reads cannot overwrite optimistic state.
    const refresh = async () => {
      if (!isCurrent()) return
      refreshQueued = true
      if (!loaded || sending || refreshing) return
      refreshing = true
      try {
        while (refreshQueued && isCurrent() && !sending) {
          refreshQueued = false
          const revision = sendRevision
          try {
            const conversation = await fetchConversation(conversationId)
            if (!isCurrent()) return
            if (revision !== sendRevision || sending) {
              refreshQueued = true
              continue
            }
            if (conversation) {
              setMessages(conversation.messages)
              setConversationStatus(conversation.status)
            }
          } catch {
            // Transient errors leave the bounded poll (or a later push) to retry.
          }
        }
      } finally {
        refreshing = false
      }
    }

    const poll = () => {
      pollTimer = null
      if (!isCurrent() || pendingIds.size === 0) return
      if (Date.now() >= pollDeadline) {
        flash('The AI is still thinking — its full reply will appear here shortly.')
        return
      }
      if (!sending && !refreshing) void refresh()
      pollTimer = window.setTimeout(poll, Math.min(POLL_INTERVAL_MS, pollDeadline - Date.now()))
    }
    const sync = {
      conversationId,
      isCurrent,
      beginSend: () => {
        if (!isCurrent() || !loaded || sending) return false
        sending = true
        sendRevision += 1
        if (refreshing) refreshQueued = true
        setThinking(true)
        return true
      },
      finishSend: () => {
        sending = false
        if (!isCurrent()) return
        setThinking(false)
        if (refreshQueued) void refresh()
      },
      watchPending: (entries: Message[]) => {
        if (!isCurrent() || !loaded) return
        const nextIds = entries
          .filter((entry) => entry.role === 'ASSISTANT' && entry.aiPayload?.asyncState === 'PENDING_AI')
          .map((entry) => entry.id)
        // Only newly pending IDs renew the deadline, not renders or other replies finishing.
        if (nextIds.some((id) => !pendingIds.has(id))) pollDeadline = Date.now() + POLL_MAX_MS
        pendingIds = new Set(nextIds)
        if (pendingIds.size === 0) stopPolling()
        else if (pollTimer === null && Date.now() < pollDeadline) {
          pollTimer = window.setTimeout(poll, Math.min(POLL_INTERVAL_MS, pollDeadline - Date.now()))
        }
      },
    }
    syncRef.current = sync
    // Push remains active after the polling deadline, including FAILED updates.
    const unsubscribe = onRealtimeEvent('conversation.message.updated', (push) => {
      if (push.conversationId === conversationId) void refresh()
    })
    // The server owns when a check-in ends (idle expiry, or a close on another
    // device), so the end arrives as a push: it is what takes the composer
    // away mid-session — there is no client-side turn count to do it.
    const unsubscribeClosed = onRealtimeEvent('conversation.closed', (push) => {
      if (push.conversationId !== conversationId || !isCurrent()) return
      setEndedByExpiry(push.reason === 'IDLE')
      setConversationStatus('CLOSED')
      if (push.reason === 'IDLE') {
        flash('Your reflection timed out — your words are saved. Finish with a quick mood check.')
      }
    })
    setLoadFailed(false)
    setLoading(true)
    setThinking(false)

    fetchCheckInHistory()
      .then((result) => {
        if (isCurrent()) {
          setHistory(result.items)
          setHistoryLoaded(true)
        }
      })
      .catch(() => {
        // the history sidebar is optional — the chat works without it
      })

    void (async () => {
      let conversation: ConversationDetail | null
      try {
        conversation = await fetchConversation(conversationId)
      } catch (caught) {
        if (!isCurrent()) return
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
      if (!isCurrent()) return
      if (!conversation) {
        navigate({ to: '/check-in', replace: true })
        return
      }

      loaded = true
      setCheckInId(conversation.checkInId)
      setConversationStatus(conversation.status)
      setMessages(conversation.messages)
      setLoading(false)

      if (conversation.checkInId) {
        getCheckIn(conversation.checkInId)
          .then((found) => {
            if (isCurrent()) setCheckIn(found)
          })
          .catch(() => {
            // the sidebar summary is optional — the chat works without it
          })
      }

      // The composed "why" travels as the student's first message.
      const pending =
        conversation.messages.length === 0 ? readPendingOpening(conversationId) : null
      if (!pending || openingInFlight.has(conversationId)) {
        if (refreshQueued) void refresh()
        return
      }
      if (!sync.beginSend()) return

      openingInFlight.add(conversationId)
      const tempId = newId('msg')
      setMessages([
        { id: tempId, role: 'USER', content: pending, createdAt: new Date().toISOString() },
      ])
      try {
        const result = await sendMessage(conversationId, { content: pending })
        if (!isCurrent()) return
        clearPendingOpening()
        streamIds.current.add(result.assistantMessage.id)
        setMessages((prev) => [
          ...prev.map((entry) => (entry.id === tempId ? result.userMessage : entry)),
          result.assistantMessage,
        ])
        if (result.humanCareRecommendation?.show) setRecommendation(result.humanCareRecommendation)
      } catch (caught) {
        if (!isCurrent()) return
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
        sync.finishSend()
      }
    })()

    return () => {
      cancelled = true
      stopPolling()
      unsubscribe()
      unsubscribeClosed()
      if (syncRef.current === sync) syncRef.current = null
    }
  }, [authStatus, user, conversationId, navigate, flash, attempt, consentState])

  useEffect(() => {
    const el = scrollRef.current
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  // Native <dialog>: showModal() gives the backdrop, focus trap and Esc for
  // free; the closed element stays mounted, so anything querying the page must
  // scope around it.
  useEffect(() => {
    const dialog = confirmDialogRef.current
    if (!dialog) return
    if (confirmComplete) dialog.showModal()
    else dialog.close()
  }, [confirmComplete])

  // Restored placeholders and new sends use the same state-driven polling path.
  useEffect(() => {
    const sync = syncRef.current
    if (sync?.conversationId === conversationId) sync.watchPending(messages)
  }, [messages, conversationId, consentState])

  useEffect(() => {
    setVoiceReady(isVoiceSupported())
    return () => {
      if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current)
      recorderRef.current?.cancel()
      recorderRef.current = null
    }
  }, [])

  useEffect(() => {
    if (consentState === 'accepted') return
    if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current)
    voiceTimerRef.current = null
    recorderRef.current?.cancel()
    recorderRef.current = null
    setVoiceState('idle')
    setVoiceElapsed(0)
  }, [consentState])

  // A check-in has no turn cap: it runs until the student completes it or the
  // server's idle expiry closes it. `readOnly` — the conversation's own status
  // — is therefore the only thing that can take the composer away.
  const readOnly = conversationStatus !== 'ACTIVE'
  const last = messages[messages.length - 1]

  const send = async (raw: string, quickReply?: QuickReplyValue, viaVoice = false) => {
    const content = raw.trim()
    if (!content || thinking || readOnly || consentStateRef.current !== 'accepted') return
    const sync = syncRef.current
    if (sync?.conversationId !== conversationId || !sync.beginSend()) return
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
    try {
      const result = await sendMessage(conversationId, {
        content,
        ...(quickReply ? { quickReply } : {}),
        ...(viaVoice ? { viaVoice: true } : {}),
      })
      if (!sync.isCurrent()) return
      voiceDraftRef.current = false
      streamIds.current.add(result.assistantMessage.id)
      setMessages((prev) => [
        ...prev.map((entry) => (entry.id === tempId ? result.userMessage : entry)),
        result.assistantMessage,
      ])
      if (result.humanCareRecommendation?.show) setRecommendation(result.humanCareRecommendation)
    } catch (caught) {
      if (!sync.isCurrent()) return
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
      sync.finishSend()
    }
  }

  const stopVoiceTimer = () => {
    if (voiceTimerRef.current !== null) {
      window.clearInterval(voiceTimerRef.current)
      voiceTimerRef.current = null
    }
  }

  const startRecording = async () => {
    if (voiceState !== 'idle' || thinking || readOnly || consentStateRef.current !== 'accepted') return
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
    if (consentStateRef.current !== 'accepted') {
      recorder.cancel()
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
    if (!clip || consentStateRef.current !== 'accepted') {
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
      voiceDraftRef.current = true
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
      if (isConsentRequired(caught)) {
        recheckConsent()
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
    if (closing || consentStateRef.current !== 'accepted') return
    setConfirmComplete(false)
    setClosing(true)
    try {
      await closeConversation(conversationId)
      setConversationStatus('CLOSED')
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
        setClosing(false)
        recheckConsent()
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
      <div className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col px-4 py-4 lg:max-w-[1440px] lg:px-12 lg:py-10 xl:px-[120px]">
        <ProgressRow step={2} backTo="/check-in/why" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1120px] flex-col overflow-hidden px-4 py-3 lg:max-w-[1440px] lg:px-12 lg:py-4 xl:px-[120px]">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-8">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-3 lg:gap-4">
            <div className="min-w-0 flex-1">
              <ProgressRow step={2} backTo="/check-in/why" />
            </div>
            {/* The only way to end a check-in on purpose: no cap, no wrap-up
                  turn, just this and the server's idle expiry. */}
            {!readOnly && !loading && !loadFailed && (
              <button
                type="button"
                onClick={() => setConfirmComplete(true)}
                disabled={closing}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill border border-hairline bg-white px-3.5 text-chip font-medium text-action transition-colors hover:border-action/40 hover:bg-panel disabled:opacity-50 lg:h-10 lg:px-4"
              >
                {closing ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="size-4" aria-hidden="true" />
                )}
                Complete
              </button>
            )}
          </div>
          {/* Past reflections live in the same right-side drawer the check-in
              uses — an in-page accordion pushed the chat down on phones. */}
          {historyLoaded && (
            <PastReflectionsDrawer
              activeConversationId={conversationId}
              entries={history}
            />
          )}

          <p className="mx-auto flex w-fit shrink-0 items-center gap-2 rounded-pill bg-peach px-4 py-1.5 text-caption text-peach-ink lg:mt-3 lg:gap-2.5 lg:px-5 lg:py-1.5 lg:text-chip">
            <span className="size-1.5 rounded-full bg-accent lg:size-2" aria-hidden="true" />
            AI-guided reflection · not a therapist or doctor
          </p>

          <div ref={scrollRef} role="log" className="mt-2 min-h-0 flex-1 overflow-y-auto lg:mt-3">
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
                    disabled={consentState !== 'accepted'}
                    className="mt-6 inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button text-white transition-colors hover:bg-brand-4 disabled:opacity-40"
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

              {!loading && receipts?.scope === reportScope && receipts.failed && (
                <p role="status" className="text-caption text-muted">Previously submitted reports couldn’t be checked. You can still report a reply; duplicates won’t be saved.</p>
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
                      <div className="min-w-0 flex-1">
                        {streamIds.current.has(entry.id) ? (
                          <p className="text-copy text-ink sm:text-lede">
                            <StreamText text={entry.content} />
                          </p>
                        ) : (
                          <Reveal>
                            <p className="text-copy text-ink sm:text-lede">{entry.content}</p>
                          </Reveal>
                        )}
                        {entry.aiPayload?.boundary && (
                          <BoundaryNotice boundary={entry.aiPayload.boundary} />
                        )}
                        {!loadFailed && user?.role === 'STUDENT' && consentState === 'accepted' && entry.role === 'ASSISTANT' && entry.content &&
                          entry.aiPayload?.asyncState !== 'PENDING_AI' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(entry.id) && (
                          <ReportResponseButton
                            key={`${reportScope}:${entry.id}`}
                            message={entry}
                            reported={receipts?.scope === reportScope && receipts.ids.has(entry.id)}
                            onReported={(alreadyReported) => {
                              setReceipts((previous) => ({ scope: reportScope, ids: new Set([...(previous?.scope === reportScope ? previous.ids : []), entry.id]), failed: previous?.scope === reportScope && previous.failed }))
                              flash(alreadyReported ? 'This reply was already reported. Your original report is unchanged.' : 'Report submitted for your school’s counsellors and psychologists.')
                            }}
                            onReload={() => setAttempt((current) => current + 1)}
                          />
                        )}
                      </div>
                    </div>
                  ),
                )}

              {thinking && !loading && (
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-blush lg:size-9"
                    aria-hidden="true"
                  >
                    <ProcessingDot />
                  </span>
                  <p className="min-w-0 flex-1 pt-1 text-copy sm:text-lede">
                    <ThinkLine states={THINK_STATES} />
                  </p>
                </div>
              )}

              {!loading &&
                !loadFailed &&
                !thinking &&
                !readOnly &&
                voiceState === 'idle' &&
                last?.role === 'ASSISTANT' && (
                <div className="pl-11 lg:pl-0">
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
                            disabled={consentState !== 'accepted'}
                            className="inline-flex h-[38px] items-center whitespace-nowrap rounded-pill border border-transparent bg-panel px-4 text-chip text-ink transition-colors hover:bg-blush disabled:cursor-not-allowed disabled:opacity-40 lg:h-10 lg:border-hairline lg:bg-page lg:px-4 lg:text-chip lg:hover:border-action/40 lg:hover:bg-white"
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
                            disabled={consentState !== 'accepted'}
                            className="inline-flex h-[38px] items-center whitespace-nowrap rounded-pill border-[1.5px] border-accent/40 bg-peach/50 px-4 text-chip text-peach-ink transition-colors hover:bg-peach disabled:cursor-not-allowed disabled:opacity-40 lg:h-10 lg:border-accent lg:bg-peach lg:px-4 lg:text-chip lg:hover:bg-blush/60"
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

          <div className="mt-2 shrink-0 lg:mt-3">
            {recommendation?.show && (
              <div className="mb-3 rounded-panel bg-peach px-5 py-4 lg:px-6 lg:py-4">
                <p className="text-copy text-peach-ink">
                  {recommendation.message ??
                    'It might help to talk with someone at your school.'}
                </p>
                <Link
                  to="/support"
                  className="mt-3 inline-flex text-button-sm text-action transition-colors hover:text-brand-4"
                >
                  Talk to a person
                </Link>
              </div>
            )}

            {composerError && (
              <div className="mb-4">
                <StatusBadge tone="error">{composerError}</StatusBadge>
              </div>
            )}

            {!loading && !loadFailed && readOnly && (
              <div className="flex flex-col items-center gap-2.5 py-1.5 lg:gap-3 lg:py-2">
                <p className="text-center text-copy text-muted">
                  {endedByExpiry
                    ? 'This reflection timed out after a quiet few minutes — what you wrote is saved and you can read it back any time.'
                    : 'This conversation has ended — you can read it back any time.'}
                </p>
                {checkInId ? (
                  <Link
                    to="/complete/$checkInId"
                    params={{ checkInId }}
                    className="inline-flex h-[46px] items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 lg:h-[52px] lg:px-10 lg:text-button"
                  >
                    How are you feeling now?
                  </Link>
                ) : (
                  <Link
                    to="/check-in"
                    className="inline-flex h-[46px] items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 lg:h-[52px] lg:px-10 lg:text-button"
                  >
                    Start a new check-in
                  </Link>
                )}
              </div>
            )}

            {!loading && !loadFailed && !readOnly && voiceState === 'recording' && (
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
                  disabled={consentState !== 'accepted'}
                  aria-label="Stop and transcribe"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-action text-white transition-colors hover:bg-brand-4 disabled:opacity-40 lg:size-10"
                >
                  <Square className="size-4 fill-current" />
                </button>
              </div>
            )}

            {!loading && !loadFailed && !readOnly && voiceState !== 'recording' && (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void send(input, undefined, voiceDraftRef.current)
                }}
                className="relative lg:flex lg:items-center lg:gap-2.5"
              >
                <div className="relative min-w-0 flex-1">
                  <input
                    value={input}
                    onChange={(event) => {
                      setInput(event.target.value)
                      if (!event.target.value.trim()) voiceDraftRef.current = false
                    }}
                    maxLength={4000}
                    disabled={voiceState === 'transcribing'}
                    placeholder={
                      voiceState === 'transcribing' ? 'Transcribing your voice note…' : 'Type a reply…'
                    }
                    aria-label="Type a reply"
                    className={`h-[48px] w-full rounded-pill border border-hairline bg-white pl-5 ${voiceReady ? 'pr-[94px]' : 'pr-[52px]'} text-copy text-ink outline-none transition-colors placeholder:text-neutral-8 focus:border-action disabled:opacity-60 lg:h-[56px] lg:bg-page lg:pr-16`}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || thinking || voiceState === 'transcribing' || consentState !== 'accepted'}
                    aria-label="Send"
                    className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-action text-white transition-colors hover:bg-brand-4 disabled:opacity-40 lg:size-10 lg:bg-panel lg:text-action lg:hover:bg-surface"
                  >
                    <ArrowRight className="size-4 lg:size-5" />
                  </button>
                </div>
                {voiceReady && (
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={thinking || voiceState === 'transcribing' || consentState !== 'accepted'}
                    aria-label="Record a voice note"
                    title="Record a voice note"
                    className="absolute right-[50px] top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-panel text-action transition-colors hover:bg-blush disabled:opacity-40 lg:static lg:size-12 lg:shrink-0 lg:translate-y-0 lg:bg-action lg:text-white lg:hover:bg-brand-4"
                  >
                    {voiceState === 'transcribing' ? (
                      <Loader2 className="size-4 animate-spin lg:size-5" />
                    ) : (
                      <Mic className="size-4 lg:size-5" />
                    )}
                  </button>
                )}
              </form>
            )}

            <p className="mt-1.5 text-center text-caption text-muted lg:mt-2.5">
              Reflection prompts only. Not medical advice or therapy.
            </p>
          </div>
        </div>

        <aside className="hidden w-[320px] shrink-0 flex-col lg:flex xl:w-[360px]">
          <h2 className="shrink-0 text-section text-heading">Your check-in</h2>
          {checkIn && <CheckInSummary checkIn={checkIn} circle className="mt-5 shrink-0" />}
          <Link
            to="/support"
            className="mt-6 flex w-full shrink-0 items-center gap-3.5 rounded-card border border-accent bg-peach p-4 text-left transition-colors hover:bg-blush/70"
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
          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <h3 className="shrink-0 text-section text-heading">Past reflections</h3>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
              <PastReflectionsList
                activeConversationId={conversationId}
                dense
                entries={history}
              />
            </div>
          </div>
        </aside>
      </div>

      {consentState === 'required' && (
        <ConsentGate
          onAccepted={acceptConsent}
          onDeclined={() => navigate({ to: '/welcome', replace: true })}
        />
      )}

      <dialog
        ref={confirmDialogRef}
        aria-labelledby="complete-check-in-title"
        onCancel={() => setConfirmComplete(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setConfirmComplete(false)
        }}
        className="m-auto w-[min(420px,calc(100%_-_32px))] rounded-panel border border-hairline bg-white p-6 text-body backdrop:bg-scrim/40"
      >
        <h2 id="complete-check-in-title" className="text-section text-heading">
          Complete this reflection?
        </h2>
        <p className="mt-2 text-copy-sm text-muted">
          The chat with the reflection guide ends. You can read it back any
          time, but you can't add messages to it — we'll ask how you're feeling
          now.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setConfirmComplete(false)}
            className="inline-flex h-11 items-center justify-center rounded-pill bg-surface px-6 text-button-sm text-ink transition-colors hover:bg-neutral-10"
          >
            Keep talking
          </button>
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={closing || consentState !== 'accepted'}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-pill bg-action px-6 text-button-sm text-white transition-colors hover:bg-brand-4 disabled:opacity-50"
          >
            {closing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {closing ? 'Finishing…' : 'Complete reflection'}
          </button>
        </div>
      </dialog>

      <Flash message={flashMessage} hiding={hiding} />
    </div>
  )
}
