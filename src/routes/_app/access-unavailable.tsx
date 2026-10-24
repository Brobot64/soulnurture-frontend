import { Link, createFileRoute } from '@tanstack/react-router'
import { LockKeyhole, TriangleAlert } from 'lucide-react'

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
    <div className="mx-auto flex w-full flex-1 shrink-0 flex-col items-center justify-center px-6 py-10 lg:py-16">
      <section
        aria-labelledby="access-locked-title"
        className="flex w-full max-w-[560px] flex-col items-center gap-5 rounded-panel border border-hairline bg-page px-6 py-8 text-center sm:p-10"
      >
        <span
          aria-hidden="true"
          className="grid size-16 place-items-center rounded-full bg-panel text-action"
        >
          <LockKeyhole className="size-7" />
        </span>
        <div>
          <h1 id="access-locked-title" className="text-title-sm text-heading sm:text-title">
            Access unavailable
          </h1>
          <p className="mt-4 text-copy text-body">
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
          className="inline-flex min-h-[52px] w-full items-center justify-center rounded-pill bg-action px-6 py-3 text-button-sm text-white transition-colors hover:bg-brand-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action sm:w-auto"
        >
          Back to home
        </Link>
        <p className="flex w-full items-start gap-3 rounded-card border border-blush bg-peach p-4 text-left text-copy-sm text-peach-ink">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span>
            If you or someone else is in immediate danger, contact local emergency services now.
          </span>
        </p>
      </section>
    </div>
  )
}
