// UI-only regression. Run: node <absolute path to this file>
// Starts ONLY an isolated Edge/profile; uses the existing Vite server on :5050.
// All /api/ HTTP and WebSocket traffic is synthetic. No credentials or real input.
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('./', import.meta.url))
const OUT = fileURLToPath(new URL('./shots/', import.meta.url))
const ORIGIN = 'http://localhost:5050'
const VIEWED = 'fixture-conversation-7'
const OTHER = 'fixture-conversation-3'
const report = { assertions: [], measurements: [], screenshots: [], requests: [], errors: [], unknownApi: [], writes: [], escapedApi: [], harnessErrors: [] }
const user = { id: 'fixture-student', name: 'Test Student', email: 'fixture@example.test', role: 'STUDENT', emailVerified: true, mustChangePassword: false, schoolId: 'fixture-school' }
const entries = Array.from({ length: 12 }, (_, i) => ({
  checkInId: `fixture-check-in-${i}`,
  feeling: 'NORMAL',
  triggers: [],
  createdAt: new Date(Date.UTC(2026, 9, 26 - i, 12)).toISOString(),
  conversationId: `fixture-conversation-${i}`,
  summary: `Synthetic reflection ${i + 1}: paused, noticed how I was feeling, and thought about what would help today. Local UI test data, not a real student's reflection.`,
}))
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
  sessionStorage.clear();
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
    setTimeout(() => { socket.readyState = 1; emit('open', new Event('open')); emit('message', new MessageEvent('message', { data: '0{"sid":"fixture-socket","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":100000}' })); }, 0);
    return socket;
  }});
  window.__visible = el => !!el && el.checkVisibility({ checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 0 && !el.closest('dialog');
  window.__rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  window.__fire = el => { if (!el) throw Error('Missing interaction target'); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); };
  window.__opener = () => [...document.querySelectorAll('button[aria-label="Show past reflections"]')].find(window.__visible);
  // Anything that reads as a "Past reflections" toggle outside the drawer is the old accordion.
  window.__dropdowns = () => [...document.querySelectorAll('button,summary')].filter(el => window.__visible(el) && /^past reflections$/i.test(el.innerText.trim()) && el !== window.__opener()).map(el => el.outerHTML.slice(0, 160));
  window.__rows = scope => [...(scope || document).querySelectorAll('a[href^="/reflection/"]')].filter(el => el.checkVisibility({ checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 0);
  window.__snap = () => {
    const dialog = document.querySelector('dialog');
    const panel = dialog?.firstElementChild;
    const list = panel?.lastElementChild;
    const main = document.querySelector('#main-content');
    const shell = document.querySelector('[role="log"]');
    // A closed <dialog> is still in the DOM: only treat it as the scope while open.
    const scope = dialog?.open ? dialog : document;
    const active = dialog?.open ? dialog.querySelector('a[aria-current]') : document.querySelector('aside a[aria-current]');
    const plain = window.__rows(scope).find(el => !el.hasAttribute('aria-current'));
    return {
      path: location.pathname, viewport: [innerWidth, innerHeight],
      doc: [document.documentElement.clientWidth, document.documentElement.scrollWidth],
      main: main ? { scrollTop: main.scrollTop, overflow: main.style.overflow, overflowY: getComputedStyle(main).overflowY, clientHeight: main.clientHeight, scrollHeight: main.scrollHeight } : null,
      shell: shell ? { rect: window.__rect(shell), overflowY: getComputedStyle(shell).overflowY, clientHeight: shell.clientHeight, scrollHeight: shell.scrollHeight, bottom: shell.getBoundingClientRect().bottom } : null,
      composerVisible: !!document.querySelector('input[aria-label="Type a reply"]')?.checkVisibility({ checkVisibilityCSS: true }),
      opener: window.__rect(window.__opener()), visibleOpeners: [...document.querySelectorAll('button[aria-label="Show past reflections"]')].filter(window.__visible).length,
      dropdowns: window.__dropdowns(),
      dialogOpen: dialog?.open ?? false, modal: !!dialog?.matches(':modal'), panel: window.__rect(panel),
      list: list ? { rect: window.__rect(list), overflowY: getComputedStyle(list).overflowY, overscroll: getComputedStyle(list).overscrollBehaviorY, clientHeight: list.clientHeight, scrollHeight: list.scrollHeight, scrollTop: list.scrollTop } : null,
      rowCount: window.__rows(dialog || document).length,
      asideLinks: document.querySelectorAll('aside a[href^="/reflection/"]').length,
      asideState: (() => { const a = document.querySelector('aside'); const l = a && a.querySelector('div[class*="overflow-y-auto"]'); return a ? { display: getComputedStyle(a).display, rect: window.__rect(a), listChildren: l ? l.childElementCount : null, listText: l ? l.innerText.slice(0, 80) : null } : null })(),
      firstAnchor: (() => { const a = document.querySelector('aside a[href^="/reflection/"]'); return a ? { rect: window.__rect(a), display: getComputedStyle(a).display, visibility: getComputedStyle(a).visibility, checkVisibility: a.checkVisibility({ checkVisibilityCSS: true }), offsetParent: !!a.offsetParent, cls: a.className, parentRect: window.__rect(a.parentElement) } : null })(),
      anchorDiag: [...document.querySelectorAll('aside a[href^="/reflection/"]')].slice(0, 2).map(el => ({ vis: el.checkVisibility({ checkVisibilityCSS: true }), w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, ov: getComputedStyle(el).visibility, disp: getComputedStyle(el).display, cv: getComputedStyle(el).contentVisibility, parentOv: getComputedStyle(el.parentElement).overflow, gpDisp: getComputedStyle(el.parentElement.parentElement).display })),
      debug: window.__rows(dialog || document).slice(0, 3).map(el => ({ href: el.getAttribute('href'), aria: el.getAttribute('aria-current'), cls: el.className, bg: getComputedStyle(el).backgroundColor })),
      activeHref: document.querySelector('[role="log"]') ? location.pathname : null,
      active: active ? { href: active.getAttribute('href'), aria: active.getAttribute('aria-current'), rect: window.__rect(active), text: active.innerText.slice(0, 40), background: getComputedStyle(active).backgroundColor, border: getComputedStyle(active).borderColor, dot: !!active.querySelector('span[aria-hidden="true"]') } : null,
      plain: plain ? { href: plain.getAttribute('href'), aria: plain.getAttribute('aria-current'), background: getComputedStyle(plain).backgroundColor, summarySize: getComputedStyle(plain.lastElementChild).fontSize, clamp: getComputedStyle(plain.lastElementChild).webkitLineClamp } : null,
      focus: document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName,
      rowLinkEscaped: !!(dialog && window.__rows(dialog).some(el => el.hasAttribute('aria-current') && el.getAttribute('href') !== location.pathname)),
    };
  };
})()`

let edge, profile, browser, cdp
async function ready(predicate, label = predicate) {
  const result = await cdp.eval(`new Promise(resolve => { const start = performance.now(); const poll = () => { if (${predicate}) resolve(true); else if (performance.now() - start > 15000) resolve(false); else requestAnimationFrame(poll); }; poll(); })`)
  if (!result) throw new Error(`UI wait failed: ${label}; ${await cdp.eval('document.body.innerText.slice(0,1200)')}`)
}
async function settle() { await cdp.eval('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))') }
async function snapshot(label) { const snap = await cdp.eval('__snap()'); report.measurements.push({ phase, label, ...snap }); return snap }
async function shot(name) { const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const path = `${OUT}${name}.png`; await writeFile(path, Buffer.from(data, 'base64')); report.screenshots.push(path) }
async function viewport(width, height) { await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 1024 }); await settle() }
async function openDrawer() { await cdp.eval('__opener().focus({preventScroll:true}); __fire(__opener())'); await ready('document.querySelector("dialog")?.matches(":modal")', 'drawer open'); await settle() }
async function closeDrawer(method) {
  const expression = method === 'close-button'
    ? '__fire(document.querySelector("button[aria-label=\\"Close past reflections\\"]"))'
    : method === 'backdrop'
      ? 'document.querySelector("dialog").dispatchEvent(new MouseEvent("click", {bubbles:true,cancelable:true,clientX:10,clientY:200}))'
      : 'document.querySelector("dialog").dispatchEvent(new Event("cancel", {cancelable:true}))'
  await cdp.eval(expression)
  await ready('!document.querySelector("dialog")?.open', method)
  await settle()
}
async function visit(id) {
  await cdp.send('Page.navigate', { url: `${ORIGIN}/reflection/${id}` })
  await ready(`location.pathname === "/reflection/${id}" && document.querySelector('[role="log"]') && document.querySelector('button[aria-label="Show past reflections"]')`, `${id} loaded with history`)
  await cdp.eval('document.fonts.ready')
  await settle()
}

async function run() {
  profile = await mkdtemp(`${ROOT}reflection-history-edge-`)
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
  const fulfilled = new Set()
  cdp.onEvent = (method, p) => {
    if (method === 'Fetch.requestPaused') {
      void (async () => {
        const url = new URL(p.request.url)
        if (!url.pathname.startsWith('/api/')) { await cdp.send('Fetch.continueRequest', { requestId: p.requestId }); return }
        if (p.networkId) fulfilled.add(p.networkId)
        report.requests.push({ phase, method: p.request.method, path: url.pathname })
        let data, status = 200
        if (!['GET', 'HEAD', 'OPTIONS'].includes(p.request.method)) { report.writes.push({ phase, method: p.request.method, path: url.pathname }); data = { message: 'UI fixture blocks writes' }; status = 405 }
        else if (url.pathname === '/api/v1/users/me') data = user
        else if (url.pathname === '/api/v1/check-ins/history') data = { items: entries }
        else if (url.pathname === '/api/v1/ai/disclosure/status') data = { version: 'fixture-v1', accepted: true, acceptedAt: '2026-10-01T00:00:00.000Z' }
        else if (url.pathname === '/api/v1/ai/disclosure') data = { version: 'fixture-v1', consentVersion: 'fixture-v1', title: 'Synthetic disclosure', intro: 'Fixture copy.', groups: [], agreements: [], confirmLabel: 'I understand', declineLabel: 'Go back', text: 'Fixture disclosure text.' }
        else if (url.pathname === '/api/v1/ai-response-reports/mine') data = { items: [] }
        else if (url.pathname === '/api/v1/notifications/unread-count') data = { count: 0 }
        else if (url.pathname === '/api/v1/chat/unread') data = { total: 0, byThread: {} }
        else if (/^\/api\/v1\/check-ins\/fixture-check-in-\d+$/.test(url.pathname)) data = { id: url.pathname.split('/').pop(), feeling: 'SAD_LOW', intensity: 'SOMEWHAT', description: 'Synthetic check-in note.', triggers: ['School'], createdAt: entries[0].createdAt }
        else if (/^\/api\/v1\/conversations\/fixture-conversation-\d+$/.test(url.pathname)) {
          const id = url.pathname.split('/').pop()
          data = { id, checkInId: id.replace('conversation', 'check-in'), status: 'CLOSED', messages: [
            { id: `${id}-m1`, role: 'USER', content: 'Synthetic student reply.', createdAt: '2026-10-20T12:01:00.000Z' },
            { id: `${id}-m2`, role: 'ASSISTANT', content: 'Synthetic closed reflection. No backend has been contacted.', aiPayload: { asyncState: 'COMPLETE' }, createdAt: '2026-10-20T12:02:00.000Z' },
          ] }
        }
        else { report.unknownApi.push({ phase, path: url.pathname }); data = { items: [] } }
        const headers = [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: ORIGIN }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,HEAD,OPTIONS' }]
        await cdp.send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: status, responseHeaders: headers, body: Buffer.from(JSON.stringify({ success: status === 200, data })).toString('base64') })
      })().catch(error => report.harnessErrors.push(error.message))
    }
    if (method === 'Runtime.exceptionThrown') report.errors.push({ phase, type: 'exception', text: p.exceptionDetails.exception?.description ?? p.exceptionDetails.text })
    if (method === 'Runtime.consoleAPICalled' && p.type === 'error') report.errors.push({ phase, type: 'console', text: p.args.map(a => a.value ?? a.description).join(' ') })
    if (method === 'Log.entryAdded' && p.entry.level === 'error') report.errors.push({ phase, type: 'log', text: p.entry.text })
    if (method === 'Network.responseReceived' && new URL(p.response.url).pathname.startsWith('/api/') && !fulfilled.has(p.requestId)) report.escapedApi.push(p.response.url)
    if (method === 'Network.webSocketCreated' && new URL(p.url).pathname.startsWith('/api/')) report.escapedApi.push(p.url)
  }
  for (const domain of ['Page', 'Network', 'Runtime', 'Log']) await cdp.send(`${domain}.enable`)
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.setBypassServiceWorker', { bypass: true })
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] })
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: INIT })

  for (const [width, height] of [[390, 844], [320, 700], [628, 885]]) {
    phase = `mobile ${width}x${height}`
    await viewport(width, height)
    await visit(VIEWED)
    let s = await snapshot('closed')
    assert(`${phase}: history accordion is gone`, s.dropdowns.length === 0, s.dropdowns)
    assert(`${phase}: one drawer opener`, s.visibleOpeners === 1 && s.opener?.width > 0, { visibleOpeners: s.visibleOpeners, opener: s.opener })
    assert(`${phase}: read-only conversation hides the composer`, s.composerVisible === false, s.composerVisible)
    assert(`${phase}: chat is the only scroller, page fixed`, s.main.scrollHeight <= s.main.clientHeight + 1 && s.shell.scrollHeight >= s.shell.clientHeight, { main: s.main, shell: [s.shell.clientHeight, s.shell.scrollHeight] })
    assert(`${phase}: no horizontal overflow`, s.doc[0] === s.doc[1], s.doc)
    if (width === 390) await shot('reflection-history-390-closed')

    await openDrawer()
    s = await snapshot('open')
    assert(`${phase}: drawer opens modally, right-anchored`, s.dialogOpen && s.modal && Math.abs(s.panel.right - width) <= 1 && s.panel.width <= width - 40, { panel: s.panel })
    assert(`${phase}: drawer list scrolls in itself`, s.list.overflowY === 'auto' && s.list.scrollHeight > s.list.clientHeight, s.list)
    assert(`${phase}: background scroll locked`, s.main.overflow === 'hidden', s.main)
    assert(`${phase}: active reflection marked, others not`, s.active?.href === `/reflection/${VIEWED}` && !!s.active?.dot && s.plain?.href !== `/reflection/${VIEWED}`, { active: s.active, plain: s.plain })
    assert(`${phase}: active row visually distinct from siblings`, !!s.active && s.active.background !== 'rgba(0, 0, 0, 0)' && s.active.background !== s.plain?.background, { activeBg: s.active?.background, plainBg: s.plain?.background })
    assert(`${phase}: no row self-links to the viewed conversation`, s.rowLinkEscaped === false, s.rowLinkEscaped)
    assert(`${phase}: drawer rows all render`, s.rowCount === entries.filter(e => e.conversationId).length, { rowCount: s.rowCount })
    await shot(`reflection-history-${width}-open`)
    console.log(`${phase} drawer rows:`, JSON.stringify(s.debug))

    await closeDrawer('Escape')
    s = await snapshot('escape-restored')
    assert(`${phase}: Escape restores the chat unchanged`, !s.dialogOpen && s.focus === 'Show past reflections' && s.main.overflow === '' && s.main.scrollTop === 0, { focus: s.focus, main: s.main })

    await openDrawer()
    await cdp.eval(`__fire(window.__rows(document.querySelector("dialog")).find(el => el.getAttribute("href") === "/reflection/${OTHER}"))`)
    await ready(`location.pathname === "/reflection/${OTHER}" && !document.querySelector("dialog")?.open`, 'tap navigates and closes')
    await settle()
    s = await snapshot('after-navigation')
    const marked = await cdp.eval('document.querySelector("aside a[aria-current]")?.getAttribute("href") ?? null')
    assert(`${phase}: navigating re-marked the newly viewed reflection`, marked === `/reflection/${OTHER}`, { marked })
  }

  phase = 'mobile 390x844 active-row visible'
  await viewport(390, 844)
  await visit('fixture-conversation-11')
  await openDrawer()
  const s = await snapshot('oldest active')
  assert('drawer shows the viewed conversation as active even at the end of the list', s.active?.href === '/reflection/fixture-conversation-11', s.active)
  assert('the active row is scrolled into view, not left below the fold', s.list.scrollTop > 0 && s.active.rect.y >= s.list.rect.y - 1 && s.active.rect.bottom <= s.list.rect.bottom + 1, { scrollTop: s.list.scrollTop, active: s.active?.rect, list: s.list.rect })
  assert('scrolling the active row into view did not move the page', s.main.scrollTop === 0 && s.doc[0] === s.doc[1], { main: s.main, doc: s.doc })
  await shot('reflection-history-390-active-last')
  await closeDrawer('close-button')

  phase = 'desktop 1440x900'
  await viewport(1440, 900)
  await visit(VIEWED)
  const d = await snapshot('desktop')
  assert('desktop: drawer opener hidden and no accordion', d.visibleOpeners === 0 && d.dropdowns.length === 0, { visibleOpeners: d.visibleOpeners, dropdowns: d.dropdowns })
  assert('desktop: sidebar marks the viewed reflection active', d.active?.href === `/reflection/${VIEWED}` && !!d.active?.dot, d.active)
  assert('desktop: sidebar keeps the smaller type scale', d.plain?.summarySize === '12px' && d.plain?.clamp === '3', d.plain)
  assert('desktop: sidebar row background differs for the active row', !!d.active && d.active.background !== d.plain?.background && d.plain?.background === 'rgb(255, 255, 255)', { activeBg: d.active?.background, plainBg: d.plain?.background })
  console.log(`${phase} rows:`, JSON.stringify(d.debug))
  assert('desktop: no horizontal overflow', d.doc[0] === d.doc[1], d.doc)
  await shot('reflection-history-1440-desktop')

  report.summary = {
    passed: report.assertions.filter(a => a.pass).length,
    failed: report.assertions.filter(a => !a.pass).length,
    errors: report.errors.length,
    harnessErrors: report.harnessErrors.length,
    escapedApi: report.escapedApi.length,
    unexpectedWrites: report.writes.length,
    unknownApi: report.unknownApi.length,
  }
  await cdp.send('Target.closeTarget', { targetId })
  await browser.send('Target.disposeBrowserContext', { browserContextId })
  browser.close(); cdp.close()
  edge.kill('SIGTERM')
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
  await writeFile(`${OUT}reflection-history-regression.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ summary: report.summary, report: `${OUT}reflection-history-regression.json`, screenshots: report.screenshots }, null, 2))
}

run().catch(async (error) => {
  report.fatal = error.message
  await writeFile(`${OUT}reflection-history-regression.json`, JSON.stringify(report, null, 2)).catch(() => {})
  try { edge?.kill('SIGTERM') } catch {}
  try { if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }) } catch {}
  console.error(error.message)
  process.exitCode = 1
})
