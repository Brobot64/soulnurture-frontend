import { createFileRoute } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { EmptyState } from '#/components/dash/ui'
import { useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/school/')({
  head: () => ({ meta: [{ title: 'Overview · Soul Nurture AI' }] }),
  component: SchoolOverviewPage,
})

function SchoolOverviewPage() {
  const user = useRoleGuard(['SCHOOL_ADMIN', 'PLATFORM_ADMIN'])
  if (!user) return null

  return (
    <>
      <DashHeader title="Overview" subtitle="Your school's wellbeing at a glance" />
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
