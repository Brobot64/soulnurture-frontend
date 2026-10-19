import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

import { Button, ErrorNote } from '#/components/dash/ui'
import { ResourceCard, ResourceSupport, ResourceToolboxNotice } from '#/components/ResourceCard'
import { useApiQuery } from '#/lib/dash'
import {
  RESOURCE_CATEGORIES,
  fetchResources,
  useResourceAuthError,
  useResourceStudent,
  useResourceToolbox,
  validateResourceSearch,
  type ResourceSearch,
} from '#/lib/resources'

export const Route = createFileRoute('/_app/resources/$resourceId')({
  validateSearch: validateResourceSearch,
  head: () => ({
    meta: [
      { title: 'Resource details · Soul Nurture AI' },
      { name: 'description', content: 'Learn about a wellbeing resource, open available content, or save it to your toolbox.' },
    ],
  }),
  component: ResourceDetailPage,
})

function ResourceDetailPage() {
  const student = useResourceStudent()
  const { resourceId } = Route.useParams()
  if (!student) {
    return <p role="status" className="mx-auto w-full max-w-[1160px] px-6 py-14 text-copy text-body">Checking your access to resources…</p>
  }
  return <StudentResourceDetail key={`${student.id}:${resourceId}`} resourceId={resourceId} />
}

function StudentResourceDetail({ resourceId }: { resourceId: string }) {
  const search: ResourceSearch = Route.useSearch()
  // There is no single-resource endpoint. Resolve the ID from the approved catalogue.
  const catalogue = useApiQuery(() => fetchResources())
  const toolbox = useResourceToolbox()
  useResourceAuthError(catalogue.error)
  const resource = catalogue.data?.items.find((item) => item.id === resourceId)

  return (
    <div className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col px-5 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link to="/resources" search={search} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-pill text-button-sm text-action hover:underline underline-offset-4">
        <ChevronLeft aria-hidden="true" className="size-4" /> Back to resources
      </Link>
      <div className="mt-6"><ResourceToolboxNotice toolbox={toolbox} /></div>
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="min-w-0">
          {catalogue.error ? (
            <section className="rounded-panel border border-hairline bg-white p-6 sm:p-8">
              <h1 className="text-title text-heading">This resource could not be loaded</h1>
              <ErrorNote className="mt-4">{catalogue.error.message}</ErrorNote>
              <Button onClick={catalogue.reload} className="mt-5"><RefreshCw aria-hidden="true" className="size-4" /> Retry resource</Button>
            </section>
          ) : !catalogue.data ? (
            <p role="status" className="rounded-panel border border-hairline bg-panel px-6 py-14 text-copy text-body">Loading resource…</p>
          ) : !resource ? (
            <section className="rounded-panel border border-hairline bg-white p-6 sm:p-8">
              <p className="text-chip font-semibold text-action">404 · Resource not found</p>
              <h1 className="mt-3 text-title text-heading">This resource is not available</h1>
              <p className="mt-4 text-copy text-body">It may have been removed or is not currently available to students. Browse the catalogue for other resources.</p>
              <Link to="/resources" search={{}} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-pill bg-action px-6 py-3 text-button-sm text-white hover:bg-brand-4">
                Browse resources
              </Link>
            </section>
          ) : (
            <>
              {catalogue.loading && <p role="status" className="mb-3 text-chip text-body">Refreshing resource…</p>}
              <ResourceCard resource={resource} toolbox={toolbox} search={search} detail />
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {resource && !catalogue.error && (
            <section className="rounded-panel border border-hairline bg-panel p-6">
              <p className="text-chip font-medium text-action">Explore the topic</p>
              <h2 className="mt-2 text-section text-heading">{RESOURCE_CATEGORIES[resource.category]}</h2>
              <Link
                to="/resources"
                search={{ category: resource.category }}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-pill text-button-sm text-action hover:underline underline-offset-4"
              >
                Browse this topic <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            </section>
          )}
          <ResourceSupport />
          <Link to="/resources" search={{ savedOnly: true }} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-pill px-2 text-button-sm text-action hover:underline underline-offset-4">
            Go to your toolbox <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
