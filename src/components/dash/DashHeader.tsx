// Dashboard header: title block, optional search + actions, bell, account menu.

import { useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'

import { AvatarInitials, Button, Dialog, SearchInput } from '#/components/dash/ui'
import { NotificationBell } from '#/components/dash/NotificationBell'
import { roleLabel, signOut, useSession } from '#/lib/auth'
import { clearSchoolSuspended } from '#/lib/dash'

interface DashHeaderProps {
  title: string
  subtitle?: string
  search?: {
    value: string
    onChange: (next: string) => void
    placeholder?: string
  }
  actions?: ReactNode
}

export function DashHeader({ title, subtitle, search, actions }: DashHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline bg-page px-6 py-5 lg:px-8">
      <div className="min-w-0">
        <h1 className="truncate text-section text-heading">{title}</h1>
        {subtitle && <p className="mt-0.5 text-copy-sm text-muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {search && (
          <SearchInput
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
            className="w-56 lg:w-72"
          />
        )}
        {actions}
        <NotificationBell />
        <AccountMenu />
      </div>
    </header>
  )
}

function AccountMenu() {
  const navigate = useNavigate()
  const { user } = useSession()
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)

  if (!user) return null

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError(false)
    try {
      await signOut()
      clearSchoolSuspended()
      void navigate({ to: '/signin' })
    } catch {
      setSignOutError(true)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <>
    <details className="group relative">
      <summary
        aria-label="Account menu"
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-hairline bg-white transition-colors hover:bg-panel [&::-webkit-details-marker]:hidden"
      >
        <AvatarInitials name={user.name} className="size-8" />
      </summary>
      <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-card border border-hairline bg-white p-4 shadow-xl">
        <p className="truncate text-card text-heading">{user.name}</p>
        <p className="truncate text-caption text-muted">{user.email}</p>
        <p className="mt-1 text-caption text-muted">{roleLabel(user.role)}</p>
        <button
          type="button"
          onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); setSignOutOpen(true) }}
          className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-copy-sm text-heading transition-colors hover:bg-panel"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </button>
      </div>
    </details>
    <Dialog open={signOutOpen} onClose={() => { if (!signingOut) setSignOutOpen(false) }} title="Sign out of Soul Nurture AI?" footer={<><Button variant="ghost" disabled={signingOut} onClick={() => setSignOutOpen(false)}>Stay signed in</Button><Button disabled={signingOut} onClick={() => void handleSignOut()}>{signingOut ? 'Signing out…' : 'Sign out'}</Button></>}>
      <p className="text-copy-sm text-body">You can sign in again with your school account whenever you need to.</p>
      {signOutError && <p role="alert" className="mt-3 text-copy-sm text-destructive">Could not sign out. Check your connection and try again.</p>}
    </Dialog>
    </>
  )
}
