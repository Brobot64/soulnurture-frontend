// THROWAWAY: click into a tab/segment of a route, scroll it, screenshot at 390px.
//   node .probe/tab.mjs PLATFORM_ADMIN:/admin/pilot 'Wellbeing trends' 700
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
  const offenders = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY') continue;
    if (r.right > vw + 1 || r.left < -1) offenders.push(cls(el).split(/\\s+/).slice(0, 5).join('.') + ' :: ' + (el.textContent || '').trim().slice(0, 30));
  }
  return { vw, scrollW: document.documentElement.scrollWidth, offenders: offenders.slice(0, 8) };
})()`

const [entry, clickText, scrollArg] = process.argv.slice(2)
const [role, path] = entry.split(':')
const scrollPx = Number(scrollArg ?? 0)

const tab = await (await fetch(`${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json()
const cdp = new Cdp(tab.webSocketDebuggerUrl)
await cdp.connect()
await cdp.send('Page.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await cdp.send('Network.setCookie', { url: ORIGIN, name: 'mockRole', value: role, path: '/' })
await cdp.send('Page.navigate', { url: `${ORIGIN}${path}` })
for (let i = 0; i < 40; i++) {
  await sleep(500)
  const snap = await cdp.evaluate('[location.pathname, document.body.innerText.trim().length]').catch(() => null)
  if (!snap || snap[0] !== path) continue
  if (snap[1] > 200) break
}
await sleep(2000)
const clicked = await cdp.evaluate(`(() => {
  const want = ${JSON.stringify(clickText)}.toLowerCase();
  const el = Array.from(document.querySelectorAll('button, a, summary')).find((n) =>
    (n.textContent || '').trim().toLowerCase() === want ||
    (n.getAttribute('aria-label') || '').trim().toLowerCase() === want);
  if (!el) return 'not found';
  el.click();
  return 'clicked';
})()`)
await sleep(2200)
if (scrollPx > 0) {
  await cdp.evaluate(`(() => {
    let el = document.scrollingElement
    for (const n of document.querySelectorAll('body *')) {
      const s = getComputedStyle(n)
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 50) { el = n; break }
    }
    el.scrollTop = ${scrollPx}
    return el.scrollTop
  })()`)
  await sleep(500)
}
console.log(entry, path, clicked, JSON.stringify(await cdp.evaluate(MEASURE)))
const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
const { writeFile } = await import('node:fs/promises')
const slug = `${entry.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${(clickText || '').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}${scrollPx ? `_s${scrollPx}` : ''}`
const shot = `${OUT.pathname.replace(/^\//, '')}tab_${slug}.png`
await writeFile(shot, Buffer.from(data, 'base64'))
console.log('shot', shot)
cdp.ws.close()
await fetch(`${DEBUG}/json/close/${tab.id}`).catch(() => {})
