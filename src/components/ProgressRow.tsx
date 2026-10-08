import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'

export type BackTarget = '/welcome' | '/check-in' | '/check-in/why'

interface ProgressRowProps {
  step: number
  of?: number
  backTo?: BackTarget
}

export function ProgressRow({ step, of = 3, backTo }: ProgressRowProps) {
  const fillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = fillRef.current
    if (!el) return
    const frame = requestAnimationFrame(() => {
      el.style.width = `${Math.round((step / of) * 100)}%`
    })
    return () => cancelAnimationFrame(frame)
  }, [step, of])

  return (
    <div className="flex items-center gap-4 lg:gap-5">
      {backTo ? (
        <Link
          to={backTo}
          aria-label="Go back"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-ink transition-colors hover:bg-neutral-10 lg:size-11"
        >
          <ChevronLeft className="size-4 lg:size-5" />
        </Link>
      ) : null}
      <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface">
        <div
          ref={fillRef}
          className="h-full w-0 rounded-pill bg-action transition-[width] duration-[var(--duration-very-slow)] ease-[var(--ease-smooth-out)]"
        />
      </div>
      <span className="shrink-0 text-caption text-muted">
        {step} of {of}
      </span>
    </div>
  )
}
