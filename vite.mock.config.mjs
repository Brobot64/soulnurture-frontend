// THROWAWAY local-verify harness (delete after the pass — never committed).
// Mock Natlas API + quiet engine.io/socket.io stub, same-origin, so the app is
// driven exactly as it ships. Run with:
//   npx vite --config vite.mock.config.mjs --port 5050 --strictPort
// Pair with `.env.local` holding an empty VITE_API_BASE_URL.
import { createHash } from 'node:crypto'

import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const NOW = Date.now()
const iso = (msAgo) => new Date(NOW - msAgo).toISOString()
const day = (msAgo) => new Date(NOW - msAgo).toISOString().slice(0, 10)
const minutes = (n) => n * 60_000
const hours = (n) => n * 3_600_000
const days = (n) => n * 86_400_000

const MOOD_IDS = ['GREAT', 'NORMAL', 'SAD', 'ANGRY', 'CONFUSED', 'INDIFFERENT', 'STRANGE', 'DISTRAUGHT']
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const METRICS = ['newUsers', 'checkIns', 'chatThreads', 'chatMessages']
const ROLES = new Set(['STUDENT', 'COUNSELLOR', 'PSYCHOLOGIST', 'SUPPORT_STAFF', 'SCHOOL_ADMIN', 'PLATFORM_ADMIN'])

