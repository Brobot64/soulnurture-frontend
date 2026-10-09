import { createFileRoute } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { EmptyState } from '#/components/dash/ui'
import { useRoleGuard } from '#/lib/dash'
import { CHAT_STAFF_ROLES } from '#/lib/auth'

export const Route = createFileRoute('/_dash/school/inbox')({
  head: () => ({ meta: [{ title: 'Inbox · Soul Nurture AI' }] }),
  component: SchoolInboxPage,
})

function SchoolInboxPage() {
  const user = useRoleGuard([...CHAT_STAFF_ROLES])
  if (!user) return null

  return (
    <>
      <DashHeader title="Inbox" subtitle="Student requests waiting for a professional" />
      <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <EmptyState
          icon={Inbox}
          title="Coming soon"
          body="This view lands in the next milestone."
        />
      </main>
    </>
  )
}
