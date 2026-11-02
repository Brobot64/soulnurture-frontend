import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  Headphones,
  Heart,
  MousePointer2,
  RefreshCw,
  UserRound,
  Volume2,
  Wind,
} from 'lucide-react'

import { Button, ErrorNote } from '#/components/dash/ui'
import {
  RESOURCE_CATEGORIES,
  RESOURCE_FEEDBACK_OPTIONS,
  RESOURCE_TYPES,
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
  TOOLKIT_ITEM: BriefcaseBusiness,
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
        <span>{RESOURCE_TYPES[resource.type] ?? 'Resource'}</span>
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
          ) : (
            <>
              <h2 className="text-card text-heading">Full resource content is not yet available</h2>
              <p className="mt-2 text-copy-sm text-body">
                You can save this listing to your toolbox or browse other resources. If you need support now, you can talk to a school counsellor.
              </p>
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
