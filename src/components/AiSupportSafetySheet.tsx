import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BookOpen, ShieldCheck } from 'lucide-react'

import { Button, Dialog, ErrorNote, Skeleton } from '#/components/dash/ui'
import { fetchDisclosure, type AiDisclosure } from '#/lib/consent'

/**
 * Epic G's "Using AI support safely", read straight off the consent
 * instrument the backend serves (`v1/ai/disclosure`). The panel deliberately
 * ships no wording of its own: a second, shorter list of what the AI may and
 * may not do is a second claim to stand behind, and the version a student
 * agreed to is the one worth showing.
 */
const SECTION_IDS = ['what-it-supports', 'what-it-cannot-do'] as const

export function AiSupportSafetySheet() {
  const [open, setOpen] = useState(false)
  const [disclosure, setDisclosure] = useState<AiDisclosure | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open || disclosure || failed) return
    let cancelled = false
    fetchDisclosure()
      .then((value) => { if (!cancelled) setDisclosure(value) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [open, disclosure, failed])

  const sections = SECTION_IDS
    .map((id) => disclosure?.groups.flatMap((group) => group.sections).find((section) => section.id === id))
    .filter((section) => section !== undefined)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="mx-auto flex w-fit items-center gap-2 rounded-pill bg-peach px-4 py-1.5 text-caption text-peach-ink transition-colors hover:bg-blush focus-visible:outline-2 focus-visible:outline-action lg:mt-3 lg:gap-2.5 lg:px-5 lg:py-1.5 lg:text-chip"
      >
        <span className="size-1.5 rounded-full bg-accent lg:size-2" aria-hidden="true" />
        AI-guided reflection · not a therapist or doctor
        <ShieldCheck className="size-3.5 shrink-0 opacity-70 lg:size-4" aria-hidden="true" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Using AI support safely" icon={ShieldCheck}>
        {failed ? (
          <>
            <ErrorNote>We couldn’t load the explanation right now.</ErrorNote>
            <div className="mt-5 flex justify-end">
              <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </>
        ) : sections.length === 0 ? (
          <Skeleton className="h-56" />
        ) : (
          <div className="flex flex-col gap-6">
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={`safety-${section.id}`}>
                <h3 id={`safety-${section.id}`} className="text-chip font-semibold text-heading">{section.heading}</h3>
                <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
                  {section.items.map((item) => (
                    <li key={item} className="text-copy-sm text-body">{item}</li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="text-caption text-muted">
              Shown exactly as the explanation you agreed to (version {disclosure?.version}).
            </p>
            <Link
              to="/consent"
              className="inline-flex min-h-11 w-fit items-center gap-2 text-chip font-semibold text-action hover:text-brand-4"
            >
              <BookOpen className="size-4" aria-hidden="true" />
              Read the full explanation
            </Link>
          </div>
        )}
      </Dialog>
    </>
  )
}
