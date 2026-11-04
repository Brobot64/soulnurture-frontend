// Secure school chat creation remains separate from read-only support request records.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Save,
  SendHorizontal,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import { ChatStatusTag } from '#/components/chat/ThreadView'
import { Flash, useFlash } from '#/components/Flash'
import { ApiError } from '#/lib/api'
import { createChatThread, fetchChatThreads, useChatUnread, type ChatThreadListItem } from '#/lib/chat'
import { timeAgo, useApiQuery } from '#/lib/dash'
import { fetchLatestCheckIn, getMoodByFeeling, type CheckIn } from '#/lib/journey'
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
  return <StudentSupport key={student.id} schoolName={student.school?.name ?? null} />
}

/** What the student just sent, kept so the confirmation screen can repeat it back. */
interface SentRequest {
  threadId: string
  createdAt: string
  note: string | null
  checkIn: CheckIn | null
}

function StudentSupport({ schoolName }: { schoolName: string | null }) {
  const navigate = useNavigate()
  const { message, hiding } = useFlash()
  const threads = useApiQuery(fetchChatThreads)
  const unread = useChatUnread()
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const [sent, setSent] = useState<SentRequest | null>(null)
  const submissionLock = useRef(false)
  const latestCheckIn = useApiQuery(fetchLatestCheckIn)
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
    const note = draft.trim() || null
    try {
      const thread = await createChatThread(note ? { note } : {})
      // Only a successful, real chat thread earns the confirmation screen.
      // entryCheckInId is the server's own record of what it attached, so the
      // receipt repeats that rather than what the form guessed.
      const attached = thread.entryCheckInId && latestCheckIn.data?.id === thread.entryCheckInId
        ? latestCheckIn.data
        : null
      setSent({ threadId: thread.id, createdAt: thread.createdAt, note, checkIn: attached })
      setDraft('')
      setWriting(false)
      reload()
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

  if (sent) {
    return (
      <Page>
        <RequestSent sent={sent} otherThreads={conversations} />
        <Flash message={message} hiding={hiding} />
      </Page>
    )
  }

  return (
    <Page>
      <nav aria-label="Support navigation" className="flex flex-wrap items-center justify-between gap-4">
        <Link to="/welcome" className="inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline">
          <ArrowLeft aria-hidden="true" className="size-4" /> Back to home
        </Link>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Link to="/support/requests" className="inline-flex min-h-11 items-center text-button-sm text-action hover:underline">My support requests</Link>
          <Link to="/support/status-guide" className="inline-flex min-h-11 items-center text-button-sm text-action hover:underline">Status guide</Link>
        </div>
      </nav>

      <div className="mt-7 grid items-start gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0" aria-busy={submitting}>
          {writing ? (
            <SupportForm
              draft={draft}
              onDraftChange={setDraft}
              onSubmit={(event) => void handleAsk(event)}
              onCancel={() => setWriting(false)}
              submitting={submitting}
              submitError={submitError}
              checkIn={latestCheckIn.data}
            />
          ) : (
            <SupportLanding
              pending={pending}
              pendingUnread={pending ? unread.byThread[pending.id] ?? 0 : 0}
              threadsLoading={threads.loading && !threads.data}
              hardError={!!threads.error && (!threads.data || accessDenied)}
              loading={threads.loading}
              onRetry={reload}
              onRequest={() => setWriting(true)}
              schoolName={schoolName}
            />
          )}

          {threads.error && threads.data && !accessDenied && !writing && (
            <div className="mt-4 rounded-card border border-hairline p-4">
              <p role="alert" className="text-copy-sm text-body">We couldn't refresh your conversations. These are the last loaded details.</p>
              <button type="button" onClick={reload} disabled={threads.loading} className="mt-2 min-h-11 text-button-sm text-action underline disabled:opacity-60">Try again</button>
            </div>
          )}

          {threads.data && !accessDenied && !writing && (
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

        {!writing && (
          <aside aria-label="About school support" className="space-y-4">
            <RailCard Icon={ShieldCheck} title="Who can see it">
              <p>Only authorised school professionals{schoolName ? ` at ${schoolName}` : ' at your school'} can read your request. Other students can’t.</p>
              <Link to="/privacy" className="mt-3 inline-flex min-h-11 items-center gap-2 text-button-sm text-action hover:underline">Read about privacy <ArrowRight aria-hidden="true" className="size-4" /></Link>
            </RailCard>
            <RailCard Icon={Save} title="What we save">
              <p>Your request, when you sent it and its status. If you have done a check-in, the newest one is saved with it.</p>
            </RailCard>
            <RailCard Icon={Bot} title="AI and people are different">
              <p>Soul Nurture AI helps you reflect and find ideas. A school counsellor is a trained person who can talk with you and plan next steps.</p>
            </RailCard>
            <EmergencyCard />
            <WhatsAppCard />
          </aside>
        )}

        {writing && (
          <aside aria-label="What happens after you send" className="space-y-4">
            <section className="rounded-card border border-hairline bg-white p-6">
              <h2 className="text-card text-muted">What happens after you send</h2>
              <ol className="mt-5 space-y-5">
                {[
                  ['You’ll see it as New', 'It appears on your dashboard straight away.'],
                  ['A professional reviews it', 'Only authorised school professionals can open it.'],
                  ['You’ll see updates', 'From Reviewed to Follow-Up Completed, all in one place.'],
                ].map(([title, detail]) => <StepRow key={title} title={title} detail={detail} />)}
              </ol>
            </section>
            <EmergencyCard />
          </aside>
        )}
      </div>
      <Flash message={message} hiding={hiding} />
    </Page>
  )
}

function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1160px] flex-1 px-5 py-8 sm:px-8 lg:py-12">{children}</div>
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-pill bg-panel px-3.5 py-1.5 text-caption font-semibold text-brand-4">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-action" />
      {children}
    </span>
  )
}

