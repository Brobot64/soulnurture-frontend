// Staff read-only view of the AI conversation a support request links to.
// Opened from the review queue's "View conversation" action — the backend
// widens GET /v1/conversations/:id to same-school staff, writes stay
// student-only.

import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { ErrorNote, Skeleton, Tag } from '#/components/dash/ui'
import { ApiError } from '#/lib/api'
import { CHAT_STAFF_ROLES } from '#/lib/auth'
import { useRoleGuard } from '#/lib/dash'
import { fetchConversation, type ConversationDetail } from '#/lib/journey'

export const Route = createFileRoute('/_dash/school/requests/$conversationId')({
  head: () => ({ meta: [{ title: 'Student conversation · Soul Nurture AI' }] }),
  component: StaffConversationPage,
})

function StaffConversationPage() {
  const user = useRoleGuard([...CHAT_STAFF_ROLES])
  const { conversationId } = Route.useParams()
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchConversation(conversationId)
      .then((found) => {
        if (cancelled) return
        setConversation(found)
        setLoading(false)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(caught instanceof ApiError ? caught.message : 'Could not load the conversation.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, conversationId, attempt])

  if (!user) return null

  return (
    <>
      <DashHeader
        title="Student conversation"
        subtitle="The AI-guided reflection this request was raised from. Read-only."
      />
      <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
        <Link
          to="/school/requests"
          className="inline-flex w-fit items-center gap-1.5 text-chip font-medium text-action transition-colors hover:text-brand-4"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to support requests
        </Link>

        {error ? (
          <div className="flex flex-col items-start gap-3">
            <ErrorNote>{error}</ErrorNote>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="text-chip font-medium text-action transition-colors hover:text-brand-4"
            >
              Try again
            </button>
          </div>
        ) : loading || !conversation ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 w-3/5 self-end rounded-3xl" />
            <Skeleton className="h-16 w-3/5 rounded-3xl" />
            <Skeleton className="h-16 w-2/5 self-end rounded-3xl" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-copy-sm text-body">Conversation</span>
              <Tag tone={conversation.status === 'ACTIVE' ? 'neutral' : 'success'}>
                {conversation.status === 'ACTIVE' ? 'Open' : 'Closed'}
              </Tag>
            </div>

            {conversation.messages.length === 0 ? (
              <p className="text-copy-sm text-muted">No messages in this conversation yet.</p>
            ) : (
              <ol className="flex max-w-[760px] flex-col gap-3">
                {conversation.messages.map((message) => (
                  <li
                    key={message.id}
                    className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-copy-sm ${
                      message.role === 'USER'
                        ? 'self-end bg-action text-white'
                        : message.role === 'SYSTEM'
                          ? 'self-center border border-hairline bg-panel-2/60 text-muted'
                          : 'self-start border border-hairline bg-white text-body'
                    }`}
                  >
                    {message.content}
                  </li>
                ))}
              </ol>
            )}

            <p className="text-caption text-muted">
              AI-guided reflection transcript. Reflection prompts only — not medical advice,
              therapy, or an emergency service.
            </p>
          </>
        )}
      </main>
    </>
  )
}
