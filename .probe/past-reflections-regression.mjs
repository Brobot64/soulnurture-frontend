// UI-only regression. Run: node <absolute path to this file>
// Starts ONLY an isolated Edge/profile; uses the existing Vite server on :5050.
// All /api/ HTTP and WebSocket traffic is synthetic. No credentials or real input.
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('./', import.meta.url))
const OUT = fileURLToPath(new URL('./shots/', import.meta.url))
const ORIGIN = 'http://localhost:5050'
const report = { assertions: [], measurements: [], screenshots: [], requests: [], errors: [], unknownApi: [], writes: [], escapedApi: [], harnessErrors: [] }
const user = { id: 'fixture-student', name: 'Test Student', email: 'fixture@example.test', role: 'STUDENT', emailVerified: true, mustChangePassword: false, schoolId: 'fixture-school' }
const entries = Array.from({ length: 36 }, (_, i) => ({ checkInId: `fixture-check-in-${i}`, feeling: 'NORMAL', triggers: [], createdAt: new Date(Date.UTC(2026, 9, 28 - i, 12)).toISOString(), conversationId: `fixture-conversation-${i}`, summary: `Synthetic reflection ${i + 1}: I took a moment to pause, notice how I was feeling, and think about what could help me today. This is local UI test data, not a real student's reflection.` }))
let fixtureEmpty = false
let phase = 'startup'
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
  localStorage.setItem('natlas.past-reflections.open', '1');
  sessionStorage.clear();
  // Socket.IO is also isolated: do not let native API WebSockets connect.
  const NativeWebSocket = window.WebSocket;
  window.__fixtureSockets = [];
  window.WebSocket = new Proxy(NativeWebSocket, { construct(Target, args) {
    const url = new URL(args[0], location.href);
    if (!url.pathname.startsWith('/api/')) return Reflect.construct(Target, args);
    window.__fixtureSockets.push(url.href);
    const socket = new EventTarget();
    Object.assign(socket, { url: url.href, readyState: 0, bufferedAmount: 0, extensions: '', protocol: '', binaryType: 'arraybuffer' });
    const emit = (type, event) => { socket.dispatchEvent(event); socket['on' + type]?.(event); };
    socket.send = (data) => { if (data === '40') queueMicrotask(() => emit('message', new MessageEvent('message', { data: '40{"sid":"fixture-socket"}' }))); };
    socket.close = () => { socket.readyState = 3; emit('close', new CloseEvent('close', { code: 1000, wasClean: true })); };
    setTimeout(() => { socket.readyState = 1; emit('open', new Event('open')); emit('message', new MessageEvent('message', { data: '0{"sid":"fixture-socket","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":1000000}' })); }, 0);
    return socket;
  }});
  window.__visible = el => !!el && el.checkVisibility({ checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 0 && (!el.closest('details:not([open])') || el.tagName === 'SUMMARY');
  window.__opener = () => [...document.querySelectorAll('button[aria-label="Show past reflections"]')].find(window.__visible);
  window.__fire = el => { if (!el) throw Error('Missing interaction target'); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); };
  window.__rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  window.__chrome = () => [...document.querySelectorAll('header,footer')].map(el => ({ tag: el.tagName, rect: window.__rect(el), text: el.innerText }));
  window.__snap = () => {
    const main = document.querySelector('#main-content'), dialog = document.querySelector('dialog'), panel = dialog?.firstElementChild, list = panel?.lastElementChild;
    return {
      path: location.pathname, viewport: [innerWidth,innerHeight], doc: [document.documentElement.clientWidth,document.documentElement.scrollWidth],
      main: { rect: window.__rect(main), scrollTop: main.scrollTop, scrollHeight: main.scrollHeight, clientHeight: main.clientHeight, scrollWidth: main.scrollWidth, clientWidth: main.clientWidth, overflow: main.style.overflow, overflowY: getComputedStyle(main).overflowY },
      opener: window.__rect(window.__opener()), visibleOpeners: [...document.querySelectorAll('button[aria-label="Show past reflections"]')].filter(window.__visible).length,
      visibleAsides: [...document.querySelectorAll('aside[aria-label="Past reflections"]')].filter(window.__visible).length,
      oldDropdowns: [...document.querySelectorAll('summary,button')].filter(el => window.__visible(el) && /past reflections/i.test(el.innerText) && el !== window.__opener() && !el.closest('dialog')).map(el => el.outerHTML),
      dialogOpen: dialog?.open ?? false, modal: !!dialog?.matches(':modal'), dialogRect: window.__rect(dialog), panel: window.__rect(panel),
      list: list ? { rect: window.__rect(list), scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, scrollWidth: list.scrollWidth, clientWidth: list.clientWidth, overflowY: getComputedStyle(list).overflowY, overscrollY: getComputedStyle(list).overscrollBehaviorY, links: list.querySelectorAll('a').length } : null,
      focus: document.activeElement?.getAttribute('aria-label'), selected: document.querySelector('[role="radio"][aria-checked="true"]')?.innerText, note: document.querySelector('textarea')?.value,
      pref: localStorage.getItem('natlas.past-reflections.open'), chrome: window.__chrome(), background: dialog ? getComputedStyle(dialog, '::backdrop').backgroundColor : null
    };
  };
})()`

let edge, profile, browser, cdp
async function ready(predicate, label = predicate) {
  const result = await cdp.eval(`new Promise(resolve => { const start = performance.now(); const poll = () => { if (${predicate}) resolve(true); else if (performance.now() - start > 12000) resolve(false); else requestAnimationFrame(poll); }; poll(); })`)
  if (!result) throw new Error(`UI wait failed: ${label}; ${await cdp.eval('document.body.innerText.slice(0,1200)')}`)
}
async function settle() { await cdp.eval('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))') }
async function snapshot(label) { const snap = await cdp.eval('__snap()'); report.measurements.push({ phase, label, ...snap }); return snap }
async function shot(name) { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const path = `${OUT}${name}.png`; await writeFile(path, Buffer.from(data, 'base64')); report.screenshots.push(path) }
async function viewport(width, height) { await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 1024 }); await settle() }
async function navigateCheckIn() {
  await cdp.send('Page.navigate', { url: `${ORIGIN}/check-in` })
  await ready('location.pathname === "/check-in" && document.querySelector("textarea") && document.querySelector("dialog") && document.querySelector("[role=radio]")', 'check-in with fixture history loaded')
  await cdp.eval('document.fonts.ready.then(() => Promise.allSettled(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished)))')
  await settle()
}
async function openDrawer() { await cdp.eval('__opener().focus({preventScroll:true}); __fire(__opener())'); await ready('document.querySelector("dialog")?.matches(":modal")', 'drawer open'); await settle() }
function overflow(s, label) { assert(`${label}: no horizontal overflow`, s.doc[0] === s.doc[1] && s.main.scrollWidth <= s.main.clientWidth + 1 && (!s.dialogOpen || s.list.scrollWidth <= s.list.clientWidth + 1), { document: s.doc, main: [s.main.clientWidth,s.main.scrollWidth], list: s.dialogOpen ? [s.list.clientWidth,s.list.scrollWidth] : null }) }
async function closeDrawer(method, before) {
  const expression = method === 'close-button' ? '__fire(document.querySelector("button[aria-label=\\"Close past reflections\\"]"))' : method === 'backdrop' ? 'document.querySelector("dialog").dispatchEvent(new MouseEvent("click", {bubbles:true,cancelable:true,clientX:10,clientY:200}))' : 'document.querySelector("dialog").dispatchEvent(new Event("cancel", {cancelable:true}))'
  await cdp.eval(expression)
  await ready('!document.querySelector("dialog")?.open', method)
  await settle()
  const s = await snapshot(method)
  assert(`${method}: closes, restores focus/overflow/scroll`, !s.dialogOpen && !s.modal && s.focus === 'Show past reflections' && s.main.overflow === before.main.overflow && s.main.scrollTop === before.main.scrollTop, { focus: s.focus, scrollBefore: before.main.scrollTop, scrollAfter: s.main.scrollTop, overflow: s.main.overflow })
  assert(`${method}: mood and note retained`, /Great/.test(s.selected) && s.note === 'Synthetic unsaved note: keep this while viewing history.', { selected: s.selected, note: s.note })
  return s
}

async function run() {
  profile = await mkdtemp(`${ROOT}past-reflections-edge-`)
  edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', 'about:blank'], { stdio: ['ignore','ignore','pipe'] })
  const wsUrl = await new Promise((resolve,reject) => {
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
  const fulfilled = new Set()
  cdp.onEvent = (method,p) => {
    if (method === 'Fetch.requestPaused') {
      void (async () => {
        const url = new URL(p.request.url)
        if (!url.pathname.startsWith('/api/')) { await cdp.send('Fetch.continueRequest', { requestId: p.requestId }); return }
        if (p.networkId) fulfilled.add(p.networkId)
        report.requests.push({ phase, method: p.request.method, path: url.pathname })
        let data, status = 200
        if (!['GET','HEAD','OPTIONS'].includes(p.request.method)) { report.writes.push({ phase, method: p.request.method, path: url.pathname }); data = { message: 'UI fixture blocks writes' }; status = 405 }
        else if (p.request.method === 'OPTIONS') data = {}
        else if (url.pathname === '/api/v1/users/me') data = user
        else if (url.pathname === '/api/v1/check-ins/history') data = { items: fixtureEmpty ? [] : entries }
        else if (url.pathname === '/api/v1/ai/disclosure/status') data = { version: 'fixture-v1', accepted: true, acceptedAt: '2026-10-01T00:00:00.000Z' }
        else if (url.pathname === '/api/v1/ai-response-reports/mine') data = { items: [] }
        else if (url.pathname === '/api/v1/notifications/unread-count') data = { count: 0 }
        else if (url.pathname === '/api/v1/chat/unread') data = { total: 0, byThread: {} }
        else if (/^\/api\/v1\/conversations\/fixture-conversation-\d+$/.test(url.pathname)) data = { id: url.pathname.split('/').pop(), checkInId: null, status: 'CLOSED', messages: [{ id: 'fixture-message', role: 'ASSISTANT', content: 'Synthetic closed reflection. No backend has been contacted.', createdAt: entries[0].createdAt }] }
        else { report.unknownApi.push({ phase, path: url.pathname }); data = { items: [] } }
        const responseHeaders = [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: ORIGIN }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,HEAD,OPTIONS' }]
        await cdp.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: status, responseHeaders, body: Buffer.from(JSON.stringify({ success: status === 200, data })).toString('base64') })
      })().catch(error => report.harnessErrors.push(error.message))
    }
    if (method === 'Runtime.exceptionThrown') report.errors.push({ phase, type: 'exception', text: p.exceptionDetails.exception?.description ?? p.exceptionDetails.text })
    if (method === 'Runtime.consoleAPICalled' && p.type === 'error') report.errors.push({ phase, type: 'console', text: p.args.map(a => a.value ?? a.description).join(' ') })
    if (method === 'Log.entryAdded' && p.entry.level === 'error') report.errors.push({ phase, type: 'log', text: p.entry.text })
    if (method === 'Network.responseReceived' && new URL(p.response.url).pathname.startsWith('/api/') && !fulfilled.has(p.requestId)) report.escapedApi.push(p.response.url)
    if (method === 'Network.webSocketCreated' && new URL(p.url).pathname.startsWith('/api/')) report.escapedApi.push(p.url)
  }
  for (const domain of ['Page','Network','Runtime','Log']) await cdp.send(`${domain}.enable`)
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.setBypassServiceWorker', { bypass: true })
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT })

  for (const [width,height] of [[390,844],[320,700],[628,944]]) {
    phase = `${width}x${height}`
    await viewport(width,height); await navigateCheckIn()
    const initial = await snapshot('initial-closed')
    assert('initial closed despite desktop preference open; one opener; no aside/dropdown', !initial.dialogOpen && initial.pref === '1' && initial.visibleOpeners === 1 && initial.visibleAsides === 0 && initial.oldDropdowns.length === 0, { pref: initial.pref, openers: initial.visibleOpeners, asides: initial.visibleAsides, dropdowns: initial.oldDropdowns.length })
    overflow(initial, 'closed')
    await shot(`past-reflections-${width}-closed`)
    await cdp.eval(`(() => { const mood = [...document.querySelectorAll('[role="radio"]')].find(el => el.innerText.includes('Great')); __fire(mood); const note = document.querySelector('textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(note, 'Synthetic unsaved note: keep this while viewing history.'); note.dispatchEvent(new Event('input', {bubbles:true})); })()`)
    await settle()
    await cdp.eval('document.querySelector("#main-content").scrollTop = 99999')
    await settle()
    const scrolled = await snapshot('main-scrolled')
    assert('sticky opener remains fully inside main at maximum scroll', scrolled.main.scrollTop > 0 && scrolled.opener.y >= scrolled.main.rect.y - 1 && scrolled.opener.bottom <= scrolled.main.rect.bottom, { scrollTop: scrolled.main.scrollTop, opener: scrolled.opener, main: scrolled.main.rect })
    await openDrawer()
    const opened = await snapshot('open')
    const expectedWidth = Math.min(340, width - 48)
    assert('right pinned/full-height panel and usable backdrop', opened.modal && opened.panel.y === 0 && opened.panel.height === height && opened.panel.right === width && opened.panel.width === expectedWidth, { panel: opened.panel, backdropWidth: opened.panel.x, color: opened.background })
    assert('main scroll locked; header/footer geometry and text unchanged', opened.main.overflowY === 'hidden' && opened.main.scrollTop === scrolled.main.scrollTop && JSON.stringify(opened.chrome) === JSON.stringify(scrolled.chrome), { overflowY: opened.main.overflowY, chrome: opened.chrome.map(c => ({tag:c.tag,rect:c.rect})) })
    assert('dialog focus stays inside modal', await cdp.eval('document.querySelector("dialog").contains(document.activeElement)'), opened.focus)
    await cdp.eval('__opener().focus({preventScroll:true})')
    assert('native modal blocks background focus and backdrop hit-tests to dialog', await cdp.eval('document.querySelector("dialog").contains(document.activeElement) && document.elementFromPoint(10,200) === document.querySelector("dialog")'))
    await cdp.eval('__fire(document.querySelector("dialog").firstElementChild.firstElementChild)'); await settle()
    assert('clicking drawer header does not dismiss', await cdp.eval('document.querySelector("dialog").matches(":modal")'))
    await cdp.eval('document.querySelector("dialog").firstElementChild.lastElementChild.scrollTop = 600')
    await settle()
    const listScrolled = await snapshot('list-scrolled')
    assert('36-entry list scrolls independently with contained overscroll', listScrolled.list.links === 36 && listScrolled.list.scrollTop === 600 && listScrolled.list.overflowY === 'auto' && listScrolled.list.overscrollY === 'contain' && listScrolled.main.scrollTop === scrolled.main.scrollTop, { list: listScrolled.list, mainScroll: listScrolled.main.scrollTop })
    assert('list scrolling preserves fixed panel/header and underlying chrome', JSON.stringify(listScrolled.panel) === JSON.stringify(opened.panel) && JSON.stringify(listScrolled.list.rect) === JSON.stringify(opened.list.rect) && JSON.stringify(listScrolled.chrome) === JSON.stringify(opened.chrome))
    overflow(listScrolled, 'open')
    await shot(`past-reflections-${width}-open`)
    await closeDrawer('close-button',scrolled)
    await openDrawer(); await closeDrawer('backdrop',scrolled)
    await openDrawer(); await closeDrawer('synthetic-Escape-cancel',scrolled)
    assert('mobile opening/closing leaves desktop preference unchanged', await cdp.eval('localStorage.getItem("natlas.past-reflections.open") === "1"'))
    await shot(`past-reflections-${width}-closed-restored`)
  }

  phase = 'resize-to-desktop'
  await viewport(390,844); await navigateCheckIn(); await openDrawer()
  await viewport(1440,900)
  await ready('!document.querySelector("dialog")?.open && [...document.querySelectorAll("aside[aria-label=\\"Past reflections\\"]")].some(__visible)', 'desktop modal close')
  const desktop = await snapshot('desktop-open')
  assert('mobile-to-desktop closes modal/unlocks main and shows sidebar', !desktop.modal && desktop.main.overflow === '' && desktop.visibleAsides === 1 && desktop.visibleOpeners === 0, { asides: desktop.visibleAsides, modal: desktop.modal, overflow: desktop.main.overflow })
  overflow(desktop, 'desktop sidebar open')
  await shot('past-reflections-1440-desktop-open')
  await cdp.eval('__fire(document.querySelector("button[aria-label=\\"Hide past reflections\\"]"))'); await settle()
  const collapsed = await snapshot('desktop-collapsed')
  assert('desktop collapse persists preference and exposes one reopen control', collapsed.visibleAsides === 0 && collapsed.visibleOpeners === 1 && collapsed.pref === '0', { asides: collapsed.visibleAsides, openers: collapsed.visibleOpeners, pref: collapsed.pref })
  overflow(collapsed,'desktop collapsed')
  await cdp.eval('__fire(__opener())'); await settle()
  const reopened = await snapshot('desktop-reopened')
  assert('desktop reopen restores sidebar/preference', reopened.visibleAsides === 1 && reopened.pref === '1' && reopened.visibleOpeners === 0)
  await viewport(320,700); const narrowed = await snapshot('desktop-to-mobile')
  assert('narrowing back to mobile starts closed with one opener', !narrowed.modal && narrowed.visibleAsides === 0 && narrowed.visibleOpeners === 1)

  phase = 'history-navigation'
  await openDrawer()
  const href = await cdp.eval('document.querySelector("dialog a").getAttribute("href")')
  assert('first history href targets fixture conversation', href === '/reflection/fixture-conversation-0', href)
  await cdp.eval('__fire(document.querySelector("dialog a"))')
  await ready('location.pathname === "/reflection/fixture-conversation-0" && document.body.innerText.includes("Synthetic closed reflection")', 'synthetic conversation navigation')
  assert('history selection navigates and removes modal/unlocks main', await cdp.eval('!document.querySelector("dialog:modal") && document.querySelector("#main-content").style.overflow === ""'), await cdp.eval('({path:location.pathname,modalCount:document.querySelectorAll("dialog:modal").length,overflow:document.querySelector("#main-content").style.overflow,sockets:window.__fixtureSockets})'))

  phase = 'empty-history'
  fixtureEmpty = true
  await viewport(390,844); await navigateCheckIn(); await openDrawer()
  const emptyText = await cdp.eval('document.querySelector("dialog").innerText')
  assert('empty history renders informative message and no links', /No past reflections yet/.test(emptyText) && await cdp.eval('document.querySelectorAll("dialog a").length === 0'), emptyText)
  overflow(await snapshot('empty-open'),'empty history')
  await shot('past-reflections-390-empty')
  await cdp.eval('__fire(document.querySelector("button[aria-label=\\"Close past reflections\\"]"))'); await settle()
  assert('empty drawer closes and returns focus', await cdp.eval('!document.querySelector("dialog").open && document.activeElement === __opener()'))

  phase = 'overall'
  assert('no console/runtime/browser-log errors', report.errors.length === 0, report.errors)
  assert('all API traffic intercepted; no backend writes attempted', report.escapedApi.length === 0 && report.writes.length === 0 && report.unknownApi.length === 0 && report.harnessErrors.length === 0, { requests: report.requests.length, escaped: report.escapedApi, writes: report.writes, unknown: report.unknownApi, harnessErrors: report.harnessErrors })
}

try { await run() } catch (error) { report.harnessErrors.push(error.stack); console.error(error); process.exitCode = 1 }
finally {
  cdp?.close()
  if (browser) { await browser.send('Browser.close').catch(() => {}); browser.close() }
  else if (edge) edge.kill()
  if (edge && edge.exitCode === null) await new Promise(resolve => { const timer = setTimeout(resolve, 5000); edge.once('exit', () => { clearTimeout(timer); resolve() }) })
  if (profile) { try { await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); report.cleanup = 'own browser closed and temporary profile removed' } catch (error) { report.cleanup = `profile cleanup incomplete: ${error.message}` } }
  report.summary = { passed: report.assertions.filter(a => a.pass).length, failed: report.assertions.filter(a => !a.pass).length, errors: report.errors.length, harnessErrors: report.harnessErrors.length }
  await writeFile(`${OUT}past-reflections-regression.json`, JSON.stringify(report,null,2))
  console.log(JSON.stringify({ summary: report.summary, cleanup: report.cleanup, report: `${OUT}past-reflections-regression.json`, screenshots: report.screenshots },null,2))
  if (report.summary.failed || report.summary.harnessErrors) process.exitCode = 1
}