function rng(seed) {
  let s = (seed >>> 0) || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// --- Store ------------------------------------------------------------------

const SCHOOL_SEEDS = [
  { id: 'sch-miva', name: 'Miva University', shortCode: 'MU', domain: 'miva.edu.ng', status: 'ACTIVE', createdAt: iso(days(210)), students: 18, professionals: 5, admins: 2, lastActivityAt: iso(hours(2)), hasDefaultPassword: true, seed: 11, deactivatedStudents: [] },
  { id: 'sch-greenfield', name: 'Greenfield Academy', shortCode: 'GA', domain: 'greenfield.edu.ng', status: 'ACTIVE', createdAt: iso(days(150)), students: 26, professionals: 4, admins: 1, lastActivityAt: iso(hours(5)), hasDefaultPassword: true, seed: 23, deactivatedStudents: [3] },
  { id: 'sch-hillcrest', name: 'Hillcrest College', shortCode: 'HC', domain: 'hillcrest.edu.ng', status: 'ACTIVE', createdAt: iso(days(90)), students: 9, professionals: 2, admins: 1, lastActivityAt: iso(days(1.2)), hasDefaultPassword: true, seed: 37, deactivatedStudents: [], zeroPrevChatWindow: true },
  { id: 'sch-riverside', name: 'Riverside Montessori', shortCode: 'RM', domain: 'riverside.edu.ng', status: 'SUSPENDED', createdAt: iso(days(320)), students: 6, professionals: 2, admins: 1, lastActivityAt: iso(days(12)), hasDefaultPassword: true, seed: 53, deactivatedStudents: [2] },
  { id: 'sch-nordic', name: 'Nordic International School', shortCode: 'NIS', domain: 'nordic.edu.ng', status: 'ACTIVE', createdAt: iso(days(3)), students: 0, professionals: 0, admins: 0, lastActivityAt: null, hasDefaultPassword: false, seed: 71, deactivatedStudents: [], empty: true },
]

const FIRST_NAMES = ['Amina', 'Chidi', 'Ngozi', 'Tunde', 'Zainab', 'Emeka', 'Fatima', 'Obinna', 'Halima', 'Segun', 'Adaeze', 'Yusuf', 'Chioma', 'Ibrahim', 'Blessing', 'Kelechi', 'Aisha', 'Femi', 'Nneka', 'Sani', 'Rukayat', 'Uche', 'Titilayo', 'Musa', 'Ifeoma', 'Damilola', 'Hafsat', 'Kola', 'Ebele', 'Bashir']
const LAST_NAMES = ['Bello', 'Okafor', 'Adeyemi', 'Ibrahim', 'Nwosu', 'Oyeleran', 'Abubakar', 'Eze', 'Lawal', 'Obi', 'Sani', 'Adebayo', 'Umeh', 'Musa', 'Ojo', 'Danjuma', 'Nnamdi', 'Afolabi', 'Suleiman', 'Balogun']
const CLASSES = ['JSS 1A', 'JSS 2B', 'JSS 3A', 'SSS 1A', 'SSS 2C', 'SSS 3B']
const LANGUAGES = ['English', 'Hausa', 'Igbo', 'Yoruba', 'Pidgin']
const PRO_ROLES = ['COUNSELLOR', 'PSYCHOLOGIST', 'SUPPORT_STAFF']
const PRO_TITLES = ['Counsellor', 'Psychologist', 'Support staff']
const PRO_DEPARTMENTS = ['Wellbeing', 'Guidance & Counselling', 'Student Affairs']

const users = []
let uidx = 0

function pushUser(partial) {
  const i = uidx++
  const name = partial.name ?? `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length]}`
  const school = partial.school ?? null
  const user = {
    id: `u-${i}`,
    name,
    email: partial.email ?? `${name.toLowerCase().replace(/[^a-z]+/g, '.')}.${i}@${school ? school.domain : 'soulnurture.ai'}`,
    role: partial.role,
    schoolId: school ? school.id : null,
    emailVerified: partial.emailVerified ?? i % 7 !== 0,
    mustChangePassword: partial.mustChangePassword ?? null,
    deactivatedAt: partial.deactivatedAt ?? null,
    createdAt: partial.createdAt ?? iso(days(i * 0.9)),
    studentProfile: null,
    professionalProfile: null,
  }
  users.push(user)
  return user
}

const SESSION_USER = pushUser({ name: 'Ibrahim Sulayman', email: 'ibrahim.sulayman@soulnurture.ai', role: 'PLATFORM_ADMIN', emailVerified: true, mustChangePassword: false })
pushUser({ name: 'Kiki Amuta', email: 'kiki.amuta@soulnurture.ai', role: 'PLATFORM_ADMIN', emailVerified: true, mustChangePassword: false })
pushUser({ name: 'Brobot Ops', email: 'platform.owner@dashboards.natlas.test', role: 'PLATFORM_ADMIN', emailVerified: true, mustChangePassword: false })

for (const school of SCHOOL_SEEDS) {
  for (let k = 1; k <= school.students; k++) {
    const u = pushUser({ school, role: 'STUDENT', mustChangePassword: k % 5 === 0, deactivatedAt: school.deactivatedStudents.includes(k) ? iso(days(20)) : null })
    u.studentProfile = {
      studentCode: `${school.shortCode}-${String(k).padStart(4, '0')}`,
      firstName: u.name.split(' ')[0],
      lastName: u.name.split(' ').slice(1).join(' ') || null,
      classLabel: CLASSES[k % CLASSES.length],
      preferredLanguage: LANGUAGES[k % LANGUAGES.length],
    }
  }
  for (let k = 0; k < school.professionals; k++) {
    const u = pushUser({ school, role: PRO_ROLES[k % PRO_ROLES.length], mustChangePassword: false })
    u.professionalProfile = { title: PRO_TITLES[k % 3], department: PRO_DEPARTMENTS[k % 3], available: true }
  }
  for (let k = 0; k < school.admins; k++) {
    const isNewestAdmin = k === school.admins - 1
    pushUser({ school, role: 'SCHOOL_ADMIN', mustChangePassword: isNewestAdmin, emailVerified: !isNewestAdmin })
  }
}

const schools = SCHOOL_SEEDS.map((school) => ({ ...school, threads: [] }))

// The owner's "infinity scroll" complaint on the admin register can only be
// re-checked in the browser if the register is longer than one page. These fill
// the list past the default take of 25 so "Load earlier schools" actually renders.
for (let i = 0; i < 30; i++) {
  schools.push({
    id: `sch-fill-${i}`,
    name: `Ridgeway Secondary ${String.fromCharCode(65 + (i % 26))}${i}`,
    shortCode: `R${String.fromCharCode(65 + (i % 26))}${i}`,
    domain: `ridge${i}.edu.ng`,
    status: i % 7 === 0 ? 'SUSPENDED' : 'ACTIVE',
    createdAt: iso(days(45 + i * 4)),
    students: 0,
    professionals: 0,
    admins: 0,
    lastActivityAt: null,
    hasDefaultPassword: false,
    seed: 200 + i,
    deactivatedStudents: [],
    threads: [],
    empty: true,
  })
}

// F5 onboarding: a provisioned student still holding the school's starter
// password — lands on /first-password until they choose their own.
const FRESH_STUDENT = pushUser({ school: SCHOOL_SEEDS[0], role: 'STUDENT', mustChangePassword: true, emailVerified: true, name: 'Chidi Onwura', email: 'chidi.onwura@miva.edu.ng' })
FRESH_STUDENT.studentProfile = { studentCode: 'MU-0101', firstName: 'Chidi', lastName: 'Onwura', classLabel: 'JSS 2B', preferredLanguage: 'English' }

const schoolUrl = (school) => ({ id: school.id, name: school.name, shortCode: school.shortCode })
const studentsOf = (school) => users.filter((u) => u.schoolId === school.id && u.role === 'STUDENT')
const staffOf = (school) => users.filter((u) => u.schoolId === school.id && u.professionalProfile)
const adminOf = (school) => users.find((u) => u.schoolId === school.id && u.role === 'SCHOOL_ADMIN') ?? null
const actorOf = (user) => (user ? { id: user.id, name: user.name } : null)

// --- Chat threads -----------------------------------------------------------

let tidx = 0
let midx = 0

function pushMessage(thread, { userId, role, content, msAgo, viaVoice = false, meta = null }) {
  const at = iso(msAgo)
  const message = {
    id: `msg-${midx++}`,
    threadId: thread.id,
    senderUserId: userId,
    role,
    content,
    viaVoice,
    meta,
    createdAt: at,
  }
  thread.messages.push(message)
  if (!thread.lastMessageAt || at > thread.lastMessageAt) {
    thread.lastMessageAt = at
    thread.updatedAt = at
  }
  thread.messageCount = thread.messages.length
  return message
}

function addThread(school, status, msAgo) {
  const students = studentsOf(school)
  const staff = staffOf(school)
  const student = students[tidx % students.length]
  const professional = status === 'PENDING' ? null : staff[tidx % staff.length] ?? null
  const profile = student.studentProfile
  const thread = {
    id: `thr-${tidx++}`,
    schoolId: school.id,
    status,
    studentId: student.id,
    professionalId: professional?.id ?? null,
    createdAt: iso(msAgo),
    updatedAt: iso(msAgo),
    claimedAt: status === 'PENDING' ? null : iso(Math.max(minutes(1), msAgo - minutes(30))),
    closedAt: status === 'CLOSED' ? iso(Math.max(minutes(1), msAgo - minutes(120))) : null,
    studentReadAt: null,
    professionalReadAt: status === 'PENDING' ? null : iso(Math.max(minutes(1), msAgo - minutes(30))),
    entryCheckInId: null,
    aiEntrySummary: `${profile?.firstName ?? student.name}${profile?.classLabel ? ` (${profile.classLabel})` : ''} asked to talk with someone.`,
    lastMessageAt: null,
    messageCount: 0,
    student: { id: student.id, name: student.name },
    professional: professional ? { id: professional.id, name: professional.name } : null,
    messages: [],
  }
  school.threads.push(thread)
  // Every thread opens with the SYSTEM entry note (deterministic fallback copy).
  pushMessage(thread, { userId: null, role: 'SYSTEM', content: thread.aiEntrySummary, msAgo, meta: { composedByAi: false } })
  return thread
}

// The miva order is deliberate: thr-0 lands on the STUDENT/COUNSELLOR mock
// personas (u-3/u-21) as an ACTIVE chat, thr-1 is a closed one with history,
// thr-2/3/4 are the PENDING pool (oldest first), thr-5 is the counsellor's
// second conversation.
const SCHEDULE = {
  'sch-miva': [['ACTIVE', hours(2)], ['CLOSED', days(3)], ['PENDING', hours(1)], ['PENDING', hours(5)], ['PENDING', hours(9)], ['ACTIVE', hours(26)]],
  'sch-greenfield': [['PENDING', hours(1)], ['PENDING', hours(3)], ['PENDING', hours(6)], ['PENDING', hours(8)], ['PENDING', hours(11)], ['PENDING', hours(15)], ['PENDING', hours(18)], ['ACTIVE', days(1)], ['ACTIVE', days(2)], ['CLOSED', days(4)]],
  'sch-hillcrest': [['PENDING', hours(4)], ['ACTIVE', days(2)]],
  'sch-riverside': [['CLOSED', days(12)]],
  'sch-nordic': [],
}
for (const school of schools) {
  for (const [status, msAgo] of SCHEDULE[school.id] ?? []) addThread(school, status, msAgo)
}

// Hand-seeded persona conversations — offsets keep claim → messages →
// read-marker ordering consistent with how the backend writes them.
{
  const miva = schools.find((school) => school.id === 'sch-miva')
  const [thr0, thr1, , , , thr5] = miva.threads

  pushMessage(thr0, { userId: thr0.studentId, role: 'STUDENT', content: "I've been feeling really anxious about exams lately. It's hard to sleep at night.", msAgo: minutes(80) })
  pushMessage(thr0, { userId: thr0.professionalId, role: 'PROFESSIONAL', content: "Thanks for reaching out — that sounds really tough, and you're not alone. Want to tell me more about what's been going on?", msAgo: minutes(60) })
  pushMessage(thr0, { userId: thr0.studentId, role: 'STUDENT', content: "Mostly when I'm lying in bed. I keep thinking I'll fail everything.", msAgo: minutes(25) })
  thr0.professionalReadAt = iso(minutes(55))

  pushMessage(thr1, { userId: thr1.studentId, role: 'STUDENT', content: 'I had a really hard week. Can we talk?', msAgo: minutes(4280) })
  pushMessage(thr1, { userId: thr1.professionalId, role: 'PROFESSIONAL', content: "Of course — I'm glad you reached out. Let's find a time tomorrow.", msAgo: minutes(4250) })
  pushMessage(thr1, { userId: thr1.studentId, role: 'STUDENT', content: 'Thank you. That helps a lot.', msAgo: minutes(4220) })
  thr1.studentReadAt = iso(minutes(4210))
  thr1.updatedAt = thr1.closedAt

  pushMessage(thr5, { userId: thr5.studentId, role: 'STUDENT', content: 'Things have been rough at home this week. Can I talk to someone?', msAgo: minutes(1500) })
  thr5.professionalReadAt = iso(minutes(1530))
}

// --- Analytics --------------------------------------------------------------

function seriesFor(school, d) {
  if (school.empty) {
    return Array.from({ length: d }, (_, i) => ({ date: day((d - 1 - i) * 86_400_000), newUsers: 0, checkIns: 0, chatThreads: 0, chatMessages: 0 }))
  }
  const r = rng(school.seed)
  const points = Array.from({ length: d }, (_, i) => ({
    date: day((d - 1 - i) * 86_400_000),
    newUsers: Math.floor(r() * 5),
    checkIns: 3 + Math.floor(r() * 12),
    chatThreads: Math.floor(r() * 3),
    chatMessages: 2 + Math.floor(r() * 10),
  }))
  if (school.zeroPrevChatWindow) {
    for (let i = Math.max(0, d - 14); i < d - 7; i++) points[i].chatMessages = 0
  }
  return points
}

function sumSeries(listOfSeries, d) {
  return Array.from({ length: d }, (_, i) => ({
    date: day((d - 1 - i) * 86_400_000),
    newUsers: 0,
    checkIns: 0,
    chatThreads: 0,
    chatMessages: 0,
    ...METRICS.reduce((acc, key) => ({ ...acc, [key]: listOfSeries.reduce((sum, points) => sum + points[i][key], 0) }), {}),
  }))
}

function deltasFor(points) {
  const sum = (arr, key) => arr.reduce((total, point) => total + point[key], 0)
  const current = points.slice(-7)
  const previous = points.slice(-14, -7)
  return Object.fromEntries(
    METRICS.map((key) => {
      const cur = sum(current, key)
      const prev = sum(previous, key)
      return [key, { current: cur, previous: prev, pct: prev === 0 ? null : Math.round(((cur - prev) / prev) * 100) }]
    }),
  )
}

function moodFor(school, points) {
  const total = points.reduce((sum, point) => sum + point.checkIns, 0)
  const dist = Object.fromEntries(MOOD_IDS.map((mood) => [mood, 0]))
  if (total === 0) return dist
  const r = rng(school.seed ^ 0x9e3779b9)
  const weights = MOOD_IDS.map(() => 0.2 + r())
  const weightSum = weights.reduce((a, b) => a + b, 0)
  let used = 0
  MOOD_IDS.forEach((mood, index) => {
    const value = index === MOOD_IDS.length - 1 ? total - used : Math.floor((weights[index] / weightSum) * total)
    dist[mood] = value
    used += value
  })
  return dist
}

function weekdayFor(school) {
  if (school.empty) return WEEKDAYS.map((weekday) => ({ weekday, count: 0 }))
  const r = rng(school.seed ^ 0x51ed270b)
  const rows = WEEKDAYS.map((weekday) => ({ weekday, count: 3 + Math.floor(r() * 8) }))
  const max = Math.max(...rows.map((row) => row.count))
  rows[1].count = max + 6
  return rows
}

function rosterFor(school) {
  return {
    students: users.filter((u) => u.schoolId === school.id && u.role === 'STUDENT').length,
    professionals: users.filter((u) => u.schoolId === school.id && u.professionalProfile).length,
    admins: users.filter((u) => u.schoolId === school.id && u.role === 'SCHOOL_ADMIN').length,
    deactivated: users.filter((u) => u.schoolId === school.id && u.deactivatedAt).length,
  }
}

function onboardingFor(school) {
  const roster = users.filter((u) => u.schoolId === school.id)
  const incomplete = roster.filter((u) => !u.deactivatedAt && (u.mustChangePassword || !u.emailVerified)).length
  const percentComplete = roster.length === 0 ? 100 : Math.round((1 - incomplete / roster.length) * 1000) / 10
  return { incomplete, percentComplete }
}

function analyticsFor(school, d) {
  const points = seriesFor(school, d)
  return { windowDays: d, series: points, deltas: deltasFor(points), mood: { total: points.reduce((s, p) => s + p.checkIns, 0), distribution: moodFor(school, points) }, weekday: weekdayFor(school) }
}

function platformAnalytics(d) {
  const perSchool = schools.map((school) => seriesFor(school, d))
  const points = sumSeries(perSchool, d)
  const dist = Object.fromEntries(MOOD_IDS.map((mood) => [mood, schools.reduce((sum, s, i) => sum + moodFor(s, perSchool[i])[mood], 0)]))
  const weekday = WEEKDAYS.map((weekday, index) => ({ weekday, count: schools.reduce((sum, s) => sum + weekdayFor(s)[index].count, 0) }))
  return { windowDays: d, series: points, deltas: deltasFor(points), mood: { total: points.reduce((s, p) => s + p.checkIns, 0), distribution: dist }, weekday }
}

// --- Activity ---------------------------------------------------------------

const s = Object.fromEntries(schools.map((school) => [school.shortCode, school]))
const A_IBRAHIM = actorOf(SESSION_USER)
const ACTIONS = [
  ['school.created', 'schools', 'school', s.NIS, hours(6), A_IBRAHIM, null],
  ['chat.thread_created', 'chat', 'chat_thread', s.MU, hours(2), actorOf(studentsOf(s.MU)[0]), { threadId: 'thr-0' }],
  ['school.admin_enrolled', 'people', 'user', s.GA, hours(3), A_IBRAHIM, { role: 'SCHOOL_ADMIN' }],
  ['school.student_enrolled', 'people', 'user', s.MU, hours(6), actorOf(adminOf(s.MU)), { studentCode: 'MU-0001' }],
  ['chat.thread_created', 'chat', 'chat_thread', s.GA, hours(8), actorOf(studentsOf(s.GA)[0]), { threadId: 'thr-6' }],
  ['chat.thread_claimed', 'chat', 'chat_thread', s.GA, hours(9), actorOf(staffOf(s.GA)[0]), { threadId: 'thr-7' }],
  ['school.professional_enrolled', 'people', 'user', s.MU, hours(26), A_IBRAHIM, { role: 'COUNSELLOR' }],
  ['school.renamed', 'schools', 'school', s.MU, days(2), A_IBRAHIM, { from: 'Miva Polytechnic', to: 'Miva University' }],
  ['school.user_password_reset', 'people', 'user', s.HC, days(2.2), actorOf(adminOf(s.HC)), { userId: 'u-55' }],
  ['chat.thread_created', 'chat', 'chat_thread', s.MU, days(2.5), actorOf(studentsOf(s.MU)[1]), { threadId: 'thr-1' }],
  ['school.suspended', 'schools', 'school', s.RM, days(3), A_IBRAHIM, null],
  ['school.user_deactivated', 'people', 'user', s.RM, days(3.1), actorOf(adminOf(s.RM)), { userId: 'u-62' }],
  ['chat.thread_closed', 'chat', 'chat_thread', s.MU, days(3.4), actorOf(staffOf(s.MU)[0]), { threadId: 'thr-4' }],
  ['school.admin_enrolled', 'people', 'user', s.MU, days(4), A_IBRAHIM, { role: 'SCHOOL_ADMIN' }],
  ['school.student_enrolled', 'people', 'user', s.GA, days(5), actorOf(adminOf(s.GA)), { studentCode: 'GA-0012' }],
  ['chat.thread_created', 'chat', 'chat_thread', s.HC, days(6), actorOf(studentsOf(s.HC)[0]), { threadId: 'thr-10' }],
  ['school.admin_enrolled', 'people', 'user', s.HC, days(30), A_IBRAHIM, { role: 'SCHOOL_ADMIN' }],
  ['school.created', 'schools', 'school', s.HC, days(90), A_IBRAHIM, null],
  ['school.created', 'schools', 'school', s.GA, days(150), A_IBRAHIM, null],
  ['school.created', 'schools', 'school', s.MU, days(210), A_IBRAHIM, null],
  ['staff.bootstrap_enrollment', 'people', 'user', null, days(300), A_IBRAHIM, { email: 'kiki.amuta@soulnurture.ai' }],
  ['chat.thread_created', 'chat', 'chat_thread', s.GA, days(1), actorOf(studentsOf(s.GA)[1]), { threadId: 'thr-8' }],
  ['school.professional_enrolled', 'people', 'user', s.GA, days(7), actorOf(adminOf(s.GA)), { role: 'PSYCHOLOGIST' }],
  ['chat.thread_claimed', 'chat', 'chat_thread', s.MU, hours(25), actorOf(staffOf(s.MU)[1]), { threadId: 'thr-3' }],
]
const ACTIVITY = ACTIONS.map(([action, kind, entity, school, msAgo, actor, meta], index) => ({
  id: `act-${index}`,
  action,
  kind,
  entity,
  entityId: null,
  meta,
  createdAt: iso(msAgo),
  actor,
  school: school ? schoolUrl(school) : null,
})).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

// --- Notifications ----------------------------------------------------------

const notifications = [
  { id: 'ntf-1', type: 'CHAT_REQUEST', title: 'Emeka asked to talk', body: 'Emeka (SSS 1A) asked to talk with someone.', data: { threadId: 'thr-2' }, readAt: null, createdAt: iso(hours(1)) },
  { id: 'ntf-2', type: 'SCHOOL_ADMIN_ENROLLED', title: 'School admin enrolled', body: 'A new school admin can now sign in to Greenfield Academy.', readAt: null, createdAt: iso(hours(3)) },
  { id: 'ntf-3', type: 'USER_PASSWORD_RESET', title: 'Password reset', body: 'A student at Hillcrest College was reset to the school default password.', readAt: null, createdAt: iso(days(2)) },
  { id: 'ntf-4', type: 'ACCOUNT_VERIFIED', title: 'Email verified', body: 'A student verified their email address.', readAt: iso(days(3)), createdAt: iso(days(3)) },
]

// --- History + deletion asks (Epic H) ---------------------------------------

const HISTORY_ENTRIES = [
  {
    checkInId: 'ci-1',
    createdAt: iso(hours(5)),
    feeling: 'STRESSED',
    intensity: 4,
    triggers: ['EXAMS'],
    reflection: { conversationId: 'conv-1', status: 'CLOSED', startedAt: iso(hours(4)), turnCount: 4, viaVoice: false, summary: 'Worked on a study-plan and a breathing exercise.' },
    supportRequest: null,
  },
  {
    checkInId: 'ci-2',
    createdAt: iso(days(3)),
    feeling: 'SAD_LOW',
    intensity: 3,
    triggers: ['FRIENDSHIP'],
    reflection: { conversationId: 'conv-2', status: 'CLOSED', startedAt: iso(days(3)), turnCount: 6, viaVoice: true, summary: null },
    supportRequest: { id: 'sr-1', createdAt: iso(days(3)), status: 'OPEN', queueStatus: 'REVIEWED', followUpState: 'REQUIRED', urgency: 'NORMAL' },
  },
  { checkInId: 'ci-3', createdAt: iso(days(9)), feeling: 'CALM', intensity: 2, triggers: [], reflection: null, supportRequest: null },
]

// A timeline long enough that "Load earlier" is the only way to reach the end,
// so the page is verified as never fetching it whole. The three hand-written
// rows above stay at the top: `ci-3` is the one a live deletion ask names.
for (let i = 0; i < 60; i++) {
  HISTORY_ENTRIES.push({
    checkInId: `ci-old-${i}`,
    createdAt: iso(days(12 + i * 3)),
    feeling: ['CALM', 'SAD_LOW', 'STRESSED', 'ANGRY'][i % 4],
    intensity: 1 + (i % 5),
    triggers: i % 3 === 0 ? ['EXAMS'] : [],
    reflection:
      i % 7 === 0
        ? { conversationId: `conv-old-${i}`, status: 'CLOSED', startedAt: iso(days(12 + i * 3)), turnCount: 3, viaVoice: i % 2 === 0, summary: null }
        : null,
    supportRequest: null,
  })
}

/**
 * Requests are read by student, not by the check-in they may or may not hang
 * off — most filed requests have no `checkInId` at all, because an escalation
 * from a conversation never links back to a check-in. `sr-unlinked-1` proves
 * the tab lists them anyway, and the window being shorter than the total
 * proves the page says so instead of implying it showed everything.
 */
const HISTORY_SUPPORT_REQUESTS = [
  { id: 'sr-1', createdAt: iso(days(3)), status: 'IN_REVIEW', timing: 'TODAY_STUDY_PERIOD', checkInId: 'ci-2', followUps: [{ status: 'SCHEDULED' }] },
  { id: 'sr-2', createdAt: iso(days(1)), status: 'PENDING', timing: 'URGENT_UNSAFE', checkInId: null, followUps: [] },
  { id: 'sr-3', createdAt: iso(days(21)), status: 'CLOSED', timing: 'GENTLE_1_2_DAYS', checkInId: null, followUps: [{ status: 'COMPLETED' }] },
]
const HISTORY_REQUESTS_TOTAL = 9

// Three of the four states the student can actually be in, so the page is
// exercised rather than admired: a live countdown, one that already ran, and
// one a cancel stopped. The held state is asserted by the backend specs.
// `ask-boom` stays scheduled forever on purpose: its cancel answers 409, so the
// page's "the server knows better than this row" branch is reachable at all.
const DELETION_ASKS = [
  {
    id: 'ask-boom', scope: 'BEFORE_DATE', beforeDate: day(days(365)), checkInIds: [], note: null,
    alertedAt: iso(hours(30)), scheduledPurgeAt: new Date(NOW + hours(18)).toISOString(), cancelledAt: null, purgedAt: null,
    holdReason: null, removedCheckIns: 0, removedConversations: 0, createdAt: iso(hours(30)),
  },
  {
    id: 'ask-live', scope: 'SELECTED_CHECK_INS', beforeDate: null, checkInIds: ['ci-3'], note: 'This one was a bad day.',
    alertedAt: iso(hours(2)), scheduledPurgeAt: new Date(NOW + hours(23)).toISOString(), cancelledAt: null, purgedAt: null,
    holdReason: null, removedCheckIns: 0, removedConversations: 0, createdAt: iso(hours(2)),
  },
  {
    id: 'ask-gone', scope: 'BEFORE_DATE', beforeDate: day(days(30)), checkInIds: [], note: null,
    alertedAt: iso(days(6)), scheduledPurgeAt: iso(days(5)), cancelledAt: null, purgedAt: iso(days(5)),
    holdReason: null, removedCheckIns: 2, removedConversations: 1, createdAt: iso(days(6)),
  },
  {
    id: 'ask-stopped', scope: 'ALL_HISTORY', beforeDate: null, checkInIds: [], note: null,
    alertedAt: iso(days(12)), scheduledPurgeAt: iso(days(11)), cancelledAt: iso(days(11)), purgedAt: null,
    holdReason: null, removedCheckIns: 0, removedConversations: 0, createdAt: iso(days(12)),
  },
]

// --- Indicators + AI reports (the rail's needs-attention badges) ------------

/**
 * Miva's flag register, shaped like what prod now holds: `indicator-levels.ts`
 * grades a flag from the intent that raised it, and no IND-* rule is switched on,
 * so every graded row carries a level with `ruleId` null beside it. The last row
 * is the one the mapping does not recognise, which is what keeps the
 * "Unclassified" chip real. `openCount` is OPEN + IN_REVIEW, which is the
 * predicate the indicators page prints and the predicate /dashboard/attention
 * must copy.
 */
const INDICATOR_FLAGS = (() => {
  const miva = schools.find((school) => school.id === 'sch-miva')
  const pool = studentsOf(miva)
  // intentId, level, severity, status, triggerLabel, hoursAgo — the pairs the
  // mapping actually produces. `ACUTE_PANIC` sits at B under a TIER_3 alert on
  // purpose so the screen can be checked for the one thing it must never imply:
  // that the level chip and the alert tier are the same field.
  const SEED = [
    ['SUICIDAL_IDEATION', 'C', 'TIER_3_ACUTE', 'OPEN', 'Possible suicidal intent', 6],
    ['SELF_HARM', 'C', 'TIER_3_ACUTE', 'IN_REVIEW', 'Thoughts of hurting myself', 18],
    ['ABUSE_DISCLOSURE', 'C', 'TIER_3_ACUTE', 'OPEN', 'Something happening at home', 52],
    ['THREAT_OR_COERCION', 'C', 'TIER_3_ACUTE', 'ACKNOWLEDGED', 'Someone threatened them', 70],
    ['PROLONGED_LOW_MOOD', 'B', 'TIER_2_HIGH', 'OPEN', 'Feeling low most days', 30],
    ['ACUTE_PANIC', 'B', 'TIER_3_ACUTE', 'IN_REVIEW', 'Could not breathe before an exam', 96],
    [null, 'U', 'TIER_2_HIGH', 'OPEN', 'It might be nothing. It might be everything.', 8],
    ['EXAM_PRESSURE', null, 'TIER_1_MODERATE', 'RESOLVED', 'Bad day, feeling better', 120],
  ]
  return SEED.map(([intentId, level, severity, status, triggerLabel, hoursAgo], index) => {
    const student = pool[index % pool.length]
    const profile = student.studentProfile ?? {}
    return {
      id: `flag-${index}`,
      studentId: student.id,
      studentRef: profile.studentCode ?? student.email,
      classLabel: profile.classLabel ?? null,
      conversationId: index < 2 ? `conv-${index}` : null,
      assigneeId: null,
      triggerLabel,
      category: intentId ?? 'MODEL_CANDIDATE',
      intentId,
      severity,
      level,
      // Never the intent id: that would make a keyword-floor flag read as if a
      // graded rule produced it, which is the misrepresentation Doc A §17 warns
      // against and what `levelSource` below now says out loud instead.
      ruleId: null,
      ruleVersion: null,
      reviewDecision: status === 'ACKNOWLEDGED' ? 'NO_FURTHER_ACTION' : null,
      studentStatementSnapshot: 'I wanted to write it down the way it actually felt.',
      status,
      source: intentId ? 'SERVER_POLICY' : 'AI_CANDIDATE',
      aiContextSummary: index < 3 ? 'The student described the situation over several turns.' : null,
      autoActions: [],
      createdAt: iso(hours(hoursAgo)),
      updatedAt: iso(hours(hoursAgo)),
      resolvedAt: status === 'RESOLVED' ? iso(hours(hoursAgo - 2)) : null,
      linkedRequest: index === 0 ? { id: 'sreq-0', status: 'PENDING' } : null,
    }
  })
})()

/** Pending review = `reviewOutcome` still null, the same predicate the badge uses. */
const AI_REPORTS = [
  { outcome: null, reason: 'DID_NOT_UNDERSTAND', hoursAgo: 4 },
  { outcome: null, reason: 'DIAGNOSIS_OR_MEDICAL_ADVICE', hoursAgo: 26 },
  { outcome: null, reason: null, hoursAgo: 50 },
  { outcome: 'NO_CHANGE_NEEDED', reason: 'UNSAFE_OR_UNKIND', hoursAgo: 74 },
  { outcome: 'FOLLOWED_UP_WITH_STUDENT', reason: 'OTHER', hoursAgo: 120 },
].map(({ outcome, reason, hoursAgo }, index) => ({
  id: `rep-${index}`,
  messageId: `msg-rep-${index}`,
  conversationId: `conv-${index}`,
  responseContent: 'Here is something you could try tonight before bed.',
  responseLanguage: 'en',
  reason,
  note: reason === 'OTHER' ? 'It was not what I needed.' : null,
  reviewOutcome: outcome,
  reviewedAt: outcome ? iso(hours(hoursAgo - 2)) : null,
  reviewedBy: outcome ? { name: 'Kiki Amuta', role: 'COUNSELLOR' } : null,
  createdAt: iso(hours(hoursAgo)),
}))

const OPEN_FLAG_STATUSES = ['OPEN', 'IN_REVIEW']
const attentionCountsFor = (viewer) => {
  const isReviewer = ['COUNSELLOR', 'PSYCHOLOGIST'].includes(viewer.role)
  const isAdmin = viewer.role === 'SCHOOL_ADMIN' || viewer.role === 'PLATFORM_ADMIN'
  if (!isReviewer && !isAdmin) return { indicators: null, reports: null, roster: null }
  const roster =
    viewer.role === 'PLATFORM_ADMIN'
      ? users
      : users.filter((u) => u.schoolId === viewer.schoolId)
  return {
    indicators: isReviewer ? INDICATOR_FLAGS.filter((f) => OPEN_FLAG_STATUSES.includes(f.status)).length : null,
    reports: isReviewer ? AI_REPORTS.filter((r) => !r.reviewOutcome).length : null,
    roster: isAdmin
      ? roster.filter((u) => !u.deactivatedAt && (u.mustChangePassword || !u.emailVerified)).length
      : null,
  }
}

// --- Wellbeing resources (Doc B §3/§4, as the seed publishes them) ----------

/**
 * Mirrors `prisma/seed.ts`: twelve approved rows carrying the title, the
 * "Use when" sentence as the description, the estimated time and the guided
 * content in WN_GUIDED below.
 */
const WN_LIBRARY = [
  ['WN-01', 'Name What You’re Feeling', 'When feelings feel confusing, mixed or hard to explain', '2–4 minutes', 'FEELINGS'],
  ['WN-02', 'Grounding: Notice the Present', 'When overwhelmed, distracted or caught in a stressful moment', '1–3 minutes', 'STEADIER'],
  ['WN-03', 'Gentle Breathing Pause', 'When the body feels tense or hurried', '1–2 minutes', 'STEADIER'],
  ['WN-04', 'Break a Problem into Smaller Steps', 'When schoolwork, responsibilities or decisions feel too big', '3–5 minutes', 'ONE_STEP'],
  ['WN-05', 'Respond to Yourself with Kindness', 'After a mistake, disappointment or harsh self-criticism', '2–4 minutes', 'KINDNESS'],
  ['WN-06', 'When Anger Is Rising', 'When irritation or anger is getting stronger', '2–5 minutes', 'DIFFICULT_MOMENT'],
  ['WN-07', 'A Small Step Through Sadness', 'When feeling low, disappointed, lonely or unmotivated', '3–10 minutes', 'HEAVY'],
  ['WN-08', 'Grief and Missing Someone', 'After a death, separation or another significant loss', 'Flexible', 'HEAVY'],
  ['WN-09', 'Handling Peer Conflict or Bullying', 'When experiencing exclusion, insults, harassment or conflict', '3–5 minutes', 'DIFFICULT_MOMENT'],
  ['WN-10', 'Ask for Support: A Message Starter', 'When it is hard to tell someone you need help', '2 minutes', 'ASK_FOR_SUPPORT'],
  ['WN-11', 'A Simple Sleep Wind-Down', 'When preparing for rest and thoughts are busy', '5–10 minutes', 'REST'],
  ['WN-12', 'Choose a Coping Plan for the Next Hour', 'When unsure what kind of help is needed', '2–3 minutes', 'ONE_STEP'],
]
/**
 * Mirrors the guided content that `prisma/seed.ts` now writes from Doc B §3:
 * the numbered steps and the reflection question, copied verbatim. `safetyNote`
 * stays null because the seed leaves it null — §3 writes those notes in the
 * responding adult's voice ("do not encourage a student to confront…"), and the
 * detail screen renders that column to the student. `mediaUrl` is null too.
 */
const WN_GUIDED = {
  'WN-01': {
    steps: [
      'Pause for a moment. You do not have to explain everything perfectly.',
      'Choose one or more words that come close to what you feel: sad, worried, angry, lonely, embarrassed, relieved, excited, numb, confused, or “something else.”',
      'Notice how strong the feeling seems right now: a little, medium, or a lot. There is no right answer.',
      'If it helps, finish this sentence: “I think I may be feeling ___ because ___.” You can leave the reason blank.',
    ],
    reflection:
      'What would help you most right now: to be heard, to understand the feeling, to calm your body, to solve a problem, or to reach someone?',
  },
  'WN-02': {
    steps: [
      'If it feels comfortable, place both feet on the floor or notice where your body is supported.',
      'Name five things you can see, four things you can feel, three things you can hear, two things you can smell, and one thing you can taste. You can adapt or skip any step.',
      'Look around and name where you are and one thing that tells you about the present moment.',
      'Ask yourself: “What is one small, safe next step I can take?”',
    ],
    reflection: 'Did anything change in your attention or comfort level? It is okay if it did not.',
  },
  'WN-03': {
    steps: [
      'Sit or stand in a comfortable position. Let your shoulders rest if you can.',
      'Breathe naturally. If comfortable, breathe in gently and let the breath out slowly, without forcing or holding it.',
      'Repeat for a few breaths while noticing the chair, floor or other support beneath you.',
      'Stop whenever you want and return to normal breathing.',
    ],
    reflection:
      'Would a quiet pause, a drink of water, a short walk, or talking to someone be more helpful now?',
  },
  'WN-04': {
    steps: [
      'Write or think of the problem in one sentence.',
      'Separate what you can influence from what you cannot control right now.',
      'Choose one action that takes about five to ten minutes, such as opening the assignment, listing questions, or asking a teacher for clarification.',
      'Decide when you will try that action. If you need help, identify one person to ask.',
    ],
    reflection: 'What is the smallest useful next step—not the whole solution?',
  },
  'WN-05': {
    steps: [
      'Notice the words you are using toward yourself, without judging yourself for having them.',
      'Ask: “Would I say this exact thing to a friend who was struggling?”',
      'Try a more balanced sentence: “This is difficult, and I can learn one thing from it,” or “One mistake does not describe my whole self.”',
      'Choose one supportive action: rest, practise, apologise if needed, ask for help, or try again later.',
    ],
    reflection: 'What would be both kind and honest to tell yourself about this situation?',
  },
  'WN-06': {
    steps: [
      'If safe, pause the conversation or move to a calmer place.',
      'Notice early body signals such as a tight jaw, hot face, fast heartbeat or clenched hands.',
      'Give yourself time before sending a message or making a decision. Try walking, drinking water, or slowly counting while you settle.',
      'When ready, describe the issue using “I” language: “I felt ___ when ___ happened. I need ___.”',
      'If anyone may be hurt, create distance and contact a trusted adult or appropriate support person.',
    ],
    reflection: 'What boundary, need or concern might the anger be pointing to?',
  },
  'WN-07': {
    steps: [
      'You do not need to force yourself to feel happy. Name what today feels like.',
      'Choose one manageable action: wash your face, eat or drink something if needed, step outside safely, listen to calming music, or complete one small task.',
      'Consider one connection: message a trusted person, sit near someone safe, or ask for company.',
      'Notice whether you need rest, practical help, a conversation, or professional support.',
    ],
    reflection: 'What is one gentle thing you can do for yourself in the next ten minutes?',
  },
  'WN-08': {
    steps: [
      'There is no single correct way to grieve. You may feel sad, angry, numb, confused, relieved, or different feelings at different times.',
      'If you want, choose a way to remember the person or what was lost: write a memory, draw, say a prayer if that fits your beliefs, look at a meaningful object, or talk with someone safe.',
      'Let yourself take breaks. You do not have to share details before you are ready.',
      'Think of one person who could listen without pressuring you to “move on.”',
    ],
    reflection:
      'Would you like to share a memory, talk about what feels hardest, or find someone supportive to speak with?',
  },
  'WN-09': {
    steps: [
      'First ask: “Am I safe right now?” If not, move toward a safer place and seek adult help.',
      'If it is safe, write down what happened, when it happened and who was present. Keep records only in a way that does not put you at further risk.',
      'Choose a trusted adult, teacher, counsellor, caregiver or designated safeguarding contact to tell.',
      'You do not have to handle repeated bullying alone or prove that you can tolerate it.',
      'If online, consider saving relevant evidence and using platform reporting/blocking tools when safe to do so.',
    ],
    reflection: 'Who is one adult or support person you could tell, and what would make it easier to start?',
  },
  'WN-10': {
    steps: [
      'Choose someone who is likely to listen and help you stay safe.',
      'Use or adapt this message: “I have been finding things difficult lately. I do not need you to solve everything immediately, but I would like you to listen and help me work out what to do next.”',
      'If speaking feels difficult, consider writing a note or asking another trusted person to join the conversation.',
      'If the first person does not respond helpfully, try another trusted adult or appropriate professional.',
    ],
    reflection: 'Would you like help choosing words for a teacher, counsellor, caregiver or friend?',
  },
  'WN-11': {
    steps: [
      'If possible, choose a roughly consistent time to begin winding down.',
      'Put school tasks or worries on paper and write one small next step for tomorrow.',
      'Try a quiet activity such as reading, gentle stretching, calm audio or preparing clothes and materials for the next day.',
      'If thoughts return, remind yourself: “I have written this down; I can return to it tomorrow.”',
    ],
    reflection: 'What is one thing you can set aside for tomorrow, and one thing that helps you feel settled?',
  },
  'WN-12': {
    steps: [
      'Choose what feels closest: I need to calm my body; understand a feeling; solve a practical problem; connect with someone; or get help to stay safe.',
      'Choose one small action that matches your need.',
      'Choose a person or service you can contact if the first step is not enough.',
      'After trying it, check: “Am I a little safer or more supported? What do I need next?”',
    ],
    reflection: 'Which next step feels manageable right now?',
  },
}

const RESOURCES = WN_LIBRARY.map(([code, title, description, durationLabel, category], index) => ({
  id: `res-${code.toLowerCase()}`,
  title,
  description,
  type: 'TOOLKIT_ITEM',
  category,
  badge: null,
  durationMinutes: null,
  durationLabel,
  ctaLabel: null,
  mediaUrl: null,
  tags: [],
  contentCode: code,
  intendedSituation: null,
  instructions: WN_GUIDED[code].steps,
  reflectionPrompt: WN_GUIDED[code].reflection,
  safetyNote: null,
  active: true,
  approved: true,
  createdAt: iso(days(4 - index * 0.1)),
  updatedAt: iso(days(4 - index * 0.1)),
}))
const savedResourceIds = new Set(['res-wn-02'])
const toolboxPayload = () => {
  const items = RESOURCES.filter((r) => savedResourceIds.has(r.id))
  return { items, count: items.length }
}

// One builder for every queue-shaped read in the app: the review list, its
// chips, the rail badge and the staff overview all come from these rows, so
// the harness cannot be the reason two numbers disagree.
function queueRows() {
  const miva = schools.find((school) => school.id === 'sch-miva')
  const queueStudents = studentsOf(miva)
  const QUEUE = [
    ['NEW', 'REVIEW_SUGGESTED', 'URGENT_UNSAFE', hours(3)],
    ['NEW', 'NONE', 'TODAY_STUDY_PERIOD', hours(7)],
    ['REVIEWED', 'REVIEW_SUGGESTED', 'GENTLE_1_2_DAYS', hours(20)],
    ['FOLLOW_UP_REQUIRED', 'NONE', 'GENTLE_1_2_DAYS', days(2)],
    ['FOLLOW_UP_COMPLETED', 'REVIEW_SUGGESTED', 'TODAY_STUDY_PERIOD', days(4)],
  ]
  return QUEUE.map(([queueStatus, prompt, timing, msAgo], i) => {
    const student = queueStudents[i % queueStudents.length]
    const profile = student.studentProfile
    return {
      id: `sreq-${i}`,
      requestedAt: iso(msAgo),
      timing,
      note: 'I keep worrying about exams and I cannot sleep.',
      initialMessage: i % 2 === 0 ? 'Can I talk to someone today?' : null,
      initialMessageAt: i % 2 === 0 ? iso(msAgo) : null,
      reviewNote: queueStatus === 'NEW' ? null : 'Spoke during break, booked a follow-up.',
      requestStatus: queueStatus === 'NEW' ? 'PENDING' : 'IN_REVIEW',
      queueStatus,
      prompt,
      followUpId: queueStatus.startsWith('FOLLOW_UP') ? `fu-${i}` : null,
      followUpStatus: queueStatus === 'FOLLOW_UP_REQUIRED' ? 'SCHEDULED' : queueStatus === 'FOLLOW_UP_COMPLETED' ? 'COMPLETED' : null,
      canManageFollowUp: queueStatus === 'FOLLOW_UP_REQUIRED',
      followUpDueAt: queueStatus === 'FOLLOW_UP_REQUIRED' ? iso(days(-1)) : null,
      followUpCompletedAt: queueStatus === 'FOLLOW_UP_COMPLETED' ? iso(days(1)) : null,
      conversationId: `conv-${i}`,
      // The UNREAD predicate: a request nobody has opened yet, and nothing
      // cancelled. The rail's badge reads the same field the page filters on.
      readAt: queueStatus === 'NEW' ? null : iso(msAgo - hours(1)),
      student: {
        id: student.id,
        firstName: profile?.firstName ?? student.name.split(' ')[0],
        lastName: profile?.lastName ?? null,
        displayName: null,
        classLabel: profile?.classLabel ?? null,
        studentCode: profile?.studentCode ?? null,
        studentRef: null,
        email: student.email,
      },
      // `SupportRequest.supportPersonId` is required with onDelete: Restrict, so
      // no real row is ever without one. A null here is a harness lie, and the
      // staff overview reads `.name` off it and takes the whole page down.
      supportPerson: { id: SESSION_USER.id, name: 'Kiki Amuta', type: 'COUNSELLOR', title: 'Counsellor' },
    }
  })
}

const queueCountsFor = (items) => ({
  all: items.length,
  new: items.filter((i) => i.queueStatus === 'NEW').length,
  reviewed: items.filter((i) => i.queueStatus === 'REVIEWED').length,
  followUpRequired: items.filter((i) => i.queueStatus === 'FOLLOW_UP_REQUIRED').length,
  followUpCompleted: items.filter((i) => i.queueStatus === 'FOLLOW_UP_COMPLETED').length,
  unread: items.filter((i) => i.readAt === null).length,
  awaitingUnread: items.filter(
    (i) => i.readAt === null && ['PENDING', 'ESCALATED'].includes(i.requestStatus),
  ).length,
  completedThisWeek: items.filter(
    (i) => i.followUpCompletedAt && Date.parse(i.followUpCompletedAt) >= NOW - 7 * 86_400_000,
  ).length,
})

// --- Request handling -------------------------------------------------------

const calls = []
const ok = (res, data) => sendJson(res, 200, { success: true, statusCode: 200, message: 'OK', data, path: '/mock', timestamp: new Date().toISOString() })
const fail = (res, status, message, code) => sendJson(res, status, { success: false, statusCode: status, message, ...(code ? { code } : {}), path: '/mock', timestamp: new Date().toISOString() })

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1_000_000) req.destroy()
    })
    req.on('end', () => resolve(raw))
  })
}

