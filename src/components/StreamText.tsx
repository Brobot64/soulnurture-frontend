import { useEffect, useRef } from 'react'

/** Word-by-word resolve-in stream (30-streaming-text.md). */
export function StreamText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const block = ref.current
    if (!block) return
    const spans = Array.from(block.querySelectorAll<HTMLSpanElement>('.t-stream-w'))
    if (spans.length === 0) return

    const rawGap = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--stream-gap'),
    )
    const gap = Number.isFinite(rawGap) ? rawGap : 60

    spans.forEach((span) => {
      span.style.transition = 'none'
      span.classList.remove('is-in')
    })
    void block.offsetWidth
    spans.forEach((span) => {
      span.style.transition = ''
    })

    const timers: number[] = []
    let index = 0
    const step = () => {
      if (index >= spans.length) return
      spans[index].classList.add('is-in')
      index += 1
      timers.push(window.setTimeout(step, gap))
    }
    step()
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [text])

  const words = text.trim().split(/\s+/)

  return (
    <span ref={ref}>
      {words.map((word, index) => (
        <span key={`${index}-${word}`} className="t-stream-w">
          {word}
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}
