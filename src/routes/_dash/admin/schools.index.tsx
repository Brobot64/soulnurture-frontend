import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, SearchX } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { SchoolsTable } from '#/components/dash/SchoolsTable'
import {
  CreateSchoolAdminDialog,
  CreateSchoolDialog,
  RenameSchoolDialog,
  SchoolStatusDialog,
} from '#/components/dash/school-dialogs'
import {
  Button,
  Card,
  ErrorNote,
  Segmented,
  Skeleton,
} from '#/components/dash/ui'
import { fetchSchools, type SchoolRow, type SchoolsResponse } from '#/lib/admin'
import { useApiQuery, useDebouncedValue, useRoleGuard } from '#/lib/dash'

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]['value']

export const Route = createFileRoute('/_dash/admin/schools/')({
  head: () => ({ meta: [{ title: 'Schools · Soul Nurture AI' }] }),
  component: AdminSchoolsPage,
})

function AdminSchoolsPage() {
  const user = useRoleGuard(['PLATFORM_ADMIN'])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SchoolRow | null>(null)
  const [statusTarget, setStatusTarget] = useState<SchoolRow | null>(null)
  const [adminTarget, setAdminTarget] = useState<SchoolRow | null>(null)
  const [rows, setRows] = useState<SchoolRow[]>([])
  // The cursor has to travel with the rows. Read from the first page alone,
  // every "Load earlier" asked for the same page again and the control never
  // retired, so the register grew forever without ever finishing.
  const [page, setPage] = useState<SchoolsResponse['page'] | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)

  // Search and status are sent to the server: a filter that only sees the rows
  // already on screen can say "no schools match" about a school that exists one
  // page down.
  const q = useDebouncedValue(search, 300)
  const filters = {
    q: q.trim() || undefined,
    status: status === 'ALL' ? undefined : (status as 'ACTIVE' | 'SUSPENDED'),
  }
  const schools = useApiQuery(() => fetchSchools(filters), [q, status, user?.id])

  // A new filter, or any reload, starts the register at the first page again.
  useEffect(() => {
    if (!schools.data) return
    setRows(schools.data.items)
    setPage(schools.data.page)
  }, [schools.data])

  if (!user) return null

  const total = schools.data?.total ?? 0
  const hasFilters = q.trim().length > 0 || status !== 'ALL'
  const noMatches = !schools.loading && schools.data !== null && rows.length === 0 && hasFilters
  const emptyRegister = !schools.loading && schools.data !== null && rows.length === 0 && !hasFilters

  async function loadEarlier() {
    const before = page?.nextBefore
    if (!before || loadingMore) return
    setLoadingMore(true)
    setMoreError(null)
    try {
      const older = await fetchSchools({ ...filters, before })
      setRows((current) => [...current, ...older.items])
      setPage(older.page)
    } catch (cause) {
      setMoreError(cause instanceof Error ? cause.message : 'Older schools could not be loaded.')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <>
      <DashHeader
        title="Schools"
        subtitle="Every school on the platform"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search schools…',
        }}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            New school
          </Button>
        }
      />
      <main className="flex flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
        {schools.error && <ErrorNote>{schools.error.message}</ErrorNote>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            options={STATUS_FILTERS}
            value={status}
            onChange={setStatus}
          />
          <span className="text-caption text-muted">
            {schools.loading
              ? 'Loading schools…'
              : `${rows.length} of ${total} ${total === 1 ? 'school' : 'schools'}`}
          </span>
        </div>
        <Card className="p-0">
          {noMatches ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-panel-2 text-muted">
                <SearchX aria-hidden="true" className="size-5" />
              </span>
              <p className="text-card text-heading">No schools match</p>
              <p className="max-w-md text-copy-sm text-muted">
                Nothing here matches the current search and status filter.
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch('')
                  setStatus('ALL')
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <SchoolsTable
              schools={rows}
              loading={schools.loading}
              actions={{
                onRename: setRenameTarget,
                onToggleStatus: setStatusTarget,
                onAddAdmin: setAdminTarget,
              }}
              emptyAction={
                emptyRegister ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden="true" className="size-4" />
                    New school
                  </Button>
                ) : undefined
              }
            />
          )}
        </Card>
        {schools.loading && rows.length === 0 && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}
        {page?.hasMore && (
          <div className="flex flex-col items-start gap-2">
            <Button variant="ghost" disabled={loadingMore} onClick={() => void loadEarlier()}>
              {loadingMore ? 'Loading…' : `Load earlier schools (${Math.max(0, total - rows.length)})`}
            </Button>
            {moreError && <ErrorNote>{moreError}</ErrorNote>}
          </div>
        )}
      </main>

      {createOpen && (
        <CreateSchoolDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => schools.reload()}
        />
      )}
      {renameTarget && (
        <RenameSchoolDialog
          school={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRenamed={() => schools.reload()}
        />
      )}
      {statusTarget && (
        <SchoolStatusDialog
          school={statusTarget}
          onClose={() => setStatusTarget(null)}
          onDone={() => schools.reload()}
        />
      )}
      {adminTarget && (
        <CreateSchoolAdminDialog
          school={adminTarget}
          onClose={() => setAdminTarget(null)}
          onCreated={() => schools.reload()}
        />
      )}
    </>
  )
}
