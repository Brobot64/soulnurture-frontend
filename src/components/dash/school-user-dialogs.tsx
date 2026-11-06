// School-portal user dialogs — onboarding students and professionals,
// editing profiles, deactivate/reactivate and credential reset.

import { useState } from 'react'
import { TriangleAlert } from 'lucide-react'

import {
  Button,
  Dialog,
  ErrorNote,
  SelectField,
  Tag,
  TextField,
} from '#/components/dash/ui'
import {
  messageOf,
  SuccessPanel,
} from '#/components/dash/school-dialogs'
import type { SchoolUserRow } from '#/lib/admin'
import {
  deactivateSchoolUser,
  eraseSchoolUser,
  onboardProfessional,
  onboardStudent,
  reactivateSchoolUser,
  resendSchoolUserVerification,
  resetSchoolUserPassword,
  updateSchoolUser,
  LANGUAGE_OPTIONS,
  STAFF_ROLE_OPTIONS,
  type OnboardedStudent,
  type UpdateSchoolUserInput,
} from '#/lib/school'

const EMAIL_RE = /^\S+@\S+\.\S+$/

/** The minimum these dialogs need — satisfied by SchoolBrief and SchoolSettings. */
export interface SchoolIdentity {
  id: string
  name: string
}

function DefaultPasswordNote({ schoolName }: { schoolName: string }) {
  return (
    <p className="text-copy-sm text-muted">
      The account starts on {schoolName}&apos;s default password and must be
      changed at first sign-in.
    </p>
  )
}

function VerificationTag({ sent }: { sent: boolean }) {
  return sent ? (
    <Tag tone="success">Verification email sent</Tag>
  ) : (
    <Tag tone="accent">Verification email could not be sent</Tag>
  )
}

// --- Onboard student --------------------------------------------------------