// The AI disclosure IS the consent instrument, and the reflection route shows
// the declined band until /ai/disclosure/status says accepted — so without
// these three endpoints the chat composer, and the voice control inside it,
// cannot be reached in this harness at all.
const DISCLOSURE_VERSION = 'mock-v3'
const DISCLOSURE_VIEW = {
  version: DISCLOSURE_VERSION,
  consentVersion: `ai-disclosure-${DISCLOSURE_VERSION}`,
  title: 'Before you chat with Soul Nurture AI',
  intro: 'Soul Nurture AI is here to listen. Please read how it works and what it cannot do.',
  groups: [
    {
      id: 'read-before-you-start',
      title: 'Read before you start',
      summary: 'The important safety, privacy and AI-use points.',
      sections: [
        {
          id: 'what-it-is',
          heading: 'What Soul Nurture AI is',
          items: [
            'It listens, reflects back what you share, and suggests small healthy steps.',
            'It is not a psychologist, counsellor, doctor or an emergency service.',
          ],
        },
      ],
    },
  ],
  agreements: [
    { id: 'not-therapy', label: 'I understand this is not therapy or medical advice.' },
    { id: 'safe-adult', label: 'I understand an adult at school may be told if I am not safe.' },
  ],
  confirmLabel: 'I understand, let me chat',
  declineLabel: 'Not now',
  text: 'It is not a psychologist. It is not an emergency service.',
}
// The harness starts already accepted: the gate is its own surface, and
// leaving it shut would hide every chat screen behind it. POST acknowledge
// still works for a pass that wants to watch the gate close.
let disclosureAccepted = true

