// UI-only measurement probe for the staff inbox lists.
// Run: node <absolute path to this file>
// Starts ONLY an isolated Edge/profile; uses the existing Vite server on :5050.
// All /api/ HTTP and WebSocket traffic is synthetic. No credentials or real input.
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('./', import.meta.url))
const OUT = fileURLToPath(new URL('./shots/', import.meta.url))
const ORIGIN = 'http://localhost:5050'
const PAGE = '/school/inbox'
const user = { id: 'fixture-staff', name: 'A. Counsellor', email: 's@example.test', role: 'COUNSELLOR', emailVerified: true, mustChangePassword: false, schoolId: 'sch', school: { id: 'sch', name: 'Greenstead School', shortCode: 'GSS' } }
const long = 'How are things going tell me how you have been feeling for the past few days about the situation with your roommate'
const brief = (id, first, last, status, content, role) => ({
  id,
  schoolId: 'sch',
  status,
  aiEntrySummary: null,
  createdAt: '2026-10-20T09:00:00.000Z',
  updatedAt: '2026-10-28T09:00:00.000Z',
  claimedAt: status === 'PENDING' ? null : '2026-10-21T09:00:00.000Z',
  closedAt: status === 'CLOSED' ? '2026-10-27T09:00:00.000Z' : null,
  student: { firstName: first, lastName: last, classLabel: 'JSS 3B', studentCode: 'GSS/2026/0142' },
  professional: null,
  messages: [{ content, role, createdAt: '2026-10-28T09:00:00.000Z' }],
})
const pool = [brief('pool-1', 'Ib', 'Test', 'PENDING', 'Okay sir', 'STUDENT'), brief('pool-2', 'Ada', 'Okafor', 'PENDING', long, 'STUDENT')]
const mine = [
  brief('mine-1', 'Ib', 'Test', 'ACTIVE', 'Hmm, have you tried talking to anyone and befriend them?', 'PROFESSIONAL'),
  brief('mine-2', 'Ib', 'Test', 'ACTIVE', 'Hello', 'PROFESSIONAL'),
  brief('mine-3', 'Ib', 'Test', 'ACTIVE', long, 'STUDENT'),
  brief('mine-4', 'Ib', 'Test', 'CLOSED', 'Hello the main test', 'STUDENT'),
  brief('mine-5', 'Mide', 'Akinyemi', 'CLOSED', long, 'PROFESSIONAL'),
]

const MEASURE = `(() => {
  const card = [...document.querySelectorAll('main h2')].find(h => /Your conversations/i.test(h.innerText)).closest('div[class*="rounded-panel"]');
  const rect = el => { const r = el.getBoundingClientRect(); const c = card.getBoundingClientRect(); return { x: Math.round(r.x - c.x), y: Math.round(r.y - c.y), w: Math.round(r.width), right: Math.round(c.right - r.right) }; };
  const list = card.querySelector('ul');
  const rows = [...list.children].map(li => li.firstElementChild);
  const style = getComputedStyle(rows[0]);
  return {
    card: { w: Math.round(card.getBoundingClientRect().width), h: Math.round(card.getBoundingClientRect().height) },
    cardPadding: getComputedStyle(card).padding,
    title: rect(card.querySelector('h2')),
    list: rect(list),
    rowInset: rows.map(r => ({ left: Math.round(r.getBoundingClientRect().x - card.getBoundingClientRect().x), right: Math.round(card.getBoundingClientRect().right - r.getBoundingClientRect().right) })),
    rowPadding: { top: style.paddingTop, bottom: style.paddingBottom },
    rowHeights: rows.map(r => Math.round(r.getBoundingClientRect().height)),
    gaps: rows.slice(1).map((r, i) => Math.round(r.getBoundingClientRect().y - rows[i].getBoundingClientRect().bottom)),
    previewToStamp: rows.map(r => { const cols = [...r.children]; const text = cols[1]; const stamp = cols[2]; return Math.round(stamp.getBoundingClientRect().x - text.getBoundingClientRect().right); }),
    previewClipped: rows.map(r => [...r.querySelectorAll('p')].some(p => p.scrollWidth > p.clientWidth + 1)),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
})()`

const report = { measurements: {}, screenshots: [], errors: [], unknownApi: [], harnessErrors: [] }
class Cdp {
  id = 0
  waiters = new Map()
  async connect(url) {
    this.ws = new WebSocket(url)
    await new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, { once: true }); this.ws.addEventListener('error', reject, { once: true }) })
    this.ws.addEventListener('message', ({ data }) => {
      const msg = JSON.parse(data)
      if (msg.id) { const w = this.waiters.get(msg.id); if (!w) return; clearTimeout(w.timer); this.waiters.delete(msg.id); msg.error ? w.reject(new Error(JSON.stringify(msg.error))) : w.resolve(msg.result) }
      else this.onEvent?.(msg.method, msg.params)
    })
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.waiters.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000); this.waiters.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params })) }) }
  async eval(expression) { const v = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (v.exceptionDetails) throw new Error(JSON.stringify(v.exceptionDetails)); return v.result.value }
  close() { this.ws?.close() }
}
const INIT = `(() => {
  sessionStorage.clear();
  const NativeWebSocket = window.WebSocket;
  window.WebSocket = new Proxy(NativeWebSocket, { construct(Target, args) {
    const url = new URL(args[0], location.href);
    if (!url.pathname.startsWith('/api/')) return Reflect.construct(Target, args);
    const socket = new EventTarget();
    Object.assign(socket, { url: url.href, readyState: 0, send() {}, close() {}, bufferedAmount: 0, binaryType: 'arraybuffer' });
    setTimeout(() => { socket.readyState = 1; socket.dispatchEvent(new Event('open')); socket.dispatchEvent(new MessageEvent('message', { data: '0{"sid":"fixture","upgrades":[],"pingInterval":60000,"pingTimeout":60000}' })); }, 0);
    return socket;
  }});
})()`

