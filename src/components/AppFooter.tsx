export function AppFooter() {
  return (
    <footer className="border-t border-hairline">
      {/* License-required N-ATLaS attribution — keep verbatim; the backend exposes the same string via GET /api/v1/ai/config. */}
      <p className="mx-auto w-full max-w-[1440px] px-4 py-3 text-center text-caption text-muted lg:px-20 lg:py-5">
        N-ATLaS is an initiative of the Federal Ministry of Communications, Innovation and Digital Economy, powered by
        Awarri Technologies.
      </p>
    </footer>
  )
}