const overviewPayload = () => {
  const roleCount = (role) => users.filter((u) => u.role === role).length
  const staff = PRO_ROLES.reduce((sum, role) => sum + roleCount(role), 0)
  const fresh = (ms) => users.filter((u) => NOW - Date.parse(u.createdAt) <= ms).length
  return {
    schools: { total: schools.length, active: schools.filter((x) => x.status === 'ACTIVE').length, suspended: schools.filter((x) => x.status === 'SUSPENDED').length },
    users: { total: users.length, students: roleCount('STUDENT'), professionals: staff, admins: roleCount('SCHOOL_ADMIN') + roleCount('PLATFORM_ADMIN'), newLast7d: fresh(days(7)), newLast30d: fresh(days(30)) },
    chat: { pendingRequests: schools.reduce((sum, x) => sum + x.threads.filter((t) => t.status === 'PENDING').length, 0) },
  }
}

const schoolRow = (school) => ({
  id: school.id,
  name: school.name,
  shortCode: school.shortCode,
  status: school.status,
  createdAt: school.createdAt,
  _count: { users: users.filter((u) => u.schoolId === school.id).length },
  students: users.filter((u) => u.schoolId === school.id && u.role === 'STUDENT').length,
  professionals: users.filter((u) => u.schoolId === school.id && u.professionalProfile).length,
  pendingChats: school.threads.filter((t) => t.status === 'PENDING').length,
  lastActivityAt: school.lastActivityAt,
})

function activityFor({ kind, schoolId, limit }) {
  let items = ACTIVITY
  if (schoolId) items = items.filter((item) => item.school?.id === schoolId)
  if (kind && kind !== 'all') items = items.filter((item) => item.kind === kind)
  return items.slice(0, Math.min(limit ?? 50, 100))
}

// --- Chat helpers -----------------------------------------------------------

const CHAT_STAFF_ROLES = ['COUNSELLOR', 'PSYCHOLOGIST', 'SUPPORT_STAFF']
const threadList = () => schools.flatMap((school) => school.threads)
const userById = (id) => users.find((u) => u.id === id) ?? null

function threadById(id) {
  for (const school of schools) {
    const thread = school.threads.find((t) => t.id === id)
    if (thread) return thread
  }
  return null
}

function studentBriefOf(user) {
  const profile = user.studentProfile ?? {}
  return {
    userId: user.id,
    firstName: profile.firstName ?? user.name.split(' ')[0],
    lastName: profile.lastName ?? (user.name.split(' ').slice(1).join(' ') || ''),
    classLabel: profile.classLabel ?? null,
    studentCode: profile.studentCode ?? null,
  }
}

function proBriefOf(user) {
  const profile = user.professionalProfile ?? {}
  return { userId: user.id, title: profile.title ?? null, department: profile.department ?? null, user: { name: user.name } }
}

function participantRoleOf(thread, viewer) {
  if (thread.studentId === viewer.id) return 'STUDENT'
  if (thread.professionalId && thread.professionalId === viewer.id) return 'PROFESSIONAL'
  return null
}

function lastPreview(thread) {
  const last = thread.messages[thread.messages.length - 1]
  return last ? [{ content: last.content, role: last.role, createdAt: last.createdAt }] : []
}

function threadRowOf(thread) {
  return {
    id: thread.id,
    schoolId: thread.schoolId,
    status: thread.status,
    aiEntrySummary: thread.aiEntrySummary,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    claimedAt: thread.claimedAt,
    closedAt: thread.closedAt,
    studentId: thread.studentId,
    professionalId: thread.professionalId,
  }
}

function threadDetailOf(thread) {
  const student = userById(thread.studentId)
  const professional = thread.professionalId ? userById(thread.professionalId) : null
  return {
    ...threadRowOf(thread),
    entryCheckInId: thread.entryCheckInId,
    studentReadAt: thread.studentReadAt,
    professionalReadAt: thread.professionalReadAt,
    student: studentBriefOf(student),
    professional: professional ? proBriefOf(professional) : null,
    messages: thread.messages,
  }
}

function unreadFor(viewer) {
  const isStaff = CHAT_STAFF_ROLES.includes(viewer.role)
  const scope = isStaff
    ? threadList().filter((t) => t.professionalId === viewer.id)
    : threadList().filter((t) => t.studentId === viewer.id)
  const byThread = {}
  let total = 0
  for (const thread of scope) {
    const readAt = isStaff ? thread.professionalReadAt : thread.studentReadAt
    const count = thread.messages.filter(
      (m) => m.senderUserId && m.senderUserId !== viewer.id && (!readAt || m.createdAt > readAt),
    ).length
    if (count > 0) {
      byThread[thread.id] = count
      total += count
    }
  }
  return { total, byThread }
}

// F3's admin register payload (pinned shape) despite richer thread rows.
const adminThreadRowOf = (t) => ({
  id: t.id,
  schoolId: t.schoolId,
  status: t.status,
  studentId: t.studentId,
  professionalId: t.professionalId,
  createdAt: t.createdAt,
  claimedAt: t.claimedAt,
  closedAt: t.closedAt,
  lastMessageAt: t.lastMessageAt,
  messageCount: t.messageCount,
  student: t.student,
  professional: t.professional,
})

// --- Session personas -------------------------------------------------------

function personaStudent() {
  return users.find((u) => u.schoolId === 'sch-miva' && u.role === 'STUDENT' && !u.mustChangePassword && u.emailVerified) ?? SESSION_USER
}