function StepRow({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="mt-1.5 grid size-4 shrink-0 place-items-center rounded-full bg-peach">
        <span className="size-2 rounded-full bg-peach-ink/70" />
      </span>
      <div className="min-w-0">
        <h3 className="text-button-sm text-heading">{title}</h3>
        <p className="mt-1 text-copy-sm text-body">{detail}</p>
      </div>
    </li>
  )
}

function RailCard({ Icon, title, children }: { Icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-hairline bg-white p-5">
      <div className="flex gap-4">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-panel text-action">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-card text-heading">{title}</h2>
          <div className="mt-2 text-copy-sm text-body">{children}</div>
        </div>
      </div>
    </section>
  )
}

function EmergencyCard({ className = '' }: { className?: string }) {
  return (
    <section className={`rounded-card border border-apricot-10 bg-peach p-5 ${className}`}>
      <div className="flex items-center gap-3 text-peach-ink">
        <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />
        <h2 className="text-card">Not for emergencies</h2>
      </div>
      <p className="mt-3 text-copy-sm text-peach-ink">{SUPPORT_EMERGENCY_NOTICE}</p>
    </section>
  )
}

function SupportLanding({
  pending,
  pendingUnread,
  threadsLoading,
  hardError,
  loading,
  onRetry,
  onRequest,
  schoolName,
}: {
  pending: ChatThreadListItem | null
  pendingUnread: number
  threadsLoading: boolean
  hardError: boolean
  loading: boolean
  onRetry: () => void
  onRequest: () => void
  schoolName: string | null
}) {
  return (
    <>
      <Eyebrow>How it works</Eyebrow>
      <h1 className="mt-5 text-title text-heading lg:text-title-lg">Talk to a school counsellor</h1>
      <p className="mt-5 max-w-[640px] text-copy text-body lg:text-[19px]">
        A real person at your school can read your request and decide how to support you. It’s your choice, and you can ask at any time.
      </p>

      {threadsLoading ? (
        <p role="status" className="mt-7 rounded-panel border border-hairline p-6 text-copy text-body">Loading your conversations…</p>
      ) : hardError ? (
        <section className="mt-7 rounded-panel border border-hairline bg-white p-6 lg:p-8">
          <h2 className="text-section text-heading">Conversations unavailable</h2>
          <p role="alert" className="mt-2 text-copy-sm text-body">We couldn't load your conversations. Check your connection or sign in again, then retry.</p>
          <button type="button" onClick={onRetry} disabled={loading} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-pill bg-action px-6 text-button-sm text-white hover:bg-brand-4 disabled:opacity-60">
            <RefreshCw aria-hidden="true" className="size-4" /> Try again
          </button>
        </section>
      ) : (
        <>
          <section className="mt-8 rounded-panel border border-hairline bg-white p-6 lg:p-8">
            <h2 className="text-card text-muted">How it works</h2>
            <ol className="mt-6 space-y-6">
              {[
                ['You send a request', 'Share as much or as little as you like. A message is optional.'],
                ['An authorised professional reviews it', `Only a school counsellor or psychologist${schoolName ? ` at ${schoolName}` : ''} who is allowed to see it can open it.`],
                ['A person decides how to follow up', 'Not the AI. You can follow its progress on your dashboard.'],
              ].map(([title, detail]) => <StepRow key={title} title={title} detail={detail} />)}
            </ol>
          </section>

          {pending ? (
            <section className="mt-8 rounded-panel border border-hairline bg-white p-6 lg:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-caption text-muted">Chat status</span>
                <ChatStatusTag status={pending.status} />
              </div>
              <h2 className="mt-4 text-section text-heading">Your request to talk has been sent</h2>
              <p className="mt-3 text-copy text-body">{SUPPORT_RESPONSE_NOTICE}</p>
              <p className="mt-3 text-caption text-muted">Sent <time dateTime={pending.createdAt}>{supportTimestamp(pending.createdAt)}</time></p>
              <Link to="/support/$threadId" params={{ threadId: pending.id }} className="mt-6 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-pill bg-action px-6 text-button text-white hover:bg-brand-4">
                Open conversation <ArrowRight aria-hidden="true" className="size-4" />
                {pendingUnread > 0 && <span className="text-caption">({pendingUnread} unread)</span>}
              </Link>
              <p className="mt-3 text-caption text-muted">You can cancel your request or end the chat from your conversation.</p>
            </section>
          ) : (
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={onRequest} disabled={loading} className="inline-flex min-h-[52px] items-center justify-center rounded-pill bg-action px-7 text-button text-white hover:bg-brand-4 disabled:opacity-60">Request support</button>
              <Link to="/welcome" className="inline-flex min-h-[52px] items-center justify-center rounded-pill bg-surface px-7 text-button text-brand-4 hover:bg-neutral-10">Not now</Link>
            </div>
          )}
        </>
      )}
    </>
  )
}

