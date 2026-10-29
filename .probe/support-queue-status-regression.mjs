// UI-only regression for the staff "Support requests" queue.
// Run: node <absolute path to this file>
// Starts ONLY an isolated Edge/profile; uses the existing Vite server on :5050.
// All /api/ HTTP and WebSocket traffic is synthetic. No credentials or real input.
//
// What it pins down, in the order the fixes were made:
//   1 urgency is a visible column and orders the table (urgent before newest)
//   2 the lifecycle is never collapsed — each stored status renders its own pill,
//     and every chip number is exactly the rows clicking it shows (search included)
//   3 a SCHEDULED review carries a real time and place into the PATCH body
//   5 opening the review dialog arms nothing: Save stays off until a change
//
// The harness mirrors the backend derivation (matchesQueueFilter, deriveUrgency,
// the 7-day window) so the DOM is compared against the contract, not a guess.
// Fix 4 (the student is notified) is a backend write and is covered by specs.
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('./', import.meta.url))
const OUT = fileURLToPath(new URL('./shots/', import.meta.url))
const ORIGIN = 'http://localhost:5050'
const PAGE = '/school/requests'
const STAFF_ID = 'fixture-counsellor'
const DAY = 24 * 60 * 60 * 1000
const ago = (days) => new Date(Date.now() - days * DAY).toISOString()
const ahead = (days) => new Date(Date.now() + days * DAY).toISOString()

const report = {
  assertions: [],
  requests: [],
  screenshots: [],
  errors: [],
  unknownApi: [],
  harnessErrors: [],
}
const user = {
  id: STAFF_ID,
  name: 'A. Counsellor',
  email: 'counsellor@example.test',
  role: 'COUNSELLOR',
  emailVerified: true,
  mustChangePassword: false,
  schoolId: 'fixture-school',
  school: { id: 'fixture-school', name: 'Greenstead School', shortCode: 'GSS' },
}

// One row per stored lifecycle value, plus the shapes the old code collapsed.
const REQUESTS = [
  {
    id: 'sq-urgent-stale',
    status: 'PENDING',
    timing: 'URGENT_UNSAFE',
    createdAt: ago(5),
    student: { first: 'Uduak', last: 'E', code: 'GSS/2026/0101', email: 'uduak@example.test' },
    followUps: [],
    prompt: 'REVIEW_SUGGESTED',
    note: 'I do not feel safe in the dormitory at night.',
  },
  {
    id: 'sq-escalated',
    status: 'ESCALATED',
    timing: 'TODAY_STUDY_PERIOD',
    createdAt: ago(4),
    student: { first: 'Tobi', last: 'A', code: 'GSS/2026/0102', email: 'tobi@example.test' },
    followUps: [],
    prompt: 'NONE',
  },
  {
    id: 'sq-fresh-accepted',
    status: 'ACCEPTED',
    timing: 'GENTLE_1_2_DAYS',
    createdAt: ago(0.007),
    reviewNote: 'Met during break, agreed to check in again.',
    student: { first: 'Amara', last: 'N', code: 'GSS/2026/0103', email: 'amara@example.test' },
    followUps: [],
    prompt: 'NONE',
  },
  {
    id: 'sq-new-followup',
    status: 'PENDING',
    timing: 'GENTLE_1_2_DAYS',
    createdAt: ago(0.04),
    student: { first: 'Zainab', last: 'M', code: 'GSS/2026/0104', email: 'zainab@example.test' },
    followUps: [{ id: 'fu-mine', status: 'SCHEDULED', dueAt: ahead(2), owner: STAFF_ID }],
    prompt: 'NONE',
  },
  {
    id: 'sq-scheduled',
    status: 'SCHEDULED',
    timing: 'TODAY_STUDY_PERIOD',
    createdAt: ago(2),
    scheduledAt: ahead(3),
    locationLabel: 'Counselling office, Block C',
    student: { first: 'Chidi', last: 'O', code: 'GSS/2026/0105', email: 'chidi@example.test' },
    followUps: [],
    prompt: 'NONE',
  },
  {
    id: 'sq-in-progress',
    status: 'IN_PROGRESS',
    timing: 'GENTLE_1_2_DAYS',
    createdAt: ago(3),
    student: { first: 'Funke', last: 'D', code: 'GSS/2026/0106', email: 'funke@example.test' },
    followUps: [{ id: 'fu-theirs', status: 'PENDING', dueAt: ahead(1), owner: 'other-staff' }],
    prompt: 'REVIEW_SUGGESTED',
  },
  {
    id: 'sq-done-this-week',
    status: 'COMPLETED',
    timing: 'GENTLE_1_2_DAYS',
    createdAt: ago(6),
    student: { first: 'Ijeoma', last: 'P', code: 'GSS/2026/0107', email: 'ijeoma@example.test' },
    followUps: [{ id: 'fu-new', status: 'COMPLETED', completedAt: ago(2), owner: STAFF_ID }],
    prompt: 'NONE',
  },
  {
    id: 'sq-done-ages',
    status: 'COMPLETED',
    timing: 'GENTLE_1_2_DAYS',
    createdAt: ago(25),
    student: { first: 'Sade', last: 'K', code: 'GSS/2026/0108', email: 'sade@example.test' },
    followUps: [{ id: 'fu-old', status: 'COMPLETED', completedAt: ago(20), owner: STAFF_ID }],
    prompt: 'NONE',
  },
  // Cancelled never enters the queue at all.
  {
    id: 'sq-cancelled',
    status: 'CANCELLED',
    timing: 'URGENT_UNSAFE',
    createdAt: ago(1),
    student: { first: 'Musa', last: 'B', code: 'GSS/2026/0109', email: 'musa@example.test' },
    followUps: [],
    prompt: 'NONE',
  },
]

