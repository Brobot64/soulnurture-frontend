// The student conversation page — the thread opened from /support.

import { useEffect } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { ThreadView } from '#/components/chat/ThreadView'
import { isChatStaff, useSession } from '#/lib/auth'

export const Route = createFileRoute('/_app/support/$threadId')({
  head: () => ({ meta: [{ title: 'Conversation · Soul Nurture AI' }] }),
  component: SupportThreadPage,
})

function SupportThreadPage() {
  const navigate = useNavigate()
  const { user, status } = useSession()
  const { threadId } = Route.useParams()

  useEffect(() => {
    if (status !== 'ready' || user) return
    void navigate({
      to: '/signin',
      search: { redirect: `/support/${threadId}` },
      replace: true,
    })
  }, [status, user, navigate, threadId])

  if (!user) return null

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-6 py-8 lg:px-8 lg:py-12">
      <Link
        to="/support"
        className="flex w-fit items-center gap-2 text-copy-sm text-muted transition-colors hover:text-heading"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to support
      </Link>
      <h1 className="mt-4 text-title text-heading">Your conversation</h1>
      <div className="mt-6">
        <ThreadView
          threadId={threadId}
          viewer={isChatStaff(user.role) ? 'staff' : 'student'}
        />
      </div>
    </div>
  )
}
