// The staff "Support indicators" review queue (Doc A US-D02, US-D05, US-D10,
// US-D12): level chips whose numbers are the rows they return, filters for the
// alert tier and the workflow state, and a detail dialog that keeps four kinds of
// content apart — what the student said, the system record, the AI summary and the
// reviewer's own decision.
//
// Deliberate absences: no threshold, count or confidence figure anywhere (none is
// approved); no colour ladder from A to U (Level U is unclear evidence, not a
// milder Level A); no "close" or "resolve" action (nothing here may close a
// record); and indicator counts never merged with support-request counts.

import { useEffect, useState, type ReactNode } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { CircleAlert, Inbox, LockKeyhole, ShieldCheck, TriangleAlert } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { SupportSurfaceTabs } from '#/components/dash/SupportSurfaceTabs'
import { Button, Dialog, EmptyState, ErrorNote, Skeleton } from '#/components/dash/ui'
import { ApiError } from '#/lib/api'
import { REVIEWER_ROLES } from '#/lib/ai-response-reports'
import { homeForRole, roleLabel, type SessionUser } from '#/lib/auth'
import { formatDateTime, useApiQuery, useRoleAccess } from '#/lib/dash'
import {
  LEVEL_CHIPS,
  REVIEW_DECISION_LABELS,
  acknowledgeIndicator,
  enumLabel,
  fetchIndicatorFlag,
  fetchIndicatorFlags,
  levelCountFor,
  markIndicatorInReview,
  recordIndicatorDecision,
  type FlagSeverity,
  type FlagStatus,
  type IndicatorFlagRow,
  type LevelFilter,
  type LinkedRequestRef,
  type ReviewDecision,
} from '#/lib/indicators'

export const Route = createFileRoute('/_dash/school/indicators/')({
  validateSearch: (search: Record<string, unknown>): { flagId?: string } =>
    typeof search.flagId === 'string' && search.flagId ? { flagId: search.flagId } : {},
  head: () => ({ meta: [{ title: 'Support indicators · Soul Nurture AI' }] }),
  component: SupportIndicatorsPage,
})

const SEVERITIES: FlagSeverity[] = ['TIER_1_MODERATE', 'TIER_2_HIGH', 'TIER_3_ACUTE']
const STATUSES: FlagStatus[] = ['OPEN', 'IN_REVIEW', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED']
/** Mirrors the backend `take` on GET /support-flags: a page, not the backlog. */
const LIST_LIMIT = 50

/** What POST /:id/review-decision answers with, kept for the confirmation view. */
interface RecordedReview {
  decision: ReviewDecision
  recordedAt: string
  status: FlagStatus
}

function SupportIndicatorsPage() {
  const access = useRoleAccess(REVIEWER_ROLES)
  const [level, setLevel] = useState<LevelFilter | 'ALL'>('ALL')
  const [severity, setSeverity] = useState<FlagSeverity | ''>('')
  const [status, setStatus] = useState<FlagStatus | ''>('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { flagId } = Route.useSearch()
  const navigate = Route.useNavigate()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  if (access.denied) return <RoleDenied user={access.user} />
  if (!access.permitted || !access.user) return null

  const user = access.user
  const schoolName = user.school?.name ?? 'your school'
  const filtered =
    level !== 'ALL' || severity !== '' || status !== '' || debouncedSearch.trim() !== ''

  return (
    <>
      <DashHeader
        title="Support indicators"
        subtitle={`Prompts raised for human review at ${schoolName}. Each one is a suggestion to look, not a diagnosis or a decision.`}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by Student ID/email',
        }}
      />
      <SupportSurfaceTabs active="/school/indicators" />
      <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col gap-6 px-6 py-8 lg:px-10 lg:py-10">
        <IndicatorList
          level={level}
          severity={severity}
          status={status}
          search={debouncedSearch}
          filtered={filtered}
          onLevelChange={setLevel}
          onSeverityChange={setSeverity}
          onStatusChange={setStatus}
          onClearFilters={() => {
            setLevel('ALL')
            setSeverity('')
            setStatus('')
            setSearch('')
          }}
          schoolName={schoolName}
          flagId={flagId}
          onSelect={(id) => void navigate({ search: id ? { flagId: id } : {}, replace: true })}
        />
        <Link
          to="/school/indicators/guide"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-pill border border-hairline bg-white px-5 text-chip text-action transition-colors hover:bg-panel"
        >
          How support indicators work
        </Link>
      </main>
    </>
  )
}

