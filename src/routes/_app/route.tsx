// Student-facing layout: the marketing header + footer wrap everything under
// _app (landing, auth, check-in, reflection, support). Dashboards live in _dash.

import { Outlet, createFileRoute } from '@tanstack/react-router'

import { AppFooter } from '#/components/AppFooter'
import { AppHeader } from '#/components/AppHeader'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="flex h-dvh flex-col">
      <AppHeader />
      {/* The footer is a sibling of this scroll box, not a child: inside it,
          the footer was part of the scrolled content and slid off screen.
          Here the only scrollable region is the band between header and footer. */}
      <main
        id="main-content"
        tabIndex={-1}
        // `relative` is load-bearing: `sr-only` is position:absolute with top:auto,
        // so it falls back to its static position and resolves against the nearest
        // POSITIONED ancestor. With none, every sr-only span in the history list
        // anchored to the initial containing block at y up to ~3600px and stretched
        // the document into a second scrollbar that slid the header and footer off
        // screen. Measured live: html.scrollHeight 4390 -> 735, outer scroll -> 0.
        // overflow-x-hidden: overflow-y:auto alone turns this box into a
        // horizontal scroller too, so one wide descendant slid the entire
        // student app — header included — sideways.
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto outline-none"
      >
        <Outlet />
      </main>
      <AppFooter />
    </div>
  )
}
