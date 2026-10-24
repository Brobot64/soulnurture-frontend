import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Bookmark, ChevronLeft, RefreshCw, Search } from 'lucide-react'

import { Button, EmptyState, ErrorNote } from '#/components/dash/ui'
import { ResourceCard, ResourceSupport, ResourceToolboxNotice } from '#/components/ResourceCard'
import { useApiQuery } from '#/lib/dash'
import {
  RESOURCE_CATEGORIES,
  RESOURCE_TYPES,
  fetchResources,
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
  const hasFilters = !!(filters.category || filters.type || filters.search)

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
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-2 lg:row-span-3 lg:mt-6">
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

      <section aria-labelledby="resource-list-heading" className="mt-10 min-w-0 lg:col-start-1 lg:row-start-4">
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
          <label htmlFor="resource-type" className="flex flex-col gap-2 text-chip font-medium text-heading md:w-[230px]">
            Resource type
            <select
              id="resource-type"
              value={filters.type ?? ''}
              onChange={(event) => updateFilters({ type: event.target.value })}
              className="h-12 w-full rounded-pill border border-hairline bg-white px-4 text-copy-sm text-heading"
            >
              <option value="">All types</option>
              {Object.entries(RESOURCE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        {hasFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {filters.search && <p className="break-words text-copy-sm text-body">Results for “{filters.search}”</p>}
            <button type="button" onClick={() => updateFilters({ category: undefined, type: undefined, search: undefined })} className="min-h-11 rounded-pill text-button-sm text-action underline underline-offset-4">
              Clear filters
            </button>
          </div>
        )}
        <div className="mt-5"><ResourceToolboxNotice toolbox={toolbox} /></div>
        <ResourceResults key={JSON.stringify(filters)} filters={filters} toolbox={toolbox} />
      </section>
    </div>
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
  const filtered = !!(filters.search || filters.category || filters.type)
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
        <EmptyState
          icon={filters.savedOnly ? Bookmark : Search}
          title={filtered ? 'No resources match these filters' : filters.savedOnly ? 'No saved resources yet' : 'No resources are available yet'}
          body={filtered ? 'Try another topic or search term, or clear your filters.' : filters.savedOnly ? 'Browse resources and choose Save to toolbox to keep a resource here.' : 'Check back later. You can still talk to a school counsellor if you need support.'}
          action={filtered || filters.savedOnly ? (
            <Link to="/resources" search={{}} className="inline-flex min-h-11 items-center justify-center rounded-pill bg-action px-6 py-2 text-button-sm text-white hover:bg-brand-4">
              Browse all resources
            </Link>
          ) : (
            <Button variant="ghost" onClick={query.reload}><RefreshCw aria-hidden="true" className="size-4" /> Check again</Button>
          )}
        />
      )}
    </div>
  )
}