function personaStaff() {
  return users.find((u) => u.schoolId === 'sch-miva' && u.professionalProfile) ?? SESSION_USER
}

function personaAdmin() {
  return users.find((u) => u.schoolId === 'sch-miva' && u.role === 'SCHOOL_ADMIN' && u.emailVerified) ?? SESSION_USER
}

// Mirrors the /users/me resolution so school-user guards can compare actor ids.
function sessionUserFor(req) {
  const cookieMatch = (req.headers.cookie ?? '').match(/(?:^|;\s*)mockRole=([A-Z_]+)/)
  const mockRole = cookieMatch ? cookieMatch[1] : 'PLATFORM_ADMIN'
  if (mockRole === 'STUDENT') return personaStudent()
  if (mockRole === 'SCHOOL_ADMIN') return personaAdmin()
  if (mockRole === 'COUNSELLOR') return personaStaff()
  if (mockRole === 'FRESH_STUDENT') return FRESH_STUDENT
  return SESSION_USER
}

async function handler(req, res, next) {
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname
  if (!path.startsWith('/api/') && path !== '/__mock__/state') return next()
  calls.push(`${req.method} ${path}${url.search}`)
  if (calls.length > 300) calls.shift()

  if (path === '/__mock__/state') {
    return ok(res, {
      schools: schools.map((school) => ({ id: school.id, name: school.name, shortCode: school.shortCode, status: school.status, hasDefaultPassword: school.hasDefaultPassword, threads: school.threads.length })),
      users: users.length,
      unreadNotifications: notifications.filter((n) => !n.readAt).length,
      chat: {
        pool: threadList().filter((t) => t.status === 'PENDING' && t.schoolId === 'sch-miva').map((t) => t.id),
        counsellorUnread: unreadFor(personaStaff()),
        studentUnread: unreadFor(personaStudent()),
      },
      calls: calls.slice(-60),
    })
  }

  // Socket.IO polling fallback (WS handled on upgrade; this keeps it quiet).
  if (path.startsWith('/api/socket.io')) {
    const sid = url.searchParams.get('sid')
    if (req.method === 'POST') {
      const body = await readBody(req)
      if (body.startsWith('40')) socketState.nsConnected = true
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8')
      res.end('ok')
      return
    }
    if (!sid) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8')
      res.end('0' + JSON.stringify({ sid: 'mocksid', upgrades: [], pingInterval: 25000, pingTimeout: 20000 }))
      return
    }
    if (socketState.nsConnected && !socketState.nsAckSent) {
      socketState.nsAckSent = true
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8')
      res.end('40' + JSON.stringify({ sid: 'mockns' }))
      return
    }
    setTimeout(() => {
      if (res.writableEnded) return
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8')
      res.end('2')
    }, 12_000)
    return
  }

  // Reflection chat — an ACTIVE conversation, so the composer (and the voice
  // control) renders instead of the read-only band.
  {
    const conversationMatch = /^\/api\/v1\/conversations\/([^/]+)$/.exec(path)
    if (conversationMatch && req.method === 'GET') {
      const id = decodeURIComponent(conversationMatch[1])
      return ok(res, {
        id,
        checkInId: null,
        status: 'ACTIVE',
        messages: [
          { id: `${id}-m0`, role: 'USER', content: 'I have been feeling heavy lately.', createdAt: iso(minutes(12)) },
          {
            id: `${id}-m1`,
            role: 'ASSISTANT',
            content: 'Thank you for telling me that. What has been weighing on you most?',
            aiPayload: { asyncState: 'COMPLETE', boundary: null },
            createdAt: iso(minutes(11)),
          },
        ],
      })
    }
  }

  // AI consent gate — see DISCLOSURE_VIEW above.
  if (path === '/api/v1/ai/disclosure' && req.method === 'GET') {
    return ok(res, DISCLOSURE_VIEW)
  }
  if (path === '/api/v1/ai/disclosure/status' && req.method === 'GET') {
    // The client compares this version against the disclosure's
    // consentVersion and calls a mismatch a load error, so it is the consent
    // version here, not the bare disclosure version.
    return ok(res, {
      version: DISCLOSURE_VIEW.consentVersion,
      accepted: disclosureAccepted,
      acceptedAt: disclosureAccepted ? iso(minutes(5)) : null,
    })
  }
  if (path === '/api/v1/ai/disclosure/acknowledge' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}')
    const missing = DISCLOSURE_VIEW.agreements
      .map((a) => a.id)
      .filter((id) => !body.agreements?.includes(id))
    if (missing.length > 0) {
      return fail(res, 400, 'Every statement must be accepted before you can chat.', 'VALIDATION_ERROR')
    }
    disclosureAccepted = true
    return ok(res, { acknowledged: true, record: { id: 'consent-mock-1' } })
  }

  // Voice transcription — echoes the parts it received, which is what lets a
  // browser pass prove that the client actually sends `language`.
  if (path === '/api/v1/ai/transcribe' && req.method === 'POST') {
    const raw = await readBody(req)
    const field = (name) => {
      const m = new RegExp(`name="${name}"\\r?\\n\\r?\\n([^\\r]*)`).exec(raw)
      return m ? m[1] : null
    }
    return ok(res, {
      text: `[mock] language=${field('language') ?? '<absent>'} bytes=${raw.length}`,
      durationSeconds: 1,
    })
  }

  // History (Epic H) — the student's own aggregate, paged by cursor, and the
  // deletion asks.
  if (path === '/api/v1/history' && req.method === 'GET') {
    const take = Math.min(Math.max(Number(url.searchParams.get('take')) || 25, 1), 100)
    const before = url.searchParams.get('before')
    const pool = before ? HISTORY_ENTRIES.filter((e) => e.createdAt < before) : HISTORY_ENTRIES
    const rows = pool.slice(0, take + 1)
    const items = rows.slice(0, take)
    const last = items.at(-1)
    return ok(res, {
      items,
      supportRequests: HISTORY_SUPPORT_REQUESTS,
      counts: {
        all: HISTORY_ENTRIES.length,
        checkIns: HISTORY_ENTRIES.length,
        reflections: HISTORY_ENTRIES.filter((e) => e.reflection).length,
        supportRequests: HISTORY_REQUESTS_TOTAL,
      },
      page: { take, hasMore: rows.length > take, nextBefore: last ? last.createdAt : null },
    })
  }

  if (path === '/api/v1/history/deletion-requests' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}')
    const receipt = {
      id: `ask-${Date.now()}`,
      scope: body.scope ?? 'ALL_HISTORY',
      beforeDate: body.beforeDate ?? null,
      checkInIds: body.checkInIds ?? [],
      note: body.note ?? null,
      alertedAt: new Date().toISOString(),
      scheduledPurgeAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      cancelledAt: null,
      purgedAt: null,
      holdReason: null,
      removedCheckIns: 0,
      removedConversations: 0,
      createdAt: new Date().toISOString(),
    }
    DELETION_ASKS.unshift(receipt)
    return sendJson(res, 201, { success: true, statusCode: 201, message: 'Created', data: receipt, path: path, timestamp: new Date().toISOString() })
  }

  if (path === '/api/v1/history/deletion-requests') {
    return ok(res, { items: DELETION_ASKS })
  }

  const cancelMatch = path.match(/^\/api\/v1\/history\/deletion-requests\/([^/]+)\/cancel$/)
  if (cancelMatch && req.method === 'POST') {
    const ask = DELETION_ASKS.find((a) => a.id === cancelMatch[1])
    if (!ask) return fail(res, 404, 'Deletion request not found')
    if (cancelMatch[1] === 'ask-boom') return fail(res, 409, 'The removal has already run — there is nothing left to undo.', 'ALREADY_REMOVED')
    // Mirrors the server's precedence: an erasure that already ran is not
    // unmade by a late cancel, and a second cancel says so instead of pretending.
    if (ask.purgedAt) return fail(res, 409, 'The removal has already run — there is nothing left to undo.', 'ALREADY_REMOVED')
    if (ask.cancelledAt) return fail(res, 409, 'This request was already cancelled.', 'ALREADY_CANCELLED')
    ask.cancelledAt = new Date().toISOString()
    return sendJson(res, 201, { success: true, statusCode: 201, message: 'Created', data: ask, path: path, timestamp: new Date().toISOString() })
  }

  const detailMatch = path.match(/^\/api\/v1\/history\/([\w-]+)$/)
  if (detailMatch && req.method === 'GET') {
    const entry = HISTORY_ENTRIES.find((e) => e.checkInId === detailMatch[1])
    if (!entry) return fail(res, 404, 'History entry not found')
    return ok(res, {
      ...entry,
      description: entry.reflection ? 'Felt heavy all week, exams coming up.' : null,
      messages: entry.reflection
        ? [
            { id: 'm-1', role: 'USER', content: 'I could not sleep before the exams.', language: 'en', viaVoice: false, createdAt: entry.reflection.startedAt },
            { id: 'm-2', role: 'ASSISTANT', content: 'That sounds draining. What has helped you get through a hard week before?', language: 'en', viaVoice: false, createdAt: entry.reflection.startedAt },
          ]
        : [],
    })
  }

  // Session — role switchable via a `mockRole` cookie (SCHOOL_ADMIN | COUNSELLOR | STUDENT | FRESH_STUDENT | ANON)
  if (path === '/api/v1/users/me') {
    if ((req.headers.cookie ?? '').includes('mockRole=ANON')) {
      return fail(res, 401, 'Unauthorized')
    }
    const target = sessionUserFor(req)
    if (target === SESSION_USER) {
      return ok(res, { id: SESSION_USER.id, name: SESSION_USER.name, email: SESSION_USER.email, emailVerified: true, role: 'PLATFORM_ADMIN', schoolId: null, mustChangePassword: false, school: null })
    }
    const school = schools.find((s) => s.id === target.schoolId)
    return ok(res, { id: target.id, name: target.name, email: target.email, emailVerified: true, role: target.role, schoolId: target.schoolId, mustChangePassword: target === FRESH_STUDENT ? FRESH_STUDENT.mustChangePassword : false, school: { id: school.id, name: school.name, shortCode: school.shortCode } })
  }

  if (path === '/api/v1/auth/first-password' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}')
    const pw = String(body.newPassword ?? '')
    if (pw.length < 8) return fail(res, 422, 'Password must be at least 8 characters.', 'VALIDATION_ERROR')
    if (!FRESH_STUDENT.mustChangePassword) {
      return fail(res, 403, 'This account is not awaiting a first password change.', 'PASSWORD_CHANGE_NOT_REQUIRED')
    }
    // Magic value simulates the changed-elsewhere race: flip the flag, then 409
    // (real: 403) so the page must self-heal into the refreshed session.
    FRESH_STUDENT.mustChangePassword = false
    if (pw === 'SelfHeal#2026') {
      return fail(res, 403, 'This account is not awaiting a first password change.', 'PASSWORD_CHANGE_NOT_REQUIRED')
    }
    return ok(res, { passwordChanged: true })
  }

  // Notifications
  if (path === '/api/v1/notifications' && req.method === 'GET') {
    const unreadOnly = url.searchParams.get('unread') === 'true'
    return ok(res, { items: notifications.filter((n) => !unreadOnly || !n.readAt) })
  }
  if (path === '/api/v1/notifications/unread-count') return ok(res, { count: notifications.filter((n) => !n.readAt).length })
  if (path === '/api/v1/notifications/read-all' && req.method === 'POST') {
    notifications.forEach((n) => (n.readAt = n.readAt ?? new Date().toISOString()))
    return ok(res, null)
  }
  const readMatch = path.match(/^\/api\/v1\/notifications\/([^/]+)\/read$/)
  if (readMatch && req.method === 'POST') {
    const item = notifications.find((n) => n.id === readMatch[1])
    if (item) item.readAt = item.readAt ?? new Date().toISOString()
    return ok(res, null)
  }

  // Chat — the student door and the staff door.
  if (path.startsWith('/api/v1/chat/')) {
    const viewer = sessionUserFor(req)
    const isStaff = CHAT_STAFF_ROLES.includes(viewer.role)
    const viewerSchool = viewer.schoolId ? schools.find((x) => x.id === viewer.schoolId) : null

    if (path === '/api/v1/chat/unread' && req.method === 'GET') {
      return ok(res, unreadFor(viewer))
    }

    if (path === '/api/v1/chat/inbox' && req.method === 'GET') {
      if (!isStaff) return fail(res, 403, 'Insufficient permissions for this resource')
      const items = threadList()
        .filter((t) => t.status === 'PENDING' && t.schoolId === viewer.schoolId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((t) => ({ ...threadRowOf(t), student: studentBriefOf(userById(t.studentId)) }))
      return ok(res, { items })
    }

    if (path === '/api/v1/chat/threads' && req.method === 'GET') {
      if (!isStaff && viewer.role !== 'STUDENT') return fail(res, 403, 'Insufficient permissions for this resource')
      const scope = isStaff
        ? threadList().filter((t) => t.professionalId === viewer.id)
        : threadList().filter((t) => t.studentId === viewer.id)
      const items = [...scope]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((t) =>
          isStaff
            ? { ...threadRowOf(t), student: studentBriefOf(userById(t.studentId)), messages: lastPreview(t) }
            : { ...threadRowOf(t), professional: t.professionalId ? proBriefOf(userById(t.professionalId)) : null, messages: lastPreview(t) },
        )
      return ok(res, { items })
    }

    if (path === '/api/v1/chat/threads' && req.method === 'POST') {
      if (viewer.role !== 'STUDENT') return fail(res, 403, 'Insufficient permissions for this resource')
      const body = JSON.parse((await readBody(req)) || '{}')
      const note = body.note !== undefined ? String(body.note) : ''
      if (note.length > 500) return fail(res, 400, 'note must be shorter than or equal to 500 characters', 'VALIDATION_ERROR')
      if (!viewerSchool) return fail(res, 422, 'Your account is not linked to a school yet. Ask your school administrator to add you.', 'NO_SCHOOL')
      if (viewerSchool.status === 'SUSPENDED') return fail(res, 403, 'Your school account is currently suspended. Contact your school administrator.', 'SCHOOL_SUSPENDED')
      const existing = threadList().find((t) => t.studentId === viewer.id && t.status === 'PENDING')
      if (existing) return fail(res, 409, 'You already have a request waiting to be picked up.', 'PENDING_REQUEST_EXISTS')
      const profile = viewer.studentProfile ?? {}
      const thread = {
        id: `thr-${tidx++}`,
        schoolId: viewerSchool.id,
        status: 'PENDING',
        studentId: viewer.id,
        professionalId: null,
        createdAt: iso(0),
        updatedAt: iso(0),
        claimedAt: null,
        closedAt: null,
        studentReadAt: iso(0),
        professionalReadAt: null,
        entryCheckInId: body.checkInId ?? null,
        aiEntrySummary: note.trim() || `${profile.firstName ?? viewer.name}${profile.classLabel ? ` (${profile.classLabel})` : ''} asked to talk with someone.`,
        lastMessageAt: null,
        messageCount: 0,
        student: { id: viewer.id, name: viewer.name },
        professional: null,
        messages: [],
      }
      viewerSchool.threads.push(thread)
      pushMessage(thread, { userId: null, role: 'SYSTEM', content: thread.aiEntrySummary, msAgo: 0, meta: { composedByAi: false } })
      ACTIVITY.unshift({ id: `act-thread-${Date.now()}`, action: 'chat.thread_created', kind: 'chat', entity: 'chat_thread', entityId: thread.id, meta: { threadId: thread.id }, createdAt: new Date().toISOString(), actor: actorOf(viewer), school: schoolUrl(viewerSchool) })
      for (const pro of staffOf(viewerSchool)) {
        notifications.unshift({ id: `ntf-chat-${Date.now()}-${pro.id}`, type: 'CHAT_REQUEST', title: `${profile.firstName ?? viewer.name} asked to talk`, body: thread.aiEntrySummary, data: { threadId: thread.id }, readAt: null, createdAt: new Date().toISOString() })
      }
      return ok(res, threadDetailOf(thread))
    }

    const chatThreadMatch = path.match(/^\/api\/v1\/chat\/threads\/([^/]+)(?:\/(claim|messages|read|close))?$/)
    if (chatThreadMatch) {
      const thread = threadById(chatThreadMatch[1])
      const action = chatThreadMatch[2]

      if (action === 'claim' && req.method === 'POST') {
        if (!isStaff) return fail(res, 403, 'Insufficient permissions for this resource')
        if (!thread || thread.schoolId !== viewer.schoolId) return fail(res, 404, 'Chat thread not found')
        if (!viewer.professionalProfile) return fail(res, 404, 'Professional profile not found')
        if (thread.status !== 'PENDING') return fail(res, 409, 'Another professional has already picked up this request.', 'CHAT_THREAD_TAKEN')
        thread.status = 'ACTIVE'
        thread.professionalId = viewer.id
        thread.claimedAt = iso(0)
        thread.professionalReadAt = iso(0)
        thread.updatedAt = iso(0)
        thread.professional = { id: viewer.id, name: viewer.name }
        ACTIVITY.unshift({ id: `act-claim-${Date.now()}`, action: 'chat.thread_claimed', kind: 'chat', entity: 'chat_thread', entityId: thread.id, meta: { threadId: thread.id }, createdAt: new Date().toISOString(), actor: actorOf(viewer), school: schoolUrl(schools.find((x) => x.id === thread.schoolId)) })
        const claimed = threadDetailOf(thread)
        delete claimed.messages
        return ok(res, claimed)
      }

      if (!thread) return fail(res, 404, 'Chat thread not found')
      const participantRole = participantRoleOf(thread, viewer)
      if (!participantRole) return fail(res, 404, 'Chat thread not found')

      if (action === 'messages' && req.method === 'POST') {
        if (thread.status === 'CLOSED') return fail(res, 409, 'This chat has been closed.', 'CHAT_THREAD_CLOSED')
        if (thread.status !== 'ACTIVE' || !thread.professionalId) return fail(res, 409, 'This request has not been picked up yet.', 'CHAT_NOT_CLAIMED')
        const body = JSON.parse((await readBody(req)) || '{}')
        const content = String(body.content ?? '').trim()
        if (!content) return fail(res, 400, 'content should not be empty', 'VALIDATION_ERROR')
        const message = pushMessage(thread, { userId: viewer.id, role: participantRole, content, msAgo: 0, viaVoice: body.viaVoice === true })
        if (participantRole === 'STUDENT') thread.studentReadAt = iso(0)
        else thread.professionalReadAt = iso(0)
        thread.updatedAt = iso(0)
        return ok(res, message)
      }

      if (action === 'read' && req.method === 'POST') {
        if (participantRole === 'STUDENT') thread.studentReadAt = iso(0)
        else thread.professionalReadAt = iso(0)
        return ok(res, { id: thread.id, read: true })
      }

      if (action === 'close' && req.method === 'POST') {
        if (thread.status !== 'CLOSED') {
          thread.status = 'CLOSED'
          thread.closedAt = iso(0)
          thread.updatedAt = iso(0)
          ACTIVITY.unshift({ id: `act-close-${Date.now()}`, action: 'chat.thread_closed', kind: 'chat', entity: 'chat_thread', entityId: thread.id, meta: { threadId: thread.id }, createdAt: new Date().toISOString(), actor: actorOf(viewer), school: schoolUrl(schools.find((x) => x.id === thread.schoolId)) })
        }
        return ok(res, { id: thread.id, status: 'CLOSED' })
      }

      if (!action && req.method === 'GET') {
        return ok(res, threadDetailOf(thread))
      }
    }

    return fail(res, 404, `No mock for ${req.method} ${path}`)
  }

  // Support-people directory (WhatsApp handoff card on /support).
  if (path === '/api/v1/support-requests/people' && req.method === 'GET') {
    const mivaStaff = staffOf(schools.find((x) => x.id === 'sch-miva')).slice(0, 2)
    return ok(
      res,
      mivaStaff.map((pro) => ({
        id: pro.id,
        professionalId: pro.id,
        name: pro.name,
        type: pro.role,
        title: pro.professionalProfile?.title ?? null,
        availabilityLabel: 'Available today',
        availableToday: true,
        imageUrl: null,
        active: true,
      })),
    )
  }

  // Staff review queue (figma PNA-4). One item per queue status so every pill,
  // filter chip and row shape on /school/requests renders at mobile width.
  if (path.startsWith('/api/v1/support-requests/queue') && req.method === 'GET') {
    const items = queueRows()
    const counts = queueCountsFor(items)
    // The rail asks this lane for one number; the list endpoint is the same
    // builder, so the badge and the chip cannot drift apart here either.
    if (path === '/api/v1/support-requests/queue/counts') return ok(res, counts)
    const status = url.searchParams.get('status')
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    return ok(res, {
      counts,
      items: items.filter(
        (item) =>
          (!status || item.queueStatus === status) &&
          (!q || `${item.student.firstName} ${item.student.lastName ?? ''}`.toLowerCase().includes(q)),
      ),
    })
  }
  // Wellbeing resources — the catalogue, the toolbox and the tailored band.
  if (path === '/api/v1/resources' && req.method === 'GET') {
    const category = url.searchParams.get('category') ?? ''
    const needle = (url.searchParams.get('search') ?? '').trim().toLowerCase()
    const savedOnly = url.searchParams.get('savedOnly') === 'true'
    let items = [...RESOURCES].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (category) items = items.filter((r) => r.category === category)
    if (needle) {
      items = items.filter((r) => `${r.title} ${r.description}`.toLowerCase().includes(needle))
    }
    if (savedOnly) items = items.filter((r) => savedResourceIds.has(r.id))
    return ok(res, { items, savedCount: savedResourceIds.size })
  }

  if (path === '/api/v1/resources/tailored' && req.method === 'GET') {
    const picks = RESOURCES.filter((r) => ['STEADIER', 'ONE_STEP'].includes(r.category)).slice(0, 3)
    return ok(res, {
      title: 'Picked for you',
      rationale: 'Based on what you told us in your last check-in.',
      basis: 'STATED_NEED',
      items: picks,
    })
  }

  if (path === '/api/v1/resources/toolbox' && req.method === 'GET') return ok(res, toolboxPayload())
  if (path === '/api/v1/resources/toolbox' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}')
    const resource = RESOURCES.find((r) => r.id === body.resourceId)
    if (!resource) return fail(res, 404, 'Resource not found')
    savedResourceIds.add(resource.id)
    return ok(res, toolboxPayload())
  }
  if (path === '/api/v1/resources/feedback' && req.method === 'POST') {
    return ok(res, { recorded: true })
  }

  // The staff overview — the page chat staff now land on. Its counts are the
  // same facts the rail badges quote, read from the same rows.
  if (path === '/api/v1/dashboard/counsellor' && req.method === 'GET') {
    // Projected into the dashboard's own row shape, with `urgency` derived the
    // way `deriveUrgency()` does it, so the urgent card and the "review these
    // first" panel read one field instead of two different predicates. Handing
    // the queue rows through raw left the panel empty while the card said 1.
    const awaiting = queueRows()
      .filter((row) => row.requestStatus === 'PENDING')
      .map((row) => ({
        id: row.id,
        status: row.requestStatus,
        timing: row.timing,
        urgency:
          row.timing === 'URGENT_UNSAFE' || row.requestStatus === 'ESCALATED' ? 'URGENT' : 'NORMAL',
        note: row.note,
        initialMessage: row.initialMessage,
        initialMessageAt: row.initialMessageAt,
        createdAt: row.requestedAt,
        readAt: row.readAt,
        conversationId: row.conversationId,
        supportPerson: row.supportPerson,
        student: row.student,
      }))
      .sort(
        (a, b) =>
          (a.urgency === b.urgency ? 0 : a.urgency === 'URGENT' ? -1 : 1) ||
          b.createdAt.localeCompare(a.createdAt),
      )
    const flags = INDICATOR_FLAGS.filter((f) => ['OPEN', 'IN_REVIEW', 'ACKNOWLEDGED'].includes(f.status))
      .sort((a, b) => b.severity.localeCompare(a.severity) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20)
      .map((f) => ({
        id: f.id,
        studentRef: f.studentRef,
        classLabel: f.classLabel,
        triggerLabel: f.triggerLabel,
        category: f.category,
        severity: f.severity,
        level: f.level,
        status: f.status,
        conversationId: f.conversationId,
        createdAt: f.createdAt,
      }))
    const distribution = HISTORY_ENTRIES.reduce((acc, entry) => {
      acc[entry.feeling] = (acc[entry.feeling] ?? 0) + 1
      return acc
    }, {})
    return ok(res, {
      flags,
      barometer: {
        total: HISTORY_ENTRIES.length,
        dominant: Object.entries(distribution).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
        distribution,
        notes: 'Based on the most recent 100 check-ins from your school.',
      },
      supportRequests: awaiting.slice(0, 20),
      pendingRequestCount: awaiting.length,
      escalatedRequestCount: 0,
      urgentRequestCount: awaiting.filter((row) => row.urgency === 'URGENT').length,
      unreadRequestCount: awaiting.filter((row) => row.readAt === null).length,
      openFlagCount: INDICATOR_FLAGS.filter((f) => f.status === 'OPEN').length,
      upcomingDropIn: null,
    })
  }

  // The rail's needs-attention badges. Same role gate and the same predicates
  // as AttentionService, so a badge can be held against the page it decorates.
  if (path === '/api/v1/dashboard/attention') {
    return ok(res, attentionCountsFor(sessionUserFor(req)))
  }

  // Safeguarding indicators (Epic D). Level chips count the set the rest of the
  // filters leave, which is why the level itself is not part of that set.
  if (path === '/api/v1/support-flags' && req.method === 'GET') {
    const viewer = sessionUserFor(req)
    if (!['COUNSELLOR', 'PSYCHOLOGIST'].includes(viewer.role)) {
      return fail(res, 403, 'Insufficient permissions for this resource')
    }
    const level = url.searchParams.get('level') ?? ''
    const severity = url.searchParams.get('severity') ?? ''
    const status = url.searchParams.get('status') ?? ''
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    if (level && !['A', 'B', 'C', 'U', 'UNCLASSIFIED'].includes(level)) {
      return fail(res, 400, `Unknown indicator level ${level}; expected A, B, C, U or UNCLASSIFIED`)
    }
    const matches = (flag) =>
      (!severity || flag.severity === severity) &&
      (!status || flag.status === status) &&
      (!q || `${flag.studentRef} ${flag.triggerLabel}`.toLowerCase().includes(q))
    const levelCounts = { A: 0, B: 0, C: 0, U: 0, UNCLASSIFIED: 0 }
    for (const flag of INDICATOR_FLAGS.filter(matches)) {
      levelCounts[flag.level ?? 'UNCLASSIFIED'] += 1
    }
    const items = INDICATOR_FLAGS.filter(
      (flag) => matches(flag) && (!level || (level === 'UNCLASSIFIED' ? flag.level === null : flag.level === level)),
    )
    return ok(res, {
      items,
      openCount: INDICATOR_FLAGS.filter((f) => OPEN_FLAG_STATUSES.includes(f.status)).length,
      levelCounts,
    })
  }

  const flagDetailMatch = path.match(/^\/api\/v1\/support-flags\/([^/]+)$/)
  if (flagDetailMatch && req.method === 'GET') {
    const flag = INDICATOR_FLAGS.find((f) => f.id === flagDetailMatch[1])
    if (!flag) return fail(res, 404, 'Indicator not found')
    return ok(res, {
      studentReported: { statement: flag.studentStatementSnapshot, triggerLabel: flag.triggerLabel },
      systemMetadata: {
        id: flag.id,
        level: flag.level,
        severity: flag.severity,
        status: flag.status,
        source: flag.source,
        category: flag.category,
        intentId: flag.intentId,
        autoActions: flag.autoActions,
        createdAt: flag.createdAt,
        updatedAt: flag.updatedAt,
        resolvedAt: flag.resolvedAt,
        conversationId: flag.conversationId,
        linkedRequest: flag.linkedRequest,
        ruleId: flag.ruleId,
        ruleVersion: flag.ruleVersion,
        // Mirrors `support-flags.service.ts` exactly: no rule id means no rule
        // label and no configured flag, and the level then has to name the
        // mapping that produced it instead.
        ruleLabel: null,
        ruleConfigured: null,
        ruleBlockedOn: null,
        levelSource: flag.level ? 'INTENT_MAPPING' : null,
        levelSourceVersion: flag.level
          ? 'intent-level-mapping-v1-2026-11-11-pending-psychology-signature'
          : null,
      },
      aiSummary: flag.aiContextSummary,
      humanDecision: {
        reviewDecision: flag.reviewDecision,
        decisions: ['NO_FURTHER_ACTION', 'FOLLOW_UP_WITH_STUDENT', 'FOLLOW_SAFEGUARDING_PROCEDURE'],
      },
      student: { ref: flag.studentRef, classLabel: flag.classLabel },
    })
  }

  // Reported AI replies (Epic G). The pending count the badge quotes is the
  // number of rows here still without a review outcome.
  if (path === '/api/v1/ai-response-reports' && req.method === 'GET') {
    const viewer = sessionUserFor(req)
    if (!['COUNSELLOR', 'PSYCHOLOGIST'].includes(viewer.role)) {
      return fail(res, 403, 'Insufficient permissions for this resource')
    }
    const limit = Number(url.searchParams.get('limit') ?? 20) || 20
    const offset = Number(url.searchParams.get('offset') ?? 0) || 0
    const items = AI_REPORTS.slice(offset, offset + limit)
    return ok(res, { items, nextOffset: offset + items.length < AI_REPORTS.length ? offset + items.length : null })
  }

  // Platform overview
  if (path === '/api/v1/admin/overview') return ok(res, overviewPayload())

  // Hosted inference endpoints. The GET is configuration-only in the real
  // backend and never contacts a replica, so the fixture has no state column;
  // only the wake POST answers with states, and it shows all four outcomes at
  // once so every chip in the panel renders in one run.
  const AI_ENDPOINTS = [
    { id: 'asr-yo', purpose: 'asr', language: 'yo', label: 'Yoruba voice notes', model: 'NCAIR1 whisper-small fine-tune' },
    { id: 'asr-ha', purpose: 'asr', language: 'ha', label: 'Hausa voice notes', model: 'NCAIR1 whisper-small fine-tune' },
    { id: 'asr-ig', purpose: 'asr', language: 'ig', label: 'Igbo voice notes', model: 'NCAIR1 whisper-small fine-tune' },
    { id: 'llm-n-atlas', purpose: 'llm', language: null, label: 'N-ATLaS replies', model: 'NCAIR1/N-ATLaS' },
  ]
  const AI_ENDPOINT_CONFIGURED = { 'asr-yo': true, 'asr-ha': true, 'asr-ig': false, 'llm-n-atlas': true }
  const AI_ENDPOINT_STATES = {
    'asr-yo': ['awake', 200, 318],
    'asr-ha': ['waking', 503, 41],
    'asr-ig': ['not_configured', null, null],
    'llm-n-atlas': ['unreachable', null, 5002],
  }

  if (path === '/api/v1/admin/ai/endpoints' && req.method === 'GET') {
    return ok(res, AI_ENDPOINTS.map((row) => ({
      ...row,
      configured: AI_ENDPOINT_CONFIGURED[row.id] === true,
    })))
  }

  if (path === '/api/v1/admin/ai/endpoints/wake' && req.method === 'POST') {
    return ok(res, AI_ENDPOINTS.map((row) => {
      const [state, httpStatus, latencyMs] = AI_ENDPOINT_STATES[row.id]
      return { ...row, state, httpStatus, latencyMs }
    }))
  }

  // Platform analytics
  if (path === '/api/v1/admin/analytics') {
    const d = Number(url.searchParams.get('days') ?? 14)
    return ok(res, platformAnalytics(d === 30 || d === 90 ? d : 14))
  }

  // Pilot analytics — the wellbeing tab is the widest table-like layout on
  // this page, so the themes carry long labels and a suppressed row.
  if (path === '/api/v1/admin/pilot') {
    const days = Number(url.searchParams.get('days') ?? 30)
    const series = Array.from({ length: Math.min(days, 14) }, (_, i) => ({
      date: new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10),
      activeUsers: 20 + i * 3,
      checkIns: 30 + i * 4,
    }))
    return ok(res, {
      generatedAt: new Date().toISOString(),
      window: { from: '2026-09-26', to: '2026-10-26', days },
      school: null,
      suppression: { threshold: 5, note: 'Themes naming fewer than 5 students are masked.' },
      overview: {
        studentsOnboarded: 412,
        newStudents: 38,
        activeStudents: 196,
        checkIns: 1204,
        aiInteractions: 3310,
        voiceInteractions: 214,
        resourcesAccessed: 640,
        supportRequests: 74,
        completedReferrals: 21,
        avgSatisfaction: { available: true, reason: '' },
      },
      engagement: {
        active: 196,
        dau: 61,
        wau: 143,
        mau: 196,
        new: 38,
        returning: 158,
        returnRate: 71,
        checkInsPerActiveStudent: 6.1,
        avgSessionsPerStudent: 3.4,
        avgSessionMinutes: 8.2,
        textVsVoice: { text: 3096, voice: 214 },
        series,
      },
      featureUsage: [
        { id: 'checkin', label: 'Daily check-in', uses: 1204, students: 196, suppressed: false, available: true },
        { id: 'voice', label: 'Voice messages', uses: 214, students: 63, suppressed: false, available: true },
        { id: 'resources', label: 'Resource library', uses: 640, students: 118, suppressed: false, available: true },
        { id: 'reflection', label: 'Reflection', uses: 4, students: null, suppressed: true, available: true },
      ],
      wellbeingThemes: [
        { id: 'school-pressure', label: 'School workload and exam pressure', mentions: 412, students: 168, suppressed: false },
        { id: 'family', label: 'Family expectations at home', mentions: 286, students: 131, suppressed: false },
        { id: 'friendship', label: 'Friendship and belonging', mentions: 194, students: 97, suppressed: false },
        { id: 'money', label: 'Money and basic needs', mentions: 88, students: 41, suppressed: false },
        { id: 'health', label: 'Health and sleep', mentions: 37, students: 19, suppressed: false },
        { id: 'faith', label: 'Faith and community', mentions: 9, students: null, suppressed: true },
      ],
      outcomes: { available: true, reason: '' },
      resources: {
        note: 'Saves are per student, not per view.',
        mostSaved: [
          { id: 'r1', title: 'Calming your mind before an exam', saves: 84, students: 71, suppressed: false },
          { id: 'r2', title: 'Talking to a parent about grades', saves: 52, students: 44, suppressed: false },
        ],
        byCategory: [
          { category: 'Exam stress', saves: 140, students: 98, suppressed: false },
          { category: 'Relationships', saves: 63, students: 51, suppressed: false },
        ],
        savesSeries: series.map((p) => ({ date: p.date, saves: p.activeUsers })),
        activities: { started: 320, completed: 214, completionRate: 67 },
      },
      support: {
        requests: { total: 74, urgent: 6, byStatus: { NEW: 12, REVIEWED: 40, FOLLOW_UP_REQUIRED: 14, FOLLOW_UP_COMPLETED: 8 } },
        referrals: { created: 26, claimed: 23, closed: 21, avgClaimHours: 5.4 },
        followUps: { completed: 8, open: 14 },
        unresolved: 12,
        series: series.map((p) => ({ date: p.date, requests: Math.round(p.activeUsers / 5), threads: Math.round(p.activeUsers / 3) })),
      },
      safeguarding: {
        flags: { total: 17, bySeverity: { TIER_1: 9, TIER_2: 5, TIER_3: 3 }, byStatus: { OPEN: 4, REVIEWED: 13 } },
        escalations: 3,
        urgentRequests: 6,
        followUpStatus: { open: 4, resolved: 13 },
        avgResolutionHours: 9.1,
      },
    })
  }

  // Platform activity
  if (path === '/api/v1/admin/activity') {
    const kind = url.searchParams.get('kind') ?? 'all'
    if (!['all', 'schools', 'people', 'chat'].includes(kind)) return fail(res, 422, 'Unknown activity kind.', 'VALIDATION_ERROR')
    return ok(res, { items: activityFor({ kind, limit: Number(url.searchParams.get('limit') ?? 50) }) })
  }

  // Platform users register
  if (path === '/api/v1/admin/users') {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const role = url.searchParams.get('role') ?? ''
    const schoolId = url.searchParams.get('schoolId') ?? ''
    if (role && !ROLES.has(role)) return fail(res, 422, 'Unknown role.', 'VALIDATION_ERROR')
    let items = [...users]
    if (q) items = items.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    if (role) items = items.filter((u) => u.role === role)
    if (schoolId) items = items.filter((u) => u.schoolId === schoolId)
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const total = items.length
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 100)
    const offset = Number(url.searchParams.get('offset') ?? 0) || 0
    items = items.slice(offset, offset + limit)
    return ok(res, {
      items: items.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, schoolId: u.schoolId, emailVerified: u.emailVerified, createdAt: u.createdAt, school: u.schoolId ? schoolUrl(schools.find((x) => x.id === u.schoolId)) : null })),
      total,
    })
  }

  // Schools register — paged by cursor, with the search and status filter
  // answered server-side, exactly like the backend. A page of 25 must not be
  // able to hide a match, so the mock filters before it slices.
  if (path === '/api/v1/schools' && req.method === 'GET') {
    const take = Math.min(Math.max(Number(url.searchParams.get('take')) || 25, 1), 100)
    const before = url.searchParams.get('before')
    const needle = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const status = url.searchParams.get('status') ?? ''
    if (status && !['ACTIVE', 'SUSPENDED'].includes(status)) {
      return fail(res, 400, `Unknown school status: ${status}`)
    }
    let pool = [...schools].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    if (before) pool = pool.filter((x) => x.createdAt < before)
    if (status) pool = pool.filter((x) => x.status === status)
    if (needle) {
      pool = pool.filter(
        (x) => x.name.toLowerCase().includes(needle) || x.shortCode.toLowerCase().includes(needle),
      )
    }
    const total = pool.length
    const rows = pool.slice(0, take + 1)
    const items = rows.slice(0, take)
    const last = items.at(-1)
    return ok(res, {
      items: items.map(schoolRow),
      total,
      page: { take, hasMore: rows.length > take, nextBefore: last ? last.createdAt : null },
    })
  }
  if (path === '/api/v1/schools' && req.method === 'POST') {
    const body = JSON.parse((await readBody(req)) || '{}')
    const name = String(body.name ?? '').trim()
    if (name.length < 2 || name.length > 120) return fail(res, 400, 'name must be between 2 and 120 characters', 'VALIDATION_ERROR')
    const letters = name.split(/\s+/).map((word) => word.replace(/[^a-zA-Z]/g, '')).filter(Boolean)
    let base = (letters.map((word) => word[0]).join('') || 'SC').toUpperCase().slice(0, 3)
    if (base.length < 2) base = (base + 'X').slice(0, 2)
    while (schools.some((x) => x.shortCode === base)) base = base.slice(0, 2) + String.fromCharCode(65 + (base.charCodeAt(2) % 26 || 0))
    let code = base
    let n = 0
    while (schools.some((x) => x.shortCode === code)) code = `${base}${++n}`
    const school = { id: `sch-new-${schools.length + 1}`, name, shortCode: code, domain: 'school.test', status: 'ACTIVE', createdAt: new Date().toISOString(), students: 0, professionals: 0, admins: 0, lastActivityAt: null, hasDefaultPassword: !!body.defaultPassword, seed: 97 + schools.length, deactivatedStudents: [], threads: [] }
    schools.push(school)
    ACTIVITY.unshift({ id: `act-new-${schools.length}`, action: 'school.created', kind: 'schools', entity: 'school', entityId: school.id, meta: null, createdAt: new Date().toISOString(), actor: A_IBRAHIM, school: schoolUrl(school) })
    return ok(res, { id: school.id, name: school.name, shortCode: school.shortCode, status: school.status })
  }

  // School user lifecycle — /schools/:id/users/:userId(/reactivate|/reset-password)
  const schoolUserMatch = path.match(/^\/api\/v1\/schools\/([^/]+)\/users\/([^/]+)(?:\/(reactivate|reset-password))?$/)
  if (schoolUserMatch) {
    const school = schools.find((x) => x.id === schoolUserMatch[1])
    if (!school) return fail(res, 404, 'School not found.', 'NOT_FOUND')
    const member = users.find((u) => u.id === schoolUserMatch[2] && u.schoolId === school.id)
    if (!member) return fail(res, 404, 'User not found in this school')
    const actor = sessionUserFor(req)
    const action = schoolUserMatch[3]

    if (!action && req.method === 'PATCH') {
      const body = JSON.parse((await readBody(req)) || '{}')
      if (body.name !== undefined) member.name = String(body.name).trim()
      if (body.phone !== undefined) member.phone = String(body.phone).trim()
      if (member.studentProfile) {
        if (body.classLabel !== undefined) member.studentProfile.classLabel = String(body.classLabel).trim()
        if (body.preferredLanguage !== undefined) member.studentProfile.preferredLanguage = String(body.preferredLanguage).trim()
      }
      if (member.professionalProfile) {
        if (body.title !== undefined) member.professionalProfile.title = String(body.title).trim()
        if (body.department !== undefined) member.professionalProfile.department = String(body.department).trim()
      }
      ACTIVITY.unshift({ id: `act-userupd-${Date.now()}`, action: 'school.user_updated', kind: 'people', entity: 'user', entityId: member.id, meta: { schoolId: school.id }, createdAt: new Date().toISOString(), actor: actorOf(actor), school: schoolUrl(school) })
      return ok(res, { updated: true })
    }
    if (!action && req.method === 'DELETE') {
      if (member.id === actor.id) return fail(res, 403, 'You cannot perform this action on your own account.', 'SELF_TARGET_FORBIDDEN')
      if (member.role === 'PLATFORM_ADMIN') return fail(res, 403, 'Platform admin accounts cannot be managed from a school.', 'PLATFORM_ADMIN_TARGET_FORBIDDEN')
      member.deactivatedAt = new Date().toISOString()
      ACTIVITY.unshift({ id: `act-userdeact-${Date.now()}`, action: 'school.user_deactivated', kind: 'people', entity: 'user', entityId: member.id, meta: { schoolId: school.id }, createdAt: new Date().toISOString(), actor: actorOf(actor), school: schoolUrl(school) })
      return ok(res, { id: member.id, deactivated: true })
    }
    if (action === 'reactivate' && req.method === 'POST') {
      member.deactivatedAt = null
      ACTIVITY.unshift({ id: `act-userreact-${Date.now()}`, action: 'school.user_reactivated', kind: 'people', entity: 'user', entityId: member.id, meta: { schoolId: school.id }, createdAt: new Date().toISOString(), actor: actorOf(actor), school: schoolUrl(school) })
      return ok(res, { id: member.id, deactivated: false })
    }
    if (action === 'reset-password' && req.method === 'POST') {
      if (member.id === actor.id) return fail(res, 403, 'You cannot perform this action on your own account.', 'SELF_TARGET_FORBIDDEN')
      if (member.role === 'PLATFORM_ADMIN') return fail(res, 403, 'Platform admin accounts cannot be managed from a school.', 'PLATFORM_ADMIN_TARGET_FORBIDDEN')
      if (!school.hasDefaultPassword) return fail(res, 422, 'Set the school default password in settings before onboarding users.', 'SCHOOL_DEFAULT_PASSWORD_REQUIRED')
      member.mustChangePassword = true
      ACTIVITY.unshift({ id: `act-userreset-${Date.now()}`, action: 'school.user_password_reset', kind: 'people', entity: 'user', entityId: member.id, meta: { schoolId: school.id }, createdAt: new Date().toISOString(), actor: actorOf(actor), school: schoolUrl(school) })
      return ok(res, { id: member.id, passwordReset: true })
    }
    return fail(res, 404, 'Not found.')
  }

  // School-scoped routes
  const schoolMatch = path.match(/^\/api\/v1\/schools\/([^/]+)(?:\/(settings|analytics|activity|chat-threads|users|overview|suspend|reactivate|admins|students|professionals))?$/)
  if (schoolMatch) {
    const school = schools.find((x) => x.id === schoolMatch[1])
    const sub = schoolMatch[2]
    if (!school) return fail(res, 404, 'School not found.', 'NOT_FOUND')
    const d = Number(url.searchParams.get('days') ?? 14)

    if (!sub && req.method === 'PATCH') {
      const body = JSON.parse((await readBody(req)) || '{}')
      const name = String(body.name ?? '').trim()
      if (name.length < 2 || name.length > 120) return fail(res, 400, 'name must be between 2 and 120 characters', 'VALIDATION_ERROR')
      const previousName = school.name
      school.name = name
      ACTIVITY.unshift({ id: `act-rename-${Date.now()}`, action: 'school.renamed', kind: 'schools', entity: 'school', entityId: school.id, meta: { from: previousName, to: name }, createdAt: new Date().toISOString(), actor: A_IBRAHIM, school: schoolUrl(school) })
      return ok(res, { id: school.id, name: school.name, shortCode: school.shortCode, status: school.status })
    }
    if (sub === 'suspend' && req.method === 'POST') {
      school.status = 'SUSPENDED'
      return ok(res, { id: school.id, status: school.status })
    }
    if (sub === 'reactivate' && req.method === 'POST') {
      school.status = 'ACTIVE'
      return ok(res, { id: school.id, status: school.status })
    }
    if (sub === 'settings' && req.method === 'GET') {
      return ok(res, { id: school.id, name: school.name, shortCode: school.shortCode, status: school.status, createdAt: school.createdAt, hasDefaultPassword: school.hasDefaultPassword })
    }
    if (sub === 'settings' && req.method === 'PATCH') {
      const body = JSON.parse((await readBody(req)) || '{}')
      const defaultPassword = String(body.defaultPassword ?? '')
      if (defaultPassword.length < 8) return fail(res, 400, 'defaultPassword must be longer than or equal to 8 characters', 'VALIDATION_ERROR')
      school.hasDefaultPassword = true
      ACTIVITY.unshift({ id: `act-settings-${Date.now()}`, action: 'school.settings_updated', kind: 'schools', entity: 'school', entityId: school.id, meta: { defaultPasswordUpdated: true }, createdAt: new Date().toISOString(), actor: actorOf(sessionUserFor(req)), school: schoolUrl(school) })
      return ok(res, { defaultPasswordUpdated: true })
    }
    if (sub === 'analytics' && req.method === 'GET') {
      return ok(res, { ...analyticsFor(school, d === 30 || d === 90 ? d : 14), roster: rosterFor(school), onboarding: onboardingFor(school) })
    }
    if (sub === 'overview' && req.method === 'GET') {
      return ok(res, { students: users.filter((u) => u.schoolId === school.id && u.role === 'STUDENT').length, professionals: users.filter((u) => u.schoolId === school.id && u.professionalProfile).length, totalUsers: users.filter((u) => u.schoolId === school.id).length, pendingChatRequests: school.threads.filter((t) => t.status === 'PENDING').length })
    }
    if (sub === 'activity' && req.method === 'GET') {
      const kind = url.searchParams.get('kind') ?? 'all'
      if (!['all', 'schools', 'people', 'chat'].includes(kind)) return fail(res, 422, 'Unknown activity kind.', 'VALIDATION_ERROR')
      return ok(res, { items: activityFor({ kind, schoolId: school.id, limit: Number(url.searchParams.get('limit') ?? 50) }) })
    }
    if (sub === 'chat-threads' && req.method === 'GET') {
      const status = url.searchParams.get('status')
      if (status && !['PENDING', 'ACTIVE', 'CLOSED'].includes(status)) return fail(res, 422, 'Unknown status.', 'VALIDATION_ERROR')
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 50) || 50, 100)
      let items = [...school.threads].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      if (status) items = items.filter((t) => t.status === status)
      return ok(res, { items: items.slice(0, limit).map(adminThreadRowOf) })
    }
    if (sub === 'users' && req.method === 'GET') {
      const role = url.searchParams.get('role')
      let items = users.filter((u) => u.schoolId === school.id)
      if (role) items = items.filter((u) => u.role === role)
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return ok(res, { items: items.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, emailVerified: u.emailVerified, mustChangePassword: u.mustChangePassword, deactivatedAt: u.deactivatedAt, createdAt: u.createdAt, studentProfile: u.studentProfile, professionalProfile: u.professionalProfile })) })
    }
    if (sub === 'students' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}')
      if (!school.hasDefaultPassword) return fail(res, 422, 'Set the school default password in settings before onboarding users.', 'SCHOOL_DEFAULT_PASSWORD_REQUIRED')
      const email = String(body.email ?? '').trim().toLowerCase()
      if (users.some((u) => u.email.toLowerCase() === email)) return fail(res, 422, 'An account with this email already exists.')
      const firstName = String(body.firstName ?? '').trim()
      if (!firstName) return fail(res, 400, 'firstName should not be empty', 'VALIDATION_ERROR')
      const lastName = body.lastName !== undefined && String(body.lastName).trim() ? String(body.lastName).trim() : null
      const studentCode = `${school.shortCode}-${String(users.filter((u) => u.schoolId === school.id && u.role === 'STUDENT').length + 1).padStart(4, '0')}`
      const created = pushUser({ school, role: 'STUDENT', email, name: [firstName, lastName].filter(Boolean).join(' '), mustChangePassword: true, emailVerified: false, createdAt: new Date().toISOString() })
      created.studentProfile = {
        studentCode,
        firstName,
        lastName,
        classLabel: body.classLabel !== undefined ? String(body.classLabel).trim() : null,
        preferredLanguage: body.preferredLanguage !== undefined ? String(body.preferredLanguage).trim() : 'en',
      }
      ACTIVITY.unshift({ id: `act-student-${Date.now()}`, action: 'school.student_enrolled', kind: 'people', entity: 'user', entityId: created.id, meta: { schoolId: school.id, studentCode }, createdAt: new Date().toISOString(), actor: actorOf(sessionUserFor(req)), school: schoolUrl(school) })
      return ok(res, { user: { id: created.id, name: created.name, email: created.email, role: created.role }, studentCode, verificationEmailSent: true })
    }
    if (sub === 'professionals' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}')
      if (!school.hasDefaultPassword) return fail(res, 422, 'Set the school default password in settings before onboarding users.', 'SCHOOL_DEFAULT_PASSWORD_REQUIRED')
      const email = String(body.email ?? '').trim().toLowerCase()
      if (users.some((u) => u.email.toLowerCase() === email)) return fail(res, 422, 'An account with this email already exists.')
      const role = String(body.role ?? '')
      if (!PRO_ROLES.includes(role)) return fail(res, 400, `role must be one of the following values: ${PRO_ROLES.join(', ')}`, 'VALIDATION_ERROR')
      const name = String(body.name ?? '').trim()
      if (name.length < 2) return fail(res, 400, 'name must be longer than or equal to 2 characters', 'VALIDATION_ERROR')
      const created = pushUser({ school, role, email, name, mustChangePassword: true, emailVerified: false, createdAt: new Date().toISOString() })
      created.professionalProfile = {
        title: body.title !== undefined ? String(body.title).trim() : null,
        department: body.department !== undefined ? String(body.department).trim() : null,
        available: true,
      }
      ACTIVITY.unshift({ id: `act-pro-${Date.now()}`, action: 'school.professional_enrolled', kind: 'people', entity: 'user', entityId: created.id, meta: { schoolId: school.id, role }, createdAt: new Date().toISOString(), actor: actorOf(sessionUserFor(req)), school: schoolUrl(school) })
      return ok(res, { user: { id: created.id, name: created.name, email: created.email, role: created.role }, verificationEmailSent: true })
    }
    if (sub === 'admins' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)) || '{}')
      if (!school.hasDefaultPassword) return fail(res, 422, 'Set the school default password in settings before onboarding users.', 'SCHOOL_DEFAULT_PASSWORD_REQUIRED')
      const email = String(body.email ?? '').trim().toLowerCase()
      if (users.some((u) => u.email.toLowerCase() === email)) return fail(res, 422, 'An account with this email already exists.')
      const created = pushUser({ school, role: 'SCHOOL_ADMIN', email, mustChangePassword: true, emailVerified: false, name: String(body.name ?? '').trim() || 'School Admin', createdAt: new Date().toISOString() })
      ACTIVITY.unshift({ id: `act-admin-${Date.now()}`, action: 'school.admin_enrolled', kind: 'people', entity: 'user', entityId: created.id, meta: { role: 'SCHOOL_ADMIN' }, createdAt: new Date().toISOString(), actor: A_IBRAHIM, school: schoolUrl(school) })
      return ok(res, { user: { id: created.id, name: created.name, email: created.email, role: 'SCHOOL_ADMIN' }, verificationEmailSent: true })
    }
    return fail(res, 404, 'Not found.')
  }

  return fail(res, 404, `No mock for ${req.method} ${path}`)
}

