import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Bookmark, ChevronLeft, RefreshCw, Search } from 'lucide-react'

import { Button, EmptyState, ErrorNote } from '#/components/dash/ui'
import { ResourceCard, ResourceReviewStrip, ResourceSupport, ResourceToolboxNotice } from '#/components/ResourceCard'
import { useApiQuery } from '#/lib/dash'
import {
  RESOURCE_CATEGORIES,
  fetchResources,
  fetchTailoredResources,
  useResourceAuthError,
  useResourceStudent,
  useResourceToolbox,
  validateResourceSearch,
  type ResourceCategory,
  type ResourceSearch,
  type ResourceToolbox,
} from '#/lib/resources'

export const Route = createFileRoute('/_app/resources/')({
  validateSearch: validateResourceSearch,
  head: () => ({
    meta: [
      { title: 'Wellbeing resources · Soul Nurture AI' },
      { name: 'description', content: 'Explore wellbeing resources by topic and keep useful resources in your personal toolbox.' },
    ],
  }),
  component: ResourcesPage,
})

function ResourcesPage() {
  const student = useResourceStudent()
  if (!student) {
    return <p role="status" className="mx-auto w-full max-w-[1160px] px-6 py-14 text-copy text-body">Checking your access to resources…</p>
  }
  return <StudentResources key={student.id} />
}

