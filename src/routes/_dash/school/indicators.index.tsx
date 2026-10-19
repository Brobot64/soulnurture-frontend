import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { homeForRole, useSession } from '#/lib/auth'

export const Route = createFileRoute('/_dash/school/indicators/')({
  head: () => ({ meta: [{ title: 'Support indicators · Soul Nurture AI' }] }),
  component: SupportIndicators,
})

function SupportIndicators() {
  const { user } = useSession()
  const authorised = user?.role === 'COUNSELLOR' || user?.role === 'PSYCHOLOGIST'

  return (
    <>
      <DashHeader title="Support indicators" subtitle="Prompts for human review, never diagnoses or decisions" />
      <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col px-6 py-10 lg:px-10 lg:py-14">
        <div className="grid flex-1 place-items-center">
          <section className="w-full max-w-xl rounded-panel border border-hairline bg-white px-7 py-12 text-center sm:px-12">
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-panel text-action"><LockKeyhole className="size-7" aria-hidden="true" /></span>
            <h2 className="mt-6 text-title-sm text-heading">{authorised ? 'Support indicators aren’t available yet' : 'Indicators aren’t available for your role'}</h2>
            <p className="mt-4 text-copy-sm text-body">{authorised ? 'This workspace is not ready for secure indicator reviews. You can continue reviewing school support requests in the meantime.' : 'Support indicators are available only to authorised counsellors and psychologists. This keeps students’ wellbeing information protected.'}</p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link to={authorised ? '/school/requests' : homeForRole(user)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-action px-6 text-chip font-semibold text-white hover:bg-brand-4">
                {authorised ? 'Go to support requests' : 'Go to my dashboard'}<ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              {authorised && <Link to="/school/indicators/guide" className="inline-flex min-h-11 items-center rounded-pill border border-hairline px-6 text-chip text-action hover:bg-panel">How support indicators work</Link>}
            </div>
          </section>
        </div>
        <p className="mt-10 flex items-start gap-2 text-caption text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />No student indicators are loaded on this page. Follow your school’s safeguarding procedures for immediate concerns.</p>
      </main>
    </>
  )
}
