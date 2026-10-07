import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'

import logo from '#/assets/soul-nurture-logo.png'

interface AuthShellProps {
  title: string
  subtitle: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col px-6 py-10 lg:py-16">
      <Link to="/welcome" className="flex w-fit items-center gap-3">
        <img src={logo} alt="" className="size-10 rounded-full" />
        <span className="text-wordmark text-heading">Soul Nurture AI</span>
      </Link>

      <h1 className="mt-10 text-title text-heading lg:text-hero-sm">{title}</h1>
      <p className="mt-3 text-copy text-body">{subtitle}</p>

      <div className="mt-9">{children}</div>

      {footer}

      <p className="mt-10 text-caption text-muted">
        Soul Nurture AI is not an emergency service. If you are in danger, tell a trusted adult
        right away.
      </p>
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
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && revealed ? 'text' : type

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
          className={`h-[60px] w-full rounded-3xl border border-hairline bg-white px-6 text-copy text-ink outline-none transition-colors placeholder:text-neutral-8 focus:border-action ${
            isPassword ? 'pr-14' : ''
          }`}
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
      {hint && <p className="mt-2 text-caption text-muted">{hint}</p>}
    </div>
  )
}
