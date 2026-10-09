import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

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
})

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
