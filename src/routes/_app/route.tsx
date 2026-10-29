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
        // overflow-x-hidden: overflow-y:auto alone turns this box into a
        // horizontal scroller too, so one wide descendant slid the entire
        // student app — header included — sideways.
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto outline-none"
      >
        <Outlet />
      </main>
      <AppFooter />
    </div>
  )
}
