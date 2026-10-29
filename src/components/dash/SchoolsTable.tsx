// Schools register table — full on /admin/schools, capped on the overview.
// Actions live in a RowMenu so the row stays glanceable.

import type { ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ExternalLink, Pause, Pencil, Play, UserPlus } from 'lucide-react'

import {
  RowMenu,
  Skeleton,
  Tag,
  type RowMenuItem,
} from '#/components/dash/ui'
import type { SchoolRow } from '#/lib/admin'
import { formatNumber, timeAgo } from '#/lib/dash'

export interface SchoolsTableActions {
  onRename: (school: SchoolRow) => void
  onToggleStatus: (school: SchoolRow) => void
  onAddAdmin: (school: SchoolRow) => void
}

export function SchoolsTable({
  schools,
  loading = false,
  actions,
  emptyAction,
}: {
  schools: SchoolRow[]
  loading?: boolean
  actions: SchoolsTableActions
  emptyAction?: ReactNode
}) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (schools.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <p className="text-card text-heading">No schools yet</p>
        <p className="max-w-md text-copy-sm text-muted">
          Create the first school to start onboarding students and staff.
        </p>
        {emptyAction}
      </div>
    )
  }

  const menuItems = (school: SchoolRow): RowMenuItem[] => [
    {
      label: 'Open school',
      icon: ExternalLink,
      onSelect: () => {
        void navigate({
          to: '/admin/schools/$id',
          params: { id: school.id },
        })
      },
    },
    { label: 'Rename', icon: Pencil, onSelect: () => actions.onRename(school) },
    { label: 'Add school admin', icon: UserPlus, onSelect: () => actions.onAddAdmin(school) },
    school.status === 'SUSPENDED'
      ? { label: 'Reactivate', icon: Play, onSelect: () => actions.onToggleStatus(school) }
      : {
          label: 'Suspend',
          icon: Pause,
          tone: 'danger' as const,
          onSelect: () => actions.onToggleStatus(school),
        },
  ]

  return (
    <>
      {/* Phone: one card per school. A 760px table in a 294px card is a
          scrollbar inside a scrollbar, which is what this replaced. */}
      <ul className="flex flex-col divide-y divide-hairline md:hidden">
        {schools.map((school) => (
          <li key={school.id} className="flex items-start gap-2 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <Link
                to="/admin/schools/$id"
                params={{ id: school.id }}
                className="block truncate text-card text-heading transition-colors hover:text-action"
              >
                {school.name}
              </Link>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {school.status === 'ACTIVE' ? (
                  <Tag tone="success">Active</Tag>
                ) : (
                  <Tag tone="danger">Suspended</Tag>
                )}
                {school.pendingChats > 0 && (
                  <Tag tone="accent">{formatNumber(school.pendingChats)} pending</Tag>
                )}
              </p>
              <p className="mt-1.5 truncate text-caption text-muted">
                {formatNumber(school.students)} students ·{' '}
                {formatNumber(school.professionals)} staff ·{' '}
                {school.lastActivityAt ? timeAgo(school.lastActivityAt) : 'no activity'}
              </p>
            </div>
            <RowMenu label={`Actions for ${school.name}`} items={menuItems(school)} />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline text-meta uppercase tracking-wider text-muted">
              <th className="py-3 pr-4 font-semibold">School</th>
              <th className="py-3 pr-4 font-semibold">Students</th>
              <th className="py-3 pr-4 font-semibold">Staff</th>
              <th className="py-3 pr-4 font-semibold">Pending chats</th>
              <th className="py-3 pr-4 font-semibold">Last activity</th>
              <th className="py-3 pr-4 font-semibold">Status</th>
              <th className="py-3 pl-2 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {schools.map((school) => (
              <tr key={school.id} className="align-middle text-copy-sm">
                <td className="py-3.5 pr-4">
                  <Link
                    to="/admin/schools/$id"
                    params={{ id: school.id }}
                    className="flex min-w-0 flex-col"
                  >
                    <span className="truncate text-card text-heading transition-colors hover:text-action">
                      {school.name}
                    </span>
                    <span className="text-caption tabular-nums text-muted">
                      {school.shortCode}
                    </span>
                  </Link>
                </td>
                <td className="py-3.5 pr-4 tabular-nums text-body">
                  {formatNumber(school.students)}
                </td>
                <td className="py-3.5 pr-4 tabular-nums text-body">
                  {formatNumber(school.professionals)}
                </td>
                <td className="py-3.5 pr-4">
                  {school.pendingChats > 0 ? (
                    <Tag tone="accent">{formatNumber(school.pendingChats)}</Tag>
                  ) : (
                    <span className="tabular-nums text-muted">0</span>
                  )}
                </td>
                <td className="py-3.5 pr-4 whitespace-nowrap text-body">
                  {school.lastActivityAt ? timeAgo(school.lastActivityAt) : '—'}
                </td>
                <td className="py-3.5 pr-4">
                  {school.status === 'ACTIVE' ? (
                    <Tag tone="success">Active</Tag>
                  ) : (
                    <Tag tone="danger">Suspended</Tag>
                  )}
                </td>
                <td className="py-3.5 pl-2 text-right">
                  <RowMenu label={`Actions for ${school.name}`} items={menuItems(school)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
