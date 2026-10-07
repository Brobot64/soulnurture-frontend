import { useCallback, useEffect, useRef, useState } from 'react'

import { Reveal } from '#/components/Reveal'

const SHOW_MS = 2600
const EXIT_MS = 220

export function useFlash() {
  const [message, setMessage] = useState<string | null>(null)
  const [hiding, setHiding] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  const flash = useCallback((text: string) => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    setMessage(text)
    setHiding(false)
    timers.current.push(window.setTimeout(() => setHiding(true), SHOW_MS))
    timers.current.push(
      window.setTimeout(() => {
        setMessage(null)
        setHiding(false)
      }, SHOW_MS + EXIT_MS),
    )
  }, [])

  return { flash, message, hiding }
}

interface FlashProps {
  message: string | null
  hiding: boolean
}

export function Flash({ message, hiding }: FlashProps) {
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <Reveal hiding={hiding} className="rounded-pill bg-ink px-6 py-3 text-copy-sm text-white shadow-lg">
        <span role="status">{message}</span>
      </Reveal>
    </div>
  )
}