const ACTED = ['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED']
const OPEN_FOLLOW_UPS = ['PENDING', 'SCHEDULED']
const queueStatusOf = (r) => (ACTED.includes(r.status) ? 'REVIEWED' : 'NEW')
const urgencyOf = (r) =>
  r.timing === 'URGENT_UNSAFE' || r.status === 'ESCALATED' ? 'URGENT' : 'NORMAL'
const followUpStateOf = (r) => {
  if (r.followUps.some((f) => OPEN_FOLLOW_UPS.includes(f.status))) return 'REQUIRED'
  if (r.followUps.some((f) => f.status === 'COMPLETED')) return 'COMPLETED'
  return 'NONE'
}
const matchesFilter = (r, filter) => {
  if (filter === 'FOLLOW_UP_REQUIRED') return followUpStateOf(r) === 'REQUIRED'
  if (filter === 'FOLLOW_UP_COMPLETED') return followUpStateOf(r) === 'COMPLETED'
  return queueStatusOf(r) === filter
}

function toItem(r) {
  const open = r.followUps
    .filter((f) => OPEN_FOLLOW_UPS.includes(f.status))
    .sort((a, b) => String(a.dueAt ?? '').localeCompare(String(b.dueAt ?? '')))
  const selected = open[0]
  const lastCompleted = r.followUps
    .filter((f) => f.status === 'COMPLETED')
    .map((f) => f.completedAt)
    .sort()
    .at(-1) ?? null
  return {
    id: r.id,
    requestedAt: r.createdAt,
    timing: r.timing,
    note: r.note ?? null,
    initialMessage: r.note ?? null,
    initialMessageAt: r.note ? r.createdAt : null,
    reviewNote: r.reviewNote ?? null,
    requestStatus: r.status,
    queueStatus: queueStatusOf(r),
    followUpState: followUpStateOf(r),
    urgency: urgencyOf(r),
    prompt: r.prompt,
    scheduledAt: r.scheduledAt ?? null,
    locationLabel: r.locationLabel ?? null,
    followUpId: selected?.id ?? null,
    followUpStatus: selected?.status ?? null,
    canManageFollowUp: selected ? selected.owner === STAFF_ID : false,
    followUpDueAt: selected?.dueAt ?? null,
    followUpCompletedAt: lastCompleted,
    conversationId: r.prompt === 'REVIEW_SUGGESTED' ? `conv-${r.id}` : null,
    student: {
      id: `stu-${r.id}`,
      firstName: r.student.first,
      lastName: r.student.last,
      displayName: null,
      classLabel: 'SS2B',
      studentCode: r.student.code,
      studentRef: null,
      email: r.student.email,
    },
    supportPerson: { id: 'sp-1', name: 'A. Counsellor', type: 'COUNSELLOR' },
  }
}

