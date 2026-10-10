import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download, TrendingUp, Users } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { ProgressBar, Sparkline } from '#/components/dash/charts'
import { PanelCard } from '#/components/dash/panels'
import {
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Segmented,
  SelectField,
  Skeleton,
  StatCard,
  Tag,
  TextField,
} from '#/components/dash/ui'
import { ApiError } from '#/lib/api'
import { fetchSchools } from '#/lib/admin'
import { formatDateTime, formatNumber, useApiQuery, useRoleGuard } from '#/lib/dash'
import {
  downloadPilotReport,
  fetchPilotAnalytics,
  pilotReportFilename,
  type PilotAnalytics,
  type PilotQuery,
} from '#/lib/pilot'

export const Route = createFileRoute('/_dash/admin/pilot')({
  head: () => ({ meta: [{ title: 'Pilot analytics · Soul Nurture AI' }] }),
  component: PilotAnalyticsPage,
})

/* ── Window presets ─────────────────────────────────────────────────────── */

type PilotRangeId = 'today' | '7d' | '30d' | 'pilot' | 'custom'

const RANGE_OPTIONS: readonly { value: PilotRangeId; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'pilot', label: 'Pilot period' },
  { value: 'custom', label: 'Custom' },
]

const RANGE_DAYS: Record<Exclude<PilotRangeId, 'custom'>, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  pilot: 366,
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function defaultCustomRange(): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000)
  return { from: isoDay(from), to: isoDay(to) }
}

/* ── Tabs ───────────────────────────────────────────────────────────────── */

type PilotTab =
  | 'overview'
  | 'engagement'
  | 'wellbeing'
  | 'resources'
  | 'support'
  | 'outcomes'
  | 'reports'

const TABS: readonly { id: PilotTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'wellbeing', label: 'Wellbeing trends' },
  { id: 'resources', label: 'Resources' },
  { id: 'support', label: 'Support & safeguarding' },
  { id: 'outcomes', label: 'Pilot outcomes' },
  { id: 'reports', label: 'Reports' },
]

/* ── Formatting helpers ─────────────────────────────────────────────────── */

const dayFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function dayLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dayFormatter.format(date)
}

/** 'IN_PROGRESS' → 'In progress'; 'TIER_1_MODERATE' → 'Tier 1 moderate'. */
function labelize(value: string): string {
  const words = value.toLowerCase().split('_')
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ')
}

function numberOrDash(value: number | null): string {
  return value === null ? '—' : formatNumber(value)
}

function percentOrDash(value: number | null): string {
  return value === null ? '—' : `${value}%`
}

/** Counts of 1–4 distinct students come back masked as null + suppressed. */
function StudentsCell({
  students,
  suppressed,
}: {
  students: number | null
  suppressed: boolean
}) {
  if (suppressed) return <Tag>Suppressed</Tag>
  return <span className="tabular-nums">{formatNumber(students ?? 0)}</span>
}

/* ── Page ───────────────────────────────────────────────────────────────── */

