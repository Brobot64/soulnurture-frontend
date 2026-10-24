// The reviewer's answer to "why did the AI stop there?". Every statement on
// this page is read from the live server configuration (GET /api/v1/ai/config)
// and describes rules the server enforces — nothing here is clinical policy, and
// nothing is asserted that the running config does not actually do.

import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, CircleSlash, PhoneIncoming, ShieldAlert } from 'lucide-react'

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
