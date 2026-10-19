import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RefreshCw, ScrollText, ShieldCheck } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { Button, EmptyState, ErrorNote, SearchInput, Skeleton, Tag } from '#/components/dash/ui'
import { describeActivity, type ActivityItem } from '#/lib/activity'
import { fetchActivity } from '#/lib/admin'
import { refreshSession } from '#/lib/auth'
import { formatDateTime, useApiQuery, useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/admin/access-log')({
  head: () => ({ meta: [{ title: 'Access activity · Soul Nurture AI' }] }),
  component: AccessLogPage,
})

function AccessLogPage() {
  const user = useRoleGuard(['PLATFORM_ADMIN'])
  return user ? <AccessLog key={user.id} /> : null
}

const kinds = [
  { value: 'all', label: 'All actions' },
  { value: 'schools', label: 'School actions' },
  { value: 'people', label: 'Account actions' },
] as const

function AccessLog() {
  const [kind, setKind] = useState<'all' | 'schools' | 'people'>('all')
  const [search, setSearch] = useState('')
  const activity = useApiQuery(async () => {
    const [schools, people] = await Promise.all([
      fetchActivity({ kind: 'schools', limit: 100 }),
      fetchActivity({ kind: 'people', limit: 100 }),
    ])
    return [...schools.items, ...people.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)
  })
  useEffect(() => {
    if (activity.error?.status === 401 || activity.error?.status === 403) {
      void refreshSession()
    }
  }, [activity.error])
  const query = search.trim().toLocaleLowerCase()
  const rows = (activity.data ?? []).filter((item) => {
    if (kind !== 'all' && item.kind !== kind) return false
    return !query || [describeActivity(item).title, item.school?.name, item.school?.shortCode, item.actor?.name].some((value) => value?.toLocaleLowerCase().includes(query))
  })

  return (
    <>
      <DashHeader title="Access activity" subtitle="School and account administration, separate from student wellbeing" actions={<Button variant="ghost" disabled={activity.loading} onClick={activity.reload}><RefreshCw className="size-4" aria-hidden="true" />Refresh</Button>} />
      <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 p-5 lg:p-10">
        <p className="flex items-start gap-3 rounded-card bg-panel px-5 py-4 text-copy-sm text-brand-4"><ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />This log shows recorded school and account changes. Sign-in attempts and activation outcomes are not available here yet. Wellbeing messages and check-ins are never shown.</p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2" aria-label="Filter activity">
            {kinds.map((option) => <button key={option.value} type="button" aria-pressed={kind === option.value} onClick={() => setKind(option.value)} className={`min-h-11 rounded-pill border px-4 text-chip transition-colors ${kind === option.value ? 'border-action bg-action text-white' : 'border-hairline bg-white text-body hover:bg-panel'}`}>{option.label}</button>)}
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search school, person or action" className="w-full sm:w-80" />
        </div>
        {activity.error && <ErrorNote>{activity.error.message} Use Refresh to try again.</ErrorNote>}
        {activity.loading ? <div role="status" aria-label="Loading access activity" className="space-y-3">{[0, 1, 2, 3].map((row) => <Skeleton key={row} className="h-16 w-full" />)}</div> : !activity.error && rows.length === 0 ? <EmptyState icon={ScrollText} title={query || kind !== 'all' ? 'No matching activity' : 'No access activity yet'} body={query || kind !== 'all' ? 'Try another search or show all actions.' : 'Recorded school and account changes will appear here.'} action={(query || kind !== 'all') && <Button variant="ghost" onClick={() => { setSearch(''); setKind('all') }}>Clear filters</Button>} /> : !activity.error && activity.data && (
          <div className="overflow-hidden rounded-panel border border-hairline bg-white">
            <div className="hidden grid-cols-[1fr_1.5fr_1.5fr_1fr_auto] gap-4 bg-panel px-6 py-4 text-meta text-brand-4 lg:grid" aria-hidden="true"><span>Time</span><span>Action</span><span>School</span><span>By</span><span>Record</span></div>
            <ul className="divide-y divide-hairline" aria-label="Recorded access activity">{rows.map((item) => <ActivityRow key={item.id} item={item} />)}</ul>
          </div>
        )}
        <p className="text-caption text-muted">Up to 100 of the latest recorded school and account changes. “Recorded” confirms an audit entry exists; it does not describe a sign-in result.</p>
      </main>
    </>
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const description = describeActivity(item)
  return (
    <li className="grid gap-3 px-5 py-5 text-copy-sm lg:grid-cols-[1fr_1.5fr_1.5fr_1fr_auto] lg:items-center lg:gap-4 lg:px-6">
      <time dateTime={item.createdAt} className="text-caption text-muted">{formatDateTime(item.createdAt)}</time>
      <span className="font-semibold text-heading">{description.title}</span>
      <span className="min-w-0 break-words">{item.school?.name ?? 'Platform'}{item.school?.shortCode && <span className="mt-1 block text-caption text-muted">{item.school.shortCode}</span>}</span>
      <span className="min-w-0 break-words"><span className="text-muted lg:hidden">By </span>{item.actor?.name ?? 'System'}</span>
      <span><Tag tone="neutral">Recorded</Tag></span>
    </li>
  )
}
