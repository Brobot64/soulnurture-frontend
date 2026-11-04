import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { ShieldAlert, TriangleAlert } from 'lucide-react'

import { SUPPORT_EMERGENCY_NOTICE } from '#/lib/support'
import type { AiBoundary } from '#/lib/journey'

/**
 * The server already decides when a turn leaves the AI's remit — a banned-claim
 * reply replaced with scripted copy, or an acute safeguarding rule that routes
 * the turn to the school. This renders that decision, so the student is never
 * left guessing which one just happened. It claims nothing the backend did not
 * record: no diagnosis, no promised response time, no emergency dispatch.
 *
 * It arrives as a popup over the chat rather than a block inside the thread:
 * the student reads it, closes it and keeps talking. A boundary is a decision
 * about one turn, not an end to the conversation.
 */
export function BoundaryNotice({
  boundary,
  onDismiss,
}: {
  boundary: AiBoundary
  onDismiss: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const outOfScope = boundary.kind === 'OUT_OF_SCOPE'
  const Icon = outOfScope ? ShieldAlert : TriangleAlert

  // Mounted only while showing, so showModal() here is what gives the backdrop,
  // focus trap and Esc for free.
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="boundary-notice-title"
      onCancel={onDismiss}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
      className={`m-auto w-[min(460px,calc(100%_-_32px))] rounded-panel border p-6 backdrop:bg-scrim/40 ${
        outOfScope ? 'border-hairline bg-white' : 'border-accent bg-peach'
      }`}
    >
      <h2
        id="boundary-notice-title"
        className={`flex items-center gap-2.5 text-section ${
          outOfScope ? 'text-heading' : 'text-peach-ink'
        }`}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {outOfScope ? 'Outside what the AI can help with' : 'Not an emergency service'}
      </h2>
      <p className={`mt-2 text-copy-sm ${outOfScope ? 'text-body' : 'text-peach-ink'}`}>
        {outOfScope
          ? 'That answer was stopped before it reached you. Diagnosing a condition, advising on medication, writing certificates and promising how things will turn out are outside what this AI may do — they need a person with the right training.'
          : `What you shared is with your school’s support team now, so a person can follow up with you. ${SUPPORT_EMERGENCY_NOTICE}`}
      </p>
      <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className={`inline-flex h-11 items-center justify-center rounded-pill px-6 text-button-sm transition-colors ${
            outOfScope
              ? 'bg-surface text-ink hover:bg-neutral-10'
              : 'bg-white/70 text-peach-ink hover:bg-white'
          }`}
        >
          Keep talking
        </button>
        <Link
          to="/support"
          onClick={onDismiss}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-pill bg-action px-6 text-button-sm text-white transition-colors hover:bg-brand-4"
        >
          Talk to a person
        </Link>
      </div>
    </dialog>
  )
}
