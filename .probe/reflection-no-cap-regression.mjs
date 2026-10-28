// UI-only regression for the unlimited check-in. Run: node <absolute path to this file>
// Starts ONLY an isolated Edge/profile; uses the existing Vite server on :5050.
// All /api/ HTTP and WebSocket traffic is synthetic. No credentials or real input.
//
// Proves: a check-in has no turn cap (composer live at 40 student turns and
// after a 41st), "Complete" is the deliberate end (confirm dialog → close →
// mood follow-up), and the server's idle expiry arrives as a push that takes
// the composer away with its own copy.
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('./', import.meta.url))
const OUT = fileURLToPath(new URL('./shots/', import.meta.url))
const ORIGIN = 'http://localhost:5050'
const CONV = 'fixture-conversation-7'
const CHECK_IN = 'fixture-check-in-7'
const DIALOG_LABEL = 'complete-check-in-title'

const report = { assertions: [], measurements: [], screenshots: [], requests: [], errors: [], unknownApi: [], writes: [], escapedApi: [], harnessErrors: [] }
const assert = (name, ok, detail) => { const item = { phase, name, pass: !!ok, detail }; report.assertions.push(item); console.log(`${ok ? 'PASS' : 'FAIL'} ${phase}: ${name} ${JSON.stringify(detail ?? '')}`) }
let phase = 'startup'

/** 40 student turns already on the conversation — 8x the cap this lane removes. */
const TURNS = 40
const iso = (offsetMinutes) => new Date(Date.UTC(2026, 9, 26, 12) + offsetMinutes * 60_000).toISOString()
function seededMessages(count) {
  const list = []
  for (let i = 0; i < count; i++) {
    list.push({ id: `seed-u${i}`, role: 'USER', content: `Synthetic student turn ${i + 1}.`, createdAt: iso(i * 2) })
    list.push({ id: `seed-a${i}`, role: 'ASSISTANT', content: `Synthetic guide reply ${i + 1} — no backend was contacted to produce this.`, aiPayload: { asyncState: 'COMPLETE' }, createdAt: iso(i * 2 + 1) })
  }
  return list
}
let seeded = TURNS
/** Per-viewport write mark: the close-count assertions must not see the
 * previous viewport's traffic. */
