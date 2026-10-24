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
 */
export function BoundaryNotice({ boundary }: { boundary: AiBoundary }) {
  const outOfScope = boundary.kind === 'OUT_OF_SCOPE'
  const Icon = outOfScope ? ShieldAlert : TriangleAlert

  return (
    <aside
      role="note"
      className={`mt-3 max-w-[560px] rounded-card border p-4 lg:p-5 ${
        outOfScope ? 'border-hairline bg-panel' : 'border-apricot-10 bg-peach'
      }`}
    >
      <p
        className={`flex items-center gap-2.5 text-button-sm ${
          outOfScope ? 'text-heading' : 'text-peach-ink'
        }`}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {outOfScope ? 'Outside what the AI can help with' : 'Not an emergency service'}
      </p>
      <p
        className={`mt-2 text-copy-sm ${outOfScope ? 'text-body' : 'text-peach-ink'}`}
      >
        {outOfScope
          ? 'That answer was stopped before it reached you. Diagnosing a condition, advising on medication, writing certificates and promising how things will turn out are outside what this AI may do — they need a person with the right training.'
          : `What you shared is with your school’s support team now, so a person can follow up with you. ${SUPPORT_EMERGENCY_NOTICE}`}
      </p>
      <Link
        to="/support"
        className={`mt-3 inline-flex min-h-11 items-center text-button-sm transition-colors ${
          outOfScope ? 'text-action hover:text-brand-4' : 'text-action hover:text-peach-ink'
        }`}
      >
        Talk to a person
      </Link>
    </aside>
  )
}
