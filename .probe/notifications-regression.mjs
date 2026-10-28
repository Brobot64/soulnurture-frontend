// UI verification only. Run with Node; existing Vite :5050 is never started/restarted.
// Adapted from past-reflections-regression.mjs; that probe and its output are untouched.
// Own isolated headless Edge/profile. Every API request and WebSocket is synthetic.
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('./', import.meta.url))
const OUT = fileURLToPath(new URL('./shots/', import.meta.url))
const ORIGIN = 'http://localhost:5050'
const SOURCE = fileURLToPath(new URL('../src/components/dash/NotificationBell.tsx', import.meta.url))
const report = { assertions: [], measurements: [], screenshots: [], requests: [], errors: [], unknownApi: [], writes: [], escapedApi: [], harnessErrors: [], sockets: [] }
const user = { id: 'fixture-student', name: 'Test Student', email: 'fixture@example.test', role: 'STUDENT', emailVerified: true, mustChangePassword: false, schoolId: 'fixture-school' }
const entries = Array.from({ length: 36 }, (_, i) => ({ checkInId: `fixture-check-in-${i}`, feeling: 'NORMAL', triggers: [], createdAt: new Date(Date.UTC(2026, 9, 28 - i, 12)).toISOString(), conversationId: `fixture-conversation-${i}`, summary: `Synthetic reflection ${i + 1}: I took a moment to pause, notice how I was feeling, and think about what could help me today. This is local UI test data, not a real student's reflection.` }))
const NOW = '2026-10-28T12:00:00.000Z'
const makeItems = () => Array.from({ length: 24 }, (_, i) => ({ id: `fixture-notification-${i}`, type: 'CHAT_MESSAGE', title: i === 0 ? 'A new message from your counsellor with a longer notification title that should wrap naturally without hiding the notification actions' : i === 23 ? 'Final fixture notification 24' : `Counsellor message ${i + 1}: a little encouragement for your day`, body: i === 0 ? 'This is a synthetic notification body with enough text to wrap across multiple lines. Take a moment to pause and notice how you are feeling, and remember that support is available whenever you need it. This long preview should be limited to two visible lines, without any horizontal overflow.' : 'Synthetic notification preview. Your support conversation is ready whenever you would like to continue.', data: { threadId: 'fixture-thread' }, readAt: null, createdAt: new Date(Date.UTC(2026, 9, 28, 12, -i)).toISOString() }))
const thread = { id: 'fixture-thread', schoolId: 'fixture-school', studentId: user.id, professionalId: null, entryCheckInId: null, aiEntrySummary: null, status: 'CLOSED', studentReadAt: null, professionalReadAt: null, claimedAt: null, closedAt: NOW, createdAt: NOW, updatedAt: NOW, student: { userId: user.id, firstName: 'Test', lastName: 'Student', classLabel: null, studentCode: 'FIXTURE' }, professional: null, messages: [{ id: 'fixture-chat-message', threadId: 'fixture-thread', senderUserId: null, role: 'SYSTEM', content: 'Synthetic support conversation. No backend has been contacted.', viaVoice: false, createdAt: NOW }] }
let items = makeItems(), holdList = false, pendingLists = [], phase = 'startup'
const assert = (name, ok, detail) => { report.assertions.push({ phase, name, pass: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${phase}: ${name} ${JSON.stringify(detail ?? '')}`) }
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex')

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
  const NativeWebSocket = window.WebSocket;
  window.__fixtureSockets = [];
  window.WebSocket = new Proxy(NativeWebSocket, { construct(Target, args) {
    const url = new URL(args[0], location.href);
    const engine = url.pathname.startsWith('/api/') || url.pathname.includes('socket.io');
    window.__fixtureSockets.push(url.href);
    const socket = new EventTarget();
    Object.assign(socket, { url: url.href, readyState: 0, bufferedAmount: 0, extensions: '', protocol: '', binaryType: 'arraybuffer' });
    const emit = (type, event) => { socket.dispatchEvent(event); socket['on' + type]?.(event); };
    socket.send = data => { if (engine && data === '40') queueMicrotask(() => emit('message', new MessageEvent('message', { data: '40{"sid":"fixture-socket"}' }))); };
    socket.close = () => { socket.readyState = 3; emit('close', new CloseEvent('close', { code: 1000, wasClean: true })); };
    setTimeout(() => { socket.readyState = 1; emit('open', new Event('open')); if (engine) emit('message', new MessageEvent('message', { data: '0{"sid":"fixture-socket","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":1000000}' })); }, 0);
    return socket;
  }});
  window.__visible = el => !!el && el.checkVisibility({ checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 0;
  window.__bell = () => document.querySelector('button[aria-label="Notifications"]');
  window.__panel = () => document.querySelector('[role="dialog"][aria-label="Notifications"]');
  window.__list = () => __panel()?.lastElementChild;
  window.__close = () => document.querySelector('button[aria-label="Close notifications"]');
  window.__all = () => __panel()?.firstElementChild.querySelector('button');
  window.__backdrop = () => __panel()?.previousElementSibling;
  window.__fire = el => { if (!el) throw Error('Missing interaction target'); el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); };
  window.__rect = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  window.__hit = el => { if (!__visible(el)) return false; const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === el || el.contains(hit); };
  window.__snap = () => {
    const bell = __bell(), panel = __panel(), list = __list(), main = document.querySelector('#main-content'), header = bell?.closest('header'), bar = panel?.firstElementChild, close = __close(), all = __all(), first = list?.querySelector('button'), last = list?.querySelector('button:last-child');
    const text = first?.lastElementChild, title = text?.children[0], body = text?.children[1];
    const style = el => el ? getComputedStyle(el) : null;
    const textInfo = el => el ? { rect: __rect(el), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, lineHeight: style(el).lineHeight, clamp: style(el).webkitLineClamp, display: style(el).display, boxOrient: style(el).webkitBoxOrient } : null;
    return {
      path: location.pathname, viewport: [innerWidth,innerHeight], visualViewport: { width: visualViewport.width, height: visualViewport.height, offsetTop: visualViewport.offsetTop }, doc: [document.documentElement.clientWidth,document.documentElement.scrollWidth], windowScroll: [scrollX,scrollY],
      main: main ? { rect: __rect(main), scrollTop: main.scrollTop, scrollWidth: main.scrollWidth, clientWidth: main.clientWidth } : null,
      bell: __rect(bell), badge: bell?.querySelector('span')?.innerText ?? null, expanded: bell?.getAttribute('aria-expanded'), ariaLinked: !!panel && bell?.getAttribute('aria-controls') === panel.id,
      header: __rect(header), panel: __rect(panel), topVar: panel?.style.getPropertyValue('--notifications-top'), position: style(panel)?.position, maxHeight: style(panel)?.maxHeight, radius: style(panel)?.borderRadius,
      panelScrollWidth: panel?.scrollWidth, panelClientWidth: panel?.clientWidth, bar: __rect(bar), barShrink: style(bar)?.flexShrink, heading: __rect(bar?.firstElementChild),
      all: { rect: __rect(all), disabled: all?.disabled, hit: __hit(all) }, close: { rect: __rect(close), visible: __visible(close), hit: __hit(close) },
      backdrop: __backdrop() ? { rect: __rect(__backdrop()), color: style(__backdrop()).backgroundColor, touchAction: style(__backdrop()).touchAction, hit: document.elementFromPoint(5,innerHeight-5) === __backdrop() } : null,
      list: list ? { rect: __rect(list), scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, scrollWidth: list.scrollWidth, clientWidth: list.clientWidth, overflowY: style(list).overflowY, minHeight: style(list).minHeight, overscrollY: style(list).overscrollBehaviorY, count: list.querySelectorAll('button').length, first: __rect(first), last: __rect(last), lastText: last?.innerText, lastHit: __hit(last) } : null,
      title: textInfo(title), body: textInfo(body), focus: document.activeElement?.getAttribute('aria-label'), focusTag: document.activeElement?.tagName, text: panel?.innerText
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
async function viewport(width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 640 })
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: width < 640, maxTouchPoints: 1 })
  await settle()
}
async function navigateCheckIn() {
  await cdp.send('Page.navigate', { url: `${ORIGIN}/check-in` })
  await ready('location.pathname === "/check-in" && document.querySelector("textarea") && __bell() && document.querySelector("[role=radio]")', 'check-in loaded')
  await ready(`(__bell().querySelector('span')?.innerText ?? '0') === '${items.filter(i => !i.readAt).length}'`, 'fixture badge loaded')
  await cdp.eval('document.fonts.ready.then(() => Promise.allSettled(document.getAnimations().filter(a => a.effect.getComputedTiming().iterations !== Infinity).map(a => a.finished)))')
  report.sockets.push({ phase, urls: await cdp.eval('window.__fixtureSockets') })
  await settle()
}
async function openPanel(waitForRows = true) {
  await cdp.eval('__bell().focus({preventScroll:true}); __fire(__bell())')
  await ready('__panel()', 'notification popup open')
  if (waitForRows) await ready(`__list()?.querySelectorAll('button').length === ${items.length} && (${items.length} > 0 || __panel().innerText.includes('caught up'))`, 'fixture notifications rendered')
  await settle()
}
function overflow(s) {
  assert('no document, main, popup or list horizontal overflow', s.doc[0] === s.doc[1] && s.main.scrollWidth <= s.main.clientWidth + 1 && (!s.panel || (s.panelScrollWidth <= s.panelClientWidth + 1 && s.list.scrollWidth <= s.list.clientWidth + 1)), { document: s.doc, main: [s.main.clientWidth,s.main.scrollWidth], panel: [s.panelClientWidth,s.panelScrollWidth], list: s.list ? [s.list.clientWidth,s.list.scrollWidth] : null })
}
function geometry(s, mobile, checkRows = true) {
  const [width,height] = s.viewport
  assert('popup linked to expanded bell', s.expanded === 'true' && s.ariaLinked)
  assert('popup fully within viewport with bottom clearance', s.panel.x >= 0 && s.panel.y >= 0 && s.panel.right <= width && s.panel.bottom < height, { panel: s.panel, viewport: s.viewport, bottomClearance: height-s.panel.bottom })
  assert('popup header cannot shrink and actions remain visible/hit-testable', s.barShrink === '0' && s.bar.y >= s.panel.y && s.bar.bottom < s.panel.bottom && s.all.rect.y >= s.bar.y && s.all.rect.bottom <= s.bar.bottom && s.all.rect.right <= s.panel.right && s.all.hit && (!mobile || (s.close.hit && s.close.rect.right < s.panel.right)), { bar: s.bar, all: s.all, close: s.close })
  assert('rounded popup', parseFloat(s.radius) > 0, s.radius)
  if (mobile) {
    assert('mobile fixed popup has exact 12px side margins', s.position === 'fixed' && near(s.panel.x,12,0.1) && near(width-s.panel.right,12,0.1), { position:s.position,left:s.panel.x,right:width-s.panel.right })
    assert('mobile top tracks actual header/bell bottom plus 8px', near(s.panel.y,Math.max(s.header.bottom,s.bell.bottom)+8,0.1) && near(parseFloat(s.topVar),s.panel.y,0.1), { headerBottom:s.header.bottom,bellBottom:s.bell.bottom,top:s.panel.y,gap:s.panel.y-s.header.bottom,variable:s.topVar })
    assert('mobile height respects 70dvh and available viewport', s.panel.height <= Math.min(height*0.7,height-s.panel.y-16)+1, { height:s.panel.height,max:Math.min(height*0.7,height-s.panel.y-16),css:s.maxHeight })
    assert('mobile close and read-all touch actions at least 44px', s.close.visible && s.close.rect.width >= 44 && s.close.rect.height >= 44 && s.all.rect.height >= 44 && s.bell.height >= 44, { close:s.close.rect,all:s.all.rect,bell:s.bell })
    assert('mobile backdrop is subtle, full viewport, hit-testable and touch-blocking', s.backdrop.hit && s.backdrop.color !== 'rgba(0, 0, 0, 0)' && /(?:0\.2|20%)/.test(s.backdrop.color) && s.backdrop.rect.width === width && s.backdrop.rect.height === height && s.backdrop.touchAction === 'none', s.backdrop)
  } else {
    assert('desktop 360px absolute popup right-aligned to bell with 8px gap', s.position === 'absolute' && near(s.panel.width,360,0.1) && near(s.panel.right,s.bell.right,0.1) && near(s.panel.y,s.bell.bottom+8,0.1), { position:s.position,panel:s.panel,bell:s.bell })
    assert('desktop maximum heights unchanged at viewport minus 112 and list 420', near(parseFloat(s.maxHeight),height-112) && (!checkRows || near(s.list.rect.height,420)), { css:s.maxHeight,listHeight:s.list.rect.height })
    assert('desktop mobile close hidden and backdrop transparent', !s.close.visible && s.backdrop.color === 'rgba(0, 0, 0, 0)', { close:s.close,backdrop:s.backdrop })
  }
  overflow(s)
  if (checkRows) {
    assert('all 24 items render inside a min-h-0 contained internal scroller', s.list.count === 24 && s.list.minHeight === '0px' && s.list.overflowY === 'auto' && s.list.overscrollY === 'contain' && s.list.scrollHeight > s.list.clientHeight, s.list)
    assert('long title and body wrap without horizontal overflow', s.title.rect.height > parseFloat(s.title.lineHeight)*1.5 && s.title.scrollWidth <= s.title.clientWidth + 1 && s.body.rect.height > parseFloat(s.body.lineHeight)*1.5 && s.body.scrollWidth <= s.body.clientWidth + 1, {title:s.title,body:s.body})
    assert('body obeys its declared two-line clamp', s.body.rect.height <= parseFloat(s.body.lineHeight)*2+1 && s.body.clamp === '2', {body:s.body,visibleLines:s.body.rect.height/parseFloat(s.body.lineHeight)})
  }
}
async function scrollLast(before) {
  await cdp.eval('__list().scrollTop = __list().scrollHeight; __list().dispatchEvent(new Event("scroll", {bubbles:true}))')
  await settle()
  const s = await snapshot('last-item')
  assert('last notification fully reachable and hit-testable inside list', s.list.scrollTop > 0 && near(s.list.scrollTop+s.list.clientHeight,s.list.scrollHeight) && s.list.last.y >= s.list.rect.y-1 && s.list.last.bottom <= s.list.rect.bottom+1 && s.list.lastHit && s.list.lastText.includes('Final fixture notification 24'), { list:s.list.rect,scrollTop:s.list.scrollTop,scrollHeight:s.list.scrollHeight,last:s.list.last,hit:s.list.lastHit })
  assert('internal scroll leaves popup header/actions and page scroll unchanged', JSON.stringify(s.bar) === JSON.stringify(before.bar) && JSON.stringify(s.panel) === JSON.stringify(before.panel) && s.main.scrollTop === before.main.scrollTop && JSON.stringify(s.windowScroll) === JSON.stringify(before.windowScroll) && s.all.hit && (!s.close.visible || s.close.hit), { bar:s.bar,mainScroll:s.main.scrollTop,windowScroll:s.windowScroll })
  return s
}
async function closePanel(method) {
  const expressions = {
    'close-X': '__fire(__close())',
    'backdrop': '__fire(document.elementFromPoint(5,innerHeight-5))',
    'Escape': 'window.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",code:"Escape",bubbles:true,cancelable:true}))',
    'bell-area': '(() => { const r=__bell().getBoundingClientRect(); __fire(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); })()',
    'bell-toggle': '__bell().focus({preventScroll:true}); __fire(__bell())'
  }
  await cdp.eval(expressions[method]); await ready('!__panel()', `${method} closed`); await settle()
  const s = await snapshot(method)
  assert(`${method} closes and returns focus to bell`, !s.panel && s.expanded === 'false' && s.focus === 'Notifications', { focus:s.focus,expanded:s.expanded })
}
async function fulfill(p, data, status = 200) {
  await cdp.send('Fetch.fulfillRequest', { requestId:p.requestId, responseCode:status, responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:ORIGIN},{name:'Access-Control-Allow-Credentials',value:'true'},{name:'Access-Control-Allow-Headers',value:'Content-Type'},{name:'Access-Control-Allow-Methods',value:'GET,HEAD,OPTIONS,POST'}], body:Buffer.from(JSON.stringify({success:status===200,data})).toString('base64') })
}
async function releaseLists() { holdList = false; const requests = pendingLists; pendingLists = []; await Promise.all(requests.map(p => fulfill(p,{items}))) }

async function run() {
  report.sourceHashBefore = await hash(SOURCE)
  report.previousProbeHashBefore = await hash(`${ROOT}past-reflections-regression.mjs`)
  report.previousReportHashBefore = await hash(`${OUT}past-reflections-regression.json`)
  profile = await mkdtemp(`${ROOT}notifications-edge-`)
  edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','about:blank'], {stdio:['ignore','ignore','pipe']})
  const wsUrl = await new Promise((resolve,reject) => {
    let stderr = ''
    const timeout = setTimeout(() => reject(new Error(`Edge startup timeout: ${stderr.slice(-1500)}`)),20000)
    edge.on('error',reject)
    edge.stderr.on('data',chunk => { stderr += chunk; const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/); if(match) {clearTimeout(timeout);resolve(match[1])} })
    edge.once('exit',code => {clearTimeout(timeout);reject(new Error(`Isolated Edge exited ${code}`))})
  })
  report.debugPort = new URL(wsUrl).port
  report.profile = profile
  browser = new Cdp(); await browser.connect(wsUrl)
  report.browser = await browser.send('Browser.getVersion')
  const {browserContextId} = await browser.send('Target.createBrowserContext')
  const {targetId} = await browser.send('Target.createTarget',{url:'about:blank',browserContextId})
  cdp = new Cdp(); await cdp.connect(`ws://127.0.0.1:${report.debugPort}/devtools/page/${targetId}`)
  const fulfilled = new Set()
  cdp.onEvent = (method,p) => {
    if (method === 'Fetch.requestPaused') void (async () => {
      const url = new URL(p.request.url), path = url.pathname, verb = p.request.method
      if (!path.startsWith('/api/') && !path.includes('socket.io')) { await cdp.send('Fetch.continueRequest',{requestId:p.requestId});return }
      if (p.networkId) fulfilled.add(p.networkId)
      report.requests.push({phase,method:verb,path})
      let data, status=200
      if (!['GET','HEAD','OPTIONS'].includes(verb)) {
        let mocked = true
        if (verb === 'POST' && path === '/api/v1/notifications/read-all') {items=items.map(i=>({...i,readAt:NOW}));data={}}
        else if (verb === 'POST' && /^\/api\/v1\/notifications\/fixture-notification-\d+\/read$/.test(path)) {items=items.map(i=>i.id===path.split('/').at(-2)?{...i,readAt:NOW}:i);data={}}
        else if (verb === 'POST' && path === '/api/v1/chat/threads/fixture-thread/read') {thread.studentReadAt=NOW;data={}}
        else {mocked=false;data={message:'Unapproved write blocked by UI fixture'};status=405}
        report.writes.push({phase,method:verb,path,mocked})
      }
      else if (verb === 'OPTIONS') data={}
      else if (path === '/api/v1/users/me') data=user
      else if (path === '/api/v1/check-ins/history') data={items:entries}
      else if (path === '/api/v1/ai/disclosure/status') data={version:'fixture-v1',accepted:true,acceptedAt:'2026-10-01T00:00:00.000Z'}
      else if (path === '/api/v1/ai-response-reports/mine') data={items:[]}
      else if (path === '/api/v1/notifications/unread-count') data={count:items.filter(i=>!i.readAt).length}
      else if (path === '/api/v1/notifications') { if(holdList) {pendingLists.push(p);return};data={items} }
      else if (path === '/api/v1/chat/unread') data={total:0,byThread:{}}
      else if (path === '/api/v1/chat/threads/fixture-thread') data=thread
      else {report.unknownApi.push({phase,path,method:verb});data={items:[]}}
      await fulfill(p,data,status)
    })().catch(error=>report.harnessErrors.push(error.stack))
    if (method === 'Runtime.exceptionThrown') report.errors.push({phase,type:'exception',text:p.exceptionDetails.exception?.description??p.exceptionDetails.text})
    if (method === 'Runtime.consoleAPICalled' && p.type === 'error') report.errors.push({phase,type:'console',text:p.args.map(a=>a.value??a.description).join(' ')})
    if (method === 'Log.entryAdded' && p.entry.level === 'error') report.errors.push({phase,type:'log',text:p.entry.text})
    if (method === 'Network.responseReceived' && (new URL(p.response.url).pathname.startsWith('/api/') || new URL(p.response.url).pathname.includes('socket.io')) && !fulfilled.has(p.requestId)) report.escapedApi.push(p.response.url)
    if (method === 'Network.webSocketCreated') report.escapedApi.push(p.url)
  }
  for (const domain of ['Page','Network','Runtime','Log']) await cdp.send(`${domain}.enable`)
  await cdp.send('Network.setCacheDisabled',{cacheDisabled:true})
  await cdp.send('Network.setBypassServiceWorker',{bypass:true})
  await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]})
  await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:INIT})

  for (const [width,height] of [[390,844],[320,568],[628,885],[628,360],[1536,900]]) {
    phase=`${width}x${height}`;items=makeItems()
    await viewport(width,height);await navigateCheckIn()
    const closed=await snapshot('closed')
    assert('initially closed with 24 unread fixture notifications', !closed.panel && closed.badge==='24' && closed.expanded==='false', {badge:closed.badge,expanded:closed.expanded})
    overflow(closed)
    await openPanel()
    const opened=await snapshot('open')
    geometry(opened,width<640)
    assert('opening does not change header geometry or scroll page', JSON.stringify(opened.header)===JSON.stringify(closed.header) && opened.main.scrollTop===closed.main.scrollTop && JSON.stringify(opened.windowScroll)===JSON.stringify(closed.windowScroll))
    assert('initial focus is mobile close or desktop bell', opened.focus===(width<640?'Close notifications':'Notifications'),opened.focus)
    await shot(`notifications-${width}x${height}-open`)
    await cdp.eval('__fire(__panel().firstElementChild.firstElementChild)');await settle()
    assert('clicking popup heading does not dismiss',await cdp.eval('!!__panel()'))
    await scrollLast(opened)
    await shot(`notifications-${width}x${height}-last-item`)
    if(width<640) {await closePanel('close-X');await openPanel()}
    await closePanel('backdrop');await openPanel();await closePanel('Escape')
    await openPanel();await closePanel('bell-area');await openPanel();await closePanel('bell-toggle')
  }

  phase='resize-open-mobile-to-desktop'
  items=makeItems();await viewport(390,844);await navigateCheckIn();await openPanel()
  await viewport(1536,900)
  const widened=await snapshot('resized-open')
  assert('resizing mobile to desktop preserves open popup',!!widened.panel && widened.expanded==='true')
  assert('resize accessibility: focus remains on a visible control when mobile close hides',widened.focusTag==='BUTTON' && await cdp.eval('__visible(document.activeElement)'),{focus:widened.focus,focusTag:widened.focusTag,closeVisible:widened.close.visible})
  geometry(widened,false);await shot('notifications-resize-mobile-to-desktop');await scrollLast(widened);await closePanel('Escape')
  phase='resize-open-desktop-to-mobile'
  await openPanel();await viewport(320,568)
  const narrowed=await snapshot('resized-open')
  assert('resizing desktop to mobile preserves open popup',!!narrowed.panel && narrowed.expanded==='true')
  geometry(narrowed,true);await scrollLast(narrowed);await closePanel('close-X')

  phase='read-all'
  items=makeItems();await viewport(390,844);await navigateCheckIn();await openPanel()
  assert('read-all starts enabled with unread badge',await cdp.eval('!__all().disabled && __bell().innerText === "24"'))
  const writesBefore=report.writes.length
  await cdp.eval('__fire(__all())')
  await ready('!__bell().querySelector("span") && __all()?.disabled','read-all badge cleared and button disabled')
  await settle()
  assert('read-all updates only the fixture, clears badge, disables action and retains popup',items.every(i=>i.readAt) && report.writes.slice(writesBefore).some(w=>w.path==='/api/v1/notifications/read-all'&&w.mocked) && await cdp.eval('!!__panel() && __all().disabled && !__bell().querySelector("span")'),report.writes.slice(writesBefore))
  assert('all item unread dots become transparent',await cdp.eval('[...__list().querySelectorAll("button")].every(el=>getComputedStyle(el.firstElementChild).backgroundColor==="rgba(0, 0, 0, 0)")'))
  const afterMark=report.writes.length
  await cdp.eval('__fire(__all())');await settle()
  assert('disabled read-all does not dispatch another mutation',report.writes.length===afterMark)
  await shot('notifications-390-read-all');await closePanel('close-X');await openPanel()
  assert('read-all state remains read when reopened',await cdp.eval('__all().disabled && !__bell().querySelector("span")'))
  await closePanel('Escape')

  phase='individual-notification-navigation'
  items=makeItems();await navigateCheckIn();await openPanel()
  await cdp.eval('__fire(__list().querySelector("button"))')
  await ready('location.pathname === "/support/fixture-thread" && document.body.innerText.includes("Synthetic support conversation")','fixture support thread rendered')
  await ready('__bell().innerText === "23"','individual-read badge updated')
  assert('individual click marks exactly one fixture notification read',items.filter(i=>i.readAt).length===1 && !!items[0].readAt && report.writes.some(w=>w.phase===phase&&w.path==='/api/v1/notifications/fixture-notification-0/read'&&w.mocked),{read:items.filter(i=>i.readAt).map(i=>i.id),writes:report.writes.filter(w=>w.phase===phase)})
  assert('individual click closes popup and navigates to intended support thread',await cdp.eval('location.pathname === "/support/fixture-thread" && !__panel() && __bell().innerText === "23"'))
  await snapshot('navigated');await shot('notifications-390-individual-navigation')

  phase='loading'
  items=makeItems();holdList=true;await navigateCheckIn();await openPanel(false)
  await ready('__list()?.querySelector("svg") && __all().disabled','loading spinner and busy read-all')
  const loading=await snapshot('loading')
  assert('held synthetic request shows spinner and disables read-all with close usable',loading.list.count===0 && loading.all.disabled && loading.close.hit && pendingLists.length>0,{pending:pendingLists.length,list:loading.list,all:loading.all})
  geometry(loading,true,false);await shot('notifications-390-loading')
  await releaseLists();await ready('__list().querySelectorAll("button").length === 24 && !__all().disabled','loading completed');await closePanel('close-X')
  holdList=true;await navigateCheckIn();await openPanel(false);await ready('__list()?.querySelector("svg")','loading spinner second open')
  await closePanel('Escape');await releaseLists();await settle()
  assert('closing while loading stays closed after fixture response resolves',await cdp.eval('!__panel() && document.activeElement === __bell()'))

  phase='empty'
  items=[];await navigateCheckIn();await openPanel()
  const empty=await snapshot('empty')
  assert('empty state shows caught-up message, no badge, disabled read-all',empty.text.includes('caught up') && empty.list.count===0 && empty.badge===null && empty.all.disabled,empty.text)
  geometry(empty,true,false);await shot('notifications-390-empty');await closePanel('close-X')

  phase='overall'
  const source=await readFile(SOURCE,'utf8')
  assert('source confirms retained desktop placement/width/max-height classes', ['sm:absolute','sm:right-0','sm:top-full','sm:mt-2','sm:max-h-[calc(100dvh-7rem)]','sm:w-[360px]','sm:max-w-[calc(100vw-2rem)]','max-h-[420px]'].every(token=>source.includes(token)))
  report.sourceHashAfter=await hash(SOURCE)
  report.previousProbeHashAfter=await hash(`${ROOT}past-reflections-regression.mjs`)
  report.previousReportHashAfter=await hash(`${OUT}past-reflections-regression.json`)
  assert('application component and previous probe/report unchanged',report.sourceHashBefore===report.sourceHashAfter && report.previousProbeHashBefore===report.previousProbeHashAfter && report.previousReportHashBefore===report.previousReportHashAfter)
  assert('no console/runtime/browser-log errors',report.errors.length===0,report.errors)
  assert('all API/socket traffic mocked with no real or unexpected writes',report.escapedApi.length===0 && report.writes.every(w=>w.mocked) && report.unknownApi.length===0 && report.harnessErrors.length===0,{requests:report.requests.length,escaped:report.escapedApi,writes:report.writes,unknown:report.unknownApi,harnessErrors:report.harnessErrors})
}

