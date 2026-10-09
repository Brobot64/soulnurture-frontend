import { createFileRoute } from '@tanstack/react-router'
import { School } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { EmptyState } from '#/components/dash/ui'
import { useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/admin/schools')({
  head: () => ({ meta: [{ title: 'Schools · Soul Nurture AI' }] }),
  component: AdminSchoolsPage,
})

function AdminSchoolsPage() {
  const user = useRoleGuard(['PLATFORM_ADMIN'])
  if (!user) return null

  return (
    <>
      <DashHeader title="Schools" subtitle="Every school on the platform" />
      <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <EmptyState
          icon={School}
          title="Coming soon"
          body="This view lands in the next milestone."
        />
      </main>
    </>
  )
}
