import { useState } from 'react'
import { CalendarDays, ListChecks, Trash2 } from 'lucide-react'

import { Button, Dialog, ErrorNote } from '#/components/dash/ui'
import {
  DELETION_ACCOUNT_WARNING,
  DELETION_SCOPES,
  DELETION_SCOPE_LABELS,
  HISTORY_DELETION_NOTICE,
  feelingTitle,
  requestHistoryDeletion,
  type DeletionScope,
  type HistoryEntry,
} from '#/lib/history'

const SCOPE_ICONS = {
  ALL_HISTORY: Trash2,
  BEFORE_DATE: CalendarDays,
  SELECTED_CHECK_INS: ListChecks,
} as const

/** The three scopes the design offers, and the field each one needs. */
function missingField(scope: DeletionScope, beforeDate: string, selected: string[]): string | null {
  if (scope === 'BEFORE_DATE' && beforeDate === '') return 'Choose a date first.'
  if (scope === 'SELECTED_CHECK_INS' && selected.length === 0) return 'Pick at least one check-in.'
  return null
}

/**
 * Epic H "Ask to delete your history?". Files the ask and schedules the removal
 * 24 hours out; it deletes nothing here and now, which is what the undo window
 * is FOR. The list of check-ins to offer comes from the student's own history,
 * already loaded on the page — no second fetch, no ids invented here.
 */
export function HistoryDeletionDialog({
  open,
  entries,
  onClose,
  onFiled,
}: {
  open: boolean
  entries: HistoryEntry[]
  onClose: () => void
  onFiled: () => void
}) {
  const [scope, setScope] = useState<DeletionScope>('ALL_HISTORY')
  const [beforeDate, setBeforeDate] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blocked = missingField(scope, beforeDate, selected)

  async function submit() {
    if (saving || blocked) return
    setSaving(true)
    setError(null)
    try {
      await requestHistoryDeletion({
        scope,
        ...(scope === 'BEFORE_DATE' ? { beforeDate } : {}),
        ...(scope === 'SELECTED_CHECK_INS' ? { checkInIds: selected } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      onFiled()
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your request could not be sent.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Ask to delete your history?" icon={Trash2}>
      <div className="flex flex-col gap-6">
        <p className="text-copy-sm text-body">{HISTORY_DELETION_NOTICE}</p>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-chip font-medium text-heading">What would you like to delete?</legend>
          {DELETION_SCOPES.map((option) => {
            const Icon = SCOPE_ICONS[option]
            return (
              <label
                key={option}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-card border px-4 py-3 text-copy-sm ${
                  scope === option ? 'border-action/40 bg-panel text-heading' : 'border-hairline text-body'
                }`}
              >
                <input
                  type="radio"
                  name="deletion-scope"
                  value={option}
                  checked={scope === option}
                  onChange={() => setScope(option)}
                  className="size-4 shrink-0 accent-brand-4"
                />
                <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                {DELETION_SCOPE_LABELS[option]}
              </label>
            )
          })}
        </fieldset>

        {scope === 'ALL_HISTORY' && (
          <p className="rounded-card border border-accent/30 bg-panel p-4 text-copy-sm text-peach-ink">
            {DELETION_ACCOUNT_WARNING}
          </p>
        )}

        {scope === 'BEFORE_DATE' && (
          <label className="flex flex-col gap-2 text-chip font-medium text-heading">
            Delete check-ins before
            <input
              type="date"
              value={beforeDate}
              onChange={(event) => setBeforeDate(event.target.value)}
              className="min-h-11 rounded-card border border-hairline bg-white px-3 text-copy-sm text-body"
            />
          </label>
        )}

        {scope === 'SELECTED_CHECK_INS' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-chip font-medium text-heading">Which check-ins?</legend>
            {entries.length === 0 ? (
              <p className="text-copy-sm text-muted">There are no check-ins to select yet.</p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto overscroll-contain">
                {entries.map((entry) => {
                  const checked = selected.includes(entry.checkInId)
                  return (
                    <li key={entry.checkInId}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-card border border-hairline px-4 py-3 text-copy-sm text-body hover:bg-panel">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setSelected(event.target.checked
                              ? [...selected, entry.checkInId]
                              : selected.filter((id) => id !== entry.checkInId))
                          }
                          className="size-4 shrink-0 accent-brand-4"
                        />
                        {historyDate(entry.createdAt)} — feeling {feelingTitle(entry.feeling)}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </fieldset>
        )}

        <label className="flex flex-col gap-2 text-chip font-medium text-heading">
          Add a note (optional)
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Tell us why you would like this removed"
            className="rounded-card border border-hairline bg-white px-3 py-2 text-copy-sm text-body"
          />
        </label>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-caption text-muted">
            Nothing is removed when you send it. The removal runs 24 hours later, and you can cancel it on
            your history page until then.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={saving || blocked !== null}>
              {saving ? 'Sending…' : 'Schedule the removal'}
            </Button>
          </div>
        </div>
        {blocked && <p className="text-caption text-accent">{blocked}</p>}
      </div>
    </Dialog>
  )
}

function historyDate(createdAt: string): string {
  const when = new Date(createdAt)
  return Number.isNaN(when.getTime())
    ? createdAt
    : when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
