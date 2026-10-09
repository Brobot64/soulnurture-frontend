// Audit activity feed → presentable rows. Audit meta carries ids only (no
// names), so the subject always comes from the actor or the school.

import { roleLabel } from '#/lib/auth'

export interface ActivityActor {
  id: string
  name: string
}

export interface ActivitySchool {
  id: string
  name: string
  shortCode: string
}

export interface ActivityItem {
  id: string
  action: string
  kind: 'schools' | 'people' | 'chat'
  entity: string
  entityId: string | null
  meta: Record<string, unknown> | null
  createdAt: string
  actor: ActivityActor | null
  school: ActivitySchool | null
}

export type FeedTone = 'success' | 'danger' | 'accent' | 'info'

export interface FeedRow {
  id: string
  title: string
  subtitle: string | null
  tag: string
  tone: FeedTone
  timestamp: string
  /** Whoever the row is about — the avatar initials derive from this. */
  subject: string
}

const ACTION_COPY: Record<
  string,
  { title: string; tag: string; tone: FeedTone }
> = {
  'school.created': { title: 'School added', tag: 'School', tone: 'info' },
  'school.renamed': { title: 'School renamed', tag: 'School', tone: 'info' },
  'school.suspended': { title: 'School suspended', tag: 'School', tone: 'danger' },
  'school.reactivated': { title: 'School reactivated', tag: 'School', tone: 'success' },
  'school.settings_updated': { title: 'Settings updated', tag: 'School', tone: 'info' },
  'school.student_enrolled': { title: 'Student enrolled', tag: 'People', tone: 'success' },
  'school.professional_enrolled': { title: 'Staff enrolled', tag: 'People', tone: 'success' },
  'school.admin_enrolled': { title: 'School admin enrolled', tag: 'People', tone: 'success' },
  'school.user_updated': { title: 'User updated', tag: 'People', tone: 'info' },
  'school.user_deactivated': { title: 'User deactivated', tag: 'People', tone: 'danger' },
  'school.user_reactivated': { title: 'User reactivated', tag: 'People', tone: 'success' },
  'school.user_password_reset': { title: 'Password reset', tag: 'People', tone: 'accent' },
  'staff.bootstrap_enrollment': { title: 'Platform admin enrolled', tag: 'People', tone: 'success' },
  'chat.thread_created': { title: 'Chat requested', tag: 'Chat', tone: 'info' },
  'chat.thread_claimed': { title: 'Chat picked up', tag: 'Chat', tone: 'accent' },
  'chat.thread_closed': { title: 'Chat closed', tag: 'Chat', tone: 'info' },
}

function metaDetail(item: ActivityItem): string | null {
  const meta = item.meta ?? {}
  if (item.action === 'school.professional_enrolled') {
    return typeof meta.role === 'string' ? roleLabel(meta.role) : null
  }
  if (item.action === 'school.admin_enrolled') return 'School admin'
  if (item.action === 'school.settings_updated') return 'Default password updated'
  return null
}

export function describeActivity(
  item: ActivityItem,
  options: { scope?: 'platform' | 'school' } = {},
): FeedRow {
  const scope = options.scope ?? 'school'
  const copy = ACTION_COPY[item.action] ?? {
    title: 'Activity',
    tag: 'Other',
    tone: 'info' as FeedTone,
  }

  const subject =
    scope === 'platform'
      ? item.school?.name ?? null
      : item.actor?.name ?? null
  const detail = metaDetail(item)
  const subtitle = [subject, detail].filter(Boolean).join(' · ') || null

  return {
    id: item.id,
    title: copy.title,
    subtitle,
    tag: copy.tag,
    tone: copy.tone,
    timestamp: item.createdAt,
    subject: item.actor?.name ?? item.school?.name ?? copy.title,
  }
}
