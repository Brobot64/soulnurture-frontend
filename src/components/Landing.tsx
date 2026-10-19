// Public landing — guests only (signed-in users fan out from the route).
// Copy is marketing-supplied, verbatim; sections: hero → what is / what for →
// privacy → in danger → bottom CTA. Tokens only, motion via the t-stagger kit.

import { useState } from 'react'
import { Link } from '@tanstack/react-router'

import { HeroIllustration } from '#/components/HeroIllustration'
import { TextsReveal } from '#/components/TextsReveal'
import { Button, Dialog } from '#/components/dash/ui'

const EMERGENCY_DISCLAIMER =
  'Soul Nurture AI is not an emergency service. If you are in danger, tell a trusted adult right away.'

function SectionChip({ emoji, label }: { emoji: string; label: string }) {
  return (
    <span className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blush text-[22px]"
      >
        {emoji}
      </span>
      <h2 className="text-title-sm text-heading lg:text-title">{label}</h2>
    </span>
  )
}

/** Tinted caution note — the "supports, not replaces" / "cannot diagnose" lines. */
function NoteBar({ children }: { children: string }) {
  return (
    <p className="rounded-card bg-panel-2 px-5 py-4 text-copy font-medium text-brand-4">
      {children}
    </p>
  )
}

export function Landing() {
  const [urgentOpen, setUrgentOpen] = useState(false)

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero — two columns, mirroring the welcome page. */}
      <section className="mx-auto grid w-full max-w-[1440px] items-center gap-8 px-6 py-10 lg:grid-cols-2 lg:gap-20 lg:px-[120px] lg:py-20">
        <div className="order-2 lg:order-1">
          <TextsReveal>
            <p className="t-stagger-line t-stagger-line--1 text-center text-wordmark text-brand-6 lg:text-left">
              Soul Nurture AI
            </p>
            <h1 className="t-stagger-line t-stagger-line--2 mt-2 text-center text-title text-heading lg:mt-3 lg:text-left lg:text-hero">
              Your space to check in, reflect, and find support.
            </h1>
          </TextsReveal>
          <div className="mt-8 flex justify-center lg:mt-12 lg:justify-start">
            <Link
              to="/signin"
              className="inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 sm:px-10 lg:h-[60px] lg:px-16 lg:text-button"
            >
              Sign in with your school account
            </Link>
          </div>
          <p className="mt-8 text-center text-caption text-muted lg:mt-6 lg:text-left">
            {EMERGENCY_DISCLAIMER}
          </p>
        </div>
        <div className="order-1 flex justify-center lg:order-2">
          <div className="lg:grid lg:aspect-square lg:w-full lg:max-w-[560px] lg:place-items-center lg:rounded-hero lg:bg-panel">
            <HeroIllustration className="w-[267px] max-w-[78vw] lg:w-3/4 lg:max-w-[400px]" />
          </div>
        </div>
      </section>

      {/* What is Soul Nurture? / What can I use it for? — paired cards. */}
      <section className="mx-auto grid w-full max-w-[1440px] gap-5 px-6 pb-5 lg:grid-cols-2 lg:px-[120px]">
        <div className="flex flex-col gap-5 rounded-panel border border-hairline bg-white p-6 lg:p-8">
          <SectionChip emoji="🌱" label="What is Soul Nurture?" />
          <p className="text-copy text-body">
            A youth-friendly AI wellbeing space that helps you check in, express
            your feelings, reflect, and find helpful resources.
          </p>
          <NoteBar>
            It supports you—it doesn&rsquo;t replace a psychologist, counsellor,
            doctor, or emergency service.
          </NoteBar>
        </div>
        <div className="flex flex-col gap-5 rounded-panel border border-hairline bg-white p-6 lg:p-8">
          <SectionChip emoji="💬" label="What can I use it for?" />
          <ul className="flex flex-wrap gap-2">
            {['Check in', 'Reflect', 'Learn', 'Find support'].map((item) => (
              <li
                key={item}
                className="rounded-pill bg-panel-2 px-4 py-2 text-chip text-brand-4"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="text-copy text-body">
            Soul Nurture can help you explore everyday emotional challenges,
            access wellbeing resources, and identify when human support may be
            helpful.
          </p>
          <NoteBar>It cannot diagnose, provide treatment, or make clinical decisions.</NoteBar>
        </div>
      </section>

      {/* Your privacy matters. */}
      <section className="mx-auto w-full max-w-[1440px] px-6 pb-5 lg:px-[120px]">
        <div className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
          <SectionChip emoji="🔐" label="Your privacy matters" />
          <div className="mt-5 grid gap-4 lg:grid-cols-2 lg:gap-10">
            <p className="text-copy text-body">
              Your check-ins, messages and other information you provide may be
              processed to provide the service. We use appropriate safeguards to
              protect your information.
            </p>
            <p className="text-copy text-body">
              If there is a serious safety concern, information may need to be
              shared with authorised support personnel according to safeguarding
              procedures.
            </p>
          </div>
          <div className="mt-6">
            <Link
              to="/privacy"
              className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-pill bg-panel px-7 text-button-sm text-ink transition-colors hover:bg-neutral-10"
            >
              Privacy Notice
            </Link>
          </div>
        </div>
      </section>

      {/* If you're in danger. */}
      <section className="mx-auto w-full max-w-[1440px] px-6 pb-5 lg:px-[120px]">
        <div className="rounded-hero bg-peach p-6 lg:p-10">
          <SectionChip emoji="🆘" label="If you&rsquo;re in danger" />
          <p className="mt-5 text-card text-counsellor lg:text-lede">
            Soul Nurture is not an emergency service.
          </p>
          <p className="mt-2 max-w-[720px] text-copy text-body">
            If you or someone else is in immediate danger, tell a trusted adult
            or qualified professional and seek urgent help. Don&rsquo;t wait for
            the AI.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setUrgentOpen(true)}
              className="inline-flex h-11 items-center justify-center whitespace-nowrap rounded-pill bg-counsellor px-7 text-button-sm text-white transition-opacity hover:opacity-90"
            >
              Get urgent help
            </button>
          </div>
        </div>
      </section>

      {/* Bottom CTA. */}
      <section className="mx-auto w-full max-w-[1440px] px-6 py-10 lg:px-[120px] lg:py-16">
        <div className="flex flex-col items-center gap-6">
          <Link
            to="/signin"
            className="inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 sm:px-10 lg:h-[60px] lg:px-16 lg:text-button"
          >
            Sign in with your school account
          </Link>
          <p className="text-center text-caption text-muted">{EMERGENCY_DISCLAIMER}</p>
        </div>
      </section>

      <Dialog
        open={urgentOpen}
        onClose={() => setUrgentOpen(false)}
        title="If you&rsquo;re in danger"
        footer={
          <Button variant="ghost" onClick={() => setUrgentOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-copy-sm font-semibold text-heading">
            Soul Nurture is not an emergency service.
          </p>
          <p className="text-copy-sm text-body">
            If you or someone else is in immediate danger:
          </p>
          <ul className="flex flex-col gap-2 text-copy-sm text-body">
            {[
              'Tell a trusted adult right away.',
              'Tell a qualified professional — a teacher, counsellor, nurse, or doctor.',
              'Contact your local emergency services.',
              "Don't wait for the AI.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Dialog>
    </div>
  )
}
