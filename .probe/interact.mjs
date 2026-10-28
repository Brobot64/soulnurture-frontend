// THROWAWAY: open the overlays a static page load cannot reach (dialogs, the
// notification sheet, a row menu) and measure them at 390px.
//   node .probe/interact.mjs
const DEBUG = 'http://127.0.0.1:9333'
const ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:5051'
const OUT = new URL('./shots/', import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class Cdp {
  constructor(url) { this.url = url; this.id = 0; this.waiters = new Map() }
  async connect() {
    this.ws = new WebSocket(this.url)
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true })
      this.ws.addEventListener('error', rej, { once: true })
    })
    this.ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data)
      const w = this.waiters.get(msg.id)
      if (!w) return
      this.waiters.delete(msg.id)
      w(msg)
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((res, rej) => {
      this.waiters.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)))
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
}

const MEASURE = `(() => {
  const vw = document.documentElement.clientWidth;
  const cls = (el) => ((typeof el.className === 'string' ? el.className : '') || '').slice(0, 90);
  const label = (el) => el.tagName.toLowerCase() + '.' + cls(el).trim().split(/\\s+/).slice(0, 5).join('.');
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement)
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true;
    return false;
  };
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) continue;
    if ((r.right > vw + 1 || r.left < -1) && !clipped(el))
      offenders.push({ at: label(el), left: Math.round(r.left), right: Math.round(r.right), text: (el.textContent||'').trim().slice(0,30) });
  }
  const box = (el) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }; };
  const overlay = document.querySelector('[role=dialog]') || Array.from(document.querySelectorAll('body *')).reverse().find((el) => getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().height > 120 && el.querySelector('button'));
  return { vw, scrollW: document.documentElement.scrollWidth, offenders: offenders.slice(0, 10), overlay: overlay ? { at: label(overlay), box: box(overlay), pad: getComputedStyle(overlay).padding, radius: getComputedStyle(overlay).borderTopLeftRadius } : null };
})()`

const clickByText = (text) => `(() => {
  const want = ${JSON.stringify(text)}.toLowerCase();
  const el = Array.from(document.querySelectorAll('button, a')).find((n) =>
    (n.textContent || '').trim().toLowerCase().includes(want) ||
    (n.getAttribute('aria-label') || '').toLowerCase().includes(want));
  if (!el) return 'not found: ' + want;
  el.click();
  return 'clicked ' + want;
})()`

async function shot(cdp, name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
  const { writeFile } = await import('node:fs/promises')
  const path = `${OUT.pathname.replace(/^\//, '')}${name}.png`
  await writeFile(path, Buffer.from(data, 'base64'))
  return path
}

const tab = await (await fetch(`${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json()
const cdp = new Cdp(tab.webSocketDebuggerUrl)
await cdp.connect()
await cdp.send('Page.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })

const cases = [
  ['SCHOOL_ADMIN', '/school/users', ['Onboard student']],
  ['PLATFORM_ADMIN', '/admin/schools', ['New school']],
  ['PLATFORM_ADMIN', '/admin', ['Notifications']],
  ['COUNSELLOR', '/school/inbox', []],
]

for (const [role, path, buttons] of cases) {
  await cdp.send('Network.setCookie', { url: ORIGIN, name: 'mockRole', value: role, path: '/' })
  await cdp.send('Page.navigate', { url: `${ORIGIN}${path}` })
  for (let i = 0; i < 60; i++) {
    await sleep(500)
    const snap = await cdp
      .evaluate('[location.pathname, document.body.innerText.trim().length]')
      .catch(() => null)
    if (snap && snap[0] === path && snap[1] > 200) break
  }
  await sleep(2200)
  if (buttons.length === 0) {
    console.log(`${role}:${path} base ${JSON.stringify(await cdp.evaluate(MEASURE))}`)
    console.log('  shot', await shot(cdp, `interact_${role.toLowerCase()}_${path.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`))
    continue
  }
  for (const text of buttons) {
    console.log(role + ':' + path, '->', await cdp.evaluate(clickByText(text)))
    await sleep(900)
    const m = await cdp.evaluate(MEASURE)
    const slug = `${role.toLowerCase()}_${path.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${text.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`
    console.log('   ', JSON.stringify(m))
    console.log('    shot', await shot(cdp, `interact_${slug}`))
    await cdp.evaluate('(() => { const b = document.querySelector("[aria-label=Close]"); if (b) b.click(); return !!b })()')
    await sleep(600)
  }
}
cdp.ws.close()
await fetch(`${DEBUG}/json/close/${tab.id}`).catch(() => {})
