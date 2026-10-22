import { useState, type CSSProperties } from 'react'

/**
 * Status dot shown while the AI is composing a reply. Each mount picks one
 * motion at random, with its own duration, so consecutive turns never look
 * identical. The motions are CSS-only (styles.css, `.t-proc*`) and fall back
 * to a static dot under prefers-reduced-motion.
 */
const VARIANTS = ['breathe', 'ripple', 'orbit', 'morph', 'hop'] as const
type ProcessingVariant = (typeof VARIANTS)[number]

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]

export function ProcessingDot() {
  const [variant] = useState<ProcessingVariant>(() => pick(VARIANTS))
  const [duration] = useState(() => (1.1 + Math.random() * 0.9).toFixed(2))

  return (
    <span
      className="t-proc"
      data-variant={variant}
      style={{ '--t-proc-dur': `${duration}s` } as CSSProperties}
      aria-hidden="true"
    >
      <span className="t-proc-ring" />
      <span className="t-proc-core" />
    </span>
  )
}