/**
 * ab05: the answer a signed-in professional gets when this queue is not theirs.
 * Redirecting them elsewhere left three possible readings — a broken page, an
 * empty school, or a permission they did not have — and only one of them is
 * true. The copy names the roles this screen serves, and says nothing about
 * whether that split is right; D2 is still an open decision, not policy.
 */
function RoleDenied({ user }: { user: SessionUser | null }) {
  const navigate = useNavigate()

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col items-center gap-6 px-6 py-14 lg:px-10">
      <section
        aria-labelledby="indicator-role-denied"
        className="flex w-full flex-col items-center gap-5 rounded-panel border border-hairline bg-white px-6 py-9 text-center sm:px-10"
      >
        <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-panel text-action">
          <LockKeyhole className="size-7" />
        </span>
        <div>
          <h1 id="indicator-role-denied" className="text-title-sm text-heading sm:text-title">
            Indicators aren’t available for this role
          </h1>
          <p className="mt-4 text-copy text-body">
            Only counsellor and psychologist accounts see the support indicator queue. Your
            account is signed in as {roleLabel(user?.role)}, so no indicator is listed here.
            Nothing is broken, and nothing was taken from you by mistake — this screen is simply
            not part of your role.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => void navigate({ to: homeForRole(user), replace: true })}
          >
            Go to my dashboard
          </Button>
          <Button variant="ghost" className="min-h-11 flex-1 sm:flex-none" onClick={() => void navigate({ to: '/' })}>
            Back to home
          </Button>
        </div>
        <p className="flex w-full items-start gap-3 rounded-card bg-panel px-4 py-3 text-left text-copy-sm text-body">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-action" />
          <span>Think you should have access? Ask your school administrator.</span>
        </p>
      </section>
      <p className="text-caption text-muted">
        Students who ask for help themselves appear on Support requests, which is a separate
        record and a separate screen. Concerned about a student’s immediate safety? Follow your
        school’s safeguarding procedures — Soul Nurture AI is not an emergency service.
      </p>
    </main>
  )
}

