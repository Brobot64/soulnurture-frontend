import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, BookOpen, ShieldCheck, Trash2 } from 'lucide-react'

import {
  DELETION_SCOPE_LABELS,
  HISTORY_NOT_EMERGENCY,
  HISTORY_RETENTION_TRUTH,
} from '#/lib/history'
import { useStudentSupportAccess } from '#/lib/support'

export const Route = createFileRoute('/_app/history/about')({
  head: () => ({ meta: [{ title: 'About your history · Soul Nurture AI' }] }),
  component: HistoryAboutPage,
})

/**
 * Epic H's explainer. Every line here was read against the server before it was
 * written, because the artboard claimed two things the code does not do — a
 * per-check-in resource count and automatic expiry after a retention period.
 * Both are absent rather than approximated, and the "who can see it" section
 * says what administrators actually receive (aggregate numbers and action
 * records) instead of the design's blunter "no access to wellbeing content".
 */

const STORED: { title: string; body: string }[] = [
  {
    title: 'Each check-in',
    body: 'The feeling you chose, how strong it felt, the things you marked as going on, and any description you typed yourself.',
  },
  {
    title: 'Each reflection',
    body: 'Every turn you sent and every reply Soul Nurture AI gave you, kept in order and marked as typed or spoken, plus the short summary written when the conversation closed.',
  },
  {
    title: 'Each support request',
    body: 'The person or service you asked for, the timing you picked, and the message a school professional was first shown — kept as it was written at the time, so a later edit of the conversation cannot change what they were asked to act on.',
  },
  {
    title: 'Your own account of things',
    body: 'Any reply you reported as a problem, with the reason you chose and your note, and the privacy choices and consent versions you have accepted.',
  },
]

const NOT_STORED = [
  'What a school professional writes in their own notes or review tools. Those are part of their record, not yours, and never appear on your history pages.',
  'A list of resources you were shown. Nothing in this product ties a wellbeing resource to a check-in, so there is no count of them to keep.',
  'Audio. A spoken turn is kept as the words it was transcribed into, marked as spoken.',
]

