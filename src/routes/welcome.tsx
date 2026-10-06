import { Link, createFileRoute } from '@tanstack/react-router'

import { HeroIllustration } from '#/components/HeroIllustration'
import { TextsReveal } from '#/components/TextsReveal'

export const Route = createFileRoute('/welcome')({
  head: () => ({
    meta: [
      { title: 'Soul Nurture AI — a calm space to check in with how you feel' },
      {
        name: 'description',
        content:
          'Take a quiet minute to check in with how you feel. A calm space for students to reflect — with the option to ask to talk to a school counsellor.',
      },
    ],
  }),
  component: Welcome,
})

const bullets = [
  'A calm space to reflect on how you feel',
  'Soul Nurture AI is not a therapist or a doctor',
  'You can ask to talk to a school counsellor at any time',
]

function Welcome() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="mx-auto grid w-full max-w-[1440px] items-center gap-8 px-6 py-10 lg:grid-cols-2 lg:gap-20 lg:px-[120px] lg:py-16">
        <div className="order-2 lg:order-1">
          <span className="hidden h-[30px] w-fit items-center gap-2 rounded-pill bg-surface px-4 text-chip text-heading lg:inline-flex">
            <span className="size-3 rounded-full bg-action" />
            Student check-in
          </span>
          <TextsReveal>
            <h1 className="t-stagger-line t-stagger-line--1 text-center text-title text-heading lg:mt-7 lg:text-left lg:text-hero">
              How are you feeling today?
            </h1>
            <p className="t-stagger-line t-stagger-line--2 mt-3 text-center text-copy text-body lg:mt-5 lg:max-w-[480px] lg:text-left lg:text-lede">
              Take a quiet minute to check in with yourself. There are no right or wrong answers.
            </p>
          </TextsReveal>
          <ul className="mt-11 flex flex-col gap-y-[18px]">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-center gap-6">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blush lg:size-7">
                  <span className="size-2.5 rounded-full bg-accent" />
                </span>
                <span className="text-copy text-ink">{bullet}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-4 lg:mt-14 lg:flex-row">
            <Link
              to="/check-in"
              className="inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 sm:px-10 lg:h-[60px] lg:px-16 lg:text-button"
            >
              Start check-in
            </Link>
            <button
              type="button"
              className="inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-pill bg-surface px-8 text-button-sm text-ink transition-colors hover:bg-neutral-10 sm:px-10 lg:h-[60px] lg:px-12 lg:text-button"
            >
              Maybe later
            </button>
          </div>
          <p className="mt-6 text-center text-copy-sm text-body lg:text-left">
            <Link
              to="/signup"
              className="font-medium text-action transition-colors hover:text-brand-4"
            >
              Create an account
            </Link>
            <span className="text-muted"> · </span>
            <Link
              to="/signin"
              className="font-medium text-action transition-colors hover:text-brand-4"
            >
              Sign in
            </Link>
          </p>
          <p className="mt-8 text-center text-caption text-muted lg:mt-6 lg:text-left">
            Soul Nurture AI is not an emergency service. If you are in danger, tell a trusted adult right away.
          </p>
        </div>
        <div className="order-1 flex justify-center lg:order-2">
          <div className="lg:grid lg:size-[560px] lg:place-items-center lg:rounded-hero lg:bg-panel">
            <HeroIllustration className="w-[267px] max-w-[78vw] lg:w-[400px] lg:max-w-none" />
          </div>
        </div>
      </div>
    </div>
  )
}
