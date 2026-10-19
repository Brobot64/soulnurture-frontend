import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, FileCheck2, LockKeyhole, ShieldCheck } from 'lucide-react'

export const Route = createFileRoute('/_app/privacy')({
  head: () => ({ meta: [{ title: 'Privacy & consent · Soul Nurture AI' }, { name: 'description', content: 'How Soul Nurture AI handles your information and how to read your AI chat agreement.' }] }),
  component: Privacy,
})

function Privacy() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-10 lg:px-10 lg:py-14">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-chip font-semibold text-action"><ArrowLeft className="size-4" aria-hidden="true" />Back to home</Link>
      <span className="mt-6 flex w-fit items-center gap-2 rounded-pill bg-panel px-3 py-1.5 text-caption font-semibold text-brand-4"><ShieldCheck className="size-3.5" aria-hidden="true" />Your information matters</span>
      <h1 className="mt-5 text-title text-heading sm:text-title-lg">Privacy & consent</h1>
      <p className="mt-3 max-w-2xl text-lede text-body">Understand what you share, how it may be used, and what you agree to before an AI chat.</p>
      <div className="mt-9 grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-panel border border-hairline bg-white p-6 sm:p-8" aria-labelledby="privacy-notice">
          <span className="grid size-12 place-items-center rounded-full bg-panel text-action"><LockKeyhole className="size-5" aria-hidden="true" /></span>
          <h2 id="privacy-notice" className="mt-5 text-section text-heading">Privacy Notice</h2>
          <div className="mt-6 space-y-7">
            <div><h3 className="text-card text-heading">How information is used</h3><p className="mt-3 text-copy text-body">Your check-ins, messages and other information you provide may be processed to provide the service. We use appropriate safeguards to protect your information.</p></div>
            <div className="border-t border-hairline pt-7"><h3 className="text-card text-heading">When information may be shared</h3><p className="mt-3 text-copy text-body">If there is a serious safety concern, information may need to be shared with authorised support personnel according to safeguarding procedures.</p></div>
          </div>
        </section>
        <aside className="space-y-5">
          <section className="rounded-panel border border-hairline bg-panel p-6 sm:p-8">
            <FileCheck2 className="size-6 text-action" aria-hidden="true" />
            <h2 className="mt-4 text-section text-heading">About this chat</h2>
            <p className="mt-3 text-copy-sm text-body">Read the current AI explanation and, when signed in, see whether your agreement has been recorded. Opening this page is not consent.</p>
            <Link to="/consent" className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-pill bg-action px-6 text-chip font-semibold text-white hover:bg-brand-4">Read before you start<ArrowRight className="size-4" aria-hidden="true" /></Link>
          </section>
          <section className="rounded-card border border-blush bg-peach p-6"><h2 className="text-card text-peach-ink">If you are in danger</h2><p className="mt-2 text-copy-sm text-peach-ink">Soul Nurture AI is not an emergency service. If you are in danger, tell a trusted adult right away.</p></section>
        </aside>
      </div>
    </div>
  )
}
