import { createFileRoute } from '@tanstack/react-router'
import { Users } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { EmptyState } from '#/components/dash/ui'
import { useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/school/users')({
  head: () => ({ meta: [{ title: 'Users · Soul Nurture AI' }] }),
  component: SchoolUsersPage,
})

function SchoolUsersPage() {
  const user = useRoleGuard(['SCHOOL_ADMIN', 'PLATFORM_ADMIN'])
  if (!user) return null

  return (
    <>
      <DashHeader title="Users" subtitle="Students and professionals at your school" />
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
