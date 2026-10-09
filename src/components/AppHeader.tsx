import { useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'

import logo from '#/assets/soul-nurture-logo.png'
import { NotificationBell } from '#/components/dash/NotificationBell'
import { signOut, useSession } from '#/lib/auth'
import { useChatUnread, watchChatUnread } from '#/lib/chat'
import { initialsOf } from '#/lib/support'

export function AppHeader() {
  const navigate = useNavigate()
  const { user, status } = useSession()
  const chatUnread = useChatUnread()

  useEffect(() => {
    if (user) watchChatUnread()
  }, [user])

  const handleSignOut = () => {
    void signOut().then(() => navigate({ to: '/welcome' }))
  }

  return (
    <header className="hidden border-b border-hairline lg:block">
      <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between px-20">
        <Link to="/welcome" className="flex items-center gap-3">
          <img src={logo} alt="" className="size-10 rounded-full" />
          <span className="text-wordmark text-heading">Soul Nurture AI</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/support"
            className="relative inline-flex h-11 items-center whitespace-nowrap rounded-pill border border-action/50 px-7 text-copy-sm font-medium text-action transition-colors hover:bg-action/5"
          >
            Talk to a person
            {user && chatUnread.total > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
                {chatUnread.total > 99 ? '99+' : chatUnread.total}
              </span>
            )}
          </Link>

          {status === 'loading' ? (
            <span className="size-11 rounded-full bg-surface" aria-hidden="true" />
          ) : user ? (
            <>
              <NotificationBell />
              <details className="relative">
              <summary
                aria-label="Your account"
                className="grid size-11 cursor-pointer list-none place-items-center rounded-full bg-surface text-brand-4 transition-colors hover:bg-neutral-10 [&::-webkit-details-marker]:hidden"
              >
                <span className="text-button-sm font-bold">{initialsOf(user.name)}</span>
              </summary>
              <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-64 rounded-card border border-hairline bg-white p-2 shadow-lg">
                <div className="px-4 py-3">
                  <p className="truncate text-button-sm font-bold text-heading">{user.name}</p>
                  <p className="truncate text-caption text-muted">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-left text-copy-sm text-ink transition-colors hover:bg-surface"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            </details>
            </>
          ) : (
            <Link
              to="/signin"
              className="inline-flex h-11 items-center whitespace-nowrap rounded-pill bg-surface px-7 text-copy-sm font-medium text-ink transition-colors hover:bg-neutral-10"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
