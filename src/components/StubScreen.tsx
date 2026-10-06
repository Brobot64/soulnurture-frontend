import type { ReactNode } from 'react'

import { TextsReveal } from '#/components/TextsReveal'

export const stubActionClass =
  'inline-flex h-[52px] items-center justify-center whitespace-nowrap rounded-pill bg-action px-8 text-button-sm text-white transition-colors hover:bg-brand-4 sm:px-10 lg:h-[60px] lg:text-button'

export function StubScreen({
  step,
  title,
  description,
  action,
}: {
  step: string
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl rounded-sheet bg-panel px-6 py-10 text-center sm:px-8 sm:py-12 lg:px-14">
        <span className="inline-flex h-8 items-center rounded-pill bg-page px-4 text-chip text-action">
          {step}
        </span>
        <TextsReveal>
          <h1 className="t-stagger-line t-stagger-line--1 mt-6 text-title-sm text-heading lg:text-title">{title}</h1>
          <p className="t-stagger-line t-stagger-line--2 mx-auto mt-4 max-w-md text-copy text-body lg:text-lede">
            {description}
          </p>
        </TextsReveal>
        <div className="mt-10">{action}</div>
        <p className="mt-6 text-caption text-muted">Scaffolded preview — the full screen ships in a later step.</p>
      </div>
    </div>
  )
}
