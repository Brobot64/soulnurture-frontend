import { useEffect, useId, useRef, useState } from 'react'
import { Flag } from 'lucide-react'

import { Button, Dialog, ErrorNote } from '#/components/dash/ui'
import { ApiError } from '#/lib/api'
import { submitAiResponseReport } from '#/lib/ai-response-reports'
import type { Message } from '#/lib/journey'

export function ReportResponseButton({ message, reported, onReported, onReload }: {
  message: Message
  reported: boolean
  onReported: (alreadyReported: boolean) => void
  onReload: () => void
}) {
  const [selection, setSelection] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(false)
  const noteId = useId()

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const close = () => {
    if (inFlight.current) return
    setSelection(null)
  }

  async function submit() {
    if (inFlight.current || selection === null || stale) return
    inFlight.current = true
    setSaving(true)
    setError(null)
    try {
      const result = await submitAiResponseReport({ messageId: message.id, expectedContent: selection, note })
      if (!mounted.current) return
      setSelection(null)
      onReported(result.alreadyReported)
    } catch (caught) {
      if (!mounted.current) return
      setStale(caught instanceof ApiError && caught.code === 'RESPONSE_CHANGED')
      setError(caught instanceof ApiError && caught.status > 0
        ? caught.message
        : 'Could not confirm your report was submitted. Check your connection and try again; a retry will not create a second report.')
    } finally {
      inFlight.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={reported}
        onClick={() => { setSelection(message.content); setNote(''); setError(null); setStale(false) }}
        className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-pill px-2 text-caption text-muted transition-colors hover:bg-panel hover:text-action focus-visible:outline-2 focus-visible:outline-action disabled:cursor-default disabled:hover:bg-transparent"
      >
        <Flag aria-hidden="true" className="size-3.5" />
        {reported ? 'Report submitted' : 'Report this reply'}
      </button>
      <Dialog open={selection !== null} onClose={close} title="Report this AI reply">
        <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="flex flex-col gap-4" aria-busy={saving}>
          <p className="text-copy-sm text-body">
            Your report and linked conversation, including any AI summary, will be visible to counsellors and psychologists at your current school.
          </p>
          <blockquote className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words rounded-card border-l-4 border-action bg-panel px-4 py-3 text-copy-sm text-heading">
            {selection}
          </blockquote>
          <div className="flex flex-col gap-2">
            <label htmlFor={noteId} className="text-chip font-medium text-heading">What would you like them to know? <span className="font-normal text-muted">(optional)</span></label>
            <textarea id={noteId} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} rows={4} disabled={saving || stale}
              aria-describedby={`${noteId}-limit`}
              className="w-full resize-y rounded-card border border-hairline bg-white px-4 py-3 text-copy-sm text-heading outline-none focus:border-action disabled:opacity-60" />
            <span id={`${noteId}-limit`} className="text-caption text-muted">{note.length}/2,000 characters</span>
          </div>
          <p className="text-caption text-muted">Reporting does not request personal support or emergency help. To ask for support, use “Talk to a person”.</p>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
            {stale ? <Button onClick={() => { close(); onReload() }}>Reload reply</Button> :
              <Button type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit report'}</Button>}
          </div>
        </form>
      </Dialog>
    </>
  )
}