/** The endpoint contract: search narrows the view, counts describe the view. */
function queueResponse(searchParams) {
  const status = searchParams.get('status')
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()
  const live = REQUESTS.filter((r) => r.status !== 'CANCELLED')
  const searched = q
    ? live.filter((r) =>
        [r.student.code, r.student.email].some((v) => v.toLowerCase().includes(q)),
      )
    : live
  const now = Date.now()
  const counts = {
    all: searched.length,
    new: 0,
    reviewed: 0,
    followUpRequired: 0,
    followUpCompleted: 0,
    completedThisWeek: 0,
  }
  for (const r of searched) {
    if (matchesFilter(r, 'NEW')) counts.new += 1
    if (matchesFilter(r, 'REVIEWED')) counts.reviewed += 1
    if (matchesFilter(r, 'FOLLOW_UP_REQUIRED')) counts.followUpRequired += 1
    if (matchesFilter(r, 'FOLLOW_UP_COMPLETED')) counts.followUpCompleted += 1
    if (r.followUps.some((f) => f.completedAt && now - Date.parse(f.completedAt) < 7 * DAY)) {
      counts.completedThisWeek += 1
    }
  }
  const items = searched
    .slice()
    .sort((a, b) => {
      if (urgencyOf(a) !== urgencyOf(b)) return urgencyOf(a) === 'URGENT' ? -1 : 1
      return Date.parse(b.createdAt) - Date.parse(a.createdAt)
    })
    .filter((r) => !status || matchesFilter(r, status))
    .map(toItem)
  return { items, counts }
}

