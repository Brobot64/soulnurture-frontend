import { createFileRoute } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { EmptyState } from '#/components/dash/ui'
import { useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/admin/')({
  head: () => ({ meta: [{ title: 'Overview · Soul Nurture AI' }] }),
  component: AdminOverviewPage,
})

function AdminOverviewPage() {
  const user = useRoleGuard(['PLATFORM_ADMIN'])
  if (!user) return null

  return (
    <>
      <DashHeader title="Overview" subtitle="Platform activity at a glance" />
      <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <EmptyState
          icon={LayoutDashboard}
          title="Coming soon"
          body="This view lands in the next milestone."
        />
      </main>
    </>
  )
}
