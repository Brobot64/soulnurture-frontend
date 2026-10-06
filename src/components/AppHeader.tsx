import { Link } from '@tanstack/react-router'
import { Heart, HeartHandshake, UserRound } from 'lucide-react'

export function AppHeader() {
  return (
    <header className="hidden border-b border-hairline lg:block">
      <div className="mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between px-20">
        <Link to="/welcome" className="flex items-center gap-3">
          {/* Brand mark approximated with icons — swap for the official asset. */}
          <span className="relative inline-flex size-10 items-center justify-center">
            <HeartHandshake className="size-9 text-action" strokeWidth={1.7} />
            <Heart className="absolute -bottom-0.5 -left-0.5 size-3.5 fill-accent text-accent" />
          </span>
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