let phase = 'startup'
const patches = []
const assert = (name, ok, detail) => {
  const item = { phase, name, pass: !!ok, detail }
  report.assertions.push(item)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${phase}: ${name} ${JSON.stringify(detail ?? '')}`)
}

class Cdp {
  id = 0
  waiters = new Map()
  async connect(url) {
    this.ws = new WebSocket(url)
    await new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, { once: true }); this.ws.addEventListener('error', reject, { once: true }) })
    this.ws.addEventListener('message', ({ data }) => {
      const msg = JSON.parse(data)
      if (msg.id) {
        const waiter = this.waiters.get(msg.id)
        if (!waiter) return
        clearTimeout(waiter.timer)
        this.waiters.delete(msg.id)
        msg.error ? waiter.reject(new Error(JSON.stringify(msg.error))) : waiter.resolve(msg.result)
      } else this.onEvent?.(msg.method, msg.params)
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiters.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
      this.waiters.set(id, { resolve, reject, timer })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async eval(expression) {
    const value = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails))
    return value.result.value
  }
  close() { this.ws?.close() }
}

const INIT = `(() => {
  sessionStorage.clear();
  const NativeWebSocket = window.WebSocket;
  window.WebSocket = new Proxy(NativeWebSocket, { construct(Target, args) {
    const url = new URL(args[0], location.href);
    if (!url.pathname.startsWith('/api/')) return Reflect.construct(Target, args);
    const socket = new EventTarget();
    Object.assign(socket, { url: url.href, readyState: 0, bufferedAmount: 0, extensions: '', protocol: '', binaryType: 'arraybuffer' });
    const emit = (type, event) => { socket.dispatchEvent(event); socket['on' + type]?.(event); };
    socket.send = () => {};
    socket.close = () => { socket.readyState = 3; emit('close', new CloseEvent('close', { code: 1000, wasClean: true })); };
    setTimeout(() => { socket.readyState = 1; emit('open', new Event('open')); emit('message', new MessageEvent('message', { data: '0{"sid":"fixture-socket","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":100000}' })); }, 0);
    return socket;
  }});
  const setValue = (el, value) => {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  window.__setField = (which, value) => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return 'no dialog';
    let el = null;
    if (which === 'status') el = dialog.querySelector('select');
    if (which === 'note') el = dialog.querySelector('textarea');
    if (which === 'when') el = dialog.querySelector('input[type="datetime-local"]');
    if (which === 'where') {
      const label = [...dialog.querySelectorAll('label')].find(l => /^\\s*Where/.test(l.textContent));
      el = label ? label.querySelector('input') : null;
    }
    if (!el) return 'no ' + which + ' field';
    setValue(el, value);
    return 'ok';
  };
  window.__clickRow = (code) => {
    const row = [...document.querySelectorAll('main ul li button')].find(b => b.innerText.includes(code));
    if (!row) return 'no row ' + code;
    row.click();
    return 'clicked';
  };
  window.__clickChip = (label) => {
    const chip = [...document.querySelectorAll('div[role="group"][aria-label="Filter by status"] button')].find(b => b.textContent.trim().startsWith(label));
    if (!chip) return 'no chip';
    chip.click();
    return 'clicked';
  };
  window.__clickDialogButton = (text) => {
    const dialog = document.querySelector('[role="dialog"]');
    const button = dialog && [...dialog.querySelectorAll('button')].find(b => b.textContent.trim() === text);
    if (!button) return 'no button';
    button.click();
    return 'clicked';
  };
  window.__pillTexts = el => [...el.querySelectorAll('span[class*="rounded-pill"]')].map(p => p.innerText.trim());
  window.__ui = () => {
    const chips = [...document.querySelectorAll('div[role="group"][aria-label="Filter by status"] button')].map(b => b.innerText.trim());
    const rows = [...document.querySelectorAll('main ul li button')].map(b => {
      const lines = b.innerText.split('\\n').map(t => t.trim()).filter(Boolean);
      // The row's own text leads with the avatar's initials, so identity comes
      // from the student code, which only the row carries.
      const code = (b.innerText.match(/GSS\\/\\d{4}\\/\\d{4}/) || [''])[0];
      return { code, name: lines[1] ?? '', urgent: b.innerText.includes('Does not feel safe'), pills: window.__pillTexts(b) };
    });
    const tiles = [...document.querySelectorAll('main div[class*="rounded-panel"]')].slice(0, 3).map(d => d.innerText.replace(/\\s+/g, ' ').trim());
    const dialog = document.querySelector('[role="dialog"]');
    const save = dialog ? [...dialog.querySelectorAll('button')].find(b => /Save review|Saving/.test(b.textContent)) : null;
    const dl = dialog ? dialog.querySelector('dl') : null;
    return {
      chips, rows, tiles,
      empty: !!document.body.innerText.includes('No requests in this view'),
      caption: (document.querySelector('main p[class*="text-caption"]') || {}).innerText,
      dialog: dialog ? {
        title: dialog.querySelector('h2')?.innerText.trim(),
        text: dialog.innerText.replace(/\\s+/g, ' '),
        status: dialog.querySelector('select')?.value ?? null,
        note: dialog.querySelector('textarea')?.value ?? null,
        when: [...dialog.querySelectorAll('input[type="datetime-local"]')].map(i => i.value),
        where: ([...dialog.querySelectorAll('label')].find(l => /^\\s*Where/.test(l.textContent))?.querySelector('input') || {}).value ?? null,
        saveDisabled: save ? save.disabled : null,
        saveText: save ? save.textContent.trim() : null,
        facts: dl ? [...dl.children].map(n => n.innerText.replace(/\\s+/g, ' ').trim()) : [],
      } : null,
    };
  };
})()`

let edge, profile, browser, cdp
async function ready(predicate, label = predicate) {
  const result = await cdp.eval(`new Promise(resolve => { const start = performance.now(); const poll = () => { if (${predicate}) resolve(true); else if (performance.now() - start > 15000) resolve(false); else requestAnimationFrame(poll); }; poll(); })`)
  if (!result) throw new Error(`UI wait failed: ${label}; ${await cdp.eval('document.body.innerText.slice(0,800)')}`)
}
async function settle() { await cdp.eval('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))') }
async function ui() { await settle(); return cdp.eval('__ui()') }
async function shot(name) { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const path = `${OUT}${name}.png`; await writeFile(path, Buffer.from(data, 'base64')); report.screenshots.push(path) }

async function run() {
  profile = await mkdtemp(`${ROOT}support-queue-edge-`)
  edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const wsUrl = await new Promise((resolve, reject) => {
    let stderr = ''
    const timeout = setTimeout(() => reject(new Error(`Edge startup timeout: ${stderr.slice(-1500)}`)), 20000)
    edge.on('error', reject)
    edge.stderr.on('data', chunk => { stderr += chunk; const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]) } })
    edge.once('exit', code => { clearTimeout(timeout); reject(new Error(`Isolated Edge exited ${code}`)) })
  })
  report.debugPort = new URL(wsUrl).port
  browser = new Cdp(); await browser.connect(wsUrl)
  const { browserContextId } = await browser.send('Target.createBrowserContext')
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId })
  cdp = new Cdp(); await cdp.connect(`ws://127.0.0.1:${report.debugPort}/devtools/page/${targetId}`)
  cdp.onEvent = (method, p) => {
    if (method === 'Fetch.requestPaused') {
      void (async () => {
        const url = new URL(p.request.url)
        const path = url.pathname
        if (!path.startsWith('/api/')) { await cdp.send('Fetch.continueRequest', { requestId: p.requestId }); return }
        const method2 = p.request.method
        const record = { phase, method: method2, path, query: url.search, body: p.request.postData ?? null }
        report.requests.push(record)
        let data = {}
        const queue = /^\/api\/v1\/support-requests\/queue$/.exec(path)
        const review = /^\/api\/v1\/support-requests\/([^/]+)$/.exec(path)
        if (path === '/api/v1/users/me') data = user
        else if (queue) data = queueResponse(url.searchParams)
        else if (review && method2 === 'PATCH') {
          patches.push({ requestId: decodeURIComponent(review[1]), body: JSON.parse(p.request.postData ?? '{}') })
          data = {}
        } else if (path.startsWith('/api/v1/follow-ups')) data = {}
        else if (path === '/api/v1/notifications/unread-count') data = { count: 0 }
        else if (path === '/api/v1/notifications') data = { items: [] }
        else if (path === '/api/v1/chat/unread') data = { total: 0, byThread: {} }
        else if (path === '/api/v1/chat/inbox') data = { items: [] }
        else if (path === '/api/v1/ai/disclosure/status') data = { version: 'fixture-v1', accepted: true, acceptedAt: '2026-10-01T00:00:00.000Z' }
        else { report.unknownApi.push(record); data = {} }
        const headers = [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: ORIGIN }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,HEAD,OPTIONS,PATCH,POST' }]
        await cdp.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: true, data })).toString('base64') })
      })().catch(error => report.harnessErrors.push(`${error.message} :: ${p.request.url}`))
    }
    if (method === 'Runtime.exceptionThrown') report.errors.push({ phase, type: 'exception', text: p.exceptionDetails.exception?.description ?? p.exceptionDetails.text })
    if (method === 'Runtime.consoleAPICalled' && p.type === 'error') report.errors.push({ phase, type: 'console', text: p.args.map(a => a.value ?? a.description).join(' ') })
    if (method === 'Log.entryAdded' && p.entry.level === 'error') report.errors.push({ phase, type: 'log', text: p.entry.text })
  }
  for (const domain of ['Page', 'Network', 'Runtime', 'Log']) await cdp.send(`${domain}.enable`)
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.setBypassServiceWorker', { bypass: true })
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT })
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  await cdp.send('Page.navigate', { url: `${ORIGIN}${PAGE}` })
  await ready(`location.pathname === '${PAGE}' && document.querySelectorAll('main ul li button').length > 0`, 'queue loaded')

  // ---- Fix 1: urgency is visible and orders the table ----------------------
  phase = 'urgency'
  let view = await ui()
  const expectedOrder = ['0102', '0101', '0103', '0104', '0105', '0106', '0107', '0108']
  const shown = view.rows.map(r => r.code.slice(-4))
  assert('all 8 queue rows render, the cancelled one never appears', view.rows.length === 8 && !shown.includes('0109'), shown)
  assert('urgent rows come first even when they are the oldest', shown.join(' ') === expectedOrder.join(' '), shown)
  assert('the two urgent rows carry the urgency pill', view.rows.filter(r => r.urgent).length === 2, view.rows.map(r => [r.code, r.urgent]))
  assert('urgent means the stale escalated row and the unsafe pending row', view.rows.slice(0, 2).every(r => r.urgent), view.rows.slice(0, 2).map(r => r.code))
  assert('no normal row is marked urgent', view.rows.slice(2).every(r => !r.urgent), view.rows.slice(2).map(r => [r.code, r.urgent]))
  await shot('queue-rows')

  // ---- Fix 2: the lifecycle is not collapsed ------------------------------
  phase = 'lifecycle'
  view = await ui()
  const LABELS = { '0101': 'Pending', '0102': 'Escalated', '0103': 'Accepted', '0104': 'Pending', '0105': 'Scheduled', '0106': 'In progress', '0107': 'Completed', '0108': 'Completed' }
  const FU = { '0104': 'Follow-up required', '0106': 'Follow-up required', '0107': 'Follow-up completed', '0108': 'Follow-up completed' }
  const pillOf = (row) => row.pills.find(p => Object.values(LABELS).includes(p))
  const byCode = (code) => view.rows.find(r => r.code.endsWith(code))
  for (const [code, label] of Object.entries(LABELS)) {
    const row = byCode(code)
    assert(`row ${code}: renders the stored status “${label}”`, row && pillOf(row) === label, row?.pills)
  }
  const distinct = new Set(view.rows.map(pillOf))
  assert('six distinct status pills, not one collapsed “Reviewed”', distinct.size === 6, [...distinct])
  assert('the table never shows a queue-chip word as a row status', !view.rows.some(r => r.pills.some(p => p === 'New' || p === 'Reviewed')), view.rows.map(r => r.pills))
  for (const [code, label] of Object.entries(FU)) {
    const row = byCode(code)
    assert(`row ${code}: follow-up state shown separately as “${label}”`, row?.pills.includes(label), row?.pills)
  }
  assert('rows with no follow-up do not claim one', view.rows.filter(r => r.pills.includes('No follow-up')).length === 0, view.rows.map(r => r.pills))

  // ---- Fix 2 continued: the numbers on the chips --------------------------
  phase = 'chip-counts'
  view = await ui()
  const CHIP_EXPECT = { All: 8, New: 3, Reviewed: 5, 'Follow-Up Required': 2, 'Follow-Up Completed': 2 }
  const chipNumber = (label) => Number(/(\d+)\)/.exec(view.chips.find(c => c.startsWith(label)) ?? '')?.[1])
  for (const [label, expected] of Object.entries(CHIP_EXPECT)) {
    assert(`chip “${label}” reads ${expected}`, chipNumber(label) === expected, view.chips)
  }
  const tiles = view.tiles.join(' | ')
  assert('the week tile counts follow-ups completed in 7 days (1) while the chip counts all of them (2)', /Completed this week 1/.test(tiles) && chipNumber('Follow-Up Completed') === 2, { tiles, chips: view.chips })

  phase = 'chip-rows'
  for (const [label, expected] of Object.entries(CHIP_EXPECT)) {
    await cdp.eval(`__clickChip(${JSON.stringify(label)})`)
    await ready(`document.querySelectorAll('main ul li button').length === ${expected}`, `chip ${label} rows`)
    const after = await ui()
    const number = Number(/(\d+)\)/.exec(after.chips.find(c => c.startsWith(label)) ?? '')?.[1])
    assert(`clicking “${label}” shows exactly its ${expected} rows`, after.rows.length === expected && number === expected, { rows: after.rows.map(r => r.code), number })
    assert(`“${label}” keeps urgency ordering inside the filtered view`, after.rows.filter(r => r.urgent).length === (label === 'All' || label === 'New' ? 2 : 0), after.rows.map(r => [r.code, r.urgent]))
  }

  // ---- Fix 2 again: search narrows the counts, not just the rows ----------
  phase = 'search'
  await cdp.eval(`__clickChip("All")`)
  await ready(`document.querySelectorAll('main ul li button').length === 8`, 'back to all')
  await cdp.eval(`(() => { const el = document.querySelector('input[type="search"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, 'GSS/2026/0105'); el.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await ready(`document.querySelectorAll('main ul li button').length === 1`, 'search narrowed')
  view = await ui()
  assert('the search leaves one row', view.rows.length === 1 && view.rows[0].code.endsWith('0105'), view.rows.map(r => r.code))
  assert('the All chip follows the search instead of lying about it', /All \(1\)/.test(view.chips.join(' ')), view.chips)
  assert('the Reviewed chip reads 1 for the single searched row', /Reviewed \(1\)/.test(view.chips.join(' ')), view.chips)
  assert('the New chip drops to 0 because the searched student is not new', /New \(0\)/.test(view.chips.join(' ')), view.chips)
  await shot('queue-search')
  await cdp.eval(`(() => { const el = document.querySelector('input[type="search"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await ready(`document.querySelectorAll('main ul li button').length === 8`, 'search cleared')

  // ---- Fix 5: opening the dialog arms nothing -----------------------------
  phase = 'dialog-inert'
  await cdp.eval(`__clickRow("GSS/2026/0101")`)
  await ready(`!!document.querySelector('[role="dialog"]')`, 'dialog opened')
  view = await ui()
  assert('a pending request opens with no status pre-selected', view.dialog.status === '', view.dialog.status)
  assert('Save is disabled on an untouched dialog', view.dialog.saveDisabled === true, view.dialog.saveDisabled)
  assert('the dialog says nothing has changed', /Nothing has changed yet/.test(view.dialog.text), view.dialog.text.slice(0, 200))
  assert('the student’s own urgency is stated in the dialog', /The student does not feel safe/.test(view.dialog.text), view.dialog.text.slice(0, 300))
  assert('no PATCH was sent just by opening or browsing', patches.length === 0, patches)
  await cdp.eval(`__setField("note", "Called her guardian.")`)
  view = await ui()
  assert('a note alone still cannot write while no status is chosen', view.dialog.saveDisabled === true, view.dialog.saveDisabled)
  assert('the caption asks for a status', /Choose a review status to save/.test(view.dialog.text), view.dialog.text.slice(-400))
  await cdp.eval(`__setField("status", "IN_PROGRESS")`)
  view = await ui()
  assert('choosing a status arms Save', view.dialog.saveDisabled === false, view.dialog.saveDisabled)
  assert('the caption tells the reviewer the student is notified', /The student is told the status changed/.test(view.dialog.text) && /your note stays private/.test(view.dialog.text), view.dialog.text.slice(-400))
  await shot('dialog-inert')
  await cdp.eval(`__clickDialogButton("Cancel")`)
  await ready(`!document.querySelector('[role="dialog"]')`, 'dialog closed')

  // ---- Fix 3 + 5: an accepted request edits its note, not its status ------
  phase = 'dialog-note'
  await cdp.eval(`__clickRow("GSS/2026/0103")`)
  await ready(`!!document.querySelector('[role="dialog"]')`, 'accepted dialog')
  view = await ui()
  assert('an accepted row opens showing its own status', view.dialog.status === 'ACCEPTED', view.dialog.status)
  assert('reopening an accepted row still leaves Save disabled', view.dialog.saveDisabled === true, view.dialog.saveDisabled)
  assert('the stored review note is the baseline of the field', view.dialog.note === 'Met during break, agreed to check in again.', view.dialog.note)
  await cdp.eval(`__setField("note", "Followed up after assembly.")`)
  view = await ui()
  assert('editing only the note arms Save', view.dialog.saveDisabled === false, view.dialog.saveDisabled)
  await cdp.eval(`__clickDialogButton("Save review")`)
  await ready(`!document.querySelector('[role="dialog"]')`, 'note saved')
  await settle()
  assert('the note-only save PATCHes the stored status, never an invented one', patches[0]?.body.status === 'ACCEPTED', patches)
  assert('the note-only save carries the note and no schedule fields', patches[0]?.body.reviewNote === 'Followed up after assembly.' && patches[0]?.body.scheduledAt === undefined && patches[0]?.body.locationLabel === undefined, patches[0]?.body)

  // ---- Fix 3: SCHEDULED needs a real time and place -----------------------
  phase = 'dialog-scheduled'
  await ready(`!document.querySelector('[role="dialog"]')`, 'dialog closed after save')
  await cdp.eval(`__clickRow("GSS/2026/0101")`)
  await ready(`!!document.querySelector('[role="dialog"]')`, 'urgent dialog')
  await cdp.eval(`__setField("status", "SCHEDULED")`)
  view = await ui()
  assert('choosing Scheduled reveals the when and where fields', view.dialog.when.length === 1 && view.dialog.where !== null, { when: view.dialog.when, where: view.dialog.where })
  assert('Scheduled with no arrangement cannot save', view.dialog.saveDisabled === true, view.dialog.saveDisabled)
  assert('the caption explains the arrangement is what the student sees', /needs a time and a place/.test(view.dialog.text), view.dialog.text.slice(-400))
  const WHEN = '2026-11-05T14:30'
  await cdp.eval(`__setField("when", ${JSON.stringify(WHEN)})`)
  view = await ui()
  assert('a time alone is still not enough', view.dialog.saveDisabled === true, view.dialog.saveDisabled)
  await cdp.eval(`__setField("where", "   ")`)
  view = await ui()
  assert('whitespace for the place does not count as an arrangement', view.dialog.saveDisabled === true, view.dialog.where)
  await cdp.eval(`__setField("where", "Library, quiet room")`)
  view = await ui()
  assert('time plus place arms Save', view.dialog.saveDisabled === false, view.dialog.saveDisabled)
  await shot('dialog-scheduled')
  await cdp.eval(`__clickDialogButton("Save review")`)
  await ready(`!document.querySelector('[role="dialog"]')`, 'scheduled saved')
  await settle()
  assert('the PATCH sends an ISO instant, not the raw local string', patches[1]?.body.scheduledAt === new Date(WHEN).toISOString(), { sent: patches[1]?.body.scheduledAt, expected: new Date(WHEN).toISOString() })
  assert('the PATCH sends the trimmed place', patches[1]?.body.locationLabel === 'Library, quiet room', patches[1]?.body)
  assert('the scheduled PATCH still names the status', patches[1]?.body.status === 'SCHEDULED' && patches[1]?.requestId === 'sq-urgent-stale', patches[1])

  // ---- Fix 3 read-back: a scheduled row shows its arrangement -------------
  phase = 'dialog-scheduled-echo'
  await ready(`!document.querySelector('[role="dialog"]')`, 'closed after scheduled save')
  await cdp.eval(`__clickRow("GSS/2026/0105")`)
  await ready(`!!document.querySelector('[role="dialog"]')`, 'scheduled row dialog')
  view = await ui()
  assert('the stored time round-trips into the field', view.dialog.when.length === 1 && view.dialog.when[0].length === 16, view.dialog.when)
  assert('the stored place round-trips into the field', view.dialog.where === 'Counselling office, Block C', view.dialog.where)
  assert('a read-back that changes nothing cannot save', view.dialog.saveDisabled === true, view.dialog.saveDisabled)
  assert('the stored status is shown, not overwritten by a chip word', /Request status Scheduled/.test(view.dialog.text), view.dialog.facts)
  await shot('dialog-echo')
  await cdp.eval(`__clickDialogButton("Cancel")`)
  await ready(`!document.querySelector('[role="dialog"]')`, 'dialog closed')

  // ---- The page itself stayed healthy -------------------------------------
  phase = 'hygiene'
  view = await ui()
  assert('the dialog PATCHes were the only writes the page made', patches.length === 2, patches)
  assert('no request escaped the fixture', report.unknownApi.length === 0, report.unknownApi)
  assert('the queue page threw no console or runtime errors', report.errors.length === 0, report.errors.slice(0, 6))
  assert('no horizontal overflow on the queue at 1440', await cdp.eval('document.documentElement.clientWidth === document.documentElement.scrollWidth'), await cdp.eval('[document.documentElement.clientWidth, document.documentElement.scrollWidth]'))

  report.summary = {
    passed: report.assertions.filter(a => a.pass).length,
    failed: report.assertions.filter(a => !a.pass).length,
    errors: report.errors.length,
    harnessErrors: report.harnessErrors.length,
    unknownApi: report.unknownApi.length,
    writes: patches.length,
  }
  await cdp.send('Target.closeTarget', { targetId })
  await browser.send('Target.disposeBrowserContext', { browserContextId })
  browser.close(); cdp.close()
  edge.kill('SIGTERM')
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
  await writeFile(`${OUT}support-queue-regression.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ summary: report.summary, report: `${OUT}support-queue-regression.json`, screenshots: report.screenshots }, null, 2))
}

run().catch(async (error) => {
  report.fatal = error.message
  console.error(error)
  try {
    if (edge) edge.kill('SIGTERM')
    if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
    await writeFile(`${OUT}support-queue-regression.json`, JSON.stringify(report, null, 2))
  } catch { /* the console output above is the report */ }
  process.exitCode = 1
})
