// School settings — the school's identity as the platform holds it, the
// default password every onboarded account starts on, and the suspension
// notice for the rare case a suspended admin reaches the portal.

import { useState, type ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'

import { DashHeader } from '#/components/dash/DashHeader'
import { messageOf } from '#/components/dash/school-dialogs'
import {
  Button,
  Card,
  ErrorNote,
  Skeleton,
  Tag,
  TextField,
} from '#/components/dash/ui'
import { fetchSchoolSettings } from '#/lib/admin'
import type { SchoolBrief } from '#/lib/auth'
import { formatDateTime, useApiQuery, useRoleGuard } from '#/lib/dash'
import { updateSchoolDefaultPassword } from '#/lib/school'

export const Route = createFileRoute('/_dash/school/settings')({
  head: () => ({ meta: [{ title: 'Settings · Soul Nurture AI' }] }),
  component: SchoolSettingsPage,
})

function SchoolSettingsPage() {
  const user = useRoleGuard(['SCHOOL_ADMIN'])
  if (!user?.school) return null
  return <SchoolSettingsContent school={user.school} />
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-copy-sm text-muted">{label}</dt>
      <dd className="text-copy-sm text-heading">{children}</dd>
    </div>
  )
}

function SchoolSettingsContent({ school }: { school: SchoolBrief }) {
  const settings = useApiQuery(
    () => fetchSchoolSettings(school.id),
    [school.id],
  )
  const data = settings.data

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string
    confirmPassword?: string
  }>({})
  const [saved, setSaved] = useState(false)

  const submit = async () => {
    const nextErrors: typeof fieldErrors = {}
    if (newPassword.length < 8) {
      nextErrors.newPassword = 'Use at least 8 characters.'
    }
    if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.'
    }
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setError(null)
    try {
      await updateSchoolDefaultPassword(school.id, newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setSaved(true)
      settings.reload()
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DashHeader title="Settings" subtitle="School profile and access" />
      <main className="flex flex-1 flex-col gap-5 p-6 lg:p-8">
        {settings.error && <ErrorNote>{settings.error.message}</ErrorNote>}

        {data?.status === 'SUSPENDED' && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-card border border-destructive/20 bg-destructive-soft px-4 py-3"
          >
            <TriangleAlert
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-destructive"
            />
            <p className="text-copy-sm text-destructive">
              This school is suspended. Students and staff can&apos;t sign in
              until the platform team reactivates it.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Card className="flex flex-col gap-4 lg:col-span-5">
            <h2 className="text-meta uppercase tracking-wider text-muted">
              School identity
            </h2>
            {settings.loading || !data ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <dl className="flex flex-col gap-3">
                <DetailRow label="Name">{data.name}</DetailRow>
                <DetailRow label="Short code">
                  <span className="tabular-nums">{data.shortCode}</span>
                </DetailRow>
                <DetailRow label="Status">
                  {data.status === 'ACTIVE' ? (
                    <Tag tone="success">Active</Tag>
                  ) : (
                    <Tag tone="danger">Suspended</Tag>
                  )}
                </DetailRow>
                <DetailRow label="Created">
                  {formatDateTime(data.createdAt)}
                </DetailRow>
              </dl>
            )}
            <p className="mt-auto text-caption text-muted">
              Renames and suspension are platform-team actions.
            </p>
          </Card>

          <Card className="flex flex-col gap-4 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-meta uppercase tracking-wider text-muted">
                Default password
              </h2>
              {saved ? (
                <Tag tone="success">Default password updated</Tag>
              ) : !data ? (
                <Skeleton className="h-6 w-16" />
              ) : data.hasDefaultPassword ? (
                <Tag tone="success">Set</Tag>
              ) : (
                <Tag tone="accent">Not set</Tag>
              )}
            </div>
            <p className="text-copy-sm text-muted">
              Every account you onboard starts on this password and is asked
              to choose a personal one at first sign-in. Existing users are
              not affected.
            </p>
            <form
              id="default-password-form"
              onSubmit={(event) => {
                event.preventDefault()
                void submit()
              }}
              className="flex flex-col gap-4"
            >
              <TextField
                label="New default password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value)
                  setSaved(false)
                }}
                placeholder="At least 8 characters"
                error={fieldErrors.newPassword}
              />
              <TextField
                label="Confirm default password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  setSaved(false)
                }}
                error={fieldErrors.confirmPassword}
              />
              {error && <ErrorNote>{error}</ErrorNote>}
            </form>
            <div className="flex justify-end">
              <Button
                type="submit"
                form="default-password-form"
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save default password'}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </>
  )
}
