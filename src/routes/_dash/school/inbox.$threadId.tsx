// The staff conversation page — inbox thread opened by a counsellor.

import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { ThreadView } from '#/components/chat/ThreadView'
import { CHAT_STAFF_ROLES } from '#/lib/auth'
import { useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/school/inbox/$threadId')({
  head: () => ({ meta: [{ title: 'Conversation · Soul Nurture AI' }] }),
  component: SchoolInboxThreadPage,
})

function SchoolInboxThreadPage() {
  const user = useRoleGuard([...CHAT_STAFF_ROLES])
  const { threadId } = Route.useParams()
  if (!user) return null

  return (
    <>
      <DashHeader title="Conversation" />
      {/* Same shell contract the student thread page gives ThreadView: the page
          is a fixed column and the transcript inside it does the scrolling. */}
      <main className="flex min-h-0 flex-1 flex-col gap-6 p-6 lg:p-8">
        <Link
          to="/school/inbox"
          className="flex w-fit shrink-0 items-center gap-2 text-copy-sm text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to inbox
        </Link>
        <ThreadView threadId={threadId} viewer="staff" />
      </main>
    </>
  )
}
