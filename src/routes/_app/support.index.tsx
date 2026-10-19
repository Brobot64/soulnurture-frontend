// Secure school chat creation remains separate from read-only support request records.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, HeartHandshake, LockKeyhole, MessageCircle, RefreshCw, SendHorizontal, ShieldCheck, TriangleAlert } from 'lucide-react'

import { ChatStatusTag } from '#/components/chat/ThreadView'
import { Flash, useFlash } from '#/components/Flash'
import { ApiError } from '#/lib/api'
import { createChatThread, fetchChatThreads, useChatUnread, type ChatThreadListItem } from '#/lib/chat'
import { timeAgo, useApiQuery } from '#/lib/dash'
import { onRealtimeEvent } from '#/lib/socket'
import { initialsOf, SUPPORT_EMERGENCY_NOTICE, SUPPORT_RESPONSE_NOTICE, useStudentSupportAccess, whatsappHandoffLink } from '#/lib/support'
import { supportTimestamp } from '#/lib/support-requests'

export const Route = createFileRoute('/_app/support/')({
  head: () => ({
    meta: [
      { title: 'Talk to a school counsellor · Soul Nurture AI' },
      { name: 'description', content: 'Ask to talk with a school professional in a secure conversation. Response times vary. This is not an emergency service.' },
    ],
  }),
  component: Support,
})

function Support() {
  const student = useStudentSupportAccess('/support')
  if (!student) {
    return <p role="status" className="mx-auto w-full max-w-[1160px] px-6 py-12 text-copy text-body">Checking your access to student support…</p>
  }
  return <StudentSupport key={student.id} />
}