// --- Quiet Socket.IO stub ---------------------------------------------------

const socketState = { nsConnected: false, nsAckSent: false }

function wsFrame(payload) {
  const data = Buffer.from(payload, 'utf8')
  let header
  if (data.length < 126) header = Buffer.from([0x81, data.length])
  else if (data.length < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(data.length, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 127
    header.writeBigUInt64BE(BigInt(data.length), 2)
  }
  return Buffer.concat([header, data])
}

function parseFrames(buffer) {
  const frames = []
  let rest = buffer
  while (rest.length >= 2) {
    const opcode = rest[0] & 0x0f
    const masked = (rest[1] & 0x80) !== 0
    let length = rest[1] & 0x7f
    let offset = 2
    if (length === 126) {
      if (rest.length < 4) break
      length = rest.readUInt16BE(2)
      offset = 4
    } else if (length === 127) {
      if (rest.length < 10) break
      length = Number(rest.readBigUInt64BE(2))
      offset = 10
    }
    let maskKey = null
    if (masked) {
      if (rest.length < offset + 4) break
      maskKey = rest.subarray(offset, offset + 4)
      offset += 4
    }
    if (rest.length < offset + length) break
    let payload = rest.subarray(offset, offset + length)
    if (masked) {
      payload = Buffer.from(payload)
      for (let i = 0; i < payload.length; i++) payload[i] ^= maskKey[i % 4]
    }
    frames.push({ opcode, payload: payload.toString('utf8') })
    rest = rest.subarray(offset + length)
  }
  return { frames, rest }
}

function attachSocketStub(httpServer) {
  httpServer.on('upgrade', (req, socket) => {
    if (!req.url?.startsWith('/api/socket.io')) return
    const key = req.headers['sec-websocket-key']
    if (!key) return socket.destroy()
    const accept = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
    const send = (payload) => {
      if (!socket.destroyed) socket.write(wsFrame(payload))
    }
    send('0' + JSON.stringify({ sid: 'mockws', upgrades: [], pingInterval: 25000, pingTimeout: 20000 }))
    let buffer = Buffer.alloc(0)
    socket.on('data', (chunk) => {
      const parsed = parseFrames(Buffer.concat([buffer, chunk]))
      buffer = parsed.rest
      for (const frame of parsed.frames) {
        if (frame.opcode === 8) return socket.end()
        if (frame.opcode !== 1) continue
        if (frame.payload === '40') send('40' + JSON.stringify({ sid: 'mockns' }))
      }
    })
    const ping = setInterval(() => send('2'), 25000)
    socket.on('close', () => clearInterval(ping))
    socket.on('error', () => clearInterval(ping))
  })
}

// --- Plugin -----------------------------------------------------------------

function mockApi() {
  return {
    name: 'mock-natlas-api',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(handler)
      if (server.httpServer) attachSocketStub(server.httpServer)
    },
  }
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [mockApi(), devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
})
