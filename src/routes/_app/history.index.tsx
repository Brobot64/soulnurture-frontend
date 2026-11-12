import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, BookOpen, BookOpenText, CalendarFold, HeartHandshake, ShieldCheck, Trash2 } from 'lucide-react'

import { HistoryDeletionDialog } from '#/components/HistoryDeletionDialog'
import { Button, ErrorNote, Skeleton } from '#/components/dash/ui'
import {
  DELETION_SCOPE_LABELS,
  HISTORY_EMPTY,
  HISTORY_INTRO,
  HISTORY_NOT_EMERGENCY,
  HISTORY_RETENTION_TRUTH,
  HISTORY_TABS,
  cancelHistoryDeletion,
  deletionState,
  deletionStateLine,
  fetchDeletionRequests,
  fetchHistory,
  feelingTitle,
  reflectionLane,
  requestStage,
  type DeletionReceipt,
  type HistoryEntry,
  type HistoryResponse,
  type HistorySupportRequest,
  type HistoryTab,
} from '#/lib/history'
import { useStudentSupportAccess } from '#/lib/support'

export const Route = createFileRoute('/_app/history/')({
  head: () => ({ meta: [{ title: 'My wellbeing history · Soul Nurture AI' }] }),
  component: HistoryPage,
})

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function withinWeek(createdAt: string, now: number): boolean {
  const when = new Date(createdAt).getTime()
  return !Number.isNaN(when) && now - when <= WEEK_MS
}

