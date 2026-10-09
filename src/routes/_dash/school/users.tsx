// Users register — the school portal's roster: role and state filters over
// the newest accounts, onboarding CTAs and per-row edit / reset / lifecycle
// actions. The backend caps the register at the newest 200 accounts.

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Briefcase, GraduationCap, SearchX } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { SchoolUsersTable } from '#/components/dash/SchoolUsersTable'
import {
  EditSchoolUserDialog,
  OnboardProfessionalDialog,
  OnboardStudentDialog,
  ResetUserPasswordDialog,
  UserStatusDialog,
} from '#/components/dash/school-user-dialogs'
import { Button, Card, ErrorNote, Segmented } from '#/components/dash/ui'
import { fetchSchoolUsers, type SchoolUserRow } from '#/lib/admin'
import { isChatStaff, type SchoolBrief } from '#/lib/auth'
import { formatNumber, useApiQuery, useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/school/users')({
  head: () => ({ meta: [{ title: 'Users · Soul Nurture AI' }] }),
  component: SchoolUsersPage,
})

type RoleFilter = 'all' | 'students' | 'staff' | 'admins'
type StateFilter = 'all' | 'default' | 'unverified' | 'deactivated'

const ROLE_FILTERS: readonly { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'students', label: 'Students' },
  { value: 'staff', label: 'Staff' },
  { value: 'admins', label: 'Admins' },
]

const STATE_FILTERS: readonly { value: StateFilter; label: string }[] = [
  { value: 'all', label: 'Any state' },
  { value: 'default', label: 'On default password' },
  { value: 'unverified', label: 'Unverified' },
  { value: 'deactivated', label: 'Deactivated' },
]

function SchoolUsersPage() {
  const user = useRoleGuard(['SCHOOL_ADMIN'])
  if (!user?.school) return null
  return <SchoolUsersContent school={user.school} currentUserId={user.id} />
}

function SchoolUsersContent({
  school,
  currentUserId,
}: {
  school: SchoolBrief
  currentUserId: string
}) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [studentOpen, setStudentOpen] = useState(false)
  const [professionalOpen, setProfessionalOpen] = useState(false)
  const [editUser, setEditUser] = useState<SchoolUserRow | null>(null)
  const [statusUser, setStatusUser] = useState<SchoolUserRow | null>(null)
  const [resetUser, setResetUser] = useState<SchoolUserRow | null>(null)

  const usersQuery = useApiQuery(() => fetchSchoolUsers(school.id), [school.id])

  const items = usersQuery.data?.items ?? []
  const filtered = items.filter((row) => {
    if (roleFilter === 'students' && row.role !== 'STUDENT') return false
    if (roleFilter === 'staff' && !isChatStaff(row.role)) return false
    if (roleFilter === 'admins' && row.role !== 'SCHOOL_ADMIN') return false
    if (stateFilter === 'default') {
      return !row.deactivatedAt && !!row.mustChangePassword
    }
    if (stateFilter === 'unverified') {
      return !row.deactivatedAt && !row.emailVerified
    }
    if (stateFilter === 'deactivated') return !!row.deactivatedAt
    return true
  })

  const reload = () => usersQuery.reload()

  return (
    <>
      <DashHeader
        title="Users"
        subtitle="Students and professionals at your school"
        actions={
          <>
            <Button variant="ghost" onClick={() => setProfessionalOpen(true)}>
              <Briefcase aria-hidden="true" className="size-4" />
              Onboard professional
            </Button>
            <Button onClick={() => setStudentOpen(true)}>
              <GraduationCap aria-hidden="true" className="size-4" />
              Onboard student
            </Button>
          </>
        }
      />
      <main className="flex flex-1 flex-col gap-5 p-6 lg:p-8">
        {usersQuery.error && <ErrorNote>{usersQuery.error.message}</ErrorNote>}

        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            options={ROLE_FILTERS}
            value={roleFilter}
            onChange={setRoleFilter}
          />
          <Segmented
            options={STATE_FILTERS}
            value={stateFilter}
            onChange={setStateFilter}
          />
        </div>

        <Card className="p-0">
          {!usersQuery.loading && items.length > 0 && filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-panel-2 text-muted">
                <SearchX aria-hidden="true" className="size-5" />
              </span>
              <p className="text-card text-heading">No users match</p>
              <p className="max-w-md text-copy-sm text-muted">
                Nothing on this roster matches the current filters.
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  setRoleFilter('all')
                  setStateFilter('all')
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <SchoolUsersTable
              users={filtered}
              loading={usersQuery.loading}
              currentUserId={currentUserId}
              actions={{
                onEdit: (row) => setEditUser(row),
                onResetPassword: (row) => setResetUser(row),
                onToggleStatus: (row) => setStatusUser(row),
              }}
              emptyAction={
                <Button onClick={() => setStudentOpen(true)}>
                  <GraduationCap aria-hidden="true" className="size-4" />
                  Onboard student
                </Button>
              }
            />
          )}
        </Card>

        <span className="text-caption text-muted">
          {usersQuery.loading
            ? 'Loading users…'
            : items.length === 0
              ? 'No users yet'
              : `${formatNumber(filtered.length)} of ${formatNumber(items.length)} users${
                  items.length >= 200 ? ' · showing the newest 200 accounts' : ''
                }`}
        </span>
      </main>

      {studentOpen && (
        <OnboardStudentDialog
          school={school}
          onClose={() => setStudentOpen(false)}
          onOnboarded={reload}
        />
      )}
      {professionalOpen && (
        <OnboardProfessionalDialog
          school={school}
          onClose={() => setProfessionalOpen(false)}
          onOnboarded={reload}
        />
      )}
      {editUser && (
        <EditSchoolUserDialog
          school={school}
          user={editUser}
          onClose={() => setEditUser(null)}
          onUpdated={reload}
        />
      )}
      {statusUser && (
        <UserStatusDialog
          school={school}
          user={statusUser}
          onClose={() => setStatusUser(null)}
          onDone={reload}
        />
      )}
      {resetUser && (
        <ResetUserPasswordDialog
          school={school}
          user={resetUser}
          onClose={() => setResetUser(null)}
          onDone={reload}
        />
      )}
    </>
  )
}
