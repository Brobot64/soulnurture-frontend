import { Link, createFileRoute } from '@tanstack/react-router'
import { LockKeyhole } from 'lucide-react'

import { AuthShell } from '#/components/AuthShell'

export const Route = createFileRoute('/_app/access-unavailable')({
  head: () => ({
    meta: [
      { title: 'Access unavailable · Soul Nurture AI' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: AccessUnavailable,
})

function AccessUnavailable() {
  return (
    <AuthShell
      title="Access unavailable"
      subtitle="You can’t sign in right now. Your school administrator can help with the next step."
    >
      <section
        aria-labelledby="access-locked-title"
        className="flex flex-col items-center gap-5 rounded-panel border border-hairline bg-white px-6 py-8 text-center"
      >
        <span
          aria-hidden="true"
          className="grid size-20 place-items-center rounded-full bg-panel text-action"
        >
          <LockKeyhole className="size-9" />
        </span>
        <div>
          <h2 id="access-locked-title" className="text-section text-heading">
            Contact your school
          </h2>
          <p className="mt-3 text-copy text-body">
            Access may be paused for your school or account. Contact your school office or
            administrator to find out what to do next.
          </p>
        </div>
        <p className="text-copy text-body">
          If you need someone to talk to, reach out to a trusted adult or your school counsellor
          in person.
        </p>
        <Link
          to="/"
          search={{}}
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-pill bg-action px-6 py-3 text-button text-white transition-colors hover:bg-brand-4 lg:min-h-[56px]"
        >
          Back to home
        </Link>
      </section>
      <p className="mt-5 text-copy text-body">
        If you or someone else is in immediate danger, contact local emergency services now.
      </p>
    </AuthShell>
  )
}
