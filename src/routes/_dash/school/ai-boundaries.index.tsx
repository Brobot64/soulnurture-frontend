// The reviewer's answer to "why did the AI stop there?". Every statement on
// this page is read from the live server configuration (GET /api/v1/ai/config)
// and describes rules the server enforces — nothing here is clinical policy, and
// nothing is asserted that the running config does not actually do.

import type { ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, CircleSlash, PhoneIncoming, ShieldAlert, ShieldCheck } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { Button, ErrorNote, Skeleton, Tag, type TagTone } from '#/components/dash/ui'
import { fetchAiConfig, type AiIntentSpec, type BannedClaimSpec, type IntentSeverity } from '#/lib/ai-config'
import { REVIEWER_ROLES } from '#/lib/ai-response-reports'
import { useApiQuery, useRoleGuard } from '#/lib/dash'

export const Route = createFileRoute('/_dash/school/ai-boundaries/')({
  head: () => ({ meta: [{ title: 'AI boundaries · Soul Nurture AI' }] }),
  component: AiBoundariesPage,
})

const SEVERITY_TONES: Record<IntentSeverity, TagTone> = {
  TIER_1_MODERATE: 'info',
  TIER_2_HIGH: 'accent',
  TIER_3_ACUTE: 'danger',
}

const SEVERITY_LABELS: Record<IntentSeverity, string> = {
  TIER_1_MODERATE: 'Moderate',
  TIER_2_HIGH: 'High',
  TIER_3_ACUTE: 'Acute',
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  pcm: 'Nigerian Pidgin',
  yo: 'Yoruba',
  ha: 'Hausa',
  ig: 'Igbo',
}

function AiBoundariesPage() {
  const user = useRoleGuard(REVIEWER_ROLES)
  return user ? <Boundaries key={`${user.id}:${user.schoolId}`} /> : null
}

