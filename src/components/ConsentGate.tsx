import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, BookOpen, Check, ChevronRight, Database, MessageCircle, RefreshCw, ShieldCheck, Sparkles, TriangleAlert, UserRound, UsersRound, type LucideIcon } from 'lucide-react'

import { StatusBadge, Spinner } from '#/components/StatusBadge'
import { ApiError } from '#/lib/api'
import {
  acknowledgeDisclosure,
  fetchDisclosure,
  fetchDisclosureStatus,
  type AiDisclosure,
  type AiDisclosureStatus,
} from '#/lib/consent'

export type ConsentState = 'loading' | 'accepted' | 'required'

/** Checks the current server version and fails closed if status is unavailable. */
export function useAiConsent(enabled: boolean) {
  const [state, setState] = useState<ConsentState>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setState('loading')
      return
    }
    let cancelled = false
    setState('loading')
    fetchDisclosureStatus()
      .then((status) => {
        if (!cancelled) setState(status.accepted ? 'accepted' : 'required')
      })
      .catch(() => {
        if (!cancelled) setState('required')
      })
    return () => {
      cancelled = true
    }
  }, [enabled, attempt])

  // ConsentGate calls this only when the student continues from a confirmed record.
  const accept = useCallback(() => setState('accepted'), [])
  const recheck = useCallback(() => {
    setState('loading')
    setAttempt((current) => current + 1)
  }, [])

  const currentState: ConsentState = enabled ? state : 'loading'
  return { state: currentState, accept, recheck }
}

type ConsentView = 'start' | 'read' | 'record' | 'declined'

interface ConsentGateProps {
  /** Called by Continue, only after a status GET confirms acceptance. */
  onAccepted: () => void
  /** Leaves the choice screen; declining never writes to the server. */
  onDeclined: () => void
  presentation?: 'modal' | 'page'
  audience?: 'student' | 'guest' | 'reader'
}

const primaryButton = 'inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-pill bg-action px-7 py-3 text-button-sm text-white transition-colors hover:bg-brand-4 disabled:cursor-not-allowed disabled:opacity-40'
const secondaryButton = 'inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-pill border border-action/25 bg-page px-7 py-3 text-button-sm text-action transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40'
const sectionIcons: Record<string, LucideIcon> = {
  'what-it-is': MessageCircle,
  'what-it-cannot-do': TriangleAlert,
  'get-human-help': UsersRound,
  'privacy-in-short': ShieldCheck,
  'what-it-supports': MessageCircle,
  'how-it-works': Sparkles,
  'what-we-collect': Database,
  'how-we-protect': ShieldCheck,
  'when-we-escalate': TriangleAlert,
  'human-support': UsersRound,
}

