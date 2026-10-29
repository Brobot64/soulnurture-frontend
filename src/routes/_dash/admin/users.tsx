// Users register — everyone across the platform, filtered server-side
// (debounced search, role + school selects) with offset paging.

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import {
  AvatarInitials,
  Button,
  Card,
  ErrorNote,
  SelectField,
  Skeleton,
  Tag,
} from '#/components/dash/ui'
import { fetchAdminUsers, fetchSchools } from '#/lib/admin'
import { roleLabel } from '#/lib/auth'
import {
  formatNumber,
  timeAgo,
  useApiQuery,
  useDebouncedValue,
  useRoleGuard,
} from '#/lib/dash'

export const Route = createFileRoute('/_dash/admin/users')({
  head: () => ({ meta: [{ title: 'Users · Soul Nurture AI' }] }),
  component: AdminUsersPage,
})

const PAGE_SIZE = 25

const ROLE_OPTIONS = [
  { value: '', label: 'Everyone' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'SCHOOL_ADMIN', label: 'School admin' },
  { value: 'PLATFORM_ADMIN', label: 'Platform admin' },
  { value: 'COUNSELLOR', label: 'Counsellor' },
  { value: 'PSYCHOLOGIST', label: 'Psychologist' },
  { value: 'SUPPORT_STAFF', label: 'Support staff' },
] as const

function AdminUsersPage() {
  const user = useRoleGuard(['PLATFORM_ADMIN'])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [offset, setOffset] = useState(0)
  const debouncedSearch = useDebouncedValue(search, 300)

  const schools = useApiQuery(() => fetchSchools(), [])
  const usersQuery = useApiQuery(
    () =>
      fetchAdminUsers({
        q: debouncedSearch.trim() || undefined,
        role: role || undefined,
        schoolId: schoolId || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    [debouncedSearch, role, schoolId, offset],
  )

  useEffect(() => {
    setOffset(0)
  }, [debouncedSearch, role, schoolId])

  if (!user) return null

  const items = usersQuery.data?.items ?? []
  const total = usersQuery.data?.total ?? 0
  const start = total === 0 ? 0 : offset + 1
  const end = offset + items.length
  const filtersActive =
    debouncedSearch.trim().length > 0 || role !== '' || schoolId !== ''

  const schoolOptions = [
    { value: '', label: 'All schools' },
    ...(schools.data?.items ?? []).map((school) => ({
      value: school.id,
      label: school.name,
    })),
  ]

  return (
    <>
      <DashHeader
        title="Users"
        subtitle="Everyone across the platform"
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search name or email…',
        }}
      />
      <main className="flex flex-1 flex-col gap-5 p-6 lg:p-8">
        {usersQuery.error && <ErrorNote>{usersQuery.error.message}</ErrorNote>}

        <div className="flex flex-wrap items-stretch gap-4">
          <SelectField
            label="Role"
            value={role}
            onChange={setRole}
            options={ROLE_OPTIONS}
            className="w-44"
          />
          <SelectField
            label="School"
            value={schoolId}
            onChange={setSchoolId}
            options={schoolOptions}
            className="w-56"
          />
        </div>

        <Card className="p-0">
          {usersQuery.loading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-panel-2 text-muted">
                <SearchX aria-hidden="true" className="size-5" />
              </span>
              <p className="text-card text-heading">
                {filtersActive ? 'No users match' : 'No users yet'}
              </p>
              <p className="max-w-md text-copy-sm text-muted">
                {filtersActive
                  ? 'Nothing here matches the current search and filters.'
                  : 'Accounts appear here as schools onboard students and staff.'}
              </p>
              {filtersActive && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch('')
                    setRole('')
                    setSchoolId('')
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-hairline md:hidden">
                {items.map((row) => (
                  // No horizontal padding: the Card already insets its content by
                  // p-6, and padding here stacked into a 44px gutter that pushed
                  // the role and verification tags onto separate lines on a phone.
                  <li key={row.id} className="flex items-start gap-3 py-3.5">
                    <AvatarInitials name={row.name} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-card text-heading">{row.name}</p>
                      <p className="truncate text-caption text-muted">{row.email}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Tag tone="neutral">{roleLabel(row.role)}</Tag>
                        {row.emailVerified ? (
                          <Tag tone="success">Verified</Tag>
                        ) : (
                          <Tag tone="info">Unverified</Tag>
                        )}
                      </p>
                      <p className="mt-1 truncate text-caption text-muted">
                        {row.school ? `${row.school.name} · ${row.school.shortCode}` : 'No school'}
                        {' · '}
                        {timeAgo(row.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-hairline text-meta uppercase tracking-wider text-muted">
                    <th className="py-3 pl-6 pr-4 font-semibold">User</th>
                    <th className="py-3 pr-4 font-semibold">Role</th>
                    <th className="py-3 pr-4 font-semibold">School</th>
                    <th className="py-3 pr-4 font-semibold">Joined</th>
                    <th className="py-3 pr-6 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {items.map((row) => (
                    <tr key={row.id} className="align-middle text-copy-sm">
                      <td className="py-3.5 pl-6 pr-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <AvatarInitials name={row.name} />
                          <span className="min-w-0">
                            <span className="block truncate text-card text-heading">
                              {row.name}
                            </span>
                            <span className="block truncate text-caption text-muted">
                              {row.email}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <Tag tone="neutral">{roleLabel(row.role)}</Tag>
                      </td>
                      <td className="py-3.5 pr-4">
                        {row.school ? (
                          <span className="flex flex-col">
                            <span className="truncate text-body">
                              {row.school.name}
                            </span>
                            <span className="text-caption tabular-nums text-muted">
                              {row.school.shortCode}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 whitespace-nowrap text-body">
                        {timeAgo(row.createdAt)}
                      </td>
                      <td className="py-3.5 pr-6">
                        {row.emailVerified ? (
                          <Tag tone="success">Verified</Tag>
                        ) : (
                          <Tag tone="info">Unverified</Tag>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </>
          )}
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-caption text-muted">
            {usersQuery.loading
              ? 'Loading users…'
              : total === 0
                ? 'No users'
                : `Showing ${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)}`}
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              disabled={offset === 0 || usersQuery.loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </Button>
            <Button
              variant="ghost"
              disabled={end >= total || usersQuery.loading}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}