function IndicatorList({
  level,
  severity,
  status,
  search,
  filtered,
  onLevelChange,
  onSeverityChange,
  onStatusChange,
  onClearFilters,
  schoolName,
  flagId,
  onSelect,
}: {
  level: LevelFilter | 'ALL'
  severity: FlagSeverity | ''
  status: FlagStatus | ''
  search: string
  filtered: boolean
  onLevelChange: (next: LevelFilter | 'ALL') => void
  onSeverityChange: (next: FlagSeverity | '') => void
  onStatusChange: (next: FlagStatus | '') => void
  onClearFilters: () => void
  schoolName: string
  flagId?: string
  onSelect: (id: string | null) => void
}) {
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const trimmedSearch = search.trim()
  const list = useApiQuery(
    () =>
      fetchIndicatorFlags({
        level: level === 'ALL' ? undefined : level,
        severity: severity || undefined,
        status: status || undefined,
        q: trimmedSearch || undefined,
      }),
    [level, severity, status, trimmedSearch],
  )

  const counts = list.data?.levelCounts
  const items = list.data?.items ?? []

  return (
    <>
      {confirmation && (
        <p role="status" className="text-copy-sm text-action">
          {confirmation}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Open for review"
          value={list.data?.openCount}
          hint="School-wide status Open, whatever filters are applied here"
        />
        <StatTile
          label="Listed here"
          value={counts ? items.length : undefined}
          hint={`The list shows the ${LIST_LIMIT} newest rows. The level chips count everything under these filters, so a chip can read higher.`}
        />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by indicator level">
        {LEVEL_CHIPS.map((chip) => {
          const active = level === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={active}
              onClick={() => onLevelChange(chip.value)}
              className={`h-10 whitespace-nowrap rounded-pill border px-4 text-chip transition-colors ${
                active
                  ? 'border-action bg-action font-semibold text-white'
                  : 'border-hairline bg-white text-body hover:border-muted'
              }`}
            >
              {chip.label} ({counts ? levelCountFor(counts, chip.value) : 0})
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <FilterSelect
          label="Alert tier"
          value={severity}
          onChange={(next) => onSeverityChange(next as FlagSeverity | '')}
          options={SEVERITIES.map((value) => ({ value, label: enumLabel(value) }))}
        />
        <FilterSelect
          label="Workflow status"
          value={status}
          onChange={(next) => onStatusChange(next as FlagStatus | '')}
          options={STATUSES.map((value) => ({ value, label: enumLabel(value) }))}
        />
        {filtered && (
          <Button
            variant="ghost"
            className="h-10 px-4"
            onClick={() => {
              onClearFilters()
              setConfirmation(null)
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <p className="text-caption text-muted">
        Each level number is exactly the set that chip filters, within the tier, status and
        search filters; the list itself returns the {LIST_LIMIT} newest. A search matches the
        student code or email a reviewer already has, and narrows the chip counts with it — an
        “Open for review” tile above does not, because that one is a school-wide fact.
        “Unclassified” is a real bucket — a flag nothing has graded, not a mild one. Level U
        means the evidence is unclear or conflicting; it is never a softer shade of Level A. A
        level that names the condition that fired sits on its own axis; a level that had no
        condition to name was read off the alert tier, and the indicator says which of the two it
        is. What reached a colleague about an indicator was always its alert tier, a separate
        field. Indicator counts say nothing about support requests, which are
        separate records on their own page: “Linked request” only means a request the student
        sent shares this indicator’s conversation. It has its own status, and the link makes an
        indicator into neither a request nor a decision.
      </p>

      {list.error && (
        <div className="flex flex-col items-start gap-3">
          <ErrorNote>
            {list.error.message}
            {list.data ? ' Showing the last loaded indicators.' : ''}
          </ErrorNote>
          <Button variant="ghost" onClick={list.reload} disabled={list.loading}>
            Try again
          </Button>
        </div>
      )}

      {list.loading && !list.data ? (
        <TableSkeleton />
      ) : list.data ? (
        items.length === 0 ? (
          trimmedSearch ? (
            <EmptyState
              icon={Inbox}
              title={`No indicator matches “${trimmedSearch}”`}
              body="Search looks at the student code and the address on their account, inside your school only. Nothing here is hidden from you because of another filter — a name typed by mistake simply has no rows behind it."
              action={
                <Button
                  variant="ghost"
                  onClick={() => {
                    onClearFilters()
                  }}
                >
                  Clear search and filters
                </Button>
              }
            />
          ) : filtered ? (
            <EmptyState
              icon={Inbox}
              title="No indicators match these filters"
              body="This school has indicators outside this combination. Clearing the filters brings them back."
              action={
                <Button variant="ghost" onClick={onClearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title={`No indicators have been raised for ${schoolName}`}
              body="An empty list is not evidence that students are safe. It means nothing has been routed here for review yet. Students who ask for help themselves appear on Support requests, a separate record."
              action={
                <Link
                  to="/school/requests"
                  className="inline-flex h-11 items-center rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4"
                >
                  Go to support requests
                </Link>
              }
            />
          )
        ) : (
          <FlagsTable items={items} onSelect={(item) => onSelect(item.id)} />
        )
      ) : null}

      {flagId && (
        <FlagDetail
          id={flagId}
          listRow={items.find((item) => item.id === flagId) ?? null}
          onClose={() => onSelect(null)}
          onChanged={(message) => {
            setConfirmation(message)
            list.reload()
          }}
        />
      )}

      <p className="flex items-start gap-2 text-caption text-muted">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Nothing on this page is a diagnosis, a risk score or an automatic decision. You only
        see indicators your school is entitled to. Concerned about a student’s immediate
        safety? Follow your school’s safeguarding procedures — this system is not an emergency
        service.
      </p>
    </>
  )
}

/** One row, two shapes: stacked below md, aligned columns at md and above. */
function FlagsTable({
  items,
  onSelect,
}: {
  items: IndicatorFlagRow[]
  onSelect: (item: IndicatorFlagRow) => void
}) {
  return (
    <div className="overflow-hidden rounded-panel border border-hairline bg-white">
      <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.75fr)_minmax(0,0.9fr)] items-center gap-4 bg-panel px-6 py-3 text-chip font-medium text-body md:grid">
        <span>Student</span>
        <span>Level</span>
        <span>Raised by</span>
        <span>Decision</span>
        <span>Linked request</span>
        <span>Raised</span>
      </div>
      <ul className="flex flex-col divide-y divide-hairline">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-panel-2/50 md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,0.95fr)_minmax(0,0.9fr)_minmax(0,0.75fr)_minmax(0,0.9fr)] md:gap-4 md:px-6"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1 md:flex-none">
                <span className="block truncate text-card text-heading">{item.studentRef}</span>
                <span className="block truncate text-caption text-muted">
                  {[item.classLabel, item.triggerLabel].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2 md:contents">
                <LevelBadge level={item.level} />
              </span>
              <span className="min-w-0 text-copy-sm text-body md:truncate">
                {enumLabel(item.source)}
                {item.status !== 'OPEN' && (
                  <span className="ml-2 text-caption text-muted">{enumLabel(item.status)}</span>
                )}
              </span>
              <span className="min-w-0 text-copy-sm md:truncate">
                {item.reviewDecision ? (
                  <span className="text-heading">{REVIEW_DECISION_LABELS[item.reviewDecision]}</span>
                ) : (
                  <span className="text-muted">Not recorded</span>
                )}
              </span>
              {/* Hidden below md: this column is a reference to another record, and
                  the detail dialog carries it with the conversation behind it. A link
                  here would put a link inside the row button. "None linked" is a fact
                  about the request table only — the student may still have spoken. */}
              <span className="hidden min-w-0 text-copy-sm md:block md:truncate">
                {item.linkedRequest ? (
                  <span className="text-heading">Linked request</span>
                ) : (
                  <span className="text-muted">None linked</span>
                )}
              </span>
              <time dateTime={item.createdAt} className="text-caption text-muted">
                {formatDateTime(item.createdAt)}
              </time>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Every level wears the same neutral chip: the letter is a catalogue position,
 * not a colour of risk, so U can never read as "mild". */
function LevelBadge({ level }: { level: IndicatorFlagRow['level'] }) {
  if (!level) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-pill border border-dashed border-hairline px-3 py-1 text-chip text-muted">
        Unclassified
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-hairline bg-panel-2 px-3 py-1 text-chip font-medium text-heading">
      {level === 'U' && (
        <TriangleAlert aria-hidden="true" className="size-3 shrink-0 text-peach-ink" />
      )}
      Level {level}
    </span>
  )
}

function FlagDetail({
  id,
  listRow,
  onClose,
  onChanged,
}: {
  id: string
  listRow: IndicatorFlagRow | null
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const detail = useApiQuery(() => fetchIndicatorFlag(id), [id])
  const [picked, setPicked] = useState<ReviewDecision | ''>('')
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [justRecorded, setJustRecorded] = useState<RecordedReview | null>(null)

  if (detail.error && !detail.data) {
    return (
      <Dialog open onClose={onClose} title="Indicator" icon={ShieldCheck}>
        <ErrorNote>
          {detail.error.status === 404
            ? 'That indicator is not available to you. It may belong to another school, or it may never have existed.'
            : detail.error.message}
        </ErrorNote>
      </Dialog>
    )
  }

  if (!detail.data) {
    return (
      <Dialog open onClose={onClose} title="Indicator" icon={ShieldCheck}>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Dialog>
    )
  }

  const { studentReported, systemMetadata, aiSummary, humanDecision, student } = detail.data
  const recorded = humanDecision.reviewDecision
  const chosen = picked === '' ? recorded : picked

  const run = async (kind: 'decision' | 'acknowledge' | 'in-review') => {
    setSaving(kind)
    setError(null)
    try {
      if (kind === 'decision') {
        if (!chosen) return
        const result = await recordIndicatorDecision(id, chosen)
        setJustRecorded({
          decision: result.decision,
          recordedAt: result.recordedAt,
          status: result.status,
        })
        onChanged('Your decision is recorded. The workflow status did not change.')
      } else {
        const result =
          kind === 'acknowledge'
            ? await acknowledgeIndicator(id)
            : await markIndicatorInReview(id)
        onChanged(result.message)
      }
      setPicked('')
      detail.reload()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save this review.')
    } finally {
      setSaving(null)
    }
  }

  if (justRecorded) {
    return (
      <ReviewRecorded
        studentRef={student.ref}
        record={justRecorded}
        conversationId={systemMetadata.conversationId}
        linkedRequest={systemMetadata.linkedRequest}
        onBack={() => {
          setJustRecorded(null)
          detail.reload()
        }}
        onClose={onClose}
      />
    )
  }

  return (
    <Dialog
      open
      onClose={() => {
        if (saving === null) onClose()
      }}
      title={`Indicator · ${student.ref}`}
      icon={ShieldCheck}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving !== null}>
            Close
          </Button>
          <Button
            onClick={() => void run('decision')}
            disabled={chosen === null || chosen === recorded || saving !== null}
          >
            {saving === 'decision' ? 'Recording…' : 'Record decision'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {listRow && (
          <p className="text-caption text-muted">
            {listRow.studentRef}
            {listRow.classLabel ? ` · ${listRow.classLabel}` : ''} · raised{' '}
            {formatDateTime(listRow.createdAt)}
          </p>
        )}

        <Section
          title="What the student said"
          note="Recorded when the prompt was raised. Later messages do not rewrite it."
        >
          {studentReported.statement ? (
            <blockquote className="whitespace-pre-wrap break-words rounded-card bg-panel-2/60 px-4 py-3 text-copy-sm text-heading">
              {studentReported.statement}
            </blockquote>
          ) : (
            <p className="text-copy-sm text-muted">
              No student statement was recorded for this indicator. The prompt came from{' '}
              {enumLabel(systemMetadata.source).toLowerCase()}, so read the linked
              conversation rather than assuming nothing was said.
            </p>
          )}
          <p className="mt-2 text-caption text-muted">
            Trigger as recorded: {studentReported.triggerLabel}
          </p>
        </Section>

        <Section
          title="System record"
          note="Machine facts, kept apart from the student’s own words."
        >
          <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-copy-sm">
            <Term value="Indicator ID" detail={systemMetadata.id} />
            <Term
              value="Level"
              detail={systemMetadata.level ? `Level ${systemMetadata.level}` : 'Unclassified'}
            />
            <Term value="Alert tier" detail={enumLabel(systemMetadata.severity)} />
            <Term value="Status" detail={enumLabel(systemMetadata.status)} />
            <Term value="Source" detail={enumLabel(systemMetadata.source)} />
            {systemMetadata.category && (
              <Term value="Category" detail={systemMetadata.category} />
            )}
            <Term value="Raised" detail={formatDateTime(systemMetadata.createdAt)} />
            {systemMetadata.resolvedAt && (
              <Term value="Resolved" detail={formatDateTime(systemMetadata.resolvedAt)} />
            )}
          </dl>
          {/* A linked record, never a merged one: an indicator, the request it
              relates to and any case file keep three separate histories. */}
          {systemMetadata.conversationId ? (
            <Link
              to="/school/requests/$conversationId"
              params={{ conversationId: systemMetadata.conversationId }}
              // PE-05 (owner): not rendered — the alert shows a snippet, so the
              // indicator surface stops there. Same treatment as the dashboard card.
              style={{ display: 'none' }}
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-chip font-medium text-action transition-colors hover:text-brand-4"
            >
              Open the conversation this indicator came from
            </Link>
          ) : (
            <p className="mt-3 text-caption text-muted">
              No conversation is linked to this indicator. That is not the same as no student
              having spoken — check Support requests, which is a separate record.
            </p>
          )}

          <div className="mt-3 rounded-card border border-hairline px-4 py-3">
            <p className="text-chip font-medium text-heading">
              Rule: {systemMetadata.ruleId ?? 'No rule recorded'}
              {systemMetadata.ruleVersion ? ` · v${systemMetadata.ruleVersion}` : ''}
            </p>
            {systemMetadata.ruleLabel && (
              <p className="mt-1 text-copy-sm text-body">“{systemMetadata.ruleLabel}”</p>
            )}
            {/* A level on this screen has to name what produced it. No indicator
                rule is switched on, so an automatic level came either from the
                condition that fired or from the AI's own alert tier, and the two
                are different claims about a student. */}
            {systemMetadata.levelSource === 'INTENT_MAPPING' && (
              <p className="mt-2 text-caption text-muted">
                Level {systemMetadata.level} came from the condition-to-level mapping
                {systemMetadata.levelSourceVersion
                  ? ` (${systemMetadata.levelSourceVersion})`
                  : ''}, which no reviewer has signed yet.
              </p>
            )}
            {systemMetadata.levelSource === 'AI_TIER' && (
              <p className="mt-2 flex items-start gap-2 text-caption text-peach-ink">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Level {systemMetadata.level} was read off the alert tier (
                {systemMetadata.severity}), because no condition in the mapping
                covered this flag. It says how urgent the model thought the message
                was — not what the student disclosed, and no reviewer has signed it.
              </p>
            )}
            {systemMetadata.ruleConfigured === false ? (
              <p className="mt-2 flex items-start gap-2 text-caption text-peach-ink">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                This rule is not switched on. {systemMetadata.ruleBlockedOn ?? ''}
              </p>
            ) : systemMetadata.levelSource ? null : (
              <p className="mt-2 text-caption text-muted">
                No rule configuration is shown for this indicator.
              </p>
            )}
          </div>
        </Section>

        <Section
          title="AI summary"
          note="A machine’s paraphrase of earlier context. Not evidence, and not the student’s words."
        >
          {aiSummary ? (
            <p className="whitespace-pre-wrap break-words text-copy-sm text-body">{aiSummary}</p>
          ) : (
            <p className="text-copy-sm text-muted">
              No AI summary was generated for this indicator.
            </p>
          )}
        </Section>

        <Section
          title="Your decision"
          note="Recording a decision does not change the workflow status, and no action here closes this record."
        >
          <fieldset className="flex flex-col gap-2" disabled={saving !== null}>
            <legend className="sr-only">Reviewer decision</legend>
            {humanDecision.decisions.map((value) => (
              <label key={value} className="flex items-start gap-2 text-copy-sm text-body">
                <input
                  type="radio"
                  name="review-decision"
                  value={value}
                  checked={chosen === value}
                  onChange={() => setPicked(value)}
                  className="mt-1"
                />
                <span>
                  {REVIEW_DECISION_LABELS[value]}
                  {recorded === value && (
                    <span className="ml-2 text-caption text-muted">
                      {picked === '' ? 'recorded' : 'was recorded'}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>

          <p className="mt-3 text-caption text-muted">
            {chosen === null
              ? 'No decision is recorded. Choose one to record it.'
              : chosen === recorded
                ? 'Nothing has changed yet — recording stays off until you pick something else.'
                : `Records as “${REVIEW_DECISION_LABELS[chosen]}”.`}
            {chosen === 'FOLLOW_SAFEGUARDING_PROCEDURE' && systemMetadata.status === 'OPEN'
              ? ' The status stays Open until you advance it — use “Mark in review” if you have started.'
              : ''}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" disabled={saving !== null} onClick={() => void run('acknowledge')}>
              {saving === 'acknowledge' ? 'Saving…' : 'Acknowledge'}
            </Button>
            <Button variant="ghost" disabled={saving !== null} onClick={() => void run('in-review')}>
              {saving === 'in-review' ? 'Saving…' : 'Mark in review'}
            </Button>
          </div>
          <p className="text-caption text-muted">
            These two change the workflow status only. Your decision above is stored separately.
          </p>

          {error && <ErrorNote className="mt-3">{error}</ErrorNote>}
        </Section>
      </div>
    </Dialog>
  )
}

/**
 * ab06: the confirmation a reviewer gets after recording a decision, and the
 * three things that are (and are not) now true. It repeats the server's own
 * write time and status rather than a local guess, because the design's promise
 * — "nothing happens automatically" — is only reassuring if the status shown is
 * the real one. A review note is deliberately absent: nothing stores one yet.
 */
function ReviewRecorded({
  studentRef,
  record,
  conversationId,
  linkedRequest,
  onBack,
  onClose,
}: {
  studentRef: string
  record: RecordedReview
  conversationId: string | null
  linkedRequest: LinkedRequestRef | null
  onBack: () => void
  onClose: () => void
}) {
  const navigate = useNavigate()

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Review recorded · ${studentRef}`}
      icon={ShieldCheck}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            Back to this indicator
          </Button>
          <Button
            onClick={() => {
              onClose()
              void navigate({
                to: '/school/requests',
                search: linkedRequest ? { requestId: linkedRequest.id } : {},
              })
            }}
          >
            {linkedRequest ? 'Open the linked request' : 'Go to support requests'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p role="status" className="text-copy-sm text-heading">
          Your decision is saved against this indicator. Nothing was sent to the student, and
          the workflow status is still {enumLabel(record.status)} — a decision is not a
          transition.
        </p>

        <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-copy-sm">
          <Term value="Your decision" detail={REVIEW_DECISION_LABELS[record.decision]} />
          <Term value="Recorded" detail={formatDateTime(record.recordedAt)} />
          <Term value="Workflow status" detail={enumLabel(record.status)} />
          <Term value="Linked request" detail={linkedRequest ? enumLabel(linkedRequest.status) : 'None found'} />
        </dl>

        <div className="flex flex-col gap-3">
          <h3 className="text-chip font-semibold text-heading">What happens next</h3>
          {NEXT_STEPS.map((step) => (
            <section key={step.title} className="rounded-card border border-hairline px-4 py-3">
              <p className="text-chip font-medium text-heading">{step.title}</p>
              <p className="mt-1 text-copy-sm text-body">{step.body}</p>
            </section>
          ))}
        </div>

        {conversationId && (
          <Link
            to="/school/requests/$conversationId"
            params={{ conversationId }}
            onClick={onClose}
            // PE-05 (owner): not rendered — see the indicator detail card.
            style={{ display: 'none' }}
            className="inline-flex min-h-11 items-center gap-2 text-chip font-medium text-action transition-colors hover:text-brand-4"
          >
            Open the conversation this indicator came from
          </Link>
        )}

        <p className="text-caption text-muted">
          Concerns that cannot wait should follow your school’s emergency procedure. Soul
          Nurture AI is not an emergency service.
        </p>
      </div>
    </Dialog>
  )
}

const NEXT_STEPS = [
  {
    title: 'Your decision is on record',
    body: 'It is stored against this indicator and written to the audit trail with your name and the time. That is all this button did.',
  },
  {
    title: 'Update the support request, if there is one',
    body: 'A request the student sent is a separate record with its own follow-up status. Set that on the support requests screen — doing it here would not change it.',
  },
  {
    title: 'No automatic action',
    body: 'The system does not contact the student, raise a safeguarding report, or decide their care. You decide next steps using your school’s safeguarding procedures.',
  },
]

function Section({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-hairline px-4 py-4">
      <h3 className="text-chip font-semibold text-heading">{title}</h3>
      <p className="text-caption text-muted">{note}</p>
      {children}
    </section>
  )
}

function Term({ value, detail }: { value: string; detail: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{value}</dt>
      <dd className="break-words text-heading">{detail}</dd>
    </>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-chip text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-pill border border-hairline bg-white px-3 text-chip text-heading outline-none transition-colors focus:border-brand-4"
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: number | undefined
  hint: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-panel border border-hairline bg-white p-5">
      <span className="text-chip text-muted">{label}</span>
      {value === undefined ? (
        <Skeleton className="h-10 w-16" />
      ) : (
        <span className="text-title-lg tabular-nums text-heading">{value}</span>
      )}
      <span className="text-caption text-muted">{hint}</span>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((key) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-panel border border-hairline bg-white px-6 py-4"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-6 w-20 rounded-pill" />
        </div>
      ))}
    </div>
  )
}