function StudentSupport() {
  const navigate = useNavigate()
  const { message, hiding } = useFlash()
  const threads = useApiQuery(fetchChatThreads)
  const unread = useChatUnread()
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submissionLock = useRef(false)
  const { reload } = threads

  useEffect(() => {
    if (threads.error?.status === 401) {
      void navigate({ to: '/signin', search: { redirect: '/support' }, replace: true })
    }
  }, [threads.error, navigate])

  useEffect(() => {
    const unsubscribes = [
      onRealtimeEvent('chat.thread.claimed', reload),
      onRealtimeEvent('chat.message.new', reload),
      onRealtimeEvent('chat.thread.closed', reload),
    ]
    return () => unsubscribes.forEach((off) => off())
  }, [reload])

  const handleAsk = async (event: FormEvent) => {
    event.preventDefault()
    if (submissionLock.current || threads.loading || threads.error) return
    submissionLock.current = true
    setSubmitting(true)
    setSubmitError(null)
    try {
      const note = draft.trim()
      const thread = await createChatThread(note ? { note } : {})
      // Only a successful, real chat thread can open the conversation.
      await navigate({ to: '/support/$threadId', params: { threadId: thread.id } })
    } catch (caught) {
      submissionLock.current = false
      setSubmitting(false)
      setSubmitError(caught instanceof ApiError ? caught.message : 'Could not send your request. Please try again.')
      reload()
    }
  }

  const list = threads.data ?? []
  const pending = list.find((thread) => thread.status === 'PENDING') ?? null
  const conversations = list.filter((thread) => thread.id !== pending?.id)
  const accessDenied = threads.error?.status === 401 || threads.error?.status === 403

  return (
    <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8 lg:py-12">
      <nav aria-label="Support navigation" className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/welcome" className="inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline">
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to home
        </Link>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link to="/support/requests" className="inline-flex min-h-11 items-center text-button-sm text-action hover:underline">My support requests</Link>
          <Link to="/support/status-guide" className="inline-flex min-h-11 items-center text-button-sm text-action hover:underline">Status guide</Link>
        </div>
      </nav>

      <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-pill bg-panel px-3 py-1 text-caption text-brand-4">
            <HeartHandshake aria-hidden="true" className="size-4" /> Here for you
          </span>
          <h1 className="mt-4 text-title text-heading lg:text-title-lg">Talk to a school counsellor</h1>
          <p className="mt-4 text-copy text-body">You can ask to talk to a counsellor or psychologist at your school. Share as much or as little as you like.</p>
          <p className="mt-3 text-copy-sm text-body">{SUPPORT_RESPONSE_NOTICE}</p>

          <div className="mt-7" aria-busy={threads.loading || submitting}>
            {threads.loading && !threads.data ? (
              <p role="status" className="rounded-panel border border-hairline p-6 text-copy text-body">Loading your conversations…</p>
            ) : threads.error && (!threads.data || accessDenied) ? (
              <section className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
                <h2 className="text-section text-heading">Conversations unavailable</h2>
                <p role="alert" className="mt-2 text-copy-sm text-body">We couldn't load your conversations. Check your connection or sign in again, then retry.</p>
                <button type="button" onClick={reload} disabled={threads.loading} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4 disabled:opacity-60">
                  <RefreshCw aria-hidden="true" className="size-4" /> Try again
                </button>
              </section>
            ) : pending ? (
              <section className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-caption text-muted">Chat status</span>
                  <ChatStatusTag status={pending.status} />
                </div>
                <h2 className="mt-4 text-section text-heading">Your request to talk has been sent</h2>
                <p className="mt-3 text-copy text-body">{SUPPORT_RESPONSE_NOTICE}</p>
                <p className="mt-3 text-caption text-muted">Sent <time dateTime={pending.createdAt}>{supportTimestamp(pending.createdAt)}</time></p>
                <Link to="/support/$threadId" params={{ threadId: pending.id }} className="mt-6 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-pill bg-action px-6 text-button text-white hover:bg-brand-4">
                  Open conversation <ArrowRight aria-hidden="true" className="size-4" />
                  {(unread.byThread[pending.id] ?? 0) > 0 && <span className="text-caption">({unread.byThread[pending.id]} unread)</span>}
                </Link>
                <p className="mt-3 text-caption text-muted">You can cancel your request or end the chat from your conversation.</p>
              </section>
            ) : (
              <section className="rounded-panel border border-hairline bg-white p-6 lg:p-8">
                <h2 className="text-section text-heading">Send a request</h2>
                <p className="mt-2 text-copy-sm text-body">This opens a secure conversation with your school's support team.</p>
                <form className="mt-6" onSubmit={(event) => void handleAsk(event)}>
                  <label htmlFor="ask-note" className="text-card text-heading">Is there anything you'd like them to know? <span className="font-normal">(optional)</span></label>
                  <textarea id="ask-note" rows={5} maxLength={500} value={draft} disabled={submitting} onChange={(event) => setDraft(event.target.value)} aria-describedby="ask-note-help ask-note-count" placeholder="For example: I've been finding school really hard lately." className="mt-3 w-full resize-y rounded-card border border-hairline bg-page px-4 py-3 text-copy text-ink placeholder:text-muted focus:border-brand-4 disabled:opacity-60" />
                  <p id="ask-note-count" className="mt-1 text-right text-caption text-muted">{draft.length}/500 characters</p>
                  <div id="ask-note-help" className="mt-4 flex gap-3 rounded-card border border-hairline bg-panel p-4 text-copy-sm text-body">
                    <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-action" />
                    <p>Your note is shared with authorised school professionals through this conversation. You don't need to explain everything now.</p>
                  </div>
                  {submitError && <p role="alert" className="mt-4 text-copy-sm text-destructive">{submitError}</p>}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button type="submit" disabled={submitting || threads.loading || !!threads.error} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-pill bg-action px-6 text-button text-white hover:bg-brand-4 disabled:opacity-60">
                      <SendHorizontal aria-hidden="true" className="size-4" /> {submitting ? 'Sending…' : 'Send request'}
                    </button>
                    <Link to="/welcome" className="inline-flex min-h-[52px] items-center justify-center rounded-pill bg-surface px-6 text-button text-brand-4 hover:bg-neutral-10">Not now</Link>
                  </div>
                  {submitting && <p role="status" className="mt-3 text-copy-sm text-body">Sending your request to talk…</p>}
                </form>
              </section>
            )}
          </div>

          {threads.error && threads.data && !accessDenied && (
            <div className="mt-4 rounded-card border border-hairline p-4">
              <p role="alert" className="text-copy-sm text-body">We couldn't refresh your conversations. These are the last loaded details.</p>
              <button type="button" onClick={reload} disabled={threads.loading} className="mt-2 min-h-11 text-button-sm text-action underline disabled:opacity-60">Try again</button>
            </div>
          )}

          {threads.data && !accessDenied && (
            <section id="conversations" className="mt-6 scroll-mt-6 rounded-panel border border-hairline p-6 lg:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-section text-heading">Chat history</h2>
                <button type="button" onClick={reload} disabled={threads.loading} className="inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline disabled:opacity-60">
                  <RefreshCw aria-hidden="true" className="size-4" /> {threads.loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              <p className="mt-2 text-copy-sm text-body">These are your conversations, separate from <Link to="/support/requests" className="text-action underline">support request records</Link>. An active chat does not mean a request has been reviewed.</p>
              {conversations.length > 0 ? (
                <ul className="mt-4 divide-y divide-hairline">
                  {conversations.map((thread) => <ConversationRow key={thread.id} thread={thread} unread={unread.byThread[thread.id] ?? 0} />)}
                </ul>
              ) : <p className="mt-4 text-copy-sm text-muted">{pending ? 'Your pending conversation is shown above. No other conversations yet.' : 'No conversations yet. When you send a request to talk, your chat will be available here.'}</p>}
            </section>
          )}
        </div>

        <aside aria-label="About school support" className="space-y-4">
          <section className="rounded-card border border-hairline p-5">
            <div className="flex items-center gap-3"><ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-action" /><h2 className="text-card text-heading">Who can see it?</h2></div>
            <p className="mt-3 text-copy-sm text-body">Authorised school professionals can read your request and the messages you share in your conversation. Other students cannot see them.</p>
            <Link to="/privacy" className="mt-3 inline-flex min-h-11 items-center text-button-sm text-action hover:underline">Read about privacy <ArrowRight aria-hidden="true" className="ml-2 size-4" /></Link>
          </section>
          <section className="rounded-card border border-hairline p-5">
            <h2 className="text-card text-heading">How it works</h2>
            <ol className="mt-4 space-y-5">
              {[
                ['You send a request', 'Add a note if you want to. A secure chat is created for your school support team.'],
                ['A professional can review it', SUPPORT_RESPONSE_NOTICE],
                ['Continue in your conversation', 'When a professional joins, you can talk here. You can cancel or end your chat at any time.'],
              ].map(([title, detail], index) => (
                <li key={title} className="flex gap-3">
                  <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-peach text-caption text-peach-ink">{index + 1}</span>
                  <div><h3 className="text-button-sm text-heading">{title}</h3><p className="mt-1 text-copy-sm text-body">{detail}</p></div>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-card border border-hairline p-5">
            <div className="flex items-center gap-3"><HeartHandshake aria-hidden="true" className="size-5 shrink-0 text-action" /><h2 className="text-card text-heading">A person, not the AI</h2></div>
            <p className="mt-3 text-copy-sm text-body">This request is for a school professional, not an AI response. A professional decides how to offer support.</p>
          </section>
          <section className="rounded-card border border-apricot-10 bg-peach p-5">
            <div className="flex items-center gap-3 text-peach-ink"><TriangleAlert aria-hidden="true" className="size-5 shrink-0" /><h2 className="text-card">Not for emergencies</h2></div>
            <p className="mt-3 text-copy-sm text-peach-ink">{SUPPORT_EMERGENCY_NOTICE}</p>
          </section>
          <WhatsAppCard />
        </aside>
      </div>
      <Flash message={message} hiding={hiding} />
    </div>
  )
}

function ConversationRow({ thread, unread }: { thread: ChatThreadListItem; unread: number }) {
  const name = thread.professional?.user.name ?? 'Waiting for a counsellor'
  const latest = thread.messages?.[0]
  const preview = latest ? `${latest.role === 'STUDENT' ? 'You: ' : ''}${latest.content}` : 'No messages yet'

  return (
    <li>
      <Link to="/support/$threadId" params={{ threadId: thread.id }} className="flex items-center gap-3 rounded-lg py-4 hover:bg-panel sm:gap-4">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-blush text-[15px] font-bold text-brand-4">{initialsOf(name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><p className="truncate text-copy text-ink">{name}</p><ChatStatusTag status={thread.status} /></div>
          <p className="mt-1 truncate text-copy-sm text-muted">{preview}</p>
          <time dateTime={thread.updatedAt} title={supportTimestamp(thread.updatedAt)} className="mt-1 block text-caption text-muted">{timeAgo(thread.updatedAt)}</time>
        </div>
        {unread > 0 && <span aria-label={`${unread} unread messages`} className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-caption text-white">{unread > 99 ? '99+' : unread}</span>}
      </Link>
    </li>
  )
}

function WhatsAppCard() {
  const href = whatsappHandoffLink()
  if (!href) return null

  return (
    <section className="rounded-card border border-hairline p-5">
      <div className="flex items-center gap-3"><MessageCircle aria-hidden="true" className="size-5 shrink-0 text-action" /><h2 className="text-card text-heading">Prefer WhatsApp?</h2></div>
      <p className="mt-3 text-copy-sm text-body">Use the configured school contact on WhatsApp. This does not assign you to a professional or confirm anyone is available.</p>
      <p className="mt-3 text-caption text-muted">WhatsApp opens outside Soul Nurture AI. Your phone number and anything you send there are shared through WhatsApp, not this secure chat.</p>
      <a href={href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-pill border border-hairline px-5 text-button-sm text-action hover:bg-panel">Open WhatsApp <span className="sr-only">(opens in a new tab)</span><ArrowRight aria-hidden="true" className="size-4" /></a>
    </section>
  )
}