function PilotAnalyticsPage() {
  const user = useRoleGuard(['PLATFORM_ADMIN'])
  const [range, setRange] = useState<PilotRangeId>('30d')
  const [custom, setCustom] = useState(defaultCustomRange)
  const [schoolId, setSchoolId] = useState('')
  const [tab, setTab] = useState<PilotTab>('overview')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const query = useMemo<PilotQuery>(() => {
    const window =
      range === 'custom'
        ? { from: custom.from, to: custom.to }
        : { days: RANGE_DAYS[range] }
    return schoolId ? { ...window, schoolId } : window
  }, [range, custom, schoolId])

  const analytics = useApiQuery(() => fetchPilotAnalytics(query), [query])
  const schools = useApiQuery(() => fetchSchools(), [])

  if (!user) return null

  const data = analytics.data
  const schoolOptions = [
    { value: '', label: 'All schools' },
    ...(schools.data?.items ?? []).map((school) => ({
      value: school.id,
      label: school.name,
    })),
  ]

  const onDownload = async () => {
    if (!data || downloading) return
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadPilotReport(query, pilotReportFilename(data))
    } catch (caught) {
      setDownloadError(
        caught instanceof ApiError
          ? caught.message
          : 'The report could not be downloaded. Please try again.',
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <DashHeader
        title="Pilot analytics"
        subtitle="How the pilot is performing across schools — always aggregate, never individual students"
        actions={
          <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
        }
      />
      <main className="flex flex-1 flex-col gap-5 p-6 lg:p-8">
        {analytics.error && <ErrorNote>{analytics.error.message}</ErrorNote>}

        <Card className="flex flex-wrap items-end gap-4">
          <SelectField
            label="School"
            value={schoolId}
            onChange={setSchoolId}
            options={schoolOptions}
            className="w-full sm:w-64"
          />
          {range === 'custom' && (
            <>
              <TextField
                label="From"
                type="date"
                value={custom.from}
                max={custom.to}
                onChange={(event) => {
                  const value = event.target.value
                  setCustom((current) => ({
                    from: value,
                    to: value && value > current.to ? value : current.to,
                  }))
                }}
                className="w-full sm:w-44"
              />
              <TextField
                label="To"
                type="date"
                value={custom.to}
                min={custom.from}
                onChange={(event) => {
                  const value = event.target.value
                  setCustom((current) => ({
                    to: value,
                    from: value && value < current.from ? value : current.from,
                  }))
                }}
                className="w-full sm:w-44"
              />
            </>
          )}
          {data && (
            <p className="ml-auto pb-2 text-caption text-muted">
              {dayLabel(data.window.from)} – {dayLabel(data.window.to)} ·{' '}
              {data.window.days} day{data.window.days === 1 ? '' : 's'}
              {data.school ? ` · ${data.school.name}` : ''}
            </p>
          )}
        </Card>

        <div
          role="tablist"
          aria-label="Pilot analytics sections"
          className="flex flex-wrap gap-1 border-b border-hairline"
        >
          {TABS.map((entry) => {
            const active = entry.id === tab
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(entry.id)}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-copy-sm transition-colors ${
                  active
                    ? 'border-action font-semibold text-heading'
                    : 'border-transparent text-muted hover:text-heading'
                }`}
              >
                {entry.label}
              </button>
            )
          })}
        </div>

        {!data && analytics.loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : !data ? null : (
          <>
            {tab === 'overview' && <OverviewTab data={data} />}
            {tab === 'engagement' && <EngagementTab data={data} />}
            {tab === 'wellbeing' && <WellbeingTab data={data} />}
            {tab === 'resources' && <ResourcesTab data={data} />}
            {tab === 'support' && <SupportTab data={data} />}
            {tab === 'outcomes' && <OutcomesTab data={data} />}
            {tab === 'reports' && (
              <ReportsTab
                data={data}
                downloading={downloading}
                error={downloadError}
                onDownload={() => void onDownload()}
              />
            )}
          </>
        )}
      </main>
    </>
  )
}

/* ── Overview ───────────────────────────────────────────────────────────── */

function OverviewTab({ data }: { data: PilotAnalytics }) {
  const { overview, engagement, suppression } = data
  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Students onboarded"
          value={formatNumber(overview.studentsOnboarded)}
          hint="Registered on the platform"
        />
        <StatCard
          label="Active students"
          value={formatNumber(overview.activeStudents)}
          hint="Active during the window"
        />
        <StatCard label="New students" value={formatNumber(overview.newStudents)} />
        <StatCard label="Check-ins" value={formatNumber(overview.checkIns)} />
        <StatCard
          label="AI interactions"
          value={formatNumber(overview.aiInteractions)}
        />
        <StatCard
          label="Voice interactions"
          value={formatNumber(overview.voiceInteractions)}
          hint="Turns that started as a voice note"
        />
        <StatCard
          label="Resources accessed"
          value={formatNumber(overview.resourcesAccessed)}
          hint="Saved to the student toolbox"
        />
        <StatCard
          label="Support requests"
          value={formatNumber(overview.supportRequests)}
          hint={`${formatNumber(overview.supportRequests > 0 ? data.support.requests.urgent : 0)} urgent`}
        />
        <StatCard
          label="Completed referrals"
          value={formatNumber(overview.completedReferrals)}
          hint="Threads closed + follow-ups completed"
        />
        <StatCard
          label="Avg. satisfaction"
          value="—"
          hint={overview.avgSatisfaction.reason}
        />
      </div>

      <PanelCard title="Daily activity">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-copy-sm text-muted">Active students</span>
              <span className="text-copy-sm font-semibold tabular-nums text-heading">
                {formatNumber(engagement.active)}
              </span>
            </div>
            <Sparkline values={engagement.series.map((point) => point.activeUsers)} />
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-copy-sm text-muted">Check-ins</span>
              <span className="text-copy-sm font-semibold tabular-nums text-heading">
                {formatNumber(overview.checkIns)}
              </span>
            </div>
            <Sparkline
              values={engagement.series.map((point) => point.checkIns)}
              className="text-accent"
            />
          </div>
        </div>
      </PanelCard>

      <p className="text-caption text-muted">
        {suppression.note} Class and cohort filters are not offered yet — groups of
        that size cannot stay non-identifying.
      </p>
    </>
  )
}

/* ── Engagement ─────────────────────────────────────────────────────────── */

function EngagementTab({ data }: { data: PilotAnalytics }) {
  const { engagement } = data
  const { text, voice } = engagement.textVsVoice
  const turns = text + voice
  const voiceShare = turns === 0 ? 0 : (voice / turns) * 100

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Active students"
          value={formatNumber(engagement.active)}
          hint="Unique students in the window"
        />
        <StatCard label="DAU" value={formatNumber(engagement.dau)} hint="Daily active" />
        <StatCard label="WAU" value={formatNumber(engagement.wau)} hint="Weekly active" />
        <StatCard label="MAU" value={formatNumber(engagement.mau)} hint="Monthly active" />
        <StatCard label="New students" value={formatNumber(engagement.new)} />
        <StatCard label="Returning students" value={formatNumber(engagement.returning)} />
        <StatCard
          label="Return rate"
          value={percentOrDash(engagement.returnRate)}
          hint="Of the previous window's active students"
        />
        <StatCard
          label="Check-ins per active student"
          value={numberOrDash(engagement.checkInsPerActiveStudent)}
        />
        <StatCard
          label="Avg. sessions per student"
          value={numberOrDash(engagement.avgSessionsPerStudent)}
        />
        <StatCard
          label="Avg. session length"
          value={
            engagement.avgSessionMinutes === null
              ? '—'
              : `${engagement.avgSessionMinutes} min`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <PanelCard title="Daily active students" className="lg:col-span-8">
          <Sparkline values={engagement.series.map((point) => point.activeUsers)} />
        </PanelCard>
        <PanelCard title="Text vs voice" className="lg:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-copy-sm text-muted">Text</span>
            <span className="text-copy-sm font-semibold tabular-nums text-heading">
              {formatNumber(text)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-copy-sm text-muted">Voice</span>
            <span className="text-copy-sm font-semibold tabular-nums text-heading">
              {formatNumber(voice)}
            </span>
          </div>
          <ProgressBar value={voiceShare} />
          <p className="text-caption text-muted">
            {turns === 0 ? 'No turns in this window.' : `${voiceShare.toFixed(1)}% of turns started as a voice note.`}
          </p>
        </PanelCard>
      </div>
    </>
  )
}

/* ── Wellbeing trends ───────────────────────────────────────────────────── */

function WellbeingTab({ data }: { data: PilotAnalytics }) {
  const themes = data.wellbeingThemes
  const maxMentions = Math.max(...themes.map((theme) => theme.mentions), 1)
  return (
    <PanelCard title="Self-reported wellbeing themes">
      <p className="-mt-1 text-caption text-muted">
        Themes students raise in check-ins and reflections. Self-reported themes —
        never clinical diagnoses or labels.
      </p>
      <div className="flex items-center gap-4 border-b border-hairline pb-2 text-caption text-muted">
        <span className="w-40 shrink-0">Theme</span>
        <span className="min-w-0 flex-1">Mentions</span>
        <span className="w-14 text-right">Mentions</span>
        <span className="w-24 text-right">Students</span>
      </div>
      {themes.map((theme) => (
        <div key={theme.id} className="flex items-center gap-4">
          <span className="w-40 shrink-0 text-copy-sm text-heading">{theme.label}</span>
          <ProgressBar
            value={(theme.mentions / maxMentions) * 100}
            className="min-w-0 flex-1"
          />
          <span className="w-14 text-right text-copy-sm tabular-nums text-heading">
            {formatNumber(theme.mentions)}
          </span>
          <span className="flex w-24 justify-end text-copy-sm text-muted">
            <StudentsCell students={theme.students} suppressed={theme.suppressed} />
          </span>
        </div>
      ))}
    </PanelCard>
  )
}

/* ── Resources ──────────────────────────────────────────────────────────── */

function ResourcesTab({ data }: { data: PilotAnalytics }) {
  const { resources } = data
  return (
    <>
      <p className="text-caption text-muted">{resources.note}</p>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard
          label="Activities started"
          value={formatNumber(resources.activities.started)}
        />
        <StatCard
          label="Activities completed"
          value={formatNumber(resources.activities.completed)}
        />
        <StatCard
          label="Completion rate"
          value={percentOrDash(resources.activities.completionRate)}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <PanelCard title="Most saved resources" className="lg:col-span-7">
          {resources.mostSaved.length === 0 ? (
            <p className="text-copy-sm text-muted">No saves in this window.</p>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center gap-4 border-b border-hairline pb-2 text-caption text-muted">
                <span className="min-w-0 flex-1">Resource</span>
                <span className="w-16 text-right">Saves</span>
                <span className="w-24 text-right">Students</span>
              </div>
              {resources.mostSaved.map((resource) => (
                <div key={resource.id} className="flex items-center gap-4 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-copy-sm text-heading">
                    {resource.title}
                  </span>
                  <span className="w-16 text-right text-copy-sm tabular-nums text-heading">
                    {formatNumber(resource.saves)}
                  </span>
                  <span className="flex w-24 justify-end text-copy-sm text-muted">
                    <StudentsCell
                      students={resource.students}
                      suppressed={resource.suppressed}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard title="By category" className="lg:col-span-5">
          {resources.byCategory.length === 0 ? (
            <p className="text-copy-sm text-muted">No saves in this window.</p>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center gap-4 border-b border-hairline pb-2 text-caption text-muted">
                <span className="min-w-0 flex-1">Category</span>
                <span className="w-16 text-right">Saves</span>
                <span className="w-24 text-right">Students</span>
              </div>
              {resources.byCategory.map((category) => (
                <div key={category.category} className="flex items-center gap-4 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-copy-sm text-heading">
                    {category.category}
                  </span>
                  <span className="w-16 text-right text-copy-sm tabular-nums text-heading">
                    {formatNumber(category.saves)}
                  </span>
                  <span className="flex w-24 justify-end text-copy-sm text-muted">
                    <StudentsCell
                      students={category.students}
                      suppressed={category.suppressed}
                    />
                  </span>
                </div>
              ))}
            </div>
          )}
        </PanelCard>
      </div>

      <PanelCard title="Saves per day">
        <Sparkline values={resources.savesSeries.map((point) => point.saves)} />
      </PanelCard>
    </>
  )
}

/* ── Support & safeguarding ─────────────────────────────────────────────── */

function BreakdownList({ entries }: { entries: [string, number][] }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
      {entries.map(([key, count]) => (
        <div
          key={key}
          className="flex items-center justify-between gap-4 border-b border-hairline py-1.5 last:border-b-0"
        >
          <span className="text-copy-sm text-muted">{labelize(key)}</span>
          <span className="text-copy-sm font-semibold tabular-nums text-heading">
            {formatNumber(count)}
          </span>
        </div>
      ))}
    </div>
  )
}

function SupportTab({ data }: { data: PilotAnalytics }) {
  const { support, safeguarding } = data
  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Support requests"
          value={formatNumber(support.requests.total)}
          hint={`${formatNumber(support.requests.urgent)} urgent`}
        />
        <StatCard
          label="Unresolved requests"
          value={formatNumber(support.unresolved)}
          hint="Open, accepted, scheduled or escalated"
        />
        <StatCard
          label="Referrals created"
          value={formatNumber(support.referrals.created)}
          hint="Counsellor conversations opened"
        />
        <StatCard
          label="Referrals completed"
          value={formatNumber(support.referrals.closed + support.referrals.claimed)}
          hint={`${formatNumber(support.referrals.claimed)} claimed · ${formatNumber(support.referrals.closed)} closed`}
        />
        <StatCard
          label="Avg. claim time"
          value={
            support.referrals.avgClaimHours === null
              ? '—'
              : `${support.referrals.avgClaimHours} h`
          }
          hint="Request to counsellor pickup"
        />
        <StatCard
          label="Follow-ups completed"
          value={formatNumber(support.followUps.completed)}
        />
        <StatCard label="Follow-ups open" value={formatNumber(support.followUps.open)} />
        <StatCard
          label="Open flags"
          value={formatNumber(safeguarding.flags.total)}
          hint={`${formatNumber(safeguarding.escalations)} escalated`}
        />
        <StatCard
          label="Avg. resolution time"
          value={
            safeguarding.avgResolutionHours === null
              ? '—'
              : `${safeguarding.avgResolutionHours} h`
          }
          hint="Flag raised to resolved"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <PanelCard title="Requests by status" className="lg:col-span-6">
          <BreakdownList entries={Object.entries(support.requests.byStatus)} />
        </PanelCard>
        <PanelCard title="Requests per day" className="lg:col-span-6">
          <Sparkline values={support.series.map((point) => point.requests)} />
          <Sparkline
            values={support.series.map((point) => point.threads)}
            className="text-accent"
          />
          <p className="text-caption text-muted">
            Requests (top) and referrals opened (bottom) per day.
          </p>
        </PanelCard>
      </div>

      <h2 className="mt-2 text-meta uppercase tracking-wider text-muted">
        Safeguarding — platform admins only
      </h2>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Flags raised" value={formatNumber(safeguarding.flags.total)} />
        <StatCard label="Escalations" value={formatNumber(safeguarding.escalations)} />
        <StatCard label="Urgent requests" value={formatNumber(safeguarding.urgentRequests)} />
        <StatCard
          label="Flags resolved"
          value={formatNumber(safeguarding.followUpStatus.resolved)}
        />
        <StatCard
          label="Flags still open"
          value={formatNumber(safeguarding.followUpStatus.open)}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <PanelCard title="Flags by severity" className="lg:col-span-6">
          <BreakdownList entries={Object.entries(safeguarding.flags.bySeverity)} />
        </PanelCard>
        <PanelCard title="Flags by status" className="lg:col-span-6">
          <BreakdownList entries={Object.entries(safeguarding.flags.byStatus)} />
        </PanelCard>
      </div>
    </>
  )
}

/* ── Pilot outcomes ─────────────────────────────────────────────────────── */

function OutcomesTab({ data }: { data: PilotAnalytics }) {
  return (
    <>
      <EmptyState
        icon={TrendingUp}
        title="Outcome deltas are not available yet"
        body={data.outcomes.reason}
      />
      <p className="text-caption text-muted">
        Once comparable pre/post survey data exists, this section will show
        before-and-after deltas only — never absolute individual results.
      </p>
    </>
  )
}

/* ── Reports ────────────────────────────────────────────────────────────── */

function ReportsTab({
  data,
  downloading,
  error,
  onDownload,
}: {
  data: PilotAnalytics
  downloading: boolean
  error: string | null
  onDownload: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <PanelCard title="Aggregate pilot report" className="lg:col-span-7">
        <p className="text-copy-sm text-muted">
          The CSV export mirrors every section of this dashboard for the selected
          window — Pilot Reach, Engagement, Wellbeing Trends, Resources, Support,
          Safeguarding and Outcomes. Aggregate only: no student identifiers, no
          PII.
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="mt-1">
          <Button onClick={onDownload} disabled={downloading}>
            <Download aria-hidden="true" className="size-4" />
            {downloading ? 'Preparing…' : 'Download CSV report'}
          </Button>
        </div>
      </PanelCard>

      <Card className="flex flex-col gap-4 lg:col-span-5">
        <h2 className="text-meta uppercase tracking-wider text-muted">
          Report window
        </h2>
        <div className="flex items-center justify-between gap-4 border-b border-hairline py-1.5">
          <span className="text-copy-sm text-muted">Period</span>
          <span className="text-copy-sm text-heading">
            {dayLabel(data.window.from)} – {dayLabel(data.window.to)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-hairline py-1.5">
          <span className="text-copy-sm text-muted">Days covered</span>
          <span className="text-copy-sm tabular-nums text-heading">
            {formatNumber(data.window.days)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-hairline py-1.5">
          <span className="text-copy-sm text-muted">School scope</span>
          <span className="text-copy-sm text-heading">
            {data.school ? data.school.name : 'All schools'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 py-1.5">
          <span className="text-copy-sm text-muted">Snapshot generated</span>
          <span className="text-copy-sm text-heading">
            {formatDateTime(data.generatedAt)}
          </span>
        </div>
        <p className="flex items-center gap-2 text-caption text-muted">
          <Users aria-hidden="true" className="size-3.5 shrink-0" />
          {data.suppression.note}
        </p>
      </Card>
    </div>
  )
}
