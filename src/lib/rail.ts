import { useCallback, useState } from 'react'

// One key for every page that mounts the past-reflections rail: the student's
// choice should not differ between the check-in and a reflection.
const STORAGE_KEY = 'natlas.past-reflections.open'

export function usePastReflectionsRail() {
  // Defaults open, and reads the stored preference lazily rather than in an
  // effect: an effect would render the rail expanded first and collapse it a
  // frame later on every visit by someone who closed it.
  const [open, setOpen] = useState(
    () => typeof window === 'undefined' || window.localStorage.getItem(STORAGE_KEY) !== '0',
  )

  const toggle = useCallback((next: boolean) => {
    setOpen(next)
    window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
  }, [])

  return { open, toggle }
}
