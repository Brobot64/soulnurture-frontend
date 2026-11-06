import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Eye, EyeOff, LockKeyhole, type LucideIcon } from 'lucide-react'

import logo from '#/assets/soul-nurture-logo.png'

/** The reassuring line each auth screen earns its name with, in the mint panel. */
export interface AuthPanel {
  Icon: LucideIcon
  heading: string
  caption: string
}

const DEFAULT_PANEL: AuthPanel = {
  Icon: LockKeyhole,
  heading: 'Protected by role',
  caption: 'Access to student information is restricted to authorised professionals.',
}

interface AuthShellProps {
  title: string
  subtitle: ReactNode
  children: ReactNode
  footer?: ReactNode
  illustrated?: boolean
  standalone?: boolean
  /** The small mint pill above the heading — "Student access", "Reset password". */
  chip?: string
  panel?: AuthPanel
  /** Replaces the drawn circle motif in the mint panel with artwork that carries its own background. */
  illustration?: ReactNode
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  illustrated = false,
  standalone = false,
  chip,
  panel = DEFAULT_PANEL,
  illustration,
}: AuthShellProps) {
  const content = (
    <>
      {illustrated && !standalone ? (
        <Link
          to="/welcome"
          className="inline-flex min-h-11 w-fit items-center gap-3 rounded-pill text-copy-sm font-medium text-action hover:text-brand-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-action"
        >
          <span className="grid size-11 place-items-center rounded-full bg-panel">
            <ArrowLeft aria-hidden="true" className="size-5" />
          </span>
          Back to welcome
        </Link>
      ) : (
        <Link to="/welcome" className="flex w-fit items-center gap-3">
          <img src={logo} alt="" className="size-10 rounded-full" />
          <span className="text-wordmark text-heading">Soul Nurture AI</span>
        </Link>
      )}

      {chip && (
        <p className="mt-10 inline-flex w-fit items-center gap-2 rounded-pill bg-mint px-3.5 py-1.5 text-caption font-semibold text-brand-4">
          <span className="size-1.5 rounded-full bg-action" aria-hidden="true" />
          {chip}
        </p>
      )}

      <h1 className={`text-title text-heading lg:text-hero-sm ${chip ? 'mt-5' : 'mt-10'}`}>{title}</h1>
      <p className="mt-3 text-copy text-body">{subtitle}</p>

      <div className="mt-9">{children}</div>

      {footer}

      <p className="mt-10 text-caption text-muted">
        Soul Nurture AI is not an emergency service. If you are in danger, tell a trusted adult
        right away.
      </p>
    </>
  )

  return (
    <div
      className={
        illustrated
          ? 'mx-auto flex w-full max-w-[520px] flex-1 flex-col px-6 py-10 lg:grid lg:max-w-[1440px] lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:items-center lg:gap-12 lg:px-12 lg:py-16 xl:gap-20 xl:px-[120px]'
          : 'mx-auto flex w-full max-w-[520px] flex-1 flex-col px-6 py-10 lg:py-16'
      }
    >
      {illustrated ? (
        <>
          <div className="w-full min-w-0 max-w-[520px]">{content}</div>
          <div
            className={
              illustration
                ? 'hidden min-h-[640px] flex-col items-center justify-center gap-10 self-stretch lg:flex'
                : 'hidden min-h-[640px] flex-col items-center justify-center gap-10 self-stretch overflow-hidden rounded-hero bg-panel p-6 lg:flex'
            }
          >
            {illustration ?? (
              <div className="relative grid aspect-square w-full max-w-[300px] place-items-center rounded-full bg-surface">
                <div className="grid size-[72%] place-items-center rounded-full bg-mint/50">
                  <div className="grid size-[61%] place-items-center rounded-full bg-action text-white">
                    <panel.Icon className="size-14" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                </div>
                <span className="absolute right-[7%] top-[10%] size-10 rounded-full bg-accent" />
                <span className="absolute bottom-[17%] left-[8%] size-6 rounded-full bg-mint" />
                <span className="absolute bottom-[23%] right-[3%] size-[18px] rounded-full bg-blush" />
              </div>
            )}
            <div className="max-w-[420px] text-center">
              <h2 className="text-section text-heading">{panel.heading}</h2>
              <p className="mt-3 text-copy text-body">{panel.caption}</p>
            </div>
          </div>
        </>
      ) : (
        content
      )}
    </div>
  )
}

interface AuthFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'password' | 'tel'
  placeholder?: string
  autoComplete?: string
  required?: boolean
  minLength?: number
  hint?: string
  invalid?: boolean
  errorId?: string
  Icon?: LucideIcon
}

export function AuthField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  required,
  minLength,
  hint,
  invalid = false,
  errorId,
  Icon,
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && revealed ? 'text' : type
  const hintId = hint ? `${id}-hint` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-copy-sm font-medium text-heading">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
        )}
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`h-[60px] w-full rounded-3xl border bg-white text-copy text-ink outline-none transition-colors placeholder:text-neutral-8 ${
            invalid
              ? 'border-destructive focus:border-destructive'
              : 'border-hairline focus:border-action'
          } ${Icon ? 'pl-13' : 'pl-6'} ${isPassword ? 'pr-14' : 'pr-6'}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:text-ink"
          >
            {revealed ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        )}
      </div>
      {hint && <p id={hintId} className="mt-2 text-caption text-muted">{hint}</p>}
    </div>
  )
}
