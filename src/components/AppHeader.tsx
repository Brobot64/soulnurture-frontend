import { Link } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'

import logo from '#/assets/soul-nurture-logo.png'

export function AppHeader() {
  return (
    <header className="hidden border-b border-hairline lg:block">
      <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between px-20">
        <Link to="/welcome" className="flex items-center gap-3">
          <img src={logo} alt="" className="size-10 rounded-full" />
          <span className="text-wordmark text-heading">Soul Nurture AI</span>
        </Link>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="inline-flex h-11 items-center whitespace-nowrap rounded-pill border border-action/50 px-7 text-copy-sm font-medium text-action transition-colors hover:bg-action/5"
          >
            Talk to a person
          </button>
          <button
            type="button"
            aria-label="Student profile"
            className="flex size-11 items-center justify-center rounded-full bg-surface text-body"
          >
            <UserRound className="size-5" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </header>
  )
}