let closeMark = 0
const closeCalls = () => report.writes.slice(closeMark).filter((w) => w.path.endsWith('/close'))
const user = { id: 'fixture-student', name: 'Test Student', email: 'fixture@example.test', role: 'STUDENT', emailVerified: true, mustChangePassword: false, schoolId: 'fixture-school' }
const checkIn = { id: CHECK_IN, feeling: 'SAD_LOW', intensity: 'SOMEWHAT', description: 'Synthetic check-in note.', triggers: ['School'], createdAt: iso(0) }

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
    const socket = new EventTarget();
    Object.assign(socket, { url: url.href, readyState: 0, bufferedAmount: 0, extensions: '', protocol: '', binaryType: 'arraybuffer' });
    const emit = (type, event) => { socket.dispatchEvent(event); socket['on' + type]?.(event); };
    socket.__emitData = (data) => emit('message', new MessageEvent('message', { data }));
    socket.send = (data) => { if (data === '40') queueMicrotask(() => socket.__emitData('40{"sid":"fixture-socket"}')); };
    socket.close = () => { socket.readyState = 3; emit('close', new CloseEvent('close', { code: 1000, wasClean: true })); };
    window.__fixtureSockets.push(socket);
    setTimeout(() => { socket.readyState = 1; emit('open', new Event('open')); socket.__emitData('0{"sid":"fixture-socket","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":100000}'); }, 0);
    return socket;
  }});
  // socket.io wire format: engine.io MESSAGE (4) + EVENT (2), then [event, payload].
  window.__push = (event, payload) => {
    const live = window.__fixtureSockets.filter(s => s.readyState === 1);
    live.forEach(s => s.__emitData('42' + JSON.stringify([event, payload])));
    return live.length;
  };
  window.__visible = el => !!el && el.checkVisibility({ checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 0 && !el.closest('[closed]');
  window.__rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  window.__fire = el => { if (!el) throw Error('Missing interaction target'); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); };
  // React owns the input: the native value setter + an input event is the only
  // synthetic way to type into a controlled field.
  window.__type = (el, text) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  window.__button = label => [...document.querySelectorAll('button')].filter(window.__visible).find(el => el.innerText.trim() === label);
  window.__composer = () => document.querySelector('input[aria-label="Type a reply"]');
  window.__dialog = () => document.querySelector(\`dialog[aria-labelledby="${DIALOG_LABEL}"]\`);
  // Student turns are the bubbles painted in the action colour (bg-action).
  window.__turns = () => [...document.querySelectorAll('[role="log"] div')].filter(el => getComputedStyle(el).backgroundColor === 'rgb(36, 100, 72)').length;
  window.__snap = () => {
    const main = document.querySelector('#main-content');
    const log = document.querySelector('[role="log"]');
    const dialog = window.__dialog();
    const composer = window.__composer();
    const scroller = (() => { let el = main; while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement; return el })();
    return {
      path: location.pathname, viewport: [innerWidth, innerHeight],
      doc: [document.documentElement.clientWidth, document.documentElement.scrollWidth],
      main: main ? { clientHeight: main.clientHeight, scrollHeight: main.scrollHeight, scrollTop: main.scrollTop } : null,
      scroller: scroller ? { id: scroller.id || scroller.tagName, clientHeight: scroller.clientHeight, scrollHeight: scroller.scrollHeight } : null,
      log: log ? { clientHeight: log.clientHeight, scrollHeight: log.scrollHeight, overflowY: getComputedStyle(log).overflowY, rect: window.__rect(log) } : null,
      composer: composer ? { visible: window.__visible(composer), disabled: composer.disabled, rect: window.__rect(composer) } : { visible: false },
      sendEnabled: (() => { const b = document.querySelector('button[aria-label="Send"]'); return b ? !b.disabled : null })(),
      mic: !!document.querySelector('button[aria-label="Record a voice note"]')?.checkVisibility({ checkVisibilityCSS: true }),
      complete: (() => { const b = window.__button('Complete'); return b ? { visible: true, disabled: b.disabled, rect: window.__rect(b) } : { visible: false } })(),
      chips: ['Tell you more', 'Show me an idea', 'I would like to talk to someone'].filter(label => !!window.__button(label)),
      userTurns: window.__turns(),
      dialogOpen: !!dialog?.open, dialogModal: !!dialog?.matches(':modal'),
      dialogText: dialog?.innerText.replace(/\\s+/g, ' ').trim().slice(0, 200) ?? null,
      dialogButtons: dialog ? [...dialog.querySelectorAll('button')].map(el => el.innerText.trim()) : [],
      bodyText: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 400),
      // The end-of-chat copy sits after a long transcript, so test it in the
      // page rather than from a truncated body dump.
      expiryCopy: /timed out after a quiet few minutes/.test(document.body.innerText),
      genericCopy: /conversation has ended/i.test(document.body.innerText),
      followupCta: /how are you feeling now\\?/i.test(document.body.innerText),
      timeoutFlash: /timed out/i.test([...document.querySelectorAll('[role="status"]')].map(el => el.innerText).join(' ')),
      followupHeading: [...document.querySelectorAll('h2')].some(el => window.__visible(el) && /how are you feeling now/i.test(el.innerText)),
      moods: [...document.querySelectorAll('[role="radio"]')].filter(window.__visible).length,
      flash: document.querySelector('[role="status"],[role="alert"]')?.innerText?.slice(0, 160) ?? null,
      focus: document.activeElement?.innerText?.trim().slice(0, 30) || document.activeElement?.tagName,
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
async function visit(path) {
  await cdp.send('Page.navigate', { url: `${ORIGIN}${path}` })
  await ready(`location.pathname === ${JSON.stringify(path)}`, `${path} loaded`)
  await cdp.eval('document.fonts.ready')
  await settle()
}
/** The transcript, composer and Complete all arrive with the conversation GET,
 * so wait for them instead of snapshotting the loading skeleton. */
async function openLiveChat(turns) {
  await ready(`window.__fixtureSockets.some(s => s.readyState === 1)`, 'fixture socket connected')
  await ready(`__turns() === ${turns} && __composer()?.checkVisibility({ checkVisibilityCSS: true }) && !!__button('Complete')`, `${turns} turns loaded with a live composer`)
  await settle()
}

async function run() {
  profile = await mkdtemp(`${ROOT}reflection-no-cap-edge-`)
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
  const fulfilled = new Set()
  let closed = false
  cdp.onEvent = (method, p) => {
    if (method === 'Fetch.requestPaused') {
      void (async () => {
        const url = new URL(p.request.url)
        if (!url.pathname.startsWith('/api/')) { await cdp.send('Fetch.continueRequest', { requestId: p.requestId }); return }
        if (p.networkId) fulfilled.add(p.networkId)
        report.requests.push({ phase, method: p.request.method, path: url.pathname })
        let data, status = 200
        const body = p.request.postData ? JSON.parse(p.request.postData) : null
        if (url.pathname === '/api/v1/users/me') data = user
        else if (url.pathname === '/api/v1/check-ins/history') data = { items: [{ checkInId: CHECK_IN, feeling: 'SAD_LOW', triggers: ['School'], createdAt: iso(0), conversationId: CONV, summary: 'Synthetic reflection under test.' }] }
        else if (url.pathname === '/api/v1/ai/disclosure/status') data = { version: 'fixture-v1', accepted: true, acceptedAt: iso(0) }
        else if (url.pathname === '/api/v1/ai-response-reports/mine') data = { items: [] }
        else if (url.pathname === '/api/v1/notifications/unread-count') data = { count: 0 }
        else if (url.pathname === '/api/v1/chat/unread') data = { total: 0, byThread: {} }
        else if (/^\/api\/v1\/check-ins\/fixture-check-in-\d+$/.test(url.pathname)) data = checkIn
        else if (/^\/api\/v1\/check-ins\/fixture-check-in-\d+\/feedback$/.test(url.pathname)) {
          if (p.request.method === 'POST') { report.writes.push({ phase, method: 'POST', path: url.pathname }); data = { id: 'fb-1', checkInId: CHECK_IN, ...body, createdAt: iso(1) } }
          else data = { feedback: null }
        }
        else if (/^\/api\/v1\/conversations\/fixture-conversation-\d+\/messages$/.test(url.pathname)) {
          if (p.request.method !== 'POST') { status = 405; data = { message: 'GET not allowed' } }
          else {
            report.writes.push({ phase, method: 'POST', path: url.pathname })
            const n = ++seeded
            const at = iso(n)
            data = {
              userMessage: { id: `srv-u${n}`, role: 'USER', content: body?.content ?? 'Synthetic', quickReply: body?.quickReply ?? null, createdAt: at },
              assistantMessage: { id: `srv-a${n}`, role: 'ASSISTANT', content: `Synthetic guide reply ${n}.`, aiPayload: { asyncState: 'COMPLETE' }, createdAt: at },
              humanCareRecommendation: null,
              aiPending: false,
            }
          }
        }
        else if (/^\/api\/v1\/conversations\/fixture-conversation-\d+\/close$/.test(url.pathname)) {
          report.writes.push({ phase, method: 'POST', path: url.pathname })
          closed = true
          data = { conversation: { id: CONV, checkInId: CHECK_IN, status: 'CLOSED' }, summaryQueued: true }
        }
        else if (/^\/api\/v1\/conversations\/fixture-conversation-\d+$/.test(url.pathname)) {
          const id = url.pathname.split('/').pop()
          data = { id, checkInId: CHECK_IN, status: closed ? 'CLOSED' : 'ACTIVE', language: 'en', messages: seededMessages(seeded) }
        }
        else { report.unknownApi.push({ phase, method: p.request.method, path: url.pathname }); data = { items: [] } }
        const headers = [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: ORIGIN }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Content-Type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,HEAD,OPTIONS' }]
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

  for (const [width, height] of [[390, 844], [1440, 900]]) {
    phase = `active ${width}x${height}`
    seeded = TURNS
    closed = false
    closeMark = report.writes.length
    await viewport(width, height)
    await visit(`/reflection/${CONV}`)
    await openLiveChat(TURNS)
    let s = await snapshot('40 turns')
    assert(`${phase}: 40 student turns are on screen`, s.userTurns === TURNS, { userTurns: s.userTurns })
    assert(`${phase}: composer still live at 40 turns`, s.composer.visible && !s.composer.disabled, s.composer)
    assert(`${phase}: quick replies still offered`, s.chips.length === 3, s.chips)
    assert(`${phase}: Complete is available while ACTIVE`, s.complete.visible && !s.complete.disabled, s.complete)
    assert(`${phase}: the transcript is the scroller, not the page`, s.log.overflowY === 'auto' && s.log.scrollHeight > s.log.clientHeight && s.main.scrollHeight <= s.main.clientHeight + 1, { log: s.log, main: s.main })
    assert(`${phase}: no horizontal page overflow`, s.doc[0] === s.doc[1], s.doc)
    await shot(`no-cap-${width}-40-turns`)

    phase = `send past the old cap ${width}x${height}`
    await cdp.eval(`__type(__composer(), 'Still here after forty turns')`)
    s = await snapshot('typed')
    assert(`${phase}: send enabled with text`, s.sendEnabled === true, { sendEnabled: s.sendEnabled })
    await cdp.eval(`__fire(document.querySelector('button[aria-label="Send"]'))`)
    await ready(`__turns() === ${TURNS + 1}`, '41st student turn rendered')
    s = await snapshot('after 41st')
    assert(`${phase}: 41st turn accepted`, s.userTurns === TURNS + 1, { userTurns: s.userTurns })
    assert(`${phase}: composer still live after the 41st`, s.composer.visible && !s.composer.disabled, s.composer)
    assert(`${phase}: Complete still available`, s.complete.visible, s.complete)
    await shot(`no-cap-${width}-41-turns`)

    phase = `complete dialog ${width}x${height}`
    await cdp.eval(`__fire(__button('Complete'))`)
    await ready(`__dialog()?.matches(':modal')`, 'confirm dialog opens modally')
    s = await snapshot('confirm open')
    assert(`${phase}: confirm dialog asks before ending`, s.dialogModal && /Complete this reflection\?/i.test(s.dialogText) && /how you're feeling now/i.test(s.dialogText), s.dialogText)
    assert(`${phase}: dialog offers keep-talking and complete`, s.dialogButtons.join('|') === 'Keep talking|Complete reflection', s.dialogButtons)
    assert(`${phase}: chat keeps its geometry behind the dialog`, s.composer.visible, s.composer)
    await shot(`complete-confirm-${width}`)
    await cdp.eval(`__fire([...__dialog().querySelectorAll('button')].find(el => el.innerText.trim() === 'Keep talking'))`)
    await ready(`!__dialog()?.open`, 'keep talking closes it')
    s = await snapshot('kept talking')
    assert(`${phase}: keep talking leaves the chat ACTIVE`, !s.dialogOpen && s.composer.visible && s.complete.visible, { dialogOpen: s.dialogOpen, composer: s.composer.visible })
    assert(`${phase}: no close call after keep talking`, closeCalls().length === 0, closeCalls())

    phase = `complete follow-up ${width}x${height}`
    await cdp.eval(`__fire(__button('Complete'))`)
    await ready(`__dialog()?.matches(':modal')`, 'confirm reopened')
    await cdp.eval(`__fire([...__dialog().querySelectorAll('button')].find(el => el.innerText.trim() === 'Complete reflection'))`)
    await ready(`location.pathname === '/complete/${CHECK_IN}' && document.querySelector('[role="radiogroup"]')`, 'landed on the mood follow-up')
    await cdp.eval('document.fonts.ready')
    await settle()
    s = await snapshot('follow-up')
    assert(`${phase}: closed conversation is not left live`, !s.composer.visible, s.composer)
    assert(`${phase}: follow-up asks how they feel`, s.followupHeading && s.moods === 8, { followupHeading: s.followupHeading, moods: s.moods })
    await shot(`complete-followup-${width}`)
    await cdp.eval(`__fire(document.querySelectorAll('[role="radio"]')[0])`)
    await ready(`!document.querySelector('[role="radiogroup"]')`, 'mood recorded')
    s = await snapshot('mood saved')
    assert(`${phase}: mood tap submits and thanks`, /knowing how you feel after a check-in/i.test(s.bodyText), s.bodyText.slice(0, 120))
    assert(`${phase}: exactly one close call made`, closeCalls().length === 1, closeCalls())
  }

  phase = 'idle expiry push 390x844'
  seeded = 12
  closed = false
  await viewport(390, 844)
  await visit(`/reflection/${CONV}`)
  await openLiveChat(12)
  let s = await snapshot('before push')
  assert('push lane starts live', s.composer.visible && s.complete.visible && s.userTurns === 12, { composer: s.composer.visible, turns: s.userTurns })
  const receivers = await cdp.eval(`__push('conversation.closed', { conversationId: ${JSON.stringify(CONV)}, checkInId: ${JSON.stringify(CHECK_IN)}, reason: 'IDLE' })`)
  assert('expiry push reached a live socket', receivers >= 1, receivers)
  await ready(`!__composer()?.checkVisibility({ checkVisibilityCSS: true })`, 'composer removed by the push')
  await settle()
  s = await snapshot('after IDLE push')
  assert('expiry takes the composer away', !s.composer.visible, s.composer)
  assert('expiry names the reason in its own copy', s.expiryCopy && !s.genericCopy, { expiryCopy: s.expiryCopy, genericCopy: s.genericCopy })
  assert('expiry says so out loud in the flash', s.timeoutFlash, s.flash)
  assert('expiry routes to the mood follow-up', s.followupCta, s.bodyText.slice(-160))
  assert('expiry hides Complete', s.complete.visible === false, s.complete)
  await shot('idle-expiry-390')

  phase = 'manual push from another device 390x844'
  seeded = 6
  closed = false
  await viewport(390, 844)
  await visit(`/reflection/${CONV}`)
  await openLiveChat(6)
  await cdp.eval(`__push('conversation.closed', { conversationId: 'fixture-conversation-99', checkInId: null, reason: 'MANUAL' })`)
  await settle()
  s = await snapshot('other conversation')
  assert('a close for another conversation leaves this chat live', s.composer.visible && s.complete.visible, s.composer)
  await cdp.eval(`__push('conversation.closed', { conversationId: ${JSON.stringify(CONV)}, checkInId: ${JSON.stringify(CHECK_IN)}, reason: 'MANUAL' })`)
  await ready(`!__composer()?.checkVisibility({ checkVisibilityCSS: true })`, 'composer removed by the manual push')
  await settle()
  s = await snapshot('after MANUAL push')
  assert('a close elsewhere ends this chat too', !s.composer.visible, s.composer)
  assert('a close elsewhere uses the generic copy, not the timeout one', s.genericCopy && !s.expiryCopy, { genericCopy: s.genericCopy, expiryCopy: s.expiryCopy })

  report.summary = {
    passed: report.assertions.filter(a => a.pass).length,
    failed: report.assertions.filter(a => !a.pass).length,
    errors: report.errors.length,
    harnessErrors: report.harnessErrors.length,
    escapedApi: report.escapedApi.length,
    writes: report.writes.length,
    unknownApi: report.unknownApi.length,
  }
  await cdp.send('Target.closeTarget', { targetId })
  await browser.send('Target.disposeBrowserContext', { browserContextId })
  browser.close(); cdp.close()
  edge.kill('SIGTERM')
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
  await writeFile(`${OUT}reflection-no-cap-regression.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ summary: report.summary, report: `${OUT}reflection-no-cap-regression.json`, screenshots: report.screenshots }, null, 2))
}

run().catch(async (error) => {
  report.fatal = error.message
  await writeFile(`${OUT}reflection-no-cap-regression.json`, JSON.stringify(report, null, 2)).catch(() => {})
  try { edge?.kill('SIGTERM') } catch {}
  try { if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }) } catch {}
  console.error(error.message)
  process.exitCode = 1
})
