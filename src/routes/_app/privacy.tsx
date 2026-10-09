// Privacy Notice — the copy supplied for the pilot landing (verbatim).
// Reachable from the landing's [Privacy Notice] button.

import { Link, createFileRoute } from '@tanstack/react-router'

import { TextsReveal } from '#/components/TextsReveal'

export const Route = createFileRoute('/_app/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy Notice — Soul Nurture AI' },
      {
        name: 'description',
        content:
          'How Soul Nurture AI handles your check-ins, messages and other information — and when information may need to be shared.',
      },
    ],
  }),
  component: Privacy,
})

function Privacy() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-10 lg:px-[120px] lg:py-16">
      <div className="max-w-[720px]">
        <Link
          to="/"
          className="text-copy-sm font-medium text-action transition-colors hover:text-brand-4"
        >
          ← Back
        </Link>
        <TextsReveal>
          <p className="t-stagger-line t-stagger-line--1 mt-6 text-wordmark text-brand-6">
            Soul Nurture AI
          </p>
          <h1 className="t-stagger-line t-stagger-line--2 mt-2 text-title text-heading lg:text-title-lg">
            Privacy Notice
          </h1>
        </TextsReveal>

        <div className="mt-8 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 className="text-card text-heading">How information is used</h2>
            <p className="text-copy text-body">
              Your check-ins, messages and other information you provide may be
              processed to provide the service. We use appropriate safeguards to
              protect your information.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-card text-heading">When information may be shared</h2>
            <p className="text-copy text-body">
              If there is a serious safety concern, information may need to be
              shared with authorised support personnel according to safeguarding
              procedures.
            </p>
          </div>
        </div>

        <p className="mt-10 rounded-card bg-panel-2 px-5 py-4 text-copy-sm font-medium text-brand-4">
          Soul Nurture AI is not an emergency service. If you are in danger, tell
          a trusted adult right away.
        </p>
      </div>
    </div>
  )
}