function Boundaries() {
  const { data, error, loading, reload } = useApiQuery(fetchAiConfig, [])
  const acute = data?.intents.filter((intent) => intent.severity === 'TIER_3_ACUTE') ?? []

  return (
    <>
      <DashHeader title="Where the AI stops" subtitle="The rules the server enforces on every reply" />
      <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col gap-6 p-6 lg:p-8">
        <Link to="/school/reports" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-pill text-chip font-medium text-action hover:text-brand-4">
          <ArrowLeft aria-hidden="true" className="size-4" />Back to AI reply reports
        </Link>
        {error ? (
          <div className="flex flex-col items-start gap-3"><ErrorNote>{error.message}</ErrorNote><Button onClick={reload}>Try again</Button></div>
        ) : loading || !data ? (
          <div aria-label="Loading AI configuration" className="flex flex-col gap-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>
        ) : (
          <>
            <p className="max-w-2xl text-copy text-body">
              Two things can take a turn outside the AI’s remit, and the student is told which one happened. Both are decided by the
              rules below, not by the model. This page reads them from the running configuration, so it can never describe more than
              the server actually enforces.
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              <BoundaryCard
                icon={CircleSlash}
                title="The reply was stopped"
                body={`The model claimed something it is banned from claiming. The server replaced its own words with approved scripted copy and the student sees “Outside what the AI can help with”. ${data.guardrails.output.bannedClaims.length} claims are policed, ${countSevere(data.guardrails.output.bannedClaims)} of them by replacing the whole reply.`}
              />
              <BoundaryCard
                icon={PhoneIncoming}
                title="The turn went to a person"
                body={
                  acute.length
                    ? `An acute safeguarding rule fired: ${acute.map((intent) => intent.label).join(', ')}. The student is told their school’s support team has it and that this is not an emergency service. The referral is written before the model’s reply is ready, so a wait for the AI never delays it.`
                    : 'No intent is configured as acute right now, so no turn is routed to your school automatically.'
                }
              />
            </div>

            {/* Epic G's counsellor explainer. Each line is checked against what
                this deployment actually runs, so the one the design asserts —
                that rules and wording already carry a professional sign-off —
                is stated as the pending workflow it is instead. */}
            <section className="rounded-panel border border-hairline bg-white p-5 sm:p-7" aria-labelledby="remit-heading">
              <h2 id="remit-heading" className="text-title-sm text-heading">What the AI does and never does</h2>
              <p className="mt-2 text-copy-sm text-muted">
                A short guide to the limits of Soul Nurture AI, for the people who review what it surfaces.
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <RemitList
                  title="The AI can"
                  tone="can"
                  items={[
                    'Guide an emotional check-in and a guided reflection.',
                    'Offer only the wellbeing resources the content register has approved for students.',
                    'Encourage a student to reach a person at their school, and hand them the route to do it.',
                    'Raise a server-policy flag on a conversation so a person can review it.',
                    'Stop its own reply when it crosses a boundary listed below, and say so to the student.',
                  ]}
                />
                <RemitList
                  title="The AI never"
                  tone="never"
                  items={[
                    'Diagnoses a mental-health condition or any other illness.',
                    'Presents itself as a therapist, counsellor, doctor or a person.',
                    'Gives therapy or medical advice, including anything about medication.',
                    'Predicts a student’s future mental health or promises how things will turn out.',
                    'Decides a student’s care, follow-up or the outcome of a request.',
                    'Turns an indicator into a clinical finding — a flag is a prompt for your review, not a diagnosis.',
                    'Acts as an emergency service or dispatches help.',
                  ]}
                />
              </div>
            </section>

            <section className="rounded-panel border border-hairline bg-white p-5 sm:p-7" aria-labelledby="banned-claims-heading">
              <h2 id="banned-claims-heading" className="text-title-sm text-heading">What the AI may never claim</h2>
              <p className="mt-2 text-copy-sm text-muted">
                A severe claim discards the whole reply. A soft claim removes only the sentence that made it, and the rest survives.
                If nothing survives, the turn counts as stopped.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {data.guardrails.output.bannedClaims.map((claim) => (
                  <BannedClaimRow key={claim.id} claim={claim} fallback={data.guardrails.output.fallbackCopy} />
                ))}
              </ul>
            </section>

            <section className="rounded-panel border border-hairline bg-white p-5 sm:p-7" aria-labelledby="intents-heading">
              <h2 id="intents-heading" className="text-title-sm text-heading">Safeguarding rules that route a turn to you</h2>
              <p className="mt-2 text-copy-sm text-muted">
                The server’s own keyword floor can never be overruled by the model. Each intent lists exactly the actions the server
                runs when it fires, so an acute rule is visible as a referral here before it appears in your queue.
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {data.intents.map((intent) => <IntentRow key={intent.id} intent={intent} />)}
              </ul>
            </section>

            <section className="rounded-panel border border-hairline bg-white p-5 sm:p-7" aria-labelledby="limits-heading">
              <h2 id="limits-heading" className="text-title-sm text-heading">Limits applied to each turn</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <Fact label="Message length sent to the model" value={`${data.guardrails.input.maxMessageChars} characters`} detail={data.guardrails.input.truncationNote} />
                <Fact label="Reply length shown to the student" value={`${data.guardrails.output.maxReplyChars} characters`} detail={data.guardrails.output.truncationNote} />
                <Fact
                  label="AI turns per student"
                  value={`${data.guardrails.rate.perStudentDaily} a day · ${data.guardrails.rate.perStudentPerMinute} a minute`}
                  detail="The limit covers AI reflection turns. Asking a school professional for support is a different route and is never blocked by it."
                />
                <Fact
                  label="Model-override probes watched for"
                  value={`${data.guardrails.input.injectionPatterns.length} patterns`}
                  detail="A hit hardens the prompt for that turn; it does not silence the student."
                />
              </dl>
            </section>

            <section className="rounded-panel border border-hairline bg-white p-5 sm:p-7" aria-labelledby="language-heading">
              <h2 id="language-heading" className="text-title-sm text-heading">The language the student is answered in</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {data.language.supported.map((code) => (
                  <li key={code}><Tag tone="neutral">{LANGUAGE_NAMES[code] ?? code}</Tag></li>
                ))}
              </ul>
              <p className="mt-4 text-copy-sm text-body">
                Vernacular replies are produced in the{' '}
                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-chip">{data.language.vernacularReplyMode}</code> lane.{' '}
                {data.language.offerEnabled
                  ? 'When a student writes in a vernacular while their preference is still English, the reply comes with an offer to switch.'
                  : 'The automatic offer to switch language is currently off.'}
              </p>
            </section>

            <section className="rounded-panel border border-hairline bg-white p-5 sm:p-7" aria-labelledby="review-heading">
              <h2 id="review-heading" className="text-title-sm text-heading">How AI behaviour is reviewed</h2>
              <ul className="mt-5 flex flex-col gap-3">
                <ReviewLine>
                  A student can report any AI reply in their reflection. Each report arrives in{' '}
                  <Link to="/school/reports" className="font-semibold text-action hover:text-brand-4">AI reply reports</Link>
                  {' '}with the reason the student chose and the reply frozen as they saw it.
                </ReviewLine>
                <ReviewLine>
                  A reviewer’s decision is recorded on the report only. It changes no reply, no conversation, no support request and
                  sends the student no message — which is why the student’s receipt never shows that a review happened.
                </ReviewLine>
                <ReviewLine>
                  The rules on this page are read from the running configuration, not from a policy document. Professional sign-off of
                  rule wording is a workflow this deployment does not record yet: every Doc A indicator rule is still awaiting the
                  threshold only a qualified professional can set, so the keyword floor below is the only automatic safety net.
                </ReviewLine>
              </ul>
              <p className="mt-5 border-t border-hairline pt-5 text-copy-sm text-heading">
                <span className="font-semibold">Human oversight principle:</span> AI supports identification and reflection.
                Qualified humans remain responsible for professional review, safeguarding decisions and follow-up.
              </p>
            </section>

            <div className="rounded-card bg-panel px-6 py-5 text-copy-sm text-brand-4">
              These are technical guardrails, not a safeguarding procedure. Your school’s own policy decides what happens after a
              flag or a report reaches you.
            </div>
            <p className="text-caption text-muted">
              Soul Nurture AI is not an emergency service and does not dispatch emergency help. Reading this configuration writes
              nothing and records no review.
            </p>
          </>
        )}
      </main>
    </>
  )
}