/** Shared canonical disclosure reader for the pre-chat dialog and /consent. */
export function ConsentGate({
  onAccepted,
  onDeclined,
  presentation = 'modal',
  audience = 'student',
}: ConsentGateProps) {
  const isModal = presentation === 'modal'
  const canRecord = audience === 'student'
  const [view, setView] = useState<ConsentView>(isModal ? 'read' : 'start')
  const [disclosure, setDisclosure] = useState<AiDisclosure | null>(null)
  const [record, setRecord] = useState<AiDisclosureStatus | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ticked, setTicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const submitLock = useRef(false)
  const mounted = useRef(false)
  const id = useId()
  const Heading = isModal ? 'h2' : 'h1'

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    setDisclosure(null)
    setRecord(null)
    setTicked([])
    setSubmitError(null)
    setConfirming(false)
    Promise.all([fetchDisclosure(), canRecord ? fetchDisclosureStatus() : Promise.resolve(null)])
      .then(([information, status]) => {
        if (cancelled) return
        if (status && status.version !== information.consentVersion) {
          setLoadError('This information changed while it was loading. Please load the latest version.')
          return
        }
        setDisclosure(information)
        setRecord(status?.accepted ? status : null)
        // A delayed load must not take someone away from their choice to decline.
        setView((current) => current === 'declined' ? current : status?.accepted ? 'record' : current)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setLoadError(caught instanceof ApiError
          ? caught.message
          : 'We could not load the information and agreement status. Check your connection and try again.')
      })
    return () => { cancelled = true }
  }, [loadAttempt, canRecord])

  useEffect(() => {
    if (!isModal) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const keepFocusInside = (event: FocusEvent) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) {
        panelRef.current?.focus()
      }
    }
    document.addEventListener('focusin', keepFocusInside)
    panelRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('focusin', keepFocusInside)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [isModal])

  useEffect(() => {
    panelRef.current?.focus()
    contentRef.current?.scrollTo({ top: 0 })
  }, [view, disclosure, loadError])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isModal) return
    if (event.key === 'Escape') {
      // Escape and backdrop clicks never imply agreement or dismiss the gate.
      event.preventDefault()
      event.stopPropagation()
    }
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0 && !element.closest('[inert]'))
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) {
      event.preventDefault()
      panel.focus()
    } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) {
      event.preventDefault()
      first.focus()
    }
  }

  const allTicked = disclosure !== null && disclosure.agreements.length > 0 &&
    disclosure.agreements.every((agreement) => ticked.includes(agreement.id))

  const handleAgree = async () => {
    if (submitLock.current || !canRecord || !disclosure || record || !allTicked || loadError) return
    submitLock.current = true
    setBusy(true)
    setSubmitError(null)
    try {
      // Check before retrying a POST: a lost response may already have been recorded.
      let status = await fetchDisclosureStatus()
      if (!mounted.current) return
      if (status.version !== disclosure.consentVersion) {
        setLoadError('The information has changed. Load the latest version and read it before agreeing.')
        return
      }
      if (!status.accepted && !confirming) {
        const result = await acknowledgeDisclosure(disclosure.agreements.map((agreement) => agreement.id))
        if (!mounted.current) return
        if (!result.acknowledged) {
          setSubmitError('Your agreement was not recorded. Please try again when you are ready.')
          return
        }
        // From here retries only read status; they do not submit another agreement.
        setConfirming(true)
        status = await fetchDisclosureStatus()
        if (!mounted.current) return
      }
      if (status.version !== disclosure.consentVersion) {
        setLoadError('The information has changed. Load the latest version and read it before agreeing.')
      } else if (!status.accepted) {
        setSubmitError('Your agreement is not confirmed yet. Check its status again before continuing.')
      } else {
        setRecord(status)
        setConfirming(false)
        setView('record')
      }
    } catch (caught) {
      if (!mounted.current) return
      setSubmitError(caught instanceof ApiError
        ? caught.message
        : 'We could not confirm your agreement. Check your connection and try again.')
    } finally {
      submitLock.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const backToInformation = () => {
    setSubmitError(null)
    setView(record ? 'record' : isModal ? 'read' : 'start')
  }
  const title = view === 'record' ? 'Agreement recorded'
    : view === 'declined' ? 'That’s okay. You don’t have to use the AI chat.'
    : view === 'read' ? 'About this chat' : 'Read before you start'
  const acceptedDate = record?.acceptedAt ? new Date(record.acceptedAt) : null
  const acceptedTime = acceptedDate && !Number.isNaN(acceptedDate.getTime())
    ? acceptedDate.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : record?.acceptedAt ?? 'Time unavailable'

  return (
    <div className={isModal
      ? 'fixed inset-0 z-50 grid place-items-center bg-scrim/45 px-4 py-6'
      : 'mx-auto w-full max-w-[1120px] px-5 py-8 lg:px-10 lg:py-12'}>
      <div
        ref={panelRef}
        role={isModal ? 'dialog' : 'region'}
        aria-modal={isModal ? true : undefined}
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={isModal
          ? 'flex max-h-full w-full max-w-[900px] flex-col overflow-hidden rounded-sheet bg-page shadow-[0_24px_60px_-20px_rgba(18,32,24,0.45)] outline-none'
          : 'flex flex-col outline-none'}
      >
        <header className={isModal ? 'shrink-0 border-b border-hairline px-5 py-5 sm:px-8 sm:py-6' : 'pb-7 lg:pb-9'}>
          <p className="mb-3 inline-flex items-center gap-2 rounded-pill bg-panel px-3 py-1.5 text-caption font-medium text-action">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-6" />
            {view === 'record' ? 'Your agreement record' : view === 'declined' ? 'You are always in control' : 'Read before you start'}
          </p>
          <Heading id={`${id}-title`} className="max-w-[760px] text-title-sm text-heading lg:text-title">{title}</Heading>
          {(view === 'read' || view === 'start') && (
            <p className="mt-3 text-copy-sm text-body">
              {record ? 'You can read this again without recording another agreement.' : 'Opening this page does not count as agreeing. You choose whether to continue.'}
            </p>
          )}
        </header>

        <div ref={contentRef} className={isModal ? 'min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8' : ''}>
          {view === 'declined' ? (
            <div className="max-w-[760px]">
              <p className="text-copy text-body">You can come back whenever you’re ready. You can also explore other ways to get support.</p>
              <h3 className="mt-7 text-section text-heading">Other ways to get support</h3>
              <div className="mt-4 divide-y divide-hairline rounded-panel border border-hairline bg-white px-5 sm:px-6">
                <Link to="/support" className="flex items-center gap-4 py-5 text-action">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-peach text-peach-ink"><UserRound aria-hidden="true" className="size-5" /></span>
                  <span className="flex-1"><span className="block text-card text-heading">Talk to a person</span><span className="mt-1 block text-copy-sm text-body">Explore human support options.</span></span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
                </Link>
                <Link to="/resources" className="flex items-center gap-4 py-5 text-action">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-panel"><BookOpen aria-hidden="true" className="size-5" /></span>
                  <span className="flex-1"><span className="block text-card text-heading">Wellbeing resources</span><span className="mt-1 block text-copy-sm text-body">Read and explore at your own pace.</span></span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
                </Link>
                <p className="py-5 text-copy-sm text-peach-ink">Soul Nurture AI is not an emergency service. If you are in danger, tell a trusted adult right away.</p>
              </div>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-start gap-5">
              <StatusBadge tone="error">{loadError}</StatusBadge>
              <button type="button" disabled={busy} onClick={() => setLoadAttempt((current) => current + 1)} className={primaryButton}>
                <RefreshCw aria-hidden="true" className="size-5" /> Load again
              </button>
            </div>
          ) : !disclosure ? (
            <p role="status" className="flex items-center gap-3 py-8 text-copy text-muted"><Spinner /> Loading the information…</p>
          ) : view === 'record' && record?.accepted ? (
            <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
              <div>
                <p className="rounded-card bg-panel px-5 py-4 text-copy-sm text-action">Your agreement to the current information has been confirmed.</p>
                <dl className="mt-5 divide-y divide-hairline rounded-card border border-hairline bg-white px-5">
                  <div className="flex items-center justify-between gap-4 py-5"><dt className="text-copy-sm text-muted">Status</dt><dd className="inline-flex items-center gap-1.5 rounded-pill bg-panel px-3 py-1 text-chip text-action"><Check aria-hidden="true" className="size-4" /> Agreed</dd></div>
                  <div className="flex flex-wrap items-center justify-between gap-3 py-5"><dt className="text-copy-sm text-muted">Date and time</dt><dd className="text-right text-copy-sm text-ink">{record.acceptedAt && acceptedDate && !Number.isNaN(acceptedDate.getTime()) ? <time dateTime={record.acceptedAt}>{acceptedTime}</time> : acceptedTime}</dd></div>
                  <div className="flex flex-wrap items-center justify-between gap-3 py-5"><dt className="text-copy-sm text-muted">Agreement version</dt><dd className="break-all text-copy-sm text-ink">{record.version}</dd></div>
                </dl>
                <button type="button" onClick={() => setView('read')} className="mt-5 flex w-full items-center gap-3 rounded-card border border-hairline px-5 py-4 text-left text-action transition-colors hover:bg-panel">
                  <BookOpen aria-hidden="true" className="size-5 shrink-0" />
                  <span className="flex-1 text-button-sm">Read about this chat again</span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
                </button>
              </div>
              <div className="flex flex-col items-center justify-center rounded-panel bg-panel px-7 py-9 text-center">
                <div aria-hidden="true" className="relative mb-7 grid size-40 place-items-center rounded-full bg-surface lg:size-60">
                  <div className="grid size-28 place-items-center rounded-full bg-brand-9/50 lg:size-44"><span className="grid size-20 place-items-center rounded-full bg-action text-white lg:size-32"><Check className="size-10 lg:size-16" strokeWidth={1.5} /></span></div>
                  <span className="absolute right-1 top-5 size-5 rounded-full bg-accent" />
                  <span className="absolute bottom-4 left-3 size-3 rounded-full bg-mint" />
                </div>
                <h3 className="text-section text-heading">You’re all set</h3>
                <p className="mt-3 max-w-[300px] text-copy-sm text-body">Thank you for reading. Continue whenever you’re ready. This information is here to read again.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-7">
              <div>
                <h3 className="text-section text-heading">{disclosure.title}</h3>
                <p className="mt-3 whitespace-pre-line text-copy text-body">{disclosure.intro}</p>
                <p className="mt-3 text-caption text-muted">Version {disclosure.version}</p>
              </div>
              {view === 'start' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {disclosure.groups.map((group) => (
                    <div key={group.id} className="rounded-card border border-hairline bg-white p-5 sm:p-6">
                      <h3 className="text-card text-heading">{group.title}</h3>
                      <p className="mt-3 whitespace-pre-line text-copy-sm text-body">{group.summary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {disclosure.groups.map((group) => (
                    <section key={group.id} aria-labelledby={`${id}-${group.id}`}>
                      <h3 id={`${id}-${group.id}`} className="text-section text-heading">{group.title}</h3>
                      <p className="mt-2 whitespace-pre-line text-copy-sm text-body">{group.summary}</p>
                      <div className={`mt-4 grid gap-4 sm:grid-cols-2 ${isModal ? '' : 'lg:grid-cols-3'}`}>
                        {group.sections.map((section) => {
                          const Icon = sectionIcons[section.id] ?? BookOpen
                          const warning = section.id === 'what-it-cannot-do' || section.id === 'get-human-help'
                          return (
                            <div key={section.id} className={`rounded-card border p-5 sm:p-6 ${warning ? 'border-accent bg-peach' : 'border-hairline bg-white'}`}>
                              <span aria-hidden="true" className={`mb-4 grid size-11 place-items-center rounded-full ${warning ? 'bg-white/70 text-peach-ink' : 'bg-panel text-action'}`}><Icon className="size-5" /></span>
                              <h4 className="text-card text-heading">{section.heading}</h4>
                              <ul className="mt-3 flex flex-col gap-3">
                                {section.items.map((item, index) => (
                                  <li key={index} className="flex gap-3 text-copy-sm text-body"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-6" /><span className="whitespace-pre-line">{item}</span></li>
                                ))}
                              </ul>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                  {canRecord && !record ? (
                    <fieldset disabled={busy || confirming} className="rounded-panel border border-hairline bg-panel p-5 sm:p-6">
                      <legend className="px-2 text-card text-heading">Your agreement</legend>
                      <p className="text-copy-sm text-body">Please tick every statement ({ticked.length}/{disclosure.agreements.length}).</p>
                      <div className="mt-4 flex flex-col gap-3">
                        {disclosure.agreements.map((agreement) => (
                          <label key={agreement.id} className="flex cursor-pointer items-start gap-3.5 rounded-card border border-hairline bg-white px-4 py-4 has-[:checked]:border-action has-[:checked]:bg-page">
                            <input type="checkbox" checked={ticked.includes(agreement.id)} onChange={() => setTicked((previous) => previous.includes(agreement.id) ? previous.filter((item) => item !== agreement.id) : [...previous, agreement.id])} className="mt-0.5 size-5 shrink-0 accent-action" />
                            <span className="whitespace-pre-line text-copy-sm text-body">{agreement.label}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : (
                    <section className="rounded-panel border border-hairline bg-panel p-5 sm:p-6">
                      <h3 className="text-card text-heading">Agreement statements</h3>
                      <ul className="mt-3 list-disc space-y-3 pl-5 text-copy-sm text-body">{disclosure.agreements.map((agreement) => <li key={agreement.id} className="whitespace-pre-line">{agreement.label}</li>)}</ul>
                      {!record && <p className="mt-5 text-copy-sm text-action">{audience === 'guest' ? 'You can read without signing in. Sign in with your student account to record your agreement.' : 'Agreement recording is available to student accounts. You can read the information here.'}</p>}
                    </section>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <footer className={isModal ? 'shrink-0 border-t border-hairline bg-page px-5 py-5 sm:px-8' : 'mt-8 border-t border-hairline pt-6'}>
          {submitError && view === 'read' && !loadError && <div className="mb-4"><StatusBadge tone="error">{submitError}</StatusBadge></div>}
          <div className={`flex flex-col-reverse gap-3 sm:flex-row sm:items-center ${view === 'record' ? 'sm:justify-center' : 'sm:justify-between'}`}>
            {view === 'declined' ? (
              <>
                <button type="button" onClick={backToInformation} className={secondaryButton}>Read before you start again</button>
                <button type="button" onClick={onDeclined} className={primaryButton}>Back to dashboard</button>
              </>
            ) : view === 'record' && record?.accepted && !loadError ? (
              <>
                <button type="button" onClick={onDeclined} className={secondaryButton}>Back to dashboard</button>
                <button type="button" onClick={onAccepted} className={primaryButton}>Continue <ArrowRight aria-hidden="true" className="size-4" /></button>
              </>
            ) : (
              <>
                <button type="button" disabled={busy} onClick={() => record ? setView('record') : setView('declined')} className={secondaryButton}>
                  {record ? 'Back to agreement record' : disclosure?.declineLabel ?? 'Not now'}
                </button>
                {disclosure && !loadError && (view === 'start' ? (
                  <button type="button" onClick={() => setView('read')} className={primaryButton}>Read about this chat <ArrowRight aria-hidden="true" className="size-4" /></button>
                ) : !record && canRecord ? (
                  <button type="button" onClick={() => void handleAgree()} disabled={!allTicked || busy} className={primaryButton}>
                    {busy && <Spinner />}{busy ? 'Checking agreement…' : confirming ? 'Check agreement status' : submitError ? 'Try again' : disclosure.confirmLabel}
                  </button>
                ) : audience === 'guest' ? (
                  <Link to="/signin" search={{ redirect: '/consent' }} className={primaryButton}>Sign in to record agreement</Link>
                ) : !record ? (
                  <button type="button" onClick={onDeclined} className={primaryButton}>Back to dashboard</button>
                ) : null)}
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
