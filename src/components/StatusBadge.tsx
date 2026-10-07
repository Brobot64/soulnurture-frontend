import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react'

export type StatusTone = 'success' | 'error'

interface StatusBadgeProps {
  tone: StatusTone
  children: ReactNode
}

const TONE_STYLES: Record<StatusTone, { box: string; icon: string; Icon: LucideIcon }> = {
  success: {
    box: 'border-action/15 bg-brand-11 text-brand-4',
    icon: 'text-action',
    Icon: CheckCircle2,
  },
  error: {
    box: 'border-destructive/20 bg-destructive-soft text-destructive',
    icon: 'text-destructive',
    Icon: AlertCircle,
  },
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  const { box, icon, Icon } = TONE_STYLES[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-2xl border px-5 py-3.5 text-copy ${box}`}
    >
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${icon}`} />
      <span>{children}</span>
    </div>
  )
}

export function Spinner({ className = 'size-5' }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={`animate-spin ${className}`} />
}