export function OnboardStudentDialog({
  school,
  onClose,
  onOnboarded,
}: {
  school: SchoolIdentity
  onClose: () => void
  onOnboarded: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [classLabel, setClassLabel] = useState('')
  const [phone, setPhone] = useState('')
  const [language, setLanguage] = useState('en')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string
    email?: string
  }>({})
  const [onboarded, setOnboarded] = useState<OnboardedStudent | null>(null)

  const submit = async () => {
    const trimmedFirst = firstName.trim()
    const trimmedEmail = email.trim()
    const nextErrors: typeof fieldErrors = {}
    if (trimmedFirst.length === 0) nextErrors.firstName = 'Enter the student’s first name.'
    if (!EMAIL_RE.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    }
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setError(null)
    try {
      const result = await onboardStudent(school.id, {
        firstName: trimmedFirst,
        email: trimmedEmail,
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(classLabel.trim() ? { classLabel: classLabel.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        preferredLanguage: language,
      })
      setOnboarded(result)
      onOnboarded()
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
      title={onboarded ? 'Student onboarded' : 'Onboard student'}
      footer={
        onboarded ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="onboard-student-form"
              disabled={busy}
            >
              {busy ? 'Onboarding…' : 'Onboard student'}
            </Button>
          </>
        )
      }
    >
      {onboarded ? (
        <SuccessPanel title={`${onboarded.user.name} is ready to sign in.`}>
          <div className="flex items-center gap-3">
            <span className="rounded-card bg-panel px-4 py-2 text-section tabular-nums text-heading">
              {onboarded.studentCode}
            </span>
            <span className="text-copy-sm text-muted">student code</span>
          </div>
          <DefaultPasswordNote schoolName={school.name} />
          <VerificationTag sent={onboarded.verificationEmailSent} />
        </SuccessPanel>
      ) : (
        <form
          id="onboard-student-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="e.g. Jude"
              maxLength={80}
              autoFocus
              error={fieldErrors.firstName}
            />
            <TextField
              label="Last name (optional)"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="e.g. Adeyemi"
              maxLength={80}
            />
          </div>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="student@school.edu.ng"
            error={fieldErrors.email}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Class (optional)"
              value={classLabel}
              onChange={(event) => setClassLabel(event.target.value)}
              placeholder="e.g. JSS 2B"
              maxLength={40}
            />
            <TextField
              label="Phone (optional)"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="e.g. 0803 000 0000"
              maxLength={30}
            />
          </div>
          <SelectField
            label="Preferred language"
            value={language}
            onChange={setLanguage}
            options={LANGUAGE_OPTIONS}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
        </form>
      )}
    </Dialog>
  )
}

// --- Onboard professional ---------------------------------------------------

export function OnboardProfessionalDialog({
  school,
  onClose,
  onOnboarded,
}: {
  school: SchoolIdentity
  onClose: () => void
  onOnboarded: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>(STAFF_ROLE_OPTIONS[0].value)
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string
    email?: string
  }>({})
  const [onboarded, setOnboarded] = useState<{
    email: string
    verificationEmailSent: boolean
  } | null>(null)

  const submit = async () => {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const nextErrors: typeof fieldErrors = {}
    if (trimmedName.length === 0) nextErrors.name = 'Enter the professional’s full name.'
    if (!EMAIL_RE.test(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    }
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setError(null)
    try {
      const result = await onboardProfessional(school.id, {
        name: trimmedName,
        email: trimmedEmail,
        role: role as (typeof STAFF_ROLE_OPTIONS)[number]['value'],
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(department.trim() ? { department: department.trim() } : {}),
      })
      setOnboarded({
        email: result.user.email,
        verificationEmailSent: result.verificationEmailSent,
      })
      onOnboarded()
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
      title={onboarded ? 'Professional onboarded' : 'Onboard professional'}
      footer={
        onboarded ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="onboard-professional-form"
              disabled={busy}
            >
              {busy ? 'Onboarding…' : 'Onboard professional'}
            </Button>
          </>
        )
      }
    >
      {onboarded ? (
        <SuccessPanel title={`${onboarded.email} can now sign in.`}>
          <DefaultPasswordNote schoolName={school.name} />
          <p className="text-copy-sm text-muted">
            Counsellors, psychologists and support staff appear in the chat
            request pool once verified.
          </p>
          <VerificationTag sent={onboarded.verificationEmailSent} />
        </SuccessPanel>
      ) : (
        <form
          id="onboard-professional-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className="flex flex-col gap-4"
        >
          <TextField
            label="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Tolu Ade"
            maxLength={120}
            autoFocus
            error={fieldErrors.name}
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="counsellor@school.edu.ng"
            error={fieldErrors.email}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Role"
              value={role}
              onChange={setRole}
              options={STAFF_ROLE_OPTIONS}
            />
            <TextField
              label="Title (optional)"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Counsellor"
              maxLength={80}
            />
          </div>
          <TextField
            label="Department (optional)"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="e.g. Student Affairs"
            maxLength={80}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
        </form>
      )}
    </Dialog>
  )
}

// --- Edit user --------------------------------------------------------------

export function EditSchoolUserDialog({
  school,
  user,
  onClose,
  onUpdated,
}: {
  school: SchoolIdentity
  user: SchoolUserRow
  onClose: () => void
  onUpdated: () => void
}) {
  const student = user.studentProfile
  const professional = user.professionalProfile
  const currentLanguage = student?.preferredLanguage ?? 'en'

  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState('')
  const [classLabel, setClassLabel] = useState(student?.classLabel ?? '')
  const [language, setLanguage] = useState(currentLanguage)
  const [title, setTitle] = useState(professional?.title ?? '')
  const [department, setDepartment] = useState(professional?.department ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  const languageOptions = LANGUAGE_OPTIONS.some(
    (option) => option.value === currentLanguage,
  )
    ? LANGUAGE_OPTIONS
    : [{ value: currentLanguage, label: currentLanguage }, ...LANGUAGE_OPTIONS]

  const buildInput = (): UpdateSchoolUserInput => {
    const input: UpdateSchoolUserInput = {}
    const trimmedName = name.trim()
    if (trimmedName !== user.name) input.name = trimmedName
    if (phone.trim()) input.phone = phone.trim()
    if (student) {
      if (classLabel.trim() !== (student.classLabel ?? '')) {
        input.classLabel = classLabel.trim()
      }
      if (language !== currentLanguage) input.preferredLanguage = language
    }
    if (professional) {
      if (title.trim() !== (professional.title ?? '')) {
        input.title = title.trim()
      }
      if (department.trim() !== (professional.department ?? '')) {
        input.department = department.trim()
      }
    }
    return input
  }

  const input = buildInput()

  const submit = async () => {
    const trimmedName = name.trim()
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      setFieldError('Name must be between 2 and 120 characters.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updateSchoolUser(school.id, user.id, input)
      onUpdated()
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
      title="Edit details"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-school-user-form"
            disabled={busy || Object.keys(input).length === 0}
          >
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form
        id="edit-school-user-form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-copy-sm text-muted">
          {user.email} — the account email can&apos;t be changed from here.
        </p>
        <TextField
          label="Full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoFocus
          error={fieldError ?? undefined}
        />
        <TextField
          label="Phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="New number"
          maxLength={30}
          hint="Leave blank to keep their current number."
        />
        {student && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Class"
              value={classLabel}
              onChange={(event) => setClassLabel(event.target.value)}
              placeholder="e.g. JSS 2B"
              maxLength={40}
            />
            <SelectField
              label="Preferred language"
              value={language}
              onChange={setLanguage}
              options={languageOptions}
            />
          </div>
        )}
        {professional && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Counsellor"
              maxLength={80}
            />
            <TextField
              label="Department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="e.g. Student Affairs"
              maxLength={80}
            />
          </div>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </form>
    </Dialog>
  )
}

// --- Deactivate / reactivate ------------------------------------------------

export function UserStatusDialog({
  school,
  user,
  onClose,
  onDone,
}: {
  school: SchoolIdentity
  user: SchoolUserRow
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const deactivating = !user.deactivatedAt

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      if (deactivating) {
        await deactivateSchoolUser(school.id, user.id)
      } else {
        await reactivateSchoolUser(school.id, user.id)
      }
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
      title={deactivating ? 'Deactivate user' : 'Reactivate user'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={deactivating ? 'danger' : 'primary'}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy
              ? deactivating
                ? 'Deactivating…'
                : 'Reactivating…'
              : deactivating
                ? 'Deactivate user'
                : 'Reactivate user'}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {deactivating && (
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive-soft text-destructive">
            <TriangleAlert aria-hidden="true" className="size-5" />
          </span>
        )}
        <div className="flex flex-col gap-2 text-copy-sm text-body">
          {deactivating ? (
            <>
              <p>
                Deactivating{' '}
                <span className="font-semibold text-heading">{user.name}</span>{' '}
                signs them out immediately and blocks sign-in until you
                reactivate them.
              </p>
              <p className="text-muted">
                Their check-ins and chats are kept — nothing is deleted.
              </p>
            </>
          ) : (
            <p>
              Reactivating{' '}
              <span className="font-semibold text-heading">{user.name}</span>{' '}
              lets them sign in again.
            </p>
          )}
        </div>
      </div>
      {error && <ErrorNote className="mt-4">{error}</ErrorNote>}
    </Dialog>
  )
}

// --- Reset password ---------------------------------------------------------

export function ResetUserPasswordDialog({
  school,
  user,
  onClose,
  onDone,
}: {
  school: SchoolIdentity
  user: SchoolUserRow
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await resetSchoolUserPassword(school.id, user.id)
      setDone(true)
      onDone()
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
      title={done ? 'Password reset' : 'Reset password'}
      footer={
        done ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? 'Resetting…' : 'Reset password'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <SuccessPanel
          title={`${user.name} is back on the default password.`}
        >
          <p className="text-copy-sm text-muted">
            Every session was signed out. They&apos;ll choose a personal
            password at their next sign-in.
          </p>
        </SuccessPanel>
      ) : (
        <p className="text-copy-sm text-body">
          Resetting puts{' '}
          <span className="font-semibold text-heading">{user.name}</span> back
          on {school.name}&apos;s default password and signs out every session
          immediately. They&apos;ll choose a personal password at next
          sign-in.
        </p>
      )}
      {error && <ErrorNote className="mt-4">{error}</ErrorNote>}
    </Dialog>
  )
}

// --- Delete permanently -----------------------------------------------------

/**
 * Deliberately not the Deactivate item's synonym: deactivating keeps the
 * history, this removes the person. The warning says so, and the confirmation
 * this click produces is the one the API requires — the deletion itself is
 * recorded, nothing else about the person survives it.
 */
export function EraseUserDialog({
  school,
  user,
  onClose,
  onDone,
}: {
  school: SchoolIdentity
  user: SchoolUserRow
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removedCheckIns, setRemovedCheckIns] = useState<number | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await eraseSchoolUser(school.id, user.id)
      setRemovedCheckIns(result.removedCheckIns)
      onDone()
    } catch (caught) {
      setError(messageOf(caught))
      setBusy(false)
    }
  }

  if (removedCheckIns !== null) {
    return (
      <Dialog open onClose={onClose} title="Account deleted">
        <SuccessPanel title={`${user.name} is removed from ${school.name}`}>
          <p className="text-copy-sm text-body">
            Their account, and everything the system held about them, is gone.
            {removedCheckIns > 0
              ? ` ${removedCheckIns} check-in(s) and the reflections built on them went with it.`
              : ''}
          </p>
          <p className="text-copy-sm text-muted">
            The deletion itself stays in your school’s records — that is the
            proof this happened, and it is the only record that does.
          </p>
        </SuccessPanel>
      </Dialog>
    )
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete this account permanently?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive-soft text-destructive">
          <TriangleAlert aria-hidden="true" className="size-5" />
        </span>
        <div className="flex flex-col gap-2 text-copy-sm text-body">
          <p>
            Deleting{' '}
            <span className="font-semibold text-heading">{user.name}</span>{' '}
            removes the account and everything recorded under it — check-ins,
            reflections, chats, consent records, and the entries that named
            them.
          </p>
          <p className="text-muted">
            This cannot be undone and there is no waiting period: the account
            is gone when you confirm. If they only need to stop signing in,
            choose Deactivate instead — that keeps their history.
          </p>
        </div>
      </div>
      {error && <ErrorNote className="mt-4">{error}</ErrorNote>}
    </Dialog>
  )
}

// --- Resend verification ----------------------------------------------------

export function ResendVerificationDialog({
  school,
  user,
  onClose,
  onDone,
}: {
  school: SchoolIdentity
  user: SchoolUserRow
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<'sent' | 'already' | 'failed' | null>(
    null,
  )

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await resendSchoolUserVerification(school.id, user.id)
      setOutcome(result.alreadyVerified ? 'already' : result.sent ? 'sent' : 'failed')
      onDone()
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
      title="Send the verification email again?"
      footer={
        outcome ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? 'Sending…' : 'Send email'}
            </Button>
          </>
        )
      }
    >
      {outcome === 'sent' ? (
        <p className="text-copy-sm text-body">
          A fresh verification link is on its way to{' '}
          <span className="font-semibold text-heading">{user.email}</span>.
        </p>
      ) : outcome === 'already' ? (
        <p className="text-copy-sm text-body">
          {user.name} has already verified this address, so no new link was
          sent.
        </p>
      ) : outcome === 'failed' ? (
        <p className="text-copy-sm text-body">
          The email could not be sent. Nothing about the account changed — try
          again, or use Reset password to hand them the school default.
        </p>
      ) : (
        <p className="text-copy-sm text-body">
          Sends a new verification link to{' '}
          <span className="font-semibold text-heading">{user.email}</span>.
          Until they open it, {user.name.split(' ')[0]} cannot finish joining{' '}
          {school.name}.
        </p>
      )}
      {error && <ErrorNote className="mt-4">{error}</ErrorNote>}
    </Dialog>
  )
}
