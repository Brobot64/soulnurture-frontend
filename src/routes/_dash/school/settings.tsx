import { createFileRoute } from '@tanstack/react-router'
import { Settings } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { EmptyState } from '#/components/dash/ui'
import { useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/school/settings')({
  head: () => ({ meta: [{ title: 'Settings · Soul Nurture AI' }] }),
  component: SchoolSettingsPage,
})

function SchoolSettingsPage() {
  const user = useRoleGuard(['SCHOOL_ADMIN', 'PLATFORM_ADMIN'])
  if (!user) return null

  return (
    <>
      <DashHeader title="Settings" subtitle="School profile and access" />
      <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <EmptyState
          icon={Settings}
          title="Coming soon"
          body="This view lands in the next milestone."
        />
      </main>
    </>
  )
}
