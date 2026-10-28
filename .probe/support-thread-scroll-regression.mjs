// UI-only regression. Run: node <absolute path to this file>
// Starts ONLY an isolated Edge/profile; uses the existing Vite server on :5050.
// All /api/ HTTP and WebSocket traffic is synthetic. No credentials or real input.
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('./', import.meta.url))
const OUT = fileURLToPath(new URL('./shots/', import.meta.url))
const ORIGIN = 'http://localhost:5050'
const THREAD = 'fixture-thread'
const report = { assertions: [], measurements: [], screenshots: [], errors: [], unknownApi: [], escapedApi: [], fixtureResponses: [], blockedWrites: [], harnessErrors: [] }
const user = { id: 'fixture-student', name: 'Test Student', email: 'fixture@example.test', role: 'STUDENT', emailVerified: true, mustChangePassword: false, schoolId: 'fixture-school' }
const messages = Array.from({ length: 40 }, (_, i) => ({
  id: `fixture-message-${i}`,
  threadId: THREAD,
  senderUserId: null,
  role: i % 3 === 2 ? 'PROFESSIONAL' : 'STUDENT',
  content: `Synthetic chat message ${i + 1}: local UI test data with enough words to wrap over a couple of lines so the transcript is genuinely long.`,
  viaVoice: false,
  meta: null,
  createdAt: `2026-10-${String(20 + Math.floor(i / 12)).padStart(2, '0')}T${String(9 + (i % 12)).padStart(2, '0')}:15:00.000Z`,
}))
const thread = {
  id: THREAD,
  schoolId: 'fixture-school',
  studentId: 'fixture-student',
  professionalId: 'fixture-professional',
  entryCheckInId: null,
  aiEntrySummary: null,
  status: 'ACTIVE',
  studentReadAt: null,
  professionalReadAt: null,
  claimedAt: '2026-10-20T09:00:00.000Z',
  closedAt: null,
  createdAt: '2026-10-20T09:00:00.000Z',
  updatedAt: messages[messages.length - 1].createdAt,
  student: { userId: 'fixture-student', firstName: 'Test', lastName: 'Student', classLabel: 'SS2B', studentCode: 'SN-0001' },
  professional: { userId: 'fixture-professional', title: 'Counsellor', department: 'Wellbeing', user: { name: 'A. Counsellor' } },
  messages,
}
let phase = 'startup'
let messageMode = 'long'
const servedMessages = () =>
  messageMode === 'short'
    ? messages.slice(0, 4)
    : messageMode === 'huge'
      ? Array.from({ length: 6 }, (_, group) => messages.map((m, i) => ({ ...m, id: `huge-${group}-${i}` }))).flat()
      : messages