function rowDate(createdAt: string): { day: string; month: string; full: string } {
  const when = new Date(createdAt)
  if (Number.isNaN(when.getTime())) return { day: '—', month: '', full: createdAt }
  return {
    day: when.toLocaleDateString('en-GB', { day: 'numeric' }),
    month: when.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase(),
    full: when.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

function HistoryPage() {
  const student = useStudentSupportAccess('/history')
  const [data, setData] = useState<HistoryResponse | null>(null)
  // The timeline is accumulated across pages; `data` alone only ever holds the
  // newest page, so rendering from it would replace what is on screen instead of
  // extending it.
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [receipts, setReceipts] = useState<DeletionReceipt[]>([])
  const [error, setError] = useState<string | null>(null)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [tab, setTab] = useState<HistoryTab>('all')
  const [askOpen, setAskOpen] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [deletionNotice, setDeletionNotice] = useState<string | null>(null)
  const [clock, setClock] = useState(() => Date.now())

  const load = useCallback(async () => {
    setError(null)
    try {
      const [history, asks] = await Promise.all([fetchHistory(), fetchDeletionRequests()])
      setData(history)
      setEntries(history.items)
      setReceipts(asks.items)
      // The countdown is measured against the moment the schedule was read, not
      // against when the page first mounted — otherwise an ask filed a minute
      // after load reads "24 hours and 1 minute".
      setClock(Date.now())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your history could not be loaded.')
    }
  }, [])

  useEffect(() => {
    if (!student) return
    void load()
  }, [student, load])

  /**
   * Older entries are fetched only when asked for. Nothing on this page ever
   * fetched on scroll: an unbounded list grew the document forever, and a
   * student on a phone scrolled through a page that never stopped getting
   * longer.
   */
  async function loadEarlier() {
    const before = data?.page.nextBefore
    if (!before || loadingMore) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const older = await fetchHistory({ before })
      setData((current) =>
        current
          ? { ...current, items: older.items, counts: older.counts, page: older.page }
          : older,
      )
      setEntries((current) => [...current, ...older.items])
    } catch (cause) {
      setMoreError(cause instanceof Error ? cause.message : 'Older entries could not be loaded.')
    } finally {
      setLoadingMore(false)
    }
  }

  // The countdown only needs a clock while something is still on the timer.
  const anythingScheduled = receipts.some((receipt) => deletionState(receipt) === 'scheduled')
  useEffect(() => {
    if (!anythingScheduled) return
    const tick = setInterval(() => setClock(Date.now()), 30_000)
    return () => clearInterval(tick)
  }, [anythingScheduled])

  async function cancelAsk(requestId: string) {
    if (cancelling) return
    setCancelling(requestId)
    setDeletionNotice(null)
    try {
      const stopped = await cancelHistoryDeletion(requestId)
      setReceipts((rows) => rows.map((row) => (row.id === requestId ? stopped : row)))
      setDeletionNotice('Stopped. Nothing was removed.')
    } catch (cause) {
      // Whatever the reason, the server now knows better than this page: a cancel
      // that arrived after the erasure is an erasure. Say what it answered, then
      // re-read the list instead of leaving a stale row on screen.
      setDeletionNotice(cause instanceof Error ? cause.message : 'This request could not be cancelled.')
      await load()
    } finally {
      setCancelling(null)
    }
  }

  if (!student) {
    return <p role="status" className="mx-auto w-full max-w-[1160px] px-5 py-12 text-copy text-body sm:px-6">Checking your access…</p>
  }
  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8">
        <ErrorNote>{error}</ErrorNote>
        <Button className="mt-4" onClick={() => void load()}>Try again</Button>
      </div>
    )
  }
  if (!data) {
    return (
      <div aria-label="Loading your history" className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col gap-4 px-5 py-8 sm:px-8 lg:py-12">
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  const loaded = entries.length
  const shown =
    tab === 'support'
      ? []
      : entries.filter((entry) =>
          tab === 'all' ? true : tab === 'reflections' ? entry.reflection !== null : true,
        )
  const now = clock
  const thisWeek = shown.filter((entry) => withinWeek(entry.createdAt, now))
  const earlier = shown.filter((entry) => !withinWeek(entry.createdAt, now))

  return (
    <>
      <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8 lg:py-12">
        <header className="max-w-[760px]">
          <h1 className="text-title text-heading lg:text-title-lg">My wellbeing history</h1>
          <p className="mt-4 text-copy text-body">{HISTORY_INTRO}</p>
        </header>

        <nav aria-label="Filter your history" className="mt-8 flex flex-wrap gap-2">
          {HISTORY_TABS.map((option) => {
            const active = tab === option.id
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(option.id)}
                className={`min-h-11 rounded-pill border px-5 text-chip font-semibold transition-colors ${
                  active ? 'border-brand-4 bg-panel text-brand-4' : 'border-hairline bg-white text-body hover:bg-panel'
                }`}
              >
                {option.label}
                <span className="ml-2 text-caption font-normal text-muted">
                  {countFor(option.id, data)}
                </span>
              </button>
            )
          })}
        </nav>

        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-8">
            {tab === 'support' ? (
              data.counts.supportRequests === 0 ? (
                <NoRequests />
              ) : (
                <RequestGroup requests={data.supportRequests} total={data.counts.supportRequests} />
              )
            ) : entries.length === 0 ? (
              <EmptyState />
            ) : shown.length === 0 ? (
              <p className="text-copy-sm text-muted">
                Nothing of this kind yet — choose “All” to see everything you have.
              </p>
            ) : (
              <>
                {thisWeek.length > 0 && <Group title="This week" entries={thisWeek} />}
                {earlier.length > 0 && <Group title="Earlier" entries={earlier} />}
              </>
            )}

            {tab !== 'support' && data.page.hasMore && (
              <div className="flex flex-col items-start gap-2">
                <Button variant="ghost" disabled={loadingMore} onClick={() => void loadEarlier()}>
                  {loadingMore ? 'Loading…' : `Load earlier entries (${Math.max(0, data.counts.checkIns - loaded)})`}
                </Button>
                {moreError && <ErrorNote>{moreError}</ErrorNote>}
              </div>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <section aria-labelledby="about-history" className="rounded-card border border-hairline bg-white p-6">
              <div className="flex items-center gap-3">
                <BookOpen aria-hidden="true" className="size-5 shrink-0 text-brand-4" />
                <h2 id="about-history" className="text-card text-heading">About your history</h2>
              </div>
              <p className="mt-3 text-copy-sm text-muted">What is stored, who can see it, and how to ask for it to be removed.</p>
              <Link
                to="/history/about"
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-button-sm text-brand-4 hover:underline"
              >
                How your history is kept <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </section>

            <section aria-labelledby="delete-history" className="rounded-card border border-hairline bg-white p-6">
              <div className="flex items-center gap-3">
                <Trash2 aria-hidden="true" className="size-5 shrink-0 text-brand-4" />
                <h2 id="delete-history" className="text-card text-heading">Delete your history</h2>
              </div>
              <p className="mt-3 text-copy-sm text-body">
                This one is your decision, not a review. A removal you schedule runs 24 hours later, and you can
                cancel it until then. A person at your school is told it is coming.
              </p>
              <Button className="mt-4" variant="ghost" onClick={() => setAskOpen(true)}>
                <CalendarFold aria-hidden="true" className="size-4" />
                Schedule a removal
              </Button>

              {deletionNotice && (
                <p role="status" className="mt-4 rounded-card border border-hairline bg-panel p-3 text-caption text-heading">
                  {deletionNotice}
                </p>
              )}

              {receipts.length > 0 && (
                <ul className="mt-5 flex flex-col gap-3 border-t border-hairline pt-5">
                  {receipts.map((receipt) => (
                    <li key={receipt.id} className="text-copy-sm text-body">
                      <p className="font-semibold text-heading">{DELETION_SCOPE_LABELS[receipt.scope]}</p>
                      <p className="mt-1 text-caption text-muted">
                        Filed {new Date(receipt.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {receipt.beforeDate ? ` · before ${receipt.beforeDate}` : ''}
                        {receipt.checkInIds.length > 0 ? ` · ${receipt.checkInIds.length} check-in(s)` : ''}
                      </p>
                      <p className={`mt-2 text-caption ${
                        deletionState(receipt) === 'scheduled'
                          ? 'text-peach-ink'
                          : deletionState(receipt) === 'removed'
                            ? 'text-muted'
                            : 'text-body'
                      }`}>
                        {deletionStateLine(receipt, now)}
                      </p>
                      {/* alertedAt keeps its own line: it says whether a person was
                          actually told, which is a different fact from the schedule. */}
                      {receipt.alertedAt === null && deletionState(receipt) === 'scheduled' && (
                        <p className="mt-1 text-caption text-peach-ink">
                          We could not reach your school’s team about this request. The removal is still scheduled. To be sure a person sees it, tell them through Support.
                        </p>
                      )}
                      {deletionState(receipt) === 'scheduled' && (
                        <Button
                          variant="ghost"
                          className="mt-3"
                          disabled={cancelling !== null}
                          onClick={() => void cancelAsk(receipt.id)}
                        >
                          {cancelling === receipt.id ? 'Cancelling…' : 'Cancel this removal'}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="rounded-card border border-apricot-10 bg-peach p-6 text-peach-ink">
              <div className="flex items-center gap-3">
                <ShieldCheck aria-hidden="true" className="size-5 shrink-0" />
                <h2 className="text-card">Not for emergencies</h2>
              </div>
              <p className="mt-3 text-copy-sm">{HISTORY_NOT_EMERGENCY}</p>
            </div>
          </aside>
        </div>

        <p className="mt-10 max-w-[760px] text-caption text-muted">{HISTORY_RETENTION_TRUTH}</p>
      </div>

      <HistoryDeletionDialog
        open={askOpen}
        entries={entries}
        onClose={() => setAskOpen(false)}
        onFiled={() => void load()}
      />
    </>
  )
}

/**
 * Totals come from `counts`, never from the rows on hand: the tab says how many
 * exist, not how many this page has fetched so far.
 */
function countFor(tab: HistoryTab, data: HistoryResponse): number {
  if (tab === 'all') return data.counts.all
  if (tab === 'check-ins') return data.counts.checkIns
  if (tab === 'reflections') return data.counts.reflections
  return data.counts.supportRequests
}

function Group({ title, entries }: { title: string; entries: HistoryEntry[] }) {
  return (
    <section aria-labelledby={`group-${title}`}>
      <h2 id={`group-${title}`} className="text-chip font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {entries.map((entry) => <HistoryRow key={entry.checkInId} entry={entry} />)}
      </ul>
    </section>
  )
}

/**
 * Support requests are listed from the student's own rows, fetched by student
 * rather than reached through the check-in link. Most requests have no link —
 * the escalation path files one against the conversation — so the old rendering
 * (entries that happened to carry a request) hid exactly the requests a student
 * was most likely to ask about.
 */
function RequestGroup({ requests, total }: { requests: HistorySupportRequest[]; total: number }) {
  return (
    <section aria-labelledby="group-requests">
      <h2 id="group-requests" className="text-chip font-semibold uppercase tracking-wide text-muted">
        Requests you sent
      </h2>
      {total > requests.length && (
        <p className="mt-2 text-caption text-muted">
          Showing the {requests.length} most recent of {total}.
        </p>
      )}
      <ul className="mt-4 flex flex-col gap-3">
        {requests.map((request) => {
          const date = rowDate(request.createdAt)
          const stage = requestStage(request)
          return (
            <li key={request.id}>
              <div className="flex items-start gap-4 rounded-card border border-hairline bg-white p-5">
                <span className="flex w-12 shrink-0 flex-col items-center rounded-panel bg-panel py-2" aria-hidden="true">
                  <span className="text-card font-bold text-heading">{date.day}</span>
                  <span className="text-caption text-muted">{date.month}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-card text-heading">
                    {request.urgency === 'URGENT' ? 'You asked for help right away' : 'You asked for support'}
                  </span>
                  <span className="mt-1.5 block text-copy-sm text-muted">{stage.detail}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-pill bg-panel px-3 py-1 text-chip text-brand-4">
                      <HeartHandshake aria-hidden="true" className="size-3.5" />
                      {stage.label}
                    </span>
                    {request.checkInId && (
                      <Link
                        to="/history/$checkInId"
                        params={{ checkInId: request.checkInId }}
                        className="text-chip text-brand-4 hover:underline"
                      >
                        From a check-in
                      </Link>
                    )}
                  </span>
                  <span className="sr-only">{date.full}</span>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function NoRequests() {
  return (
    <section className="rounded-card border border-hairline bg-white p-8">
      <h2 className="text-title-sm text-heading">No support requests yet</h2>
      <p className="mt-3 max-w-[620px] text-copy-sm text-body">
        If you ask a person at your school for support, that request appears here with what happened to it. The
        school’s review notes are never shown on this page.
      </p>
    </section>
  )
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const date = rowDate(entry.createdAt)
  const lane = reflectionLane(entry)
  return (
    <li>
      <Link
        to="/history/$checkInId"
        params={{ checkInId: entry.checkInId }}
        className="flex items-start gap-4 rounded-card border border-hairline bg-white p-5 transition-colors hover:border-brand-4/40"
      >
        <span className="flex w-12 shrink-0 flex-col items-center rounded-panel bg-panel py-2" aria-hidden="true">
          <span className="text-card font-bold text-heading">{date.day}</span>
          <span className="text-caption text-muted">{date.month}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-card text-heading">Feeling {feelingTitle(entry.feeling)}</span>
          {/* No resource count: nothing in the data ties a resource to a check-in, so
              this row states only what is stored. */}
          <span className="mt-1.5 block text-copy-sm text-muted">
            Check-in{lane ? ` · ${lane}` : ' only'}
            {entry.reflection && entry.reflection.turnCount > 1 ? ` · ${entry.reflection.turnCount} turns` : ''}
          </span>
          {entry.supportRequest && (
            <span className="mt-2 inline-flex items-center gap-2 rounded-pill bg-panel px-3 py-1 text-chip text-brand-4">
              Support request · {requestStage(entry.supportRequest).label}
            </span>
          )}
          <span className="sr-only">{date.full}</span>
        </span>
        <BookOpenText className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
      </Link>
    </li>
  )
}

function EmptyState() {
  return (
    <section className="rounded-card border border-hairline bg-white p-8">
      <h2 className="text-title-sm text-heading">No history yet</h2>
      <p className="mt-3 max-w-[620px] text-copy-sm text-body">{HISTORY_EMPTY}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/check-in" className="inline-flex min-h-11 items-center rounded-pill bg-brand-4 px-6 text-button-sm font-semibold text-white hover:bg-brand-5">
          Start a check-in
        </Link>
        <Link to="/history/about" className="inline-flex min-h-11 items-center rounded-pill bg-panel px-6 text-button-sm text-brand-4 hover:bg-brand-11">
          How your history is kept
        </Link>
      </div>
    </section>
  )
}
