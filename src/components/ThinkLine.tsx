import { useEffect, useRef } from 'react'

const ms = (name: string, fallback: number) => {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

interface ThinkLineProps {
  states: readonly string[]
  className?: string
}

/** Cycling shimmer status line (28-thinking-states.md). Pass a stable states array. */
export function ThinkLine({ states, className = '' }: ThinkLineProps) {
  const boxRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box || states.length === 0) return

    const timers: number[] = []
    let stopped = false

    const makeText = (text: string, enterStart: boolean) => {
      const el = document.createElement('span')
      el.className = enterStart ? 't-think-text is-enter-start' : 't-think-text'
      el.textContent = text
      el.setAttribute('data-text', text)
      box.appendChild(el)
      return el
    }

    let live = makeText(states[0], false)
    let index = 0

    const cycle = () => {
      timers.push(
        window.setTimeout(() => {
          if (stopped) return
          const swap = ms('--think-swap', 150)
          const gap = ms('--think-gap', 50)
          const leaving = live
          index = (index + 1) % states.length

          leaving.classList.add('is-exit')
          const next = makeText(states[index], true)
          live = next

          const release = () => {
            void next.offsetWidth
            next.classList.remove('is-enter-start')
          }
          if (gap > 0) timers.push(window.setTimeout(release, gap))
          else release()

          timers.push(
            window.setTimeout(() => {
              if (stopped) return
              leaving.remove()
              cycle()
            }, swap + gap),
          )
        }, ms('--think-hold', 2000)),
      )
    }

    cycle()

    return () => {
      stopped = true
      timers.forEach((id) => window.clearTimeout(id))
      box.querySelectorAll('.t-think-text').forEach((el) => el.remove())
    }
  }, [states])

  const longest = states.reduce((a, b) => (b.length > a.length ? b : a), '')

  return (
    <span ref={boxRef} className={`t-think ${className}`} role="status">
      <span className="t-think-sizer" aria-hidden="true">
        {longest}
      </span>
    </span>
  )
}
