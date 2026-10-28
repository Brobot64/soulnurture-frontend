export function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-hairline bg-white">
      <div className="mx-auto w-full max-w-[1440px] space-y-0.5 px-4 py-1.5 text-center text-caption text-muted lg:px-20 lg:py-2">
        {/* License-required N-ATLaS attribution — keep verbatim; the backend exposes the same string via GET /api/v1/ai/config. */}
        <p>
          N-ATLaS is an initiative of the Federal Ministry of Communications, Innovation and Digital Economy, powered
          by Awarri Technologies.
        </p>
        {/* License-required attribution for the vernacular ASR models behind voice notes — same Awarri terms, its own string. */}
        <p>
          Voice notes in Yoruba, Hausa and Igbo are transcribed by Yoruba-ASR, Hausa-ASR and Igbo-ASR, developed by
          Awarri Technologies in partnership with the Federal Government of Nigeria.
        </p>
      </div>
    </footer>
  )
}