function StudentResources() {
  const filters: ResourceSearch = Route.useSearch()
  const navigate = useNavigate()
  const toolbox = useResourceToolbox()
  const [draft, setDraft] = useState(filters.search ?? '')
  useEffect(() => setDraft(filters.search ?? ''), [filters.search])

  const updateFilters = (next: Record<string, unknown>) => {
    void navigate({
      to: '/resources',
      search: validateResourceSearch({ ...filters, ...next }),
      resetScroll: false,
    })
  }
  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    updateFilters({ search: draft })
  }
  const hasFilters = !!(filters.category || filters.search)

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 py-8 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:content-start lg:gap-x-12 lg:px-12 lg:py-12 xl:px-[120px]">
      <Link to="/welcome" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-pill text-button-sm text-action hover:underline underline-offset-4 lg:col-span-2">
        <ChevronLeft aria-hidden="true" className="size-4" /> Back home
      </Link>

      <header className="mt-6 grid items-start gap-6 lg:contents">
        <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:mt-6">
          <h1 className="max-w-[620px] text-title text-heading lg:text-hero-sm">Wellbeing resources</h1>
          <p className="mt-4 max-w-[600px] text-copy text-body lg:text-lede">
            Explore what is on your mind, at your own pace. Keep resources you want to return to in your toolbox.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-2 lg:row-span-4 lg:mt-6">
          <ResourceSupport />
          <Link
            to="/resources"
            search={{ savedOnly: true }}
            className="group flex items-start gap-4 rounded-panel border border-action/15 bg-panel p-6 transition-colors hover:border-action/40"
          >
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-card bg-white text-action">
              <Bookmark className="size-6" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[20px] font-semibold leading-7 text-heading">Your toolbox</span>
              <span className="mt-1 block text-copy-sm text-body">A place for what helps you.</span>
              <span className="mt-4 inline-flex items-center gap-2 text-chip font-semibold text-action group-hover:underline underline-offset-4">
                {toolbox.error ? 'View saved resources' : toolbox.count === null ? 'Loading saved resources…' : `${toolbox.count} saved ${toolbox.count === 1 ? 'resource' : 'resources'}`}
                <span aria-hidden="true">→</span>
              </span>
            </span>
          </Link>
        </div>
      </header>

      <section aria-labelledby="resource-topics-heading" className="mt-10 min-w-0 rounded-panel border border-hairline bg-white p-5 sm:p-6 lg:col-start-1 lg:row-start-3 lg:mt-8">
        <h2 id="resource-topics-heading" className="text-card text-heading">What is on your mind?</h2>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by topic">
          <button
            type="button"
            aria-pressed={!filters.category}
            onClick={() => updateFilters({ category: undefined })}
            className={`min-h-11 rounded-pill border px-4 py-2 text-chip transition-colors ${!filters.category ? 'border-action bg-action text-white' : 'border-hairline text-body hover:bg-panel'}`}
          >
            All topics
          </button>
          {(Object.keys(RESOURCE_CATEGORIES) as ResourceCategory[]).map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={filters.category === category}
              onClick={() => updateFilters({ category })}
              className={`min-h-11 rounded-pill border px-4 py-2 text-chip transition-colors ${filters.category === category ? 'border-action bg-action text-white' : 'border-hairline text-body hover:bg-panel'}`}
            >
              {RESOURCE_CATEGORIES[category]}
            </button>
          ))}
        </div>
      </section>

      <ResourcePickedForYou filters={filters} />

      <section aria-labelledby="resource-list-heading" className="mt-10 min-w-0 lg:col-start-1 lg:row-start-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h2 id="resource-list-heading" className="text-section text-heading">
            {filters.category ? RESOURCE_CATEGORIES[filters.category] : filters.savedOnly ? 'Your toolbox' : 'Explore resources'}
          </h2>
          <div role="group" aria-label="Resource collection" className="flex w-fit max-w-full flex-wrap gap-1 rounded-panel bg-panel p-1.5">
            {[{ savedOnly: false, label: 'All resources' }, { savedOnly: true, label: 'Saved toolbox' }].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={!!filters.savedOnly === option.savedOnly}
                onClick={() => updateFilters({ savedOnly: option.savedOnly })}
                className={`min-h-11 rounded-pill px-4 py-2 text-chip transition-colors ${!!filters.savedOnly === option.savedOnly ? 'bg-white font-semibold text-action' : 'text-body hover:bg-white/60'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end">
          <form role="search" onSubmit={submitSearch} className="flex min-w-0 flex-1 flex-col gap-2">
            <label htmlFor="resource-search" className="text-chip font-medium text-heading">Search resources</label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  id="resource-search"
                  type="search"
                  maxLength={200}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Search resources"
                  className="h-12 w-full rounded-pill border border-hairline bg-white pl-11 pr-4 text-copy-sm text-heading placeholder:text-muted"
                />
              </div>
              <Button type="submit" className="h-12 shrink-0 px-5">Search</Button>
            </div>
          </form>
        </div>
        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {filters.search && <p className="break-words text-copy-sm text-body">Results for “{filters.search}”</p>}
            <button type="button" onClick={() => updateFilters({ category: undefined, search: undefined })} className="min-h-11 rounded-pill text-button-sm text-action underline underline-offset-4">
              Clear filters
            </button>
          </div>
        )}
        <div className="mt-5"><ResourceToolboxNotice toolbox={toolbox} /></div>
        <ResourceResults key={JSON.stringify(filters)} filters={filters} toolbox={toolbox} />
      </section>

      <div className="mt-10 lg:col-span-2 lg:row-start-6">
        <ResourceReviewStrip />
      </div>
    </div>
  )
}

/**
 * Epic F artboard 1. The server reports which rule built the list, so the
 * personalisation sentence appears exactly when a stated need earned it
 * (Doc B §2) and never when it did not. The band is a way *into* the catalogue,
 * so it steps aside whenever a topic, a search or the toolbox is what the
 * student is actually answering — a "picked for you" row over a filtered list
 * would describe a selection that did not happen.
 */
function ResourcePickedForYou({ filters }: { filters: ResourceSearch }) {
  if (filters.category || filters.search || filters.savedOnly) return null
  return <PickedForYouRow />
}

function PickedForYouRow() {
  const query = useApiQuery(() => fetchTailoredResources())
  const tailored = query.data
  // An empty tail of this read is the catalogue being empty, which the list
  // below already explains. Two "nothing yet" panels on one page is noise.
  if (query.error || !tailored || tailored.items.length === 0) return null
  const statedNeed = tailored.basis === 'STATED_NEED'

  return (
    <section
      aria-labelledby="resource-picked-heading"
      className="mt-10 min-w-0 rounded-panel border border-hairline bg-white p-5 sm:p-6 lg:col-start-1 lg:row-start-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="resource-picked-heading" className="text-card text-heading">
          {tailored.title}
        </h2>
        {statedNeed && (
          <span className="rounded-pill bg-panel px-3 py-1 text-chip text-body">
            From your latest check-in
          </span>
        )}
      </div>
      <p className="mt-2 text-copy-sm text-body">{tailored.rationale}</p>
      <ul className="mt-5 grid gap-4 md:grid-cols-3">
        {tailored.items.map((resource) => (
          <li key={resource.id} className="min-w-0">
            <Link
              to="/resources/$resourceId"
              params={{ resourceId: resource.id }}
              search={{}}
              className="block min-h-11 break-words rounded-card border border-hairline bg-panel-2/60 px-4 py-3 text-chip font-semibold text-action transition-colors hover:bg-panel"
            >
              {resource.title}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-caption text-muted">
        You choose what to try. An idea on this list is not a recommendation about you.
      </p>
    </section>
  )
}

function ResourceResults({ filters, toolbox }: { filters: ResourceSearch; toolbox: ResourceToolbox }) {
  const query = useApiQuery(() => fetchResources(filters))
  useResourceAuthError(query.error)
  if (query.error) {
    return (
      <div className="mt-5 rounded-panel border border-hairline bg-white p-6">
        <ErrorNote>We could not load resources. {query.error.message}</ErrorNote>
        <Button onClick={query.reload} className="mt-4"><RefreshCw aria-hidden="true" className="size-4" /> Retry resources</Button>
      </div>
    )
  }
  if (!query.data) {
    return <p role="status" className="mt-5 rounded-panel border border-hairline bg-panel px-6 py-12 text-copy text-body">Loading resources…</p>
  }
  const items = query.data.items
  const filtered = !!(filters.search || filters.category)
  return (
    <div className="mt-5" aria-busy={query.loading}>
      <p role="status" className="mb-4 text-chip text-body">
        {query.loading ? 'Refreshing resources…' : `${items.length} ${items.length === 1 ? 'resource' : 'resources'}${filters.savedOnly ? ' in your toolbox' : ''}${filtered ? ' matching your filters' : ''}`}
      </p>
      {items.length ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {items.map((resource) => <ResourceCard key={resource.id} resource={resource} toolbox={toolbox} search={filters} />)}
        </div>
      ) : (
        <ResourcesEmpty filters={filters} onReload={query.reload} toolbox={toolbox} />
      )}
    </div>
  )
}

/**
 * Epic F artboard 5 — and the state every student is actually in today, because
 * the content register approves nothing yet. So it is written the way the source
 * document writes it: the shelf is empty because review has not happened, not
 * because the student looked in the wrong place. The copy it replaced ("No
 * resources are available yet / Check back later") put the wait on the student
 * rather than on the review, and offered no way out.
 */
function ResourcesEmpty({
  filters,
  onReload,
  toolbox,
}: {
  filters: ResourceSearch
  onReload: () => void
  toolbox: ResourceToolbox
}) {
  const browseAll = (
    <Link
      to="/resources"
      search={{}}
      className="inline-flex min-h-11 items-center justify-center rounded-pill border border-hairline bg-white px-5 py-2 text-button-sm text-action hover:bg-panel"
    >
      Browse all resources
    </Link>
  )
  const askSomeone = (
    <Link
      to="/support"
      className="inline-flex min-h-11 items-center justify-center rounded-pill bg-action px-5 py-2 text-button-sm font-semibold text-white hover:bg-brand-4"
    >
      Talk to a school counsellor
    </Link>
  )

  // Only claim the student has saved something when the toolbox read says so;
  // an empty toolbox with a stale search must not be told it has rows.
  if (filters.savedOnly && filters.search && (toolbox.count ?? 0) > 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No saved resources match that search"
        body={`You have saved resources, but none of their approved wording matches “${filters.search}”. Clear the search to see the whole toolbox.`}
        action={
          <Link
            to="/resources"
            search={{ savedOnly: true }}
            className="inline-flex min-h-11 items-center justify-center rounded-pill bg-action px-5 py-2 text-button-sm font-semibold text-white hover:bg-brand-4"
          >
            Show my toolbox
          </Link>
        }
      />
    )
  }
  if (filters.savedOnly) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No saved resources yet"
        body="When a resource helps, choose Save to toolbox to keep it here."
        action={browseAll}
      />
    )
  }
  if (filters.search) {
    return (
      <EmptyState
        icon={Search}
        title="Nothing here matches that search"
        body="Search only looks through resources that have been reviewed and approved, so this means no approved wording matches that search. It does not mean your topic is missing."
        action={
          <Link
            to="/resources"
            search={{}}
            className="inline-flex min-h-11 items-center justify-center rounded-pill bg-action px-5 py-2 text-button-sm font-semibold text-white hover:bg-brand-4"
          >
            Clear the search
          </Link>
        }
      />
    )
  }
  if (filters.category) {
    return (
      <EmptyState
        icon={Search}
        title="No approved resources here yet"
        body={`We are still adding ideas to ${RESOURCE_CATEGORIES[filters.category].toLowerCase()}. A resource appears here only once it has been reviewed and approved, so this topic is empty for now. Try another topic, or ask to talk to a school counsellor if you would like support today.`}
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            {browseAll}
            {askSomeone}
          </div>
        }
      />
    )
  }
  return (
    <EmptyState
      icon={Search}
      title="No approved resources yet"
      body="A resource reaches this page only after a reviewer approves it, and that has not happened for this catalogue yet. There is nothing to read here today — asking to talk to someone at your school still works."
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          {askSomeone}
          <Button variant="ghost" onClick={onReload}>
            <RefreshCw aria-hidden="true" className="size-4" /> Check again
          </Button>
        </div>
      }
    />
  )
}
