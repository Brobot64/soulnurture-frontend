import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { ShieldAlert, TriangleAlert, type LucideIcon } from 'lucide-react'

import { SUPPORT_EMERGENCY_NOTICE } from '#/lib/support'
import type { AiBoundary } from '#/lib/journey'

/**
 * The server already decides when a turn leaves the AI's remit — a banned-claim
 * reply replaced with scripted copy, or an acute safeguarding rule that routes
 * the turn to the school. This renders that decision, so the student is never
 * left guessing which one just happened. It claims nothing the backend did not
 * record: no diagnosis, no promised response time, no emergency dispatch.
 *
 * It is a popup, not a block in the thread: the full text interrupts once, the
 * thread keeps a one-line marker so the record survives after the student
 * closes it, and closing returns them to a chat that is still open.
 */

interface BoundaryCopy {
  Icon: LucideIcon
  heading: string
  body: string
  /** The acute lane is the peach warning; the out-of-scope lane is neutral. */
  acute: boolean
}

function boundaryCopy(boundary: AiBoundary): BoundaryCopy {
  const acute = boundary.kind === 'ACUTE_SAFEGUARD_ROUTE'
  return {
    Icon: acute ? TriangleAlert : ShieldAlert,
    heading: acute ? 'Not an emergency service' : 'Outside what the AI can help with',
    body: acute
      ? `What you shared is with your school’s support team now, so a person can follow up with you. ${SUPPORT_EMERGENCY_NOTICE}`
      : 'That answer was stopped before it reached you. Diagnosing a condition, advising on medication, writing certificates and promising how things will turn out are outside what this AI may do — they need a person with the right training.',
    acute,
  }
}

/** The thread's standing record of a turn that left the AI's remit. */
export function BoundaryNoticeMarker({
  boundary,
  onOpen,
}: {
  boundary: AiBoundary
  onOpen: () => void
}) {
  const { Icon, heading, acute } = boundaryCopy(boundary)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mt-2 flex max-w-[560px] items-center gap-2 rounded-card border px-3 py-2 text-left text-caption transition-colors ${
        acute
          ? 'border-apricot-10 bg-peach/60 text-peach-ink hover:bg-peach'
          : 'border-hairline bg-panel text-heading hover:bg-surface'
      }`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{heading}</span>
      <span className="shrink-0 underline">View</span>
    </button>
  )
}

/**
 * Shown over the chat as soon as a turn leaves the AI's remit. Dismissing it
 * (button, backdrop or Esc) only closes the popup — nothing about the
 * conversation changes, and the marker stays in the thread.
 */
export function BoundaryNoticeDialog({
  boundary,
  onClose,
}: {
  boundary: AiBoundary | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (boundary) dialog.showModal()
    else dialog.close()
  }, [boundary])

  const copy = boundaryCopy(boundary ?? { kind: 'OUT_OF_SCOPE', intentId: null })
  const { Icon } = copy

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="boundary-notice-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={`m-auto w-[min(520px,calc(100%_-_32px))] rounded-panel border p-7 text-center backdrop:bg-scrim/45 backdrop:backdrop-blur-sm ${
        copy.acute ? 'border-apricot-10 bg-peach text-peach-ink' : 'border-hairline bg-page text-body'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mx-auto grid size-16 place-items-center rounded-full ${copy.acute ? 'bg-white/70' : 'bg-panel text-action'}`}
      >
        <Icon className="size-8" />
      </span>
      <h2
        id="boundary-notice-title"
        className="mt-5 text-section text-heading"
      >
        {copy.heading}
      </h2>
      <p className="mx-auto mt-3 max-w-[420px] text-copy-sm">{copy.body}</p>
      <div className="mt-7 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-center sm:items-center">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 items-center justify-center rounded-pill bg-white/70 px-6 text-button-sm text-ink transition-colors hover:bg-white"
        >
          Back to the chat
        </button>
        <Link
          to="/support"
          onClick={onClose}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-pill bg-action px-6 text-button-sm text-white transition-colors hover:bg-brand-4"
        >
          Talk to a person
        </Link>
      </div>
    </dialog>
  )
}
