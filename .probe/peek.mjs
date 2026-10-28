// THROWAWAY: evaluate an expression on a route at mobile size, print the result.
//   node .probe/peek.mjs STUDENT:/check-in 'document.body.innerText.slice(0,400)'
const DEBUG = 'http://127.0.0.1:9333'
const ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:5051'
const [entry, expr] = process.argv.slice(2)
const [role, path] = entry.includes(':') ? entry.split(':') : ['PLATFORM_ADMIN', entry]
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

const tab = await (await fetch(`${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json()
const cdp = new Cdp(tab.webSocketDebuggerUrl)
await cdp.connect()
await cdp.send('Page.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await cdp.send('Network.setCookie', { url: ORIGIN, name: 'mockRole', value: role, path: '/' })
await cdp.send('Page.navigate', { url: `${ORIGIN}${path}` })
for (let i = 0; i < 60; i++) {
  await sleep(500)
  const n = await cdp.evaluate('document.body.innerText.trim().length').catch(() => 0)
  if (n > 200) break
}
await sleep(1500)
console.log(await cdp.evaluate(expr))
cdp.ws.close()
await fetch(`${DEBUG}/json/close/${tab.id}`).catch(() => {})