function countSevere(claims: BannedClaimSpec[]): number {
  return claims.filter((claim) => claim.severity === 'severe').length
}

function RemitList({ title, tone, items }: { title: string; tone: 'can' | 'never'; items: string[] }) {
  return (
    <div className={`rounded-card border p-5 ${tone === 'can' ? 'border-hairline bg-panel' : 'border-apricot-10 bg-peach'}`}>
      <h3 className={`text-card ${tone === 'can' ? 'text-heading' : 'text-peach-ink'}`}>{title}</h3>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
        {items.map((item) => (
          <li key={item} className={`text-copy-sm ${tone === 'can' ? 'text-body' : 'text-peach-ink'}`}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function ReviewLine({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-card border border-hairline p-4">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-action" aria-hidden="true" />
      <p className="min-w-0 text-copy-sm text-body">{children}</p>
    </li>
  )
}

function BoundaryCard({ icon: Icon, title, body }: { icon: typeof ShieldAlert; title: string; body: string }) {
  return (
    <section className="rounded-panel border border-hairline bg-white p-6">
      <span className="grid size-11 place-items-center rounded-full bg-panel text-action"><Icon className="size-5" aria-hidden="true" /></span>
      <h2 className="mt-5 text-card text-heading">{title}</h2>
      <p className="mt-3 text-copy-sm leading-relaxed text-body">{body}</p>
    </section>
  )
}

function BannedClaimRow({ claim, fallback }: { claim: BannedClaimSpec; fallback: string }) {
  return (
    <li className="rounded-card border border-hairline p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-chip font-semibold text-heading">{claim.id}</h3>
        <Tag tone={claim.severity === 'severe' ? 'danger' : 'info'}>{claim.severity === 'severe' ? 'Whole reply replaced' : 'Offending sentences removed'}</Tag>
      </div>
      <p className="mt-2 text-copy-sm text-body">{claim.reason}</p>
      {claim.severity === 'severe' && (
        <p className="mt-2 whitespace-pre-wrap break-words border-l-4 border-hairline pl-3 text-caption text-muted">
          Scripted copy shown instead: {claim.replacement ?? fallback}
        </p>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer text-caption text-muted">Matched phrases ({claim.patterns.length})</summary>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {claim.patterns.map((pattern) => (
            <li key={pattern}><code className="rounded bg-panel-2 px-1.5 py-0.5 text-chip text-body">{pattern}</code></li>
          ))}
        </ul>
      </details>
    </li>
  )
}

function IntentRow({ intent }: { intent: AiIntentSpec }) {
  return (
    <li className="rounded-card border border-hairline p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-chip font-semibold text-heading">{intent.label}</h3>
        <Tag tone={SEVERITY_TONES[intent.severity]}>{SEVERITY_LABELS[intent.severity]}</Tag>
        {intent.actions.map((action) => <Tag key={action} tone="neutral">{action.toLowerCase().replaceAll('_', ' ')}</Tag>)}
      </div>
      <p className="mt-2 text-copy-sm text-body">{intent.description}</p>
      {intent.keywords.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-caption text-muted">Server keyword floor ({intent.keywords.length})</summary>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {intent.keywords.map((keyword) => (
              <li key={keyword}><code className="rounded bg-panel-2 px-1.5 py-0.5 text-chip text-body">{keyword}</code></li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

function Fact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-card border border-hairline p-4">
      <dt className="text-chip font-medium text-muted">{label}</dt>
      <dd className="mt-1.5 text-copy font-semibold text-heading">{value}</dd>
      <p className="mt-2 text-caption leading-relaxed text-muted">{detail}</p>
    </div>
  )
}
