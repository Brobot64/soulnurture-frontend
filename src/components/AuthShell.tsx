import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from 'lucide-react'

import logo from '#/assets/soul-nurture-logo.png'

interface AuthShellProps {
  title: string
  subtitle: ReactNode
  children: ReactNode
  footer?: ReactNode
  illustrated?: boolean
  standalone?: boolean
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  illustrated = false,
  standalone = false,
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

      <h1 className="mt-10 text-title text-heading lg:text-hero-sm">{title}</h1>
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
            aria-hidden="true"
            className="hidden min-h-[640px] items-center justify-center self-stretch overflow-hidden rounded-hero bg-panel p-6 lg:flex"
          >
            <div className="relative grid aspect-square w-full max-w-[300px] place-items-center rounded-full bg-surface">
              <div className="grid size-[72%] place-items-center rounded-full bg-mint/50">
                <div className="grid size-[61%] place-items-center rounded-full bg-action text-white">
                  <LockKeyhole className="size-14" strokeWidth={1.75} />
                </div>
              </div>
              <span className="absolute right-[7%] top-[10%] size-10 rounded-full bg-accent" />
              <span className="absolute bottom-[17%] left-[8%] size-6 rounded-full bg-mint" />
              <span className="absolute bottom-[23%] right-[3%] size-[18px] rounded-full bg-blush" />
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
          className={`h-[60px] w-full rounded-3xl border bg-white px-6 text-copy text-ink outline-none transition-colors placeholder:text-neutral-8 ${
            invalid
              ? 'border-destructive focus:border-destructive'
              : 'border-hairline focus:border-action'
          } ${isPassword ? 'pr-14' : ''}`}
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