const assert = (name, ok, detail) => { const item = { phase, name, pass: !!ok, detail }; report.assertions.push(item); console.log(`${ok ? 'PASS' : 'FAIL'} ${phase}: ${name} ${JSON.stringify(detail ?? '')}`) }

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
    socket.send = (data) => { if (data === '40') queueMicrotask(() => emit('message', new MessageEvent('message', { data: '40{"sid":"fixture-socket"}' }))); };
    socket.close = () => { socket.readyState = 3; emit('close', new CloseEvent('close', { code: 1000, wasClean: true })); };
    setTimeout(() => { socket.readyState = 1; emit('open', new Event('open')); emit('message', new MessageEvent('message', { data: '0{"sid":"fixture-socket","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":100000}' })); }, 0);
    return socket;
  }});
  window.__rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  window.__snap = () => {
    const log = document.querySelector('[role="log"]');
    const composer = document.querySelector('textarea');
    const main = document.querySelector('main');
    // The scroller is not always main: the student layout scrolls inside main,
    // while the dashboard layout scrolls in main's wrapper.
    let scroller = main;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    const bubbles = log ? [...log.children].filter(el => el.className.includes('items-end') || el.className.includes('items-start')) : [];
    const last = bubbles[bubbles.length - 1];
    return {
      path: location.pathname, viewport: [innerWidth, innerHeight],
      doc: [document.documentElement.clientWidth, document.documentElement.scrollWidth],
      main: main ? { overflowY: getComputedStyle(main).overflowY, clientHeight: main.clientHeight, scrollHeight: main.scrollHeight, scrollTop: main.scrollTop } : null,
      scroller: scroller ? { tag: scroller.tagName, clientHeight: scroller.clientHeight, scrollHeight: scroller.scrollHeight, scrollTop: scroller.scrollTop } : null,
      log: log ? { rect: window.__rect(log), overflowY: getComputedStyle(log).overflowY, overscroll: getComputedStyle(log).overscrollBehaviorY, clientHeight: log.clientHeight, scrollHeight: log.scrollHeight, scrollTop: log.scrollTop, bubbles: bubbles.length } : null,
      lastBubble: last ? { text: last.innerText.slice(0, 40), rect: window.__rect(last) } : null,
      composer: composer ? { rect: window.__rect(composer), position: getComputedStyle(composer.closest('div[class*="sticky"], div[class*="sticky"]') || composer).position } : null,
    };
  };
})()`

let edge, profile, browser, cdp
async function ready(predicate, label = predicate) {
  const result = await cdp.eval(`new Promise(resolve => { const start = performance.now(); const poll = () => { if (${predicate}) resolve(true); else if (performance.now() - start > 15000) resolve(false); else requestAnimationFrame(poll); }; poll(); })`)
  if (!result) throw new Error(`UI wait failed: ${label}; ${await cdp.eval('document.body.innerText.slice(0,800)')}`)
}
async function settle() { await cdp.eval('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))') }
async function snapshot(label) { const snap = await cdp.eval('__snap()'); report.measurements.push({ phase, label, ...snap }); return snap }
async function shot(name) { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const path = `${OUT}${name}.png`; await writeFile(path, Buffer.from(data, 'base64')); report.screenshots.push(path) }
async function viewport(width, height) { await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 1024 }); await settle() }

async function run() {
  profile = await mkdtemp(`${ROOT}support-thread-edge-`)
  edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const wsUrl = await new Promise((resolve, reject) => {
    let stderr = ''
    const timeout = setTimeout(() => reject(new Error(`Edge startup timeout: ${stderr.slice(-1500)}`)), 20000)
    edge.on('error', reject)
    edge.stderr.on('data', chunk => { stderr += chunk; const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]) } })
    edge.once('exit', code => { clearTimeout(timeout); reject(new Error(`Isolated Edge exited ${code}`)) })
  })
  report.debugPort = new URL(wsUrl).port
  report.profile = profile
  browser = new Cdp(); await browser.connect(wsUrl)
  const { browserContextId } = await browser.send('Target.createBrowserContext')
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId })
  cdp = new Cdp(); await cdp.connect(`ws://127.0.0.1:${report.debugPort}/devtools/page/${targetId}`)
  cdp.onEvent = (method, p) => {
    if (method === 'Fetch.requestPaused') {
      void (async () => {
        const url = new URL(p.request.url)
        if (!url.pathname.startsWith('/api/')) { await cdp.send('Fetch.continueRequest', { requestId: p.requestId }); return }
        let data, status = 200
        if (!['GET', 'HEAD', 'OPTIONS'].includes(p.request.method)) { data = { message: 'UI fixture blocks writes' }; status = 405 }
        else if (url.pathname === '/api/v1/users/me') data = user
        else if (url.pathname === `/api/v1/chat/threads/${THREAD}`) data = { ...thread, messages: servedMessages() }
        else if (url.pathname === '/api/v1/chat/unread') data = { total: 0, byThread: {} }
        else if (url.pathname === '/api/v1/notifications/unread-count') data = { count: 0 }
        else if (url.pathname === '/api/v1/ai/disclosure/status') data = { version: 'fixture-v1', accepted: true, acceptedAt: '2026-10-01T00:00:00.000Z' }
        else { report.unknownApi.push({ phase, path: url.pathname }); data = {} }
        const headers = [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: ORIGIN }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,HEAD,OPTIONS' }]
        await cdp.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: status, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: status === 200, data })).toString('base64') })
      })().catch(error => report.harnessErrors.push(error.message))
    }
    if (method === 'Runtime.exceptionThrown') report.errors.push({ phase, type: 'exception', text: p.exceptionDetails.exception?.description ?? p.exceptionDetails.text })
    if (method === 'Runtime.consoleAPICalled' && p.type === 'error') report.errors.push({ phase, type: 'console', text: p.args.map(a => a.value ?? a.description).join(' ') })
    if (method === 'Log.entryAdded' && p.entry.level === 'error') {
      // The harness answers every write with 405, so the read-receipt POST
      // failing is the fixture working, not a page error.
      if (p.entry.text.includes('405')) report.blockedWrites.push(p.entry.url ?? p.entry.text)
      else report.errors.push({ phase, type: 'log', text: p.entry.text })
    }
    if (method === 'Network.responseReceived' && new URL(p.response.url).pathname.startsWith('/api/')) {
      // Every /api/ response here is the harness's own fixture; only a write the
      // harness refused (405) is worth counting, and that is a blocked write.
      if (p.response.status === 405) report.blockedWrites.push(p.response.url)
      else report.fixtureResponses.push(p.response.url)
    }
  }
  for (const domain of ['Page', 'Network', 'Runtime', 'Log']) await cdp.send(`${domain}.enable`)
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.setBypassServiceWorker', { bypass: true })
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT })

  const byViewport = {}
  for (const [width, height] of [[390, 844], [320, 700], [1440, 900]]) {
    phase = `${width}x${height}`
    await viewport(width, height)
    await cdp.send('Page.navigate', { url: `${ORIGIN}/support/${THREAD}` })
    await ready(`location.pathname === "/support/${THREAD}" && document.querySelector('[role="log"]') && document.querySelector('textarea')`, 'thread loaded')
    await cdp.eval('document.fonts.ready')
    await settle()
    const s = await snapshot('loaded')
    byViewport[phase] = s
    assert(`${phase}: all 40 messages render inside the transcript box`, s.log.bubbles === messages.length, s.log)
    assert(`${phase}: the transcript scrolls in itself`, s.log.overflowY === 'auto' && s.log.scrollHeight > s.log.clientHeight, { overflowY: s.log.overflowY, box: [s.log.clientHeight, s.log.scrollHeight] })
    assert(`${phase}: the transcript does not chain-scroll the page`, s.log.overscroll === 'contain', s.log.overscroll)
    assert(`${phase}: the transcript keeps a usable share of the screen`, s.log.clientHeight >= 0.25 * s.main.clientHeight, { log: s.log.clientHeight, main: s.main.clientHeight })
    assert(`${phase}: the newest message is scrolled to and clipped by the box, not the page`, s.log.scrollTop + s.log.clientHeight >= s.log.scrollHeight - 2 && s.lastBubble.rect.bottom <= s.log.rect.bottom + 1, { scrollTop: s.log.scrollTop, lastBottom: s.lastBubble?.rect?.bottom, logBottom: s.log.rect.bottom })
    assert(`${phase}: the composer sits below the transcript, not floating over it`, s.composer.rect.top >= s.log.rect.bottom - 1, { composerTop: s.composer.rect.top, logBottom: s.log.rect.bottom })
    assert(`${phase}: the page itself does not scroll`, s.scroller.scrollHeight <= s.scroller.clientHeight + 1, { scroller: s.scroller, main: s.main })
    assert(`${phase}: the composer is on screen without scrolling`, s.composer.rect.bottom <= height + 1, { composerBottom: s.composer.rect.bottom, height })
    assert(`${phase}: no horizontal overflow`, s.doc[0] === s.doc[1], s.doc)
    await shot(`support-thread-${width}`)
  }

  // The requirement is that history length cannot change the page: the box holds
  // it and scrolls, so the shell geometry must be identical at 4, 40 and 240
  // messages while the box's own scrollHeight keeps growing.
  for (const [width, height] of [[390, 844], [320, 700], [1440, 900]]) {
    const baseline = byViewport[`${width}x${height}`]
    for (const mode of ['short', 'huge']) {
      phase = `${width}x${height} ${mode}-history`
      messageMode = mode
      await viewport(width, height)
      await cdp.send('Page.navigate', { url: `${ORIGIN}/support/${THREAD}` })
      await ready(`location.pathname === "/support/${THREAD}" && document.querySelector('[role="log"]') && document.querySelector('textarea')`, 'thread reloaded')
      await cdp.eval('document.fonts.ready')
      await settle()
      const s = await snapshot('invariance')
      const expected = mode === 'short' ? 4 : messages.length * 6
      assert(`${phase}: ${expected} messages rendered`, s.log.bubbles === expected, { bubbles: s.log.bubbles })
      assert(`${phase}: page height is unchanged by history`, Math.abs(s.main.scrollHeight - baseline.main.scrollHeight) <= 1, { main: s.main, baseline: baseline.main })
      assert(`${phase}: transcript box height is unchanged by history`, Math.abs(s.log.rect.height - baseline.log.rect.height) <= 1, { logHeight: s.log.rect.height, baseline: baseline.log.rect.height })
      assert(`${phase}: the box absorbs the extra history in its own scroll`, mode === 'short' ? s.log.scrollHeight <= baseline.log.scrollHeight : s.log.scrollHeight > baseline.log.scrollHeight, { scrollHeight: [baseline.log.scrollHeight, s.log.scrollHeight] })
      assert(`${phase}: composer stays in the same place`, Math.abs(s.composer.rect.top - baseline.composer.rect.top) <= 1, { composerTop: s.composer.rect.top, baseline: baseline.composer.rect.top })
      await shot(`support-thread-${width}-${mode}`)
    }
    messageMode = 'long'
  }

  // The staff inbox mounts the same ThreadView in a different shell (dash header
  // + rail instead of the marketing header + footer), so the contract has to
  // hold there too.
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    phase = `staff ${width}x${height}`
    user.role = 'COUNSELLOR'
    await viewport(width, height)
    await cdp.send('Page.navigate', { url: `${ORIGIN}/school/inbox/${THREAD}` })
    await ready(`location.pathname === "/school/inbox/${THREAD}" && document.querySelector('[role="log"]') && document.querySelector('textarea')`, 'staff thread loaded')
    await cdp.eval('document.fonts.ready')
    await settle()
    const s = await snapshot('staff')
    assert(`${phase}: all 40 messages render inside the transcript box`, s.log.bubbles === messages.length, s.log)
    assert(`${phase}: the transcript scrolls in itself`, s.log.overflowY === 'auto' && s.log.scrollHeight > s.log.clientHeight, { overflowY: s.log.overflowY, box: [s.log.clientHeight, s.log.scrollHeight] })
    assert(`${phase}: the composer sits below the transcript`, s.composer.rect.top >= s.log.rect.bottom - 1, { composerTop: s.composer.rect.top, logBottom: s.log.rect.bottom })
    assert(`${phase}: the page itself does not scroll`, s.scroller.scrollHeight <= s.scroller.clientHeight + 1, { scroller: s.scroller, main: s.main })
    assert(`${phase}: no horizontal overflow`, s.doc[0] === s.doc[1], s.doc)
    await shot(`support-thread-staff-${width}`)
  }
  user.role = 'STUDENT'

  report.summary = {
    passed: report.assertions.filter(a => a.pass).length,
    failed: report.assertions.filter(a => !a.pass).length,
    errors: report.errors.length,
    harnessErrors: report.harnessErrors.length,
    fixtureResponses: report.fixtureResponses.length,
    blockedWrites: report.blockedWrites.length,
    unknownApi: report.unknownApi.length,
  }
  await cdp.send('Target.closeTarget', { targetId })
  await browser.send('Target.disposeBrowserContext', { browserContextId })
  browser.close(); cdp.close()
  edge.kill('SIGTERM')
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
  await writeFile(`${OUT}support-thread-regression.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ summary: report.summary, report: `${OUT}support-thread-regression.json`, screenshots: report.screenshots }, null, 2))
}

run().catch(async (error) => {
  report.fatal = error.message
  await writeFile(`${OUT}support-thread-regression.json`, JSON.stringify(report, null, 2)).catch(() => {})
  try { edge?.kill('SIGTERM') } catch {}
  try { if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }) } catch {}
  console.error(error.message)
  process.exitCode = 1
})
