import { useState } from 'react'
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
import { fetchSchools, type SchoolRow } from '#/lib/admin'
import { useApiQuery, useRoleGuard } from '#/lib/dash'

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
  const schools = useApiQuery(() => fetchSchools(), [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SchoolRow | null>(null)
  const [statusTarget, setStatusTarget] = useState<SchoolRow | null>(null)
  const [adminTarget, setAdminTarget] = useState<SchoolRow | null>(null)

  if (!user) return null

  const items = schools.data?.items ?? []
  const needle = search.trim().toLowerCase()
  const filtered = items.filter((school) => {
    if (status !== 'ALL' && school.status !== status) return false
    if (!needle) return true
    return (
      school.name.toLowerCase().includes(needle) ||
      school.shortCode.toLowerCase().includes(needle)
    )
  })

  const hasFilters = needle.length > 0 || status !== 'ALL'
  const noMatches = !schools.loading && items.length > 0 && filtered.length === 0

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
      <main className="flex flex-1 flex-col gap-5 p-6 lg:p-8">
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
              : `${filtered.length} of ${items.length} schools`}
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
              {hasFilters && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch('')
                    setStatus('ALL')
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <SchoolsTable
              schools={filtered}
              loading={schools.loading}
              actions={{
                onRename: setRenameTarget,
                onToggleStatus: setStatusTarget,
                onAddAdmin: setAdminTarget,
              }}
              emptyAction={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus aria-hidden="true" className="size-4" />
                  New school
                </Button>
              }
            />
          )}
        </Card>
        {schools.loading && items.length === 0 && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
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
