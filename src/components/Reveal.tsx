import { useEffect, useRef, type ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  className?: string
  hiding?: boolean
}

/** Single-block mount reveal reusing the texts-reveal tokens (18-texts-reveal.md). */
export function Reveal({ children, className = '', hiding = false }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.classList.toggle('is-hiding', hiding)
    if (!hiding && !el.classList.contains('is-shown')) {
      void el.offsetHeight
      el.classList.add('is-shown')
    }
  }, [hiding])

  return (
    <div ref={ref} className="t-stagger contents">
      <div className={`t-stagger-line ${className}`}>{children}</div>
    </div>
  )
}
