import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Clock3,
  Headphones,
  Heart,
  MousePointer2,
  RefreshCw,
  Sprout,
  UserRound,
  Volume2,
  Wind,
} from 'lucide-react'

import { Button, ErrorNote } from '#/components/dash/ui'
import { SUPPORT_EMERGENCY_NOTICE, SUPPORT_RESPONSE_NOTICE } from '#/lib/support'
import {
  RESOURCE_CATEGORIES,
  RESOURCE_FEEDBACK_OPTIONS,
  resourceDuration,
  resourceSteps,
  safeResourceUrl,
  submitResourceFeedback,
  type Resource,
  type ResourceFeedbackChoice,
  type ResourceSearch,
  type ResourceToolbox,
  type ResourceType,
} from '#/lib/resources'

const TYPE_ICONS = {
  ARTICLE: BookOpen,
  AUDIO_GUIDE: Headphones,
  SOMATIC_EXERCISE: Wind,
  INTERACTIVE: MousePointer2,
  SOUNDSCAPE: Volume2,
  AFFIRMATION: Heart,
  TOOLKIT_ITEM: Sprout,
} satisfies Record<ResourceType, typeof BookOpen>

/** Shared resource presentation for the catalogue and the full detail screen. */
export function ResourceCard({
  resource,
  toolbox,
  search = {},
  detail = false,
}: {
  resource: Resource
  toolbox: ResourceToolbox
  search?: ResourceSearch
  detail?: boolean
}) {
  const Icon = TYPE_ICONS[resource.type] ?? BookOpen
  const duration = resourceDuration(resource)
  const steps = resourceSteps(resource)
  const saved = toolbox.savedIds.has(resource.id)
  const saving = toolbox.savingId === resource.id
  const error = toolbox.saveError?.resourceId === resource.id ? toolbox.saveError.error : null
  const url = safeResourceUrl(resource.mediaUrl)
  // A resource has a body beyond the card if any guided section or an external
  // asset exists. For the approved WN-* rows none do, so the detail screen says
  // that plainly instead of hiding four sections and promising a "full version".
  const hasGuidedContent =
    steps.length > 0 ||
    Boolean(resource.intendedSituation?.trim()) ||
    Boolean(resource.reflectionPrompt?.trim()) ||
    Boolean(resource.safetyNote?.trim())
  const saveLabel = saved
    ? 'Saved'
    : saving
      ? 'Saving…'
      : toolbox.error
        ? 'Save unavailable'
        : toolbox.loading && toolbox.count === null
          ? 'Checking saves…'
          : error
            ? 'Retry save'
            : 'Save to toolbox'

  return (
    <article className={`flex min-w-0 flex-col rounded-panel border border-hairline bg-white ${detail ? 'p-6 sm:p-8 lg:p-10' : 'p-6'}`}>
      <div className="flex items-start justify-between gap-3">
        <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-card bg-panel text-action ${detail ? 'size-16' : 'size-12'}`}>
          <Icon className={detail ? 'size-7' : 'size-5'} strokeWidth={1.7} />
        </span>
        {resource.badge?.trim() && (
          <span className="max-w-[70%] break-words rounded-pill bg-peach px-3 py-1.5 text-chip text-peach-ink">
            {resource.badge}
          </span>
        )}
      </div>
      <p className="mt-5 text-chip font-medium text-action">
        {RESOURCE_CATEGORIES[resource.category] ?? 'Wellbeing'}
      </p>
      {detail ? (
        <h1 className="mt-3 break-words text-title text-heading lg:text-title-lg">{resource.title}</h1>
      ) : (
        <h3 className="mt-2 break-words text-[20px] font-semibold leading-7 text-heading">
          <Link
            to="/resources/$resourceId"
            params={{ resourceId: resource.id }}
            search={search}
            className="rounded-sm hover:text-action hover:underline underline-offset-4"
          >
            {resource.title}
          </Link>
        </h3>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-chip text-body">
        {duration && (
          <span className="inline-flex items-center gap-1.5">
            <Clock3 aria-hidden="true" className="size-4 shrink-0" />
            {duration}
          </span>
        )}
      </div>

      {detail && <h2 className="mt-8 border-t border-hairline pt-8 text-section text-heading">About this resource</h2>}
      <p className={`mt-3 break-words text-copy text-body ${detail ? 'whitespace-pre-line' : 'line-clamp-3'}`}>
        {resource.description?.trim() || 'A description is not available yet.'}
      </p>
      {detail && resource.tags.length > 0 && (
        <ul aria-label="Resource tags" className="mt-5 flex flex-wrap gap-2">
          {[...new Set(resource.tags)].map((tag) => (
            <li key={tag} className="max-w-full break-words rounded-pill border border-hairline px-3 py-1 text-chip text-body">
              {tag}
            </li>
          ))}
        </ul>
      )}

      {detail && resource.intendedSituation?.trim() && (
        <section className="mt-8">
          <h2 className="text-card text-heading">When this might help</h2>
          <p className="mt-3 break-words whitespace-pre-line text-copy text-body">{resource.intendedSituation}</p>
        </section>
      )}
      {detail && steps.length > 0 && (
        <section className="mt-8">
          <h2 className="text-card text-heading">How to try it</h2>
          <ol className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <li key={`${resource.id}-step-${index}`} className="flex gap-3">
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-panel text-chip font-semibold text-action">
                  {index + 1}
                </span>
                <span className="break-words whitespace-pre-line text-copy text-body">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {detail && resource.reflectionPrompt?.trim() && (
        <section className="mt-8">
          <h2 className="text-card text-heading">Afterwards</h2>
          <p className="mt-3 break-words whitespace-pre-line text-copy text-body">{resource.reflectionPrompt}</p>
        </section>
      )}
      {detail && resource.safetyNote?.trim() && (
        <section className="mt-8 rounded-card border border-hairline bg-panel p-5">
          <h2 className="text-card text-heading">Good to know</h2>
          <p className="mt-3 break-words whitespace-pre-line text-copy-sm text-body">{resource.safetyNote}</p>
        </section>
      )}

      {detail && (
        <section className="mt-8 rounded-card border border-hairline bg-panel p-5 sm:p-6" aria-label="Full resource content">
          {url ? (
            <>
              <h2 className="text-card text-heading">Continue to the resource</h2>
              <p className="mt-2 break-words text-copy-sm text-body">
                The full resource opens on {new URL(url).hostname} in a new tab.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-action px-6 py-3 text-button-sm text-white transition-colors hover:bg-brand-4"
              >
                Open resource
                <ArrowUpRight aria-hidden="true" className="size-4" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          ) : hasGuidedContent ? (
            <>
              <h2 className="text-card text-heading">That is the whole resource</h2>
              <p className="mt-2 text-copy-sm text-body">
                There is nothing to open somewhere else. Try the steps above at any point in your day, and save this
                page to your toolbox if you want to find it again.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-card text-heading">Try this on your own time</h2>
              <p className="mt-2 text-copy-sm text-body">
                {duration
                  ? `This one is a ${duration} prompt to sit with, not a step-by-step exercise — we do not have an approved set of steps for it yet.`
                  : 'This one is a prompt to sit with, not a step-by-step exercise — we do not have an approved set of steps for it yet.'}{' '}
                You can save it to your toolbox to find it again, or talk to someone at your school and work through it
                together.
              </p>
              <Link
                to="/support"
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-pill text-button-sm text-action hover:underline underline-offset-4"
              >
                Talk to a school counsellor <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </>
          )}
        </section>
      )}

      <div className={`${detail ? 'mt-6' : 'mt-auto pt-6'} flex flex-wrap items-center justify-between gap-3`}>
        {!detail && (
          <Link
            to="/resources/$resourceId"
            params={{ resourceId: resource.id }}
            search={search}
            aria-label={`View resource: ${resource.title}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-pill text-button-sm text-action hover:underline underline-offset-4"
          >
            View resource <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
        <button
          type="button"
          disabled={saved || !toolbox.canSave}
          onClick={() => void toolbox.save(resource.id)}
          aria-label={`${saved ? 'Saved to your toolbox' : saveLabel}: ${resource.title}`}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-pill border px-4 py-2 text-chip transition-colors disabled:cursor-default ${saved ? 'border-hairline bg-panel text-action' : 'border-hairline text-action hover:bg-panel disabled:text-muted disabled:hover:bg-transparent'}`}
        >
          {saved ? <BookmarkCheck aria-hidden="true" className="size-4" /> : <Bookmark aria-hidden="true" className="size-4" />}
          {saveLabel}
        </button>
      </div>
      {error && <ErrorNote className="mt-4">Could not save this resource. {error.message}</ErrorNote>}
    </article>
  )
}

export function ResourceToolboxNotice({ toolbox }: { toolbox: ResourceToolbox }) {
  if (!toolbox.error) return null
  return (
    <section aria-label="Toolbox status" className="rounded-card border border-blush bg-peach p-5">
      <p role="alert" className="text-copy-sm text-peach-ink">
        Your toolbox could not be refreshed. Saved status may be out of date, and saving is temporarily unavailable. You can still browse resources.
      </p>
      <Button variant="ghost" className="mt-3" onClick={toolbox.reload}>
        <RefreshCw aria-hidden="true" className="size-4" /> Retry toolbox
      </Button>
    </section>
  )
}

/**
 * Doc B §5 "what next?" block. A refusal or a "not helpful" is stored as an
 * answer to this prompt only and never becomes a safeguarding signal (Doc C
 * §5.1), which is why nothing here reaches a support or flagging endpoint.
 */
export function ResourceNextStep({ resource }: { resource: Resource }) {
  const navigate = useNavigate()
  const [answer, setAnswer] = useState<ResourceFeedbackChoice | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const respond = async (choice: ResourceFeedbackChoice) => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    const recorded = await submitResourceFeedback(resource.id, choice)
      .then(() => true)
      .catch(() => false)
    setBusy(false)
    // Leaving this page must never depend on a bookkeeping write succeeding.
    if (choice === 'WANT_TO_TALK') {
      void navigate({ to: '/support' })
      return
    }
    if (choice === 'TRY_SOMETHING_ELSE') {
      void navigate({ to: '/resources', search: { category: resource.category } })
      return
    }
    if (choice === 'DECLINED' || recorded) {
      setAnswer(choice)
      return
    }
    setFailed(true)
  }

  if (answer === 'DECLINED') return null

  return (
    <section className="mt-6 rounded-panel border border-hairline bg-white p-6" aria-labelledby="resource-next-step-heading">
      <h2 id="resource-next-step-heading" className="text-card text-heading">
        {answer === 'NOT_HELPFUL' ? 'Thanks for telling us' : 'What next?'}
      </h2>
      {answer === 'NOT_HELPFUL' ? (
        <p className="mt-3 text-copy-sm text-body">
          That is noted. You can browse another resource or talk to someone at your school.
        </p>
      ) : (
        <>
          <p className="mt-2 text-copy-sm text-body">
            Pick any answer, or none. This only shapes what we show you here.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {RESOURCE_FEEDBACK_OPTIONS.map((option) => (
              <button
                key={option.choice}
                type="button"
                disabled={busy}
                onClick={() => void respond(option.choice)}
                className="min-h-11 rounded-pill border border-hairline px-4 py-2 text-chip text-action transition-colors hover:bg-panel disabled:cursor-default disabled:text-muted"
              >
                {option.label}
              </button>
            ))}
          </div>
          {failed && (
            <ErrorNote className="mt-4">
              We could not record your answer. Your choice still works here — try again if you want us to remember it.
            </ErrorNote>
          )}
        </>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/resources" search={{}} className="inline-flex min-h-11 items-center gap-2 rounded-pill text-button-sm text-action hover:underline underline-offset-4">
          Browse other resources <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
        <Link to="/support" className="inline-flex min-h-11 items-center gap-2 rounded-pill text-button-sm text-action hover:underline underline-offset-4">
          Talk to someone <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  )
}

/**
 * Doc B's two standing lines, on every Epic F board.
 *
 * The first is now enforced rather than promised: the catalogue reads only the
 * codes the content register approves, so an unreviewed string cannot reach
 * this page. It says "before students see it" rather than the design's "by
 * school counsellors", because the register records an authorised reviewer
 * (`approvedBy`), not that a counsellor specifically read this row.
 */
export function ResourceReviewStrip() {
  return (
    <section
      aria-label="How resources are chosen"
      className="mt-8 grid gap-x-8 gap-y-2 rounded-card border border-hairline bg-panel-2/60 p-5 sm:grid-cols-2"
    >
      <p className="text-caption text-body">
        Every resource is reviewed and approved before students see it.
      </p>
      <p className="text-caption text-body">
        Resources are for self-support. They do not replace a counsellor, doctor or emergency help.
      </p>
    </section>
  )
}

/**
 * Epic F artboard 4 — the way out of a resource that does not pretend the
 * resource was the answer. The three "what happens next" lines are the workflow
 * /support already ships, and both notices come from the support library
 * instead of being re-typed, so safety copy cannot drift between surfaces.
 */
export function ResourceStillHeavy({ resource }: { resource: Resource }) {
  return (
    <section
      className="mt-6 rounded-panel border border-accent bg-peach p-6 sm:p-8"
      aria-labelledby="resource-still-heavy-heading"
    >
      <h2 id="resource-still-heavy-heading" className="text-section text-peach-ink">
        Still feeling heavy?
      </h2>
      <p className="mt-3 text-copy-sm text-peach-ink">
        It is okay if this was not enough. A real person can help more, and you can ask to talk to someone at your school.
      </p>
      <Link
        to="/support"
        className="mt-5 inline-flex min-h-11 w-full max-w-md items-center justify-center gap-2 rounded-pill bg-action px-5 py-3 text-center text-button-sm font-semibold text-white transition-colors hover:bg-brand-4"
      >
        <span className="min-w-0 break-words">Talk to a school counsellor</span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      </Link>

      <div className="mt-6 rounded-card border border-hairline bg-white p-5">
        <h3 className="text-chip font-semibold text-heading">What happens next</h3>
        <ul className="mt-3 space-y-2 text-copy-sm text-body">
          <li>Your request goes to a school professional.</li>
          <li>A person decides what support is right, not the AI.</li>
          <li>You can see its status in the app.</li>
        </ul>
        <p className="mt-3 text-caption text-muted">{SUPPORT_RESPONSE_NOTICE}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link
          to="/resources"
          search={{ category: resource.category }}
          className="inline-flex min-h-11 items-center gap-2 rounded-pill text-button-sm text-action hover:underline underline-offset-4"
        >
          Keep browsing this topic <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
        <Link
          to="/support/status-guide"
          className="inline-flex min-h-11 items-center gap-2 rounded-pill text-button-sm text-action hover:underline underline-offset-4"
        >
          See how a request moves
        </Link>
      </div>

      <p className="mt-5 text-caption text-peach-ink">{SUPPORT_EMERGENCY_NOTICE}</p>
    </section>
  )
}

export function ResourceSupport() {
  return (
    <aside className="min-w-0 rounded-panel border border-accent bg-peach p-6">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-counsellor text-white">
        <UserRound className="size-5" />
      </span>
      <h2 className="mt-4 text-section text-peach-ink">You can talk to someone</h2>
      <p className="mt-2 text-copy-sm text-peach-ink">
        Resources are not a replacement for a real conversation. A school counsellor can help you work through what is on your mind.
      </p>
      <Link to="/support" className="mt-4 inline-flex min-h-11 max-w-full items-center justify-center gap-2 whitespace-normal rounded-pill bg-action px-4 py-3 text-center text-button-sm font-semibold text-white transition-colors hover:bg-brand-4">
        <span className="min-w-0 break-words">Talk to a school counsellor</span>
        <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
      </Link>
      <p className="mt-4 text-caption text-peach-ink">If you are in immediate danger, contact local emergency services or a trusted adult now.</p>
    </aside>
  )
}
