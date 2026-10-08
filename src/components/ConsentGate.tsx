import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { StatusBadge, Spinner } from '#/components/StatusBadge'
import { ApiError } from '#/lib/api'
import {
  acknowledgeDisclosure,
  fetchDisclosure,
  fetchDisclosureStatus,
  type AiDisclosure,
} from '#/lib/consent'

export type ConsentState = 'loading' | 'accepted' | 'required'

/**
 * Reads the student's consent status for the CURRENT disclosure version.
 * Fails closed: an unreachable status endpoint is treated as "not accepted",
 * so the explanation is shown rather than silently skipped.
 */
export function useAiConsent(enabled: boolean) {
  const [state, setState] = useState<ConsentState>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
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

  const accept = useCallback(() => setState('accepted'), [])
  const recheck = useCallback(() => setAttempt((current) => current + 1), [])

  return { state, accept, recheck }
}

interface ConsentGateProps {
  /** Called after the backend has recorded the acceptance. */
  onAccepted: () => void
  /** "Not now" — returns to the dashboard and writes nothing. */
  onDeclined: () => void
}

/**
 * Hard-blocking pre-chat explanation. Opening the chat is never consent, so
 * this modal cannot be dismissed by clicking the backdrop or pressing Escape —
 * the only ways out are agreeing (recorded server-side) or declining.
 */
export function ConsentGate({ onAccepted, onDeclined }: ConsentGateProps) {
  const [disclosure, setDisclosure] = useState<AiDisclosure | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ticked, setTicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    fetchDisclosure()
      .then((view) => {
        if (cancelled) return
        setDisclosure(view)
        setTicked([])
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setLoadError(
          caught instanceof ApiError
            ? caught.message
            : 'We could not load the explanation. Check your connection and try again.',
        )
      })
    return () => {
      cancelled = true
    }
  }, [loadAttempt])

  // The page behind the modal must not scroll while the gate is open.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    panelRef.current?.focus()
  }, [disclosure])

  const allTicked =
    disclosure !== null &&
    disclosure.agreements.length > 0 &&
    disclosure.agreements.every((agreement) => ticked.includes(agreement.id))

  const toggle = (id: string) => {
    setTicked((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  // Keeps Tab inside the dialog — a hard block that leaks focus to the page
  // behind it is not a hard block for keyboard users.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const focusable = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]!
    const last = focusable[focusable.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handleAgree = async () => {
    if (busy || !disclosure || !allTicked) return
    setBusy(true)
    setSubmitError(null)
    try {
      // Sent in the backend's canonical order — the server stores its own copy
      // of the statement ids for the audit trail either way.
      await acknowledgeDisclosure(disclosure.agreements.map((agreement) => agreement.id))
      onAccepted()
    } catch (caught) {
      setBusy(false)
      setSubmitError(
        caught instanceof ApiError
          ? caught.message
          : 'Your agreement could not be saved. Please try again.',
      )
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-scrim/45 px-4 py-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-gate-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="flex max-h-full w-full max-w-[720px] flex-col overflow-hidden rounded-sheet bg-page shadow-[0_24px_60px_-20px_rgba(18,32,24,0.45)] outline-none"
      >
        <div className="shrink-0 border-b border-hairline px-6 py-6 lg:px-9 lg:py-7">
          <h2 id="consent-gate-title" className="text-title-sm text-heading lg:text-title">
            {disclosure?.title ?? 'Before you chat with Soul Nurture AI'}
          </h2>
          <p className="mt-2 text-copy text-body">
            {disclosure?.intro ?? 'Please read how Soul Nurture AI works before you start.'}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-9 lg:py-7">
          {loadError && (
            <div className="flex flex-col gap-5">
              <StatusBadge tone="error">{loadError}</StatusBadge>
              <button
                type="button"
                onClick={() => setLoadAttempt((current) => current + 1)}
                className="inline-flex h-[52px] w-fit items-center justify-center gap-2.5 rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4"
              >
                <RefreshCw className="size-5" />
                Try again
              </button>
            </div>
          )}

          {!loadError && !disclosure && (
            <p className="flex items-center gap-3 text-copy text-muted">
              <Spinner />
              Loading the explanation…
            </p>
          )}

          {disclosure && (
            <div className="flex flex-col gap-9">
              {disclosure.groups.map((group) => (
                <section key={group.id} aria-labelledby={`consent-group-${group.id}`}>
                  <h3 id={`consent-group-${group.id}`} className="text-section text-heading">
                    {group.title}
                  </h3>
                  <p className="mt-1.5 text-copy-sm text-muted">{group.summary}</p>
                  <div className="mt-5 flex flex-col gap-5">
                    {group.sections.map((section) => (
                      <div key={section.id}>
                        <h4 className="text-card text-ink">{section.heading}</h4>
                        <ul className="mt-2 flex flex-col gap-2">
                          {section.items.map((item) => (
                            <li key={item} className="flex gap-2.5 text-copy-sm text-body">
                              <span
                                aria-hidden="true"
                                className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              <fieldset className="border-t border-hairline pt-7">
                <legend className="sr-only">Statements you must agree to</legend>
                <p className="text-card text-ink">
                  Please tick every statement ({ticked.length}/{disclosure.agreements.length})
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  {disclosure.agreements.map((agreement) => (
                    <label
                      key={agreement.id}
                      className="flex cursor-pointer items-start gap-3.5 rounded-card border border-hairline bg-white px-5 py-4 transition-colors hover:border-action/40 has-[:checked]:border-action has-[:checked]:bg-brand-12"
                    >
                      <input
                        type="checkbox"
                        checked={ticked.includes(agreement.id)}
                        onChange={() => toggle(agreement.id)}
                        className="mt-0.5 size-5 shrink-0 accent-action"
                      />
                      <span className="text-copy-sm text-body">{agreement.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-hairline bg-white px-6 py-5 lg:px-9">
          {submitError && (
            <div className="mb-4">
              <StatusBadge tone="error">{submitError}</StatusBadge>
            </div>
          )}
          {!allTicked && !loadError && disclosure && (
            <p className="mb-3 text-copy-sm text-muted">
              Tick every statement above to continue. You can also come back later.
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 lg:flex-row lg:items-center lg:justify-between">
            <button
              type="button"
              onClick={onDeclined}
              disabled={busy}
              className="inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-pill border border-hairline bg-surface px-8 text-button-sm text-brand-4 transition-colors hover:bg-neutral-10 disabled:opacity-50"
            >
              {disclosure?.declineLabel ?? 'Not now'}
            </button>
            <button
              type="button"
              onClick={() => void handleAgree()}
              disabled={!allTicked || busy || loadError !== null}
              className="inline-flex h-[52px] items-center justify-center gap-2.5 whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 disabled:cursor-not-allowed disabled:opacity-40 lg:h-[56px] lg:px-12 lg:text-button"
            >
              {busy && <Spinner />}
              {busy ? 'Saving…' : (disclosure?.confirmLabel ?? 'I understand and agree')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
