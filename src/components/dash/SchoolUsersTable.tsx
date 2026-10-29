// School users register table — everyone at the school with their role,
// profile detail and onboarding state. Actions live in a RowMenu; the
// destructive ones never render on your own row.

import type { ReactNode } from 'react'
import { KeyRound, Pencil, UserCheck, UserX } from 'lucide-react'

import { userDetail } from '#/components/dash/panels'
import {
  RowMenu,
  Skeleton,
  Tag,
  type RowMenuItem,
} from '#/components/dash/ui'
import type { SchoolUserRow } from '#/lib/admin'
import { roleLabel } from '#/lib/auth'
import { formatDay } from '#/lib/dash'

export interface SchoolUsersTableActions {
  onEdit: (user: SchoolUserRow) => void
  onResetPassword: (user: SchoolUserRow) => void
  onToggleStatus: (user: SchoolUserRow) => void
}

function stateTags(user: SchoolUserRow) {
  if (user.deactivatedAt) return <Tag tone="danger">Deactivated</Tag>
  return (
    <>
      {user.mustChangePassword && <Tag tone="accent">Default password</Tag>}
      {!user.emailVerified && <Tag tone="info">Unverified</Tag>}
      {!user.mustChangePassword && user.emailVerified && (
        <Tag tone="success">Active</Tag>
      )}
    </>
  )
}

export function SchoolUsersTable({
  users,
  loading = false,
  currentUserId,
  actions,
  emptyAction,
}: {
  users: SchoolUserRow[]
  loading?: boolean
  /** The signed-in admin — their own row offers no destructive actions. */
  currentUserId: string
  actions: SchoolUsersTableActions
  emptyAction?: ReactNode
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <p className="text-card text-heading">No users yet</p>
        <p className="max-w-md text-copy-sm text-muted">
          Onboard the first student to start building your school roster.
        </p>
        {emptyAction}
      </div>
    )
  }

  const menuItems = (user: SchoolUserRow): RowMenuItem[] => {
    const isSelf = user.id === currentUserId
    return [
      { label: 'Edit details', icon: Pencil, onSelect: () => actions.onEdit(user) },
      ...(isSelf || user.deactivatedAt
        ? []
        : [{ label: 'Reset password', icon: KeyRound, onSelect: () => actions.onResetPassword(user) }]),
      ...(isSelf
        ? []
        : user.deactivatedAt
          ? [{ label: 'Reactivate', icon: UserCheck, onSelect: () => actions.onToggleStatus(user) }]
          : [
              {
                label: 'Deactivate',
                icon: UserX,
                tone: 'danger' as const,
                onSelect: () => actions.onToggleStatus(user),
              },
            ]),
    ]
  }

  return (
    <>
      {/* Phone: stacked rows. The 720px table below md is a scrollbar trap. */}
      <ul className="flex flex-col divide-y divide-hairline md:hidden">
        {users.map((user) => {
          const detail = userDetail(user)
          return (
            <li key={user.id} className="flex items-start gap-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-card text-heading">{user.name}</p>
                <p className="truncate text-caption text-muted">{user.email}</p>
                {detail && (
                  <p className="mt-1 truncate text-caption text-muted">{detail}</p>
                )}
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Tag tone="neutral">{roleLabel(user.role)}</Tag>
                  {stateTags(user)}
                  <span className="text-caption text-muted">
                    {formatDay(user.createdAt)}
                  </span>
                </p>
              </div>
              <RowMenu label={`Actions for ${user.name}`} items={menuItems(user)} />
            </li>
          )
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline text-meta uppercase tracking-wider text-muted">
              <th className="py-3 pl-6 pr-4 font-semibold">User</th>
              <th className="py-3 pr-4 font-semibold">Role</th>
              <th className="py-3 pr-4 font-semibold">Details</th>
              <th className="py-3 pr-4 font-semibold">State</th>
              <th className="py-3 pr-4 font-semibold">Joined</th>
              <th className="py-3 pl-2 pr-6 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {users.map((user) => {
              const detail = userDetail(user)
              return (
                <tr key={user.id} className="align-middle text-copy-sm">
                  <td className="py-3.5 pl-6 pr-4">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-card text-heading">
                        {user.name}
                      </span>
                      <span className="truncate text-caption text-muted">
                        {user.email}
                      </span>
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <Tag tone="neutral">{roleLabel(user.role)}</Tag>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="block max-w-56 truncate text-body">
                      {detail ?? '—'}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {stateTags(user)}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 whitespace-nowrap text-body">
                    {formatDay(user.createdAt)}
                  </td>
                  <td className="py-3.5 pl-2 pr-6 text-right">
                    <RowMenu label={`Actions for ${user.name}`} items={menuItems(user)} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