function HistoryAboutPage() {
  const student = useStudentSupportAccess('/history/about')
  if (!student) {
    return <p role="status" className="mx-auto w-full max-w-[1160px] px-6 py-12 text-copy text-body">Checking your access…</p>
  }

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8 lg:py-12">
      <Link to="/history" className="inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" /> My wellbeing history
      </Link>

      <header className="mt-6 max-w-[760px]">
        <h1 className="text-title text-heading lg:text-title-lg">About your history</h1>
        <p className="mt-4 text-copy text-body">
          What your history pages store, who is able to read it, how long it stays, and how to ask for it to be removed.
        </p>
      </header>

      <section aria-labelledby="what-is-stored" className="mt-10 max-w-[760px]">
        <h2 id="what-is-stored" className="text-card font-semibold text-heading">What your history keeps</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {STORED.map((item) => (
            <li key={item.title} className="rounded-card border border-hairline bg-white p-5">
              <h3 className="text-copy-sm font-semibold text-heading">{item.title}</h3>
              <p className="mt-2 text-copy-sm text-body">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="what-is-not-stored" className="mt-10 max-w-[760px]">
        <h2 id="what-is-not-stored" className="text-card font-semibold text-heading">What is not kept here</h2>
        <ul className="mt-4 flex list-disc flex-col gap-3 pl-5">
          {NOT_STORED.map((item) => (
            <li key={item} className="text-copy-sm text-body">{item}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="who-can-see" className="mt-10 max-w-[760px]">
        <h2 id="who-can-see" className="text-card font-semibold text-heading">Who can see it</h2>
        <p className="mt-3 text-copy-sm text-body">
          You see all of it. Beyond you, reading your words is limited to the people whose work involves your care:
        </p>
        <ul className="mt-4 flex flex-col gap-4">
          <li className="rounded-card border border-hairline bg-white p-5">
            <h3 className="text-copy-sm font-semibold text-heading">Counsellors, psychologists and support staff at your school</h3>
            <p className="mt-2 text-copy-sm text-body">
              They can read your check-ins, reflections and requests so they can help you. They can only see students in
              their own school — an account at another school cannot reach your entries.
            </p>
          </li>
          <li className="rounded-card border border-hairline bg-white p-5">
            <h3 className="text-copy-sm font-semibold text-heading">School administrators</h3>
            <p className="mt-2 text-copy-sm text-body">
              They run the school’s account rather than your care, so they are not given a way to read your words. What
              they do see is school-level numbers — how many check-ins happened, how feelings are spread across the
              school — and a record of actions taken in the account, such as a conversation being opened or closed.
              Those records carry internal reference numbers, not the contents of your entries.
            </p>
          </li>
          <li className="rounded-card border border-hairline bg-white p-5">
            <h3 className="text-copy-sm font-semibold text-heading">The team that runs this product</h3>
            <p className="mt-2 text-copy-sm text-body">
              Counted totals for how the product is being used. Any figure that would point back at a group of fewer than
              five students is withheld rather than shown.
            </p>
          </li>
        </ul>
        <p className="mt-4 text-copy-sm text-body">
          Other students cannot see your history. Nothing on these pages is shared with a classmate.
        </p>
        <Link to="/privacy" className="mt-4 inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline">
          <BookOpen aria-hidden="true" className="size-4" /> Privacy &amp; consent
        </Link>
      </section>

      <section aria-labelledby="how-long" className="mt-10 max-w-[760px]">
        <h2 id="how-long" className="text-card font-semibold text-heading">How long it is kept</h2>
        <p className="mt-3 text-copy-sm text-body">{HISTORY_RETENTION_TRUTH}</p>
      </section>

      <section aria-labelledby="asking-removal" className="mt-10 max-w-[760px]">
        <div className="flex items-center gap-3">
          <Trash2 aria-hidden="true" className="size-5 shrink-0 text-action" />
          <h2 id="asking-removal" className="text-card font-semibold text-heading">Asking for it to be removed</h2>
        </div>
        <p className="mt-3 text-copy-sm text-body">
          The button under your history schedules a removal; it does not delete anything at the moment you send it. You
          choose one of three scopes — {(Object.keys(DELETION_SCOPE_LABELS) as (keyof typeof DELETION_SCOPE_LABELS)[])
            .map((scope) => `“${DELETION_SCOPE_LABELS[scope]}”`)
            .join(', ')} — and can add why.
        </p>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5">
          <li className="text-copy-sm text-body">
            This decision is yours. A person at your school is told the removal is coming; they are not asked to approve
            it, and nothing is held back waiting for a review.
          </li>
          <li className="text-copy-sm text-body">
            The removal runs 24 hours after you send it, and your history page shows the countdown with a button to stop
            it. Cancel in that window and nothing is removed at all.
          </li>
          <li className="text-copy-sm text-body">
            Once the 24 hours are up it happens and cannot be undone. Each removal leaves one note in the audit record
            saying only what scope ran and how many rows went — no names, no content.
          </li>
          <li className="text-copy-sm text-body">
            “All of my history” goes further than the entries: it takes the account itself, the login, and the
            safeguarding record raised on it, out of this product.
          </li>
          <li className="text-copy-sm text-body">
            If we could not reach a person at your school when you sent it, your history page says so. The removal is
            still scheduled; use Support too if you want a person to know in time to talk with you first.
          </li>
        </ul>
        <p className="mt-4 text-copy-sm text-muted">
          What is removed is what this product holds. Anything already copied out of it — a backup, a document a
          professional wrote elsewhere — is outside what these pages can reach, so ask the school directly about that.
        </p>
      </section>

      <div className="mt-10 max-w-[760px] rounded-card border border-apricot-10 bg-peach p-6 text-peach-ink">
        <div className="flex items-center gap-3">
          <ShieldCheck aria-hidden="true" className="size-5 shrink-0" />
          <h2 className="text-card">Not for emergencies</h2>
        </div>
        <p className="mt-3 text-copy-sm">{HISTORY_NOT_EMERGENCY}</p>
      </div>

      <nav aria-label="History options" className="mt-8 flex flex-wrap gap-3">
        <Link to="/history" className="inline-flex min-h-11 items-center rounded-pill bg-action px-6 text-button-sm font-semibold text-white hover:bg-brand-4">
          My wellbeing history
        </Link>
        <Link to="/support" className="inline-flex min-h-11 items-center rounded-pill bg-surface px-6 text-button-sm text-brand-4 hover:bg-neutral-10">
          Ask to talk to someone
        </Link>
      </nav>
    </div>
  )
}