function SupportForm({
  draft,
  onDraftChange,
  onSubmit,
  onCancel,
  submitting,
  submitError,
  checkIn,
}: {
  draft: string
  onDraftChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
  submitting: boolean
  submitError: string | null
  checkIn: CheckIn | null
}) {
  const mood = checkIn ? getMoodByFeeling(checkIn.feeling) : undefined
  const triggers = checkIn?.triggers ?? []

  return (
    <>
      <Link to="/support" className="inline-flex min-h-11 items-center gap-3 text-button-sm text-action hover:underline">
        <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-panel"><ArrowLeft className="size-4" /></span>
        Back
      </Link>
      <h1 className="mt-6 text-title text-heading lg:text-title-lg">Send a request</h1>
      <p className="mt-4 text-copy text-body">Share as much or as little as you like. You don’t have to explain everything.</p>

      <form onSubmit={onSubmit} className="mt-7 rounded-panel border border-hairline bg-white p-6 lg:p-8">
        <label htmlFor="ask-note" className="text-card text-heading">Is there anything you’d like them to know? <span className="font-normal">(optional)</span></label>
        <textarea
          id="ask-note"
          rows={5}
          maxLength={500}
          value={draft}
          disabled={submitting}
          onChange={(event) => onDraftChange(event.target.value)}
          aria-describedby="ask-note-count ask-note-help"
          placeholder="For example: I've been finding school really hard lately…"
          className="mt-3 w-full resize-y rounded-card border border-hairline bg-white px-4 py-3 text-copy text-ink placeholder:text-muted focus:border-brand-4 disabled:opacity-60"
        />
        <p id="ask-note-count" className="mt-1 text-right text-caption text-muted">{draft.length} / 500</p>

        {checkIn && (
          <div className="mt-5 rounded-card border border-action/40 bg-panel p-5">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-md bg-action text-white"><Check className="size-4" /></span>
              <h2 className="text-card text-heading">Your latest check-in goes with this</h2>
            </div>
            <p className="mt-2 text-copy-sm text-body">This helps the counsellor understand how you’re feeling.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex h-9 items-center rounded-pill bg-surface px-4 text-chip text-body">Feeling: {mood?.label ?? checkIn.feeling}</span>
              {triggers.length > 0 && <span className="inline-flex h-9 items-center rounded-pill bg-surface px-4 text-chip text-body">On your mind: {triggers.join(', ')}</span>}
            </div>
          </div>
        )}

        <p id="ask-note-help" className="mt-5 text-copy-sm text-muted">
          When you send this, an authorised school professional can read it. You can read more about how your information is handled in{' '}
          <Link to="/privacy" className="text-action underline">About this chat</Link>.
        </p>
        {submitError && <p role="alert" className="mt-4 text-copy-sm text-destructive">{submitError}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={submitting || !!submitError} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-pill bg-action px-7 text-button text-white hover:bg-brand-4 disabled:opacity-60">
            <SendHorizontal aria-hidden="true" className="size-4" /> {submitting ? 'Sending…' : 'Send request'}
          </button>
          <button type="button" onClick={onCancel} disabled={submitting} className="inline-flex min-h-[52px] items-center justify-center rounded-pill bg-surface px-7 text-button text-brand-4 hover:bg-neutral-10 disabled:opacity-60">Cancel</button>
        </div>
        {submitting && <p role="status" className="mt-3 text-copy-sm text-body">Sending your request to talk…</p>}
      </form>
    </>
  )
}

function RequestSent({ sent, otherThreads }: { sent: SentRequest; otherThreads: ChatThreadListItem[] }) {
  const mood = sent.checkIn ? getMoodByFeeling(sent.checkIn.feeling) : undefined
  const shared = [
    sent.note ? 'Your message' : null,
    sent.checkIn ? `your latest check-in (${mood?.label ?? sent.checkIn.feeling}${sent.checkIn.triggers.length ? `; ${sent.checkIn.triggers.join(', ')}` : ''})` : null,
  ].filter(Boolean)

  return (
    <>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-12">
        <div className="min-w-0">
          <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-panel">
            <span className="grid size-11 place-items-center rounded-full bg-action text-white"><Check className="size-6" /></span>
          </span>
          <h1 className="mt-6 text-title text-heading lg:text-title-lg">Your request has been sent</h1>
          <p className="mt-4 text-copy text-body">Thank you for reaching out. A school counsellor or psychologist will review it.</p>

          <section className="mt-7 rounded-panel border border-hairline bg-white p-6">
            <p className="text-caption text-muted">Request status</p>
            <span className="mt-2 inline-flex rounded-pill bg-peach px-3.5 py-1.5 text-chip font-semibold text-peach-ink">New</span>
            <div className="mt-5 border-t border-hairline pt-5">
              <p className="flex items-center gap-2 text-copy-sm text-body"><Clock3 aria-hidden="true" className="size-4 shrink-0 text-muted" /> Sent <time dateTime={sent.createdAt}>{supportTimestamp(sent.createdAt)}</time></p>
              {shared.length > 0 && (
                <>
                  <p className="mt-4 text-caption text-muted">Shared with your request</p>
                  <p className="mt-1 text-copy-sm text-body">{shared.join(' and ')}.</p>
                </>
              )}
              <p className="mt-4 flex items-start gap-2 text-caption text-muted"><LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> Only authorised school professionals can see this.</p>
            </div>
          </section>
        </div>

        <div className="min-w-0">
          <h2 className="text-section text-heading lg:text-title-sm">What happens next</h2>
          <ul className="mt-5 space-y-4">
            {[
              { Icon: UserRound, title: 'A person reads your request', detail: 'An authorised school professional reviews it. This is a person, not the AI.' },
              { Icon: ShieldCheck, title: 'They decide how to follow up', detail: 'Your school’s safeguarding steps and their professional judgement guide what happens next.' },
              { Icon: Clock3, title: 'You’ll see updates here', detail: 'Track it any time from your dashboard, from New to Follow-Up Completed.' },
            ].map((row) => (
              <li key={row.title}>
                <RailCard Icon={row.Icon} title={row.title}><p>{row.detail}</p></RailCard>
              </li>
            ))}
            <li>
              <Link
                to="/resources"
                className="flex items-center gap-4 rounded-card border border-hairline bg-white p-5 hover:bg-panel"
              >
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-action text-white"><BookOpen className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-card text-heading">While you wait: wellbeing resources</span>
                  <span className="mt-1 block text-copy-sm text-body">Ideas for exam stress and better sleep</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-action" />
              </Link>
            </li>
          </ul>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/support/$threadId" params={{ threadId: sent.threadId }} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-pill bg-action px-7 text-button text-white hover:bg-brand-4">
              Open your conversation <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link to="/welcome" className="inline-flex min-h-[52px] items-center justify-center rounded-pill bg-surface px-7 text-button text-brand-4 hover:bg-neutral-10">Back to home</Link>
          </div>
          <p className="mt-5 flex items-start gap-2 text-copy-sm text-peach-ink">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>Need help right now? {SUPPORT_EMERGENCY_NOTICE}</span>
          </p>
        </div>
      </div>

      {/* The confirmation screen replaces the landing, so the only route back to
          an older conversation has to live here. */}
      {otherThreads.length > 0 && (
        <section className="mt-10 rounded-panel border border-hairline p-6 lg:p-8">
          <h2 className="text-section text-heading">Your other conversations</h2>
          <ul className="mt-4 divide-y divide-hairline">
            {otherThreads.map((thread) => <ConversationRow key={thread.id} thread={thread} unread={0} />)}
          </ul>
        </section>
      )}
    </>
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
    <RailCard Icon={MessageCircle} title="Prefer WhatsApp?">
      <p>Use the configured school contact on WhatsApp. This does not assign you to a professional or confirm anyone is available.</p>
      <p className="mt-3 text-caption text-muted">WhatsApp opens outside Soul Nurture AI. Your phone number and anything you send there are shared through WhatsApp, not this secure chat.</p>
      <a href={href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-pill border border-hairline px-5 text-button-sm text-action hover:bg-panel">Open WhatsApp <span className="sr-only">(opens in a new tab)</span><ArrowRight aria-hidden="true" className="size-4" /></a>
    </RailCard>
  )
}
