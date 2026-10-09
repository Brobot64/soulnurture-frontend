// Dashboard UI primitives — cards, chips, tags, dialog, feed panel.

import {
  useEffect,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react'

import { Spinner } from '#/components/StatusBadge'
import { timeAgo } from '#/lib/dash'
import type { FeedRow } from '#/lib/activity'
import { initialsOf } from '#/lib/support'

export function Card({
  className = '',
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`rounded-panel border border-hairline bg-white p-6 ${className}`}>
      {children}
    </div>
  )
}

export function AvatarInitials({
  name,
  className = 'size-10',
}: {
  name: string
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-panel-2 text-chip font-semibold text-heading ${className}`}
    >
      {initialsOf(name)}
    </span>
  )
}

export type TagTone = 'neutral' | 'success' | 'danger' | 'accent' | 'info'

const TAG_TONES: Record<TagTone, string> = {
  neutral: 'bg-panel-2 text-body',
  success: 'bg-brand-11 text-brand-4',
  danger: 'bg-destructive-soft text-destructive',
  accent: 'bg-peach text-peach-ink',
  info: 'bg-panel text-body',
}

export function Tag({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: TagTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-pill px-3 py-1 text-chip ${TAG_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/** Delta chip: ↑ green on a mint wash, ↓ red on a soft wash, — with no baseline. */
export function DeltaChip({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-panel-2 px-2.5 py-1 text-chip text-muted">
        <Minus aria-hidden="true" className="size-3.5" />—
      </span>
    )
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-mint/30 px-2.5 py-1 text-chip font-semibold text-brand-4">
        <ArrowUpRight aria-hidden="true" className="size-3.5" />+{pct}%
      </span>
    )
  }
  if (pct < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-destructive-soft px-2.5 py-1 text-chip font-semibold text-destructive">
        <ArrowDownRight aria-hidden="true" className="size-3.5" />
        {pct}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-panel-2 px-2.5 py-1 text-chip text-muted">
      0%
    </span>
  )
}

export function StatCard({
  label,
  value,
  pct,
  hint,
  children,
}: {
  label: string
  value: string | number
  pct?: number | null
  hint?: string
  children?: ReactNode
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <span className="text-chip text-muted">{label}</span>
        {pct !== undefined && <DeltaChip pct={pct} />}
      </div>
      <span className="text-title-lg tabular-nums text-heading">{value}</span>
      {hint && <span className="text-caption text-muted">{hint}</span>}
      {children}
    </Card>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-pill border border-hairline bg-white pl-10 pr-4 text-copy-sm text-heading outline-none transition-colors placeholder:text-muted focus:border-brand-4"
      />
    </div>
  )
}

type ButtonVariant = 'primary' | 'ghost' | 'danger'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-action text-white hover:bg-brand-4',
  ghost: 'border border-hairline bg-white text-heading hover:bg-panel',
  danger: 'bg-destructive text-white hover:opacity-90',
}

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-pill px-6 text-button-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  )
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-hairline bg-panel-2/40 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-white text-muted">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="text-card text-heading">{title}</p>
      {body && <p className="max-w-md text-copy-sm text-muted">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-panel-2 ${className}`} />
}

export function FeedPanel({
  rows,
  loading = false,
}: {
  rows: FeedRow[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-panel border border-dashed border-hairline bg-panel-2/40 px-6 py-12 text-center text-copy-sm text-muted">
        No activity yet.
      </div>
    )
  }

  return (
    <div className="divide-y divide-hairline rounded-panel border border-hairline bg-white">
      {rows.map((row) => (
        <div key={row.id} className="flex items-start gap-3 px-5 py-4">
          <AvatarInitials name={row.subject} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-card text-heading">{row.title}</span>
              <Tag tone={row.tone === 'danger' ? 'danger' : row.tone === 'success' ? 'success' : row.tone === 'accent' ? 'accent' : 'neutral'}>
                {row.tag}
              </Tag>
            </div>
            {row.subtitle && (
              <p className="mt-0.5 truncate text-copy-sm text-muted">{row.subtitle}</p>
            )}
          </div>
          <span className="whitespace-nowrap pt-0.5 text-caption text-muted">
            {timeAgo(row.timestamp)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-page">
      <Spinner className="size-8 text-brand-4" />
    </div>
  )
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-scrim/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-lg rounded-panel bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-section text-heading">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-panel"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}
