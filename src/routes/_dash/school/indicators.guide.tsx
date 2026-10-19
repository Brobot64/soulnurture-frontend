import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Eye, HeartHandshake, ShieldCheck, UserRoundCheck } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'

export const Route = createFileRoute('/_dash/school/indicators/guide')({
  head: () => ({ meta: [{ title: 'How support indicators work · Soul Nurture AI' }] }),
  component: IndicatorGuide,
})

const explanations = [
  { title: 'A prompt', icon: Eye, text: 'An indicator points to something that may benefit from a human review. Read the available context before deciding whether to follow up.' },
  { title: 'Not a diagnosis', icon: HeartHandshake, text: 'An indicator does not describe a condition, assign a clinical finding, or decide what support a student needs.' },
  { title: 'Your decision', icon: UserRoundCheck, text: 'Use your professional judgement and your school’s safeguarding procedures. A suggested action is not an automatic decision.' },
  { title: 'Authorised eyes only', icon: ShieldCheck, text: 'Student wellbeing information belongs in the care of authorised school professionals. Share only through approved safeguarding channels.' },
]

function IndicatorGuide() {
  return (
    <>
      <DashHeader title="How support indicators work" subtitle="A short guide for counsellors and psychologists" />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-10 lg:px-10 lg:py-14">
        <Link to="/school/indicators" className="inline-flex min-h-11 items-center gap-2 text-chip font-semibold text-action"><ArrowLeft className="size-4" aria-hidden="true" />Support indicators</Link>
        <p className="mt-7 max-w-2xl text-lede text-body">You stay in control of every review. These principles help keep student support thoughtful, private, and human.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {explanations.map(({ title, icon: Icon, text }) => <section key={title} className="rounded-panel border border-hairline bg-white p-6"><span className={`grid size-11 place-items-center rounded-full ${title === 'Not a diagnosis' ? 'bg-peach text-peach-ink' : 'bg-panel text-action'}`}><Icon className="size-5" aria-hidden="true" /></span><h2 className="mt-5 text-card text-heading">{title}</h2><p className="mt-3 text-copy-sm leading-relaxed text-body">{text}</p></section>)}
        </div>
        <div className="mt-7 rounded-card bg-panel px-6 py-5 text-copy-sm text-brand-4">The review workspace is not available yet. No indicator rules or sample student records are presented here as approved clinical guidance.</div>
        <p className="mt-8 text-caption text-muted">Concerned about a student’s immediate safety? Follow your school’s safeguarding procedures. Soul Nurture AI is not an emergency service.</p>
      </main>
    </>
  )
}
