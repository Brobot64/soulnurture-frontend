import { createFileRoute } from '@tanstack/react-router'
import { Users } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { EmptyState } from '#/components/dash/ui'
import { useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/admin/users')({
  head: () => ({ meta: [{ title: 'Users · Soul Nurture AI' }] }),
  component: AdminUsersPage,
})

function AdminUsersPage() {
  const user = useRoleGuard(['PLATFORM_ADMIN'])
  if (!user) return null

  return (
    <>
      <DashHeader title="Users" subtitle="Everyone across the platform" />
      <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <EmptyState
          icon={Users}
          title="Coming soon"
          body="This view lands in the next milestone."
        />
      </main>
    </>
  )
}
