import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { BookOpen, ChevronDown, HeartHandshake, Home, LogOut, Menu, ShieldCheck, X } from 'lucide-react'

import logo from '#/assets/soul-nurture-logo.png'
import { NotificationBell } from '#/components/dash/NotificationBell'
import { Button, Dialog } from '#/components/dash/ui'
import { homeForRole, signOut, useSession } from '#/lib/auth'
import { useChatUnread, watchChatUnread } from '#/lib/chat'
import { initialsOf } from '#/lib/support'

export function AppHeader() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { user, status } = useSession()
  const chatUnread = useChatUnread()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)
  const accountButtonRef = useRef<HTMLButtonElement>(null)

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError(false)
    try {
      await signOut()
      setSignOutOpen(false)
      void navigate({ to: '/' })
    } catch {
      setSignOutError(true)
    } finally {
      setSigningOut(false)
    }
  }

  useEffect(() => {
    if (user) watchChatUnread()
  }, [user])

  useEffect(() => {
    setMobileOpen(false)
    setAccountOpen(false)
  }, [pathname])

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        setAccountOpen(false)
      }
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [])

  const home = user ? homeForRole(user) : '/'
  const path = pathname.replace(/\/+$/, '') || '/'
  const inSection = (base: string) => path === base || path.startsWith(`${base}/`)
  const supportActive = inSection('/support')
  const links = [
    {
      to: home,
      label: 'Home',
      icon: Home,
      exact: true,
      active: path === '/' || path === '/welcome' || ['/check-in', '/reflection', '/complete'].some(inSection),
    },
    { to: '/resources' as const, label: 'Wellbeing resources', icon: BookOpen, exact: false, active: inSection('/resources') },
  ]

  return (
    <header className="relative z-30 shrink-0 border-b border-hairline bg-page">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-pill focus:bg-action focus:px-5 focus:py-3 focus:text-white">
        Skip to content
      </a>
      <div className="mx-auto flex min-h-14 w-full max-w-[1440px] items-center justify-between gap-3 px-5 py-2 lg:min-h-[68px] lg:gap-6 lg:px-12 xl:px-20">
        <Link to={home} activeOptions={{ exact: true }} aria-label="Soul Nurture AI home" className="flex shrink-0 items-center gap-2.5">
          <img src={logo} alt="" className="size-9 rounded-full lg:size-10" />
          <span className="hidden text-card font-bold tracking-tight text-heading min-[400px]:inline lg:text-wordmark">Soul Nurture AI</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-2 lg:flex">
          {links.map(({ to, label, active, exact }) => (
            <Link key={label} to={to} activeOptions={{ exact, includeSearch: false }} aria-current={active ? 'page' : undefined} className={`rounded-xl px-4 py-3 text-chip transition-colors ${active ? 'bg-panel font-semibold text-brand-4' : 'text-body hover:bg-panel/60'}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 lg:gap-3">
          <Link to="/support" aria-current={supportActive ? 'page' : undefined} className={`relative hidden min-h-11 items-center gap-2 rounded-pill border px-5 text-chip font-semibold text-action transition-colors hover:bg-panel lg:inline-flex ${supportActive ? 'border-action bg-panel' : 'border-action/40'}`}>
            Request counsellor support
            {user && chatUnread.total > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
                {chatUnread.total > 99 ? '99+' : chatUnread.total}
              </span>
            )}
          </Link>
          {status === 'loading' ? <span className="size-10 rounded-full bg-surface" aria-hidden="true" /> : user ? (
            <>
              <NotificationBell />
              <div className="relative">
                <button ref={accountButtonRef} type="button" aria-label="Your account" aria-expanded={accountOpen} aria-controls="account-navigation" onClick={() => { setAccountOpen(!accountOpen); setMobileOpen(false) }} className="flex size-10 items-center justify-center gap-1 rounded-full bg-surface text-chip font-bold text-brand-4 transition-colors hover:bg-neutral-10 lg:w-auto lg:px-3">
                  {initialsOf(user.name)}<ChevronDown className="hidden size-3 lg:block" aria-hidden="true" />
                </button>
                {accountOpen && (
                  <div id="account-navigation" className="fixed left-4 right-4 top-20 z-40 rounded-card border border-hairline bg-white p-2 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-[calc(100%+12px)] sm:w-64">
                    <div className="border-b border-hairline px-4 py-3">
                      <p className="truncate text-card text-heading">{user.name}</p>
                      <p className="mt-1 truncate text-caption text-muted">{user.email}</p>
                    </div>
                    <Link to="/privacy" onClick={() => setAccountOpen(false)} className="mt-1 flex items-center gap-2.5 rounded-xl px-4 py-3 text-copy-sm text-ink hover:bg-panel"><ShieldCheck className="size-4" aria-hidden="true" />Privacy & consent</Link>
                    <button type="button" onClick={() => { accountButtonRef.current?.focus(); setAccountOpen(false); setSignOutOpen(true) }} className="flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-left text-copy-sm text-ink hover:bg-panel">
                      <LogOut className="size-4" aria-hidden="true" />Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : <Link to="/signin" className="hidden min-h-11 items-center rounded-pill bg-surface px-5 text-chip font-semibold text-ink hover:bg-neutral-10 sm:inline-flex">Sign in</Link>}
          <button type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="mobile-navigation" onClick={() => { setMobileOpen(!mobileOpen); setAccountOpen(false) }} className="grid size-11 place-items-center rounded-full text-heading hover:bg-panel lg:hidden">
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="absolute inset-x-0 top-full border-b border-hairline bg-page px-5 pb-5 shadow-lg lg:hidden">
          {links.map(({ to, label, icon: Icon, active, exact }) => (
            <Link key={label} to={to} activeOptions={{ exact, includeSearch: false }} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-copy-sm ${active ? 'bg-panel font-semibold text-action' : 'text-body hover:bg-panel'}`}><Icon className="size-5" aria-hidden="true" />{label}</Link>
          ))}
          <Link to="/support" onClick={() => setMobileOpen(false)} aria-current={supportActive ? 'page' : undefined} className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-copy-sm text-action ${supportActive ? 'bg-panel font-semibold' : 'hover:bg-panel'}`}><HeartHandshake className="size-5" aria-hidden="true" />Request counsellor support</Link>
          <Link to="/privacy" onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-4 text-copy-sm text-body hover:bg-panel"><ShieldCheck className="size-5" aria-hidden="true" />Privacy & consent</Link>
          {!user && <Link to="/signin" onClick={() => setMobileOpen(false)} className="mt-3 flex min-h-11 items-center justify-center rounded-pill bg-action text-copy-sm font-semibold text-white">Sign in with your school account</Link>}
        </nav>
      )}
      <Dialog open={signOutOpen} onClose={() => { if (!signingOut) setSignOutOpen(false) }} title="Sign out of Soul Nurture AI?" icon={LogOut} footer={<><Button variant="ghost" disabled={signingOut} onClick={() => setSignOutOpen(false)}>Stay signed in</Button><Button disabled={signingOut} onClick={() => void handleSignOut()}>{signingOut ? 'Signing out…' : 'Sign out'}</Button></>}>
        <p className="text-copy-sm text-body">Your saved check-ins and conversations will still be here when you sign in again. On a shared device, always sign out when you are done.</p>
        {signOutError && <p role="alert" className="mt-3 text-copy-sm text-destructive">Could not sign out. Check your connection and try again.</p>}
      </Dialog>
    </header>
  )
}
