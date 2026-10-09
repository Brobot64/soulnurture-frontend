// School lifecycle dialogs — create (with the short-code reveal), rename,
// suspend/reactivate and owner-only school-admin provisioning.

import { useState } from 'react'
import { CheckCircle2, TriangleAlert } from 'lucide-react'

import {
  Button,
  Dialog,
  ErrorNote,
  Tag,
  TextField,
} from '#/components/dash/ui'
import {
  createSchool,
  onboardSchoolAdmin,
  renameSchool,
  setSchoolSuspended,
  type CreatedSchool,
  type SchoolStatus,
} from '#/lib/admin'
import { ApiError } from '#/lib/api'

/** The minimum every school dialog needs — satisfied by SchoolRow and SchoolSettings. */
export interface SchoolRef {
  id: string
  name: string
  status: SchoolStatus
}

function messageOf(caught: unknown): string {
  return caught instanceof ApiError || caught instanceof Error
    ? caught.message
    : 'Something went wrong. Please try again.'
}

function SuccessPanel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3">
      <span className="flex size-12 items-center justify-center rounded-full bg-mint/30 text-brand-4">
        <CheckCircle2 aria-hidden="true" className="size-6" />
      </span>
      <p className="text-card text-heading">{title}</p>
      {children}
    </div>
  )
}

// --- Create school ---------------------------------------------------------

export function CreateSchoolDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [defaultPassword, setDefaultPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    defaultPassword?: string
  }>({})
  const [created, setCreated] = useState<CreatedSchool | null>(null)

  const submit = async () => {
    const trimmedName = name.trim()
    const nextErrors: typeof fieldErrors = {}
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      nextErrors.name = 'Name must be between 2 and 120 characters.'
    }
    if (defaultPassword && defaultPassword.length < 8) {
      nextErrors.defaultPassword = 'Use at least 8 characters.'
    }
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setError(null)
    try {
      const school = await createSchool({
        name: trimmedName,
        ...(defaultPassword ? { defaultPassword } : {}),
      })
      setCreated(school)
      onCreated()
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={created ? 'School created' : 'New school'}
      footer={
        created ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-school-form"
              disabled={busy || name.trim().length === 0}
            >
              {busy ? 'Creating…' : 'Create school'}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <SuccessPanel title={`${created.name} is ready.`}>
          <div className="flex items-center gap-3">
            <span className="rounded-card bg-panel px-4 py-2 text-section tabular-nums text-heading">
              {created.shortCode}
            </span>
            <span className="text-copy-sm text-muted">short code</span>
          </div>
          <p className="text-copy-sm text-muted">
            Student codes are built from this code — no need to memorise it
            separately. You can register the school&apos;s first admin from the
            schools list.
          </p>
        </SuccessPanel>
      ) : (
        <form
          id="create-school-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-4"
        >
          <TextField
            label="School name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Miva University"
            autoFocus
            error={fieldErrors.name}
          />
          <TextField
            label="Default password (optional)"
            type="password"
            value={defaultPassword}
            onChange={(event) => setDefaultPassword(event.target.value)}
            placeholder="At least 8 characters"
            hint="Accounts onboarded to this school start on this password and are forced to change it at first sign-in. You can also set it later in school settings."
            error={fieldErrors.defaultPassword}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
        </form>
      )}
    </Dialog>
  )
}

// --- Rename school ---------------------------------------------------------

