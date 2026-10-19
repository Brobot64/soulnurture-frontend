import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { LockKeyhole } from 'lucide-react'

import appCss from '../styles.css?url'
import logoUrl from '#/assets/soul-nurture-logo.png'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        content: '#F9FCFA',
      },
      {
        title: 'Soul Nurture AI',
      },
      {
        name: 'description',
        content: 'Soul Nurture AI — a calm space for students to check in with how they feel.',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:site_name',
        content: 'Soul Nurture AI',
      },
      {
        property: 'og:title',
        content: 'Soul Nurture AI',
      },
      {
        property: 'og:description',
        content: 'Soul Nurture AI — a calm space for students to check in with how they feel.',
      },
      {
        property: 'og:image',
        content: logoUrl,
      },
      {
        name: 'twitter:card',
        content: 'summary',
      },
      {
        name: 'twitter:title',
        content: 'Soul Nurture AI',
      },
      {
        name: 'twitter:description',
        content: 'Soul Nurture AI — a calm space for students to check in with how they feel.',
      },
      {
        name: 'twitter:image',
        content: logoUrl,
      },
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Soul Nurture AI',
          description: 'Soul Nurture AI — a calm space for students to check in with how they feel.',
        },
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: logoUrl,
      },
      {
        rel: 'apple-touch-icon',
        href: logoUrl,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-md rounded-panel border border-hairline bg-white p-8 text-center sm:p-12">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-panel text-action"><LockKeyhole className="size-7" aria-hidden="true" /></span>
        <h1 className="mt-6 text-title-sm text-heading">Page not found</h1>
        <p className="mt-3 text-copy-sm text-body">The link you entered doesn’t lead to a page. No private information is shown here.</p>
        <Link to="/" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-pill bg-action px-6 text-chip font-semibold text-white hover:bg-brand-4">Back to home</Link>
        <p className="mt-6 text-caption text-muted">If you’re in danger, tell a trusted adult or contact local emergency services.</p>
      </div>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-page font-sans text-body antialiased">
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
