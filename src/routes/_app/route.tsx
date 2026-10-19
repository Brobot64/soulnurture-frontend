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
      <main id="main-content" tabIndex={-1} className="flex min-h-0 flex-1 flex-col overflow-y-auto outline-none">
        <Outlet />
        <AppFooter />
      </main>
    </div>
  )
}