let edge, profile, browser, cdp
async function settle() { await cdp.eval('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))') }
async function ready(predicate, label) {
  const ok = await cdp.eval(`new Promise(resolve => { const start = performance.now(); const poll = () => { if (${predicate}) resolve(true); else if (performance.now() - start > 15000) resolve(false); else requestAnimationFrame(poll); }; poll(); })`)
  if (!ok) throw new Error(`wait failed: ${label}`)
}
async function shot(name) { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const path = `${OUT}${name}.png`; await writeFile(path, Buffer.from(data, 'base64')); report.screenshots.push(path) }

async function run() {
  profile = await mkdtemp(`${ROOT}inbox-padding-edge-`)
  edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const wsUrl = await new Promise((resolve, reject) => { let s = ''; const t = setTimeout(() => reject(new Error('edge timeout')), 20000); edge.stderr.on('data', c => { s += c; const m = s.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (m) { clearTimeout(t); resolve(m[1]) } }); edge.on('error', reject) })
  report.debugPort = new URL(wsUrl).port
  browser = new Cdp(); await browser.connect(wsUrl)
  const { browserContextId } = await browser.send('Target.createBrowserContext')
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId })
  cdp = new Cdp(); await cdp.connect(`ws://127.0.0.1:${report.debugPort}/devtools/page/${targetId}`)
  cdp.onEvent = (method, p) => {
    if (method === 'Fetch.requestPaused') {
      void (async () => {
        const url = new URL(p.request.url)
        if (!url.pathname.startsWith('/api/')) { await cdp.send('Fetch.continueRequest', { requestId: p.requestId }); return }
        let data = {}
        if (url.pathname === '/api/v1/users/me') data = user
        else if (url.pathname === '/api/v1/chat/inbox') data = { items: pool }
        else if (url.pathname === '/api/v1/chat/threads') data = { items: mine }
        else if (url.pathname === '/api/v1/chat/unread') data = { total: 2, byThread: { 'mine-1': 2 } }
        else if (url.pathname === '/api/v1/notifications/unread-count') data = { count: 0 }
        else if (url.pathname === '/api/v1/notifications') data = { items: [] }
        else if (url.pathname === '/api/v1/ai/disclosure/status') data = { version: 'v', accepted: true, acceptedAt: '2026-10-01T00:00:00.000Z' }
        else report.unknownApi.push({ phase: 'measure', method: p.request.method, path: url.pathname })
        const headers = [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: ORIGIN }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,HEAD,OPTIONS,PATCH,POST' }]
        await cdp.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: true, data })).toString('base64') })
      })().catch(e => report.harnessErrors.push(e.message))
    }
    if (method === 'Runtime.exceptionThrown') report.errors.push(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text)
    if (method === 'Runtime.consoleAPICalled' && p.type === 'error') report.errors.push(p.args.map(a => a.value ?? a.description).join(' '))
  }
  for (const domain of ['Page', 'Network', 'Runtime', 'Log']) await cdp.send(`${domain}.enable`)
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT })

  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 1024 })
    await cdp.send('Page.navigate', { url: `${ORIGIN}${PAGE}` })
    await ready(`location.pathname === '${PAGE}' && [...document.querySelectorAll('main h2')].some(h => /Your conversations/i.test(h.innerText)) && document.querySelectorAll('main ul').length >= 2 && document.querySelectorAll('main ul')[1].children.length > 0`, 'inbox rows')
    await cdp.eval('document.fonts.ready')
    await settle()
    report.measurements[`${width}`] = await cdp.eval(MEASURE)
    await shot(`inbox-${width}`)
  }
  await writeFile(`${OUT}inbox-padding.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.measurements, null, 2))
  console.log(JSON.stringify({ errors: report.errors, unknownApi: report.unknownApi, screenshots: report.screenshots }))
  await cdp.send('Target.closeTarget', { targetId })
  await browser.send('Target.disposeBrowserContext', { browserContextId })
  browser.close(); cdp.close(); edge.kill('SIGTERM')
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
}
run().catch(async (e) => { console.error(e); try { edge?.kill('SIGTERM'); profile && await rm(profile, { recursive: true, force: true }) } catch {} ; process.exitCode = 1 })
