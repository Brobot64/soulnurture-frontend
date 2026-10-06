import { useEffect, useRef, type ReactNode } from 'react'

export function TextsReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const block = ref.current
    if (!block) return
    block.classList.remove('is-hiding')
    block.classList.remove('is-shown')
    void block.offsetHeight
    block.classList.add('is-shown')
  }, [])

  return (
    <div ref={ref} className="t-stagger">
      {children}
    </div>
  )
}