try {await run()} catch(error) {report.harnessErrors.push(error.stack);console.error(error);process.exitCode=1}
finally {
  cdp?.close()
  if(browser) {await browser.send('Browser.close').catch(()=>{});browser.close()} else if(edge) edge.kill()
  if(edge && edge.exitCode===null) await new Promise(resolve=>{const timer=setTimeout(resolve,5000);edge.once('exit',()=>{clearTimeout(timer);resolve()})})
  if(profile) {try {await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:250});report.cleanup='own browser closed and temporary profile removed'} catch(error) {report.cleanup=`profile cleanup incomplete: ${error.message}`}}
  report.summary={passed:report.assertions.filter(a=>a.pass).length,failed:report.assertions.filter(a=>!a.pass).length,errors:report.errors.length,harnessErrors:report.harnessErrors.length}
  report.findings=[]
  const clampFailures=report.assertions.filter(a=>!a.pass&&a.name==='body obeys its declared two-line clamp')
  if(clampFailures.length) report.findings.push({issue:'Body two-line clamp is ineffective',occurrences:clampFailures.length,source:`${SOURCE}:232`,detail:'Computed display:block overrides the display needed by line-clamp-2. Long fixture body renders 4-8 lines. The identical line-clamp-2 block class combination exists in HEAD (source-reviewed); this is pre-existing, not introduced by the popup placement change.'})
  const focusFailure=report.assertions.find(a=>!a.pass&&a.name.startsWith('resize accessibility:'))
  if(focusFailure) report.findings.push({issue:'Open mobile-to-desktop resize loses control focus',source:`${SOURCE}:45-55`,detail:focusFailure.detail,note:'Mobile close receives initial focus, then is display:none after widening. Focus falls to BODY. Escape still closes and restores the bell.'})
  report.scope={applicationCodeModified:false,serverStartedOrRestarted:false,realBackendWrites:false,interactions:'synthetic dispatchEvent only; DOM focus/scroll helpers',browser:'isolated headless Edge, not physical phone or Safari',desktopBaseline:'Source-reviewed HEAD retains absolute/right-0/top-full/mt-2/360px/viewport-minus-7rem and 420px list rules.'}
  await writeFile(`${OUT}notifications-regression.json`,JSON.stringify(report,null,2))
  console.log(JSON.stringify({summary:report.summary,cleanup:report.cleanup,report:`${OUT}notifications-regression.json`,screenshots:report.screenshots},null,2))
  if(report.summary.failed || report.summary.harnessErrors) process.exitCode=1
}
