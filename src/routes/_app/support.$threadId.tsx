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
    // Every pixel of chrome here comes off the transcript: the page is a fixed
    // column and the history scrolls inside its own box, so the title is hidden
    // on phones (the card header already says who you are talking to) and the
    // padding is the mobile size until lg.
    <div className="mx-auto flex min-h-0 w-full max-w-[760px] flex-1 flex-col px-6 py-4 lg:px-8 lg:py-12">
      <Link
        to="/support"
        className="flex w-fit shrink-0 items-center gap-2 text-copy-sm text-muted transition-colors hover:text-heading"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to support
      </Link>
      {/* Screen-reader and SEO heading kept, its height not spent on a phone:
          the card header already says who you are talking to. */}
      <h1 className="sr-only mt-4 text-title text-heading lg:not-sr-only lg:block">Your conversation</h1>
      <div className="mt-4 flex min-h-0 flex-1 flex-col lg:mt-6">
        <ThreadView
          threadId={threadId}
          viewer={isChatStaff(user.role) ? 'staff' : 'student'}
        />
      </div>
    </div>
  )
}
