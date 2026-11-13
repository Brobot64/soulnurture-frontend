// Platform-admin control for the hosted vernacular models. They scale to zero
// between uses and take minutes to load a checkpoint, so the first student of a
// pilot would otherwise spend that time being told to type instead. Waking them
// starts billed GPU, which is why this is a deliberate press and not a page load.

import { useState } from 'react'
import { Power } from 'lucide-react'

import { PanelCard } from '#/components/dash/panels'
import { Button, ErrorNote, Skeleton, Tag, type TagTone } from '#/components/dash/ui'
import {
  fetchAiEndpoints,
  wakeAiEndpoints,
  type AiEndpointState,
  type AiEndpointStatus,
} from '#/lib/admin'
import { useApiQuery } from '#/lib/dash'

const STATE_TONES: Record<AiEndpointState, TagTone> = {
  awake: 'success',
  waking: 'info',
  reached: 'neutral',
  unreachable: 'danger',
  not_configured: 'neutral',
}

const STATE_LABELS: Record<AiEndpointState, string> = {
  awake: 'Running',
  waking: 'Starting up',
  reached: 'Answered',
  unreachable: 'No answer',
  not_configured: 'Not configured',
}

function messageOf(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'Something went wrong.'
}

export function HfEndpointsPanel() {
  const endpoints = useApiQuery(fetchAiEndpoints, [])
  const [statuses, setStatuses] = useState<Record<string, AiEndpointStatus>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  const wake = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await wakeAiEndpoints()
      setStatuses(Object.fromEntries(result.map((row) => [row.id, row])))
      setCheckedAt(new Date())
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const rows = endpoints.data ?? []
  const anyConfigured = rows.some((row) => row.configured)

  return (
    <PanelCard
      title="Vernacular models"
      action={
        <Button onClick={() => void wake()} disabled={busy || !anyConfigured}>
          <Power aria-hidden="true" className="size-4" />
          {busy ? 'Asking each endpoint…' : 'Start them all'}
        </Button>
      }
    >
      <p className="text-copy-sm text-muted">
        Each of these runs on a replica that scales to zero when idle. Starting
        one loads a model that then bills until it sleeps again: the voice
        fine-tunes take about three minutes to come up, N-ATLaS closer to
        fourteen. This page only asks them to start — it does not wait.
      </p>

      {endpoints.loading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <ul className="flex flex-col divide-y divide-hairline">
          {rows.map((row) => {
            const status = statuses[row.id]
            const state: AiEndpointState | null =
              status?.state ?? (row.configured ? null : 'not_configured')
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-card text-heading">{row.label}</span>
                  <span className="text-caption text-muted">{row.model}</span>
                </div>
                <div className="flex items-center gap-3">
                  {state && (
                    <Tag tone={STATE_TONES[state]}>{STATE_LABELS[state]}</Tag>
                  )}
                  {!state && <Tag tone="neutral">Not checked</Tag>}
                  {status?.latencyMs != null && (
                    <span className="text-caption tabular-nums text-muted">
                      {status.latencyMs} ms
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}

      <p className="text-caption text-muted">
        {checkedAt
          ? `Asked at ${checkedAt.toLocaleTimeString()}. Re-check by pressing the button again — the answer is what each endpoint said then, not what it is now.`
          : 'The state column stays empty until you start them: no request is sent while you are only reading this.'}
      </p>
    </PanelCard>
  )
}