export function RenameSchoolDialog({
  school,
  onClose,
  onRenamed,
}: {
  school: SchoolRef
  onClose: () => void
  onRenamed: () => void
}) {
  const [name, setName] = useState(school.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const submit = async () => {
    const trimmedName = name.trim()
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      setFieldError('Name must be between 2 and 120 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await renameSchool(school.id, trimmedName)
      onRenamed()
      onClose()
    } catch (caught) {
      setError(messageOf(caught))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Rename school"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="rename-school-form"
            disabled={busy || name.trim() === school.name}
          >
            {busy ? 'Saving…' : 'Save name'}
          </Button>
        </>
      }
    >
      <form
        id="rename-school-form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        className="flex flex-col gap-4"
      >
        <TextField
          label="School name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          error={fieldError ?? undefined}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </Dialog>
  )
}

// --- Suspend / reactivate --------------------------------------------------

export function SchoolStatusDialog({
  school,
  onClose,
  onDone,
}: {
  school: SchoolRef
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const suspending = school.status === 'ACTIVE'

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await setSchoolSuspended(school.id, suspending)
      onDone()
      onClose()
    } catch (caught) {
      setError(messageOf(caught))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={suspending ? 'Suspend school' : 'Reactivate school'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={suspending ? 'danger' : 'primary'}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy
              ? suspending
                ? 'Suspending…'
                : 'Reactivating…'
              : suspending
                ? 'Suspend school'
                : 'Reactivate school'}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {suspending && (
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive-soft text-destructive">
            <TriangleAlert aria-hidden="true" className="size-5" />
          </span>
        )}
        <div className="flex flex-col gap-2 text-copy-sm text-body">
          {suspending ? (
            <>
              <p>
                Suspending <span className="font-semibold text-heading">{school.name}</span>{' '}
                signs out every user immediately and blocks sign-in until the
                school is reactivated.
              </p>
              <p className="text-muted">
                Students keep their data — nothing is deleted.
              </p>
            </>
          ) : (
            <p>
              Reactivating <span className="font-semibold text-heading">{school.name}</span>{' '}
              lets its users sign in again. Suspension notifications already
              delivered stay in their inboxes.
            </p>
          )}
        </div>
      </div>
      {error && <ErrorNote className="mt-4">{error}</ErrorNote>}
    </Dialog>
  )
}

// --- Provision school admin (platform owner only) --------------------------

export function CreateSchoolAdminDialog({
  school,
  onClose,
  onCreated,
}: {
  school: SchoolRef
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    email?: string
  }>({})
  const [provisioned, setProvisioned] = useState<{
    email: string
    verificationEmailSent: boolean
  } | null>(null)

  const submit = async () => {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const nextErrors: typeof fieldErrors = {}
    if (trimmedName.length === 0) nextErrors.name = 'Enter the admin’s full name.'
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    }
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setError(null)
    try {
      const result = await onboardSchoolAdmin(school.id, {
        name: trimmedName,
        email: trimmedEmail,
      })
      setProvisioned({
        email: result.user.email,
        verificationEmailSent: result.verificationEmailSent,
      })
      onCreated()
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'SCHOOL_DEFAULT_PASSWORD_REQUIRED') {
        setError(
          'This school has no default password yet. Set one in the school settings before onboarding users.',
        )
      } else {
        setError(messageOf(caught))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={provisioned ? 'School admin created' : 'Add school admin'}
      footer={
        provisioned ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-school-admin-form"
              disabled={busy}
            >
              {busy ? 'Creating…' : 'Create admin'}
            </Button>
          </>
        )
      }
    >
      {provisioned ? (
        <SuccessPanel title={`${provisioned.email} can now sign in.`}>
          <p className="text-copy-sm text-muted">
            The account starts on {school.name}&apos;s default password and must
            be changed at first sign-in.
          </p>
          {provisioned.verificationEmailSent ? (
            <Tag tone="success">Verification email sent</Tag>
          ) : (
            <Tag tone="accent">Verification email could not be sent</Tag>
          )}
        </SuccessPanel>
      ) : (
        <form
          id="create-school-admin-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-copy-sm text-muted">
            A school admin manages {school.name}&apos;s users and settings.
          </p>
          <TextField
            label="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Amina Bello"
            autoFocus
            error={fieldErrors.name}
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@school.edu.ng"
            error={fieldErrors.email}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
        </form>
      )}
    </Dialog>
  )
}
