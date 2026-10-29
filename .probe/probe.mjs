// THROWAWAY mobile-layout probe — lives outside src, never committed, delete after the pass.
// Drives headless Edge over CDP at a real 390x844 mobile viewport and reports per route:
// page-level horizontal overflow, the elements causing it, nested horizontal scrollers,
// and fixed/sticky elements that could cover content. Screenshots land in .probe/shots/.
//
//   "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new \
//     --remote-debugging-port=9333 --user-data-dir=<tmp> about:blank
//   node .probe/probe.mjs                 # all default routes
//   node .probe/probe.mjs PLATFORM_ADMIN:/admin

const DEBUG = 'http://127.0.0.1:9333'
const ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:5050'
const WIDTH = Number(process.env.MOBILE_WIDTH ?? 390)
const HEIGHT = Number(process.env.MOBILE_HEIGHT ?? 844)
const OUT = new URL('./shots/', import.meta.url)

const DEFAULT_ROUTES = [
  'PLATFORM_ADMIN:/admin',
  'PLATFORM_ADMIN:/admin/schools',
  'PLATFORM_ADMIN:/admin/schools/sch-miva',
  'PLATFORM_ADMIN:/admin/users',
  'PLATFORM_ADMIN:/admin/pilot',
  'PLATFORM_ADMIN:/admin/access-log',
  'SCHOOL_ADMIN:/school',
  'SCHOOL_ADMIN:/school/users',
  'SCHOOL_ADMIN:/school/settings',
  'SCHOOL_ADMIN:/school/indicators',
  // REVIEWER_ROLES only — as SCHOOL_ADMIN these two bounce to /school, which
  // the pathname gate (correctly) reports as a page that never rendered.
  'COUNSELLOR:/school/reports',
  'COUNSELLOR:/school/ai-boundaries',
  'COUNSELLOR:/school/inbox',
  'COUNSELLOR:/school/inbox/thr-0',
  'COUNSELLOR:/school/requests',
  'PLATFORM_ADMIN:/signin',
  'ANON:/',
  'STUDENT:/',
  'STUDENT:/welcome',
  'STUDENT:/check-in',
  'STUDENT:/resources',
  'STUDENT:/support',
  'STUDENT:/support/requests',
  'STUDENT:/privacy',
]

const MEASURE = `(() => {
  const vw = document.documentElement.clientWidth;
  const cls = (el) => ((typeof el.className === 'string' ? el.className : '') || '').slice(0, 110);
  const label = (el) => el.tagName.toLowerCase() + '.' + cls(el).trim().split(/\\s+/).slice(0, 6).join('.');
  const clippedAncestor = (el) => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  };
  const offenders = [], scrollers = [], fixed = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    // A closed <details> hides its children through the slot, not display:none,
    // so they still report a box — the account menu measured as an offender on
    // every page until this skip existed.
    if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY') continue;
    if ((r.right > vw + 1 || r.left < -1) && !clippedAncestor(el)) {
      offenders.push({ at: label(el), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), text: (el.textContent || '').trim().slice(0, 40) });
    }
    if (el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(style.overflowX)) {
      scrollers.push({ at: label(el), scrollW: el.scrollWidth, clientW: el.clientWidth });
    }
    if (style.position === 'fixed' || style.position === 'sticky') {
      fixed.push({ at: label(el), pos: style.position, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) });
    }
  }
  return {
    vw,
    scrollW: document.documentElement.scrollWidth,
    pageOverflowX: document.documentElement.scrollWidth > vw + 1,
    offenders: offenders.slice(0, 14),
    scrollers: scrollers.slice(0, 12),
    fixed,
  };
})()`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class Cdp {
  constructor(url) {
    this.url = url
    this.id = 0
    this.waiters = new Map()
  }
  async connect() {
    this.ws = new WebSocket(this.url)
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      const waiter = this.waiters.get(msg.id)
      if (!waiter) {
        if (msg.method && this.onEvent) this.onEvent(msg.method, msg.params)
        return
      }
      this.waiters.delete(msg.id)
      waiter(msg)
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.waiters.set(id, (msg) => {
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`))
        else resolve(msg.result)
      })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 300))
    return result.result.value
  }
  close() {
    this.ws?.close()
  }
}

async function main() {
  const { mkdir, writeFile } = await import('node:fs/promises')
  await mkdir(OUT, { recursive: true })
  const args = process.argv.slice(2)
  const routes = args.length
    ? args.map((arg) => (arg.includes(':') ? arg : `PLATFORM_ADMIN:${arg}`))
    : DEFAULT_ROUTES

  const report = []
  for (const entry of routes) {
    const [role, path] = entry.split(':')
    // One fresh tab per route: a single long-lived tab driven through 24
    // client-rendered navigations degrades until it stops running page JS at
    // all, and every blank report then looks like a broken page, not a broken
    // harness.
    const tab = await (await fetch(`${DEBUG}/json/new?about:blank`, { method: 'PUT' })).json()
    const cdp = new Cdp(tab.webSocketDebuggerUrl)
    await cdp.connect()
    await cdp.send('Page.enable')
    await cdp.send('Network.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Log.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: true,
    })
    const missing = []
    const errors = []
    cdp.onEvent = (method, params) => {
      if (method === 'Runtime.exceptionThrown') {
        const d = params.exceptionDetails ?? {}
        errors.push(
          `uncaught: ${d.exception?.description?.split('\n')[0] ?? d.text ?? 'unknown'}`.slice(0, 160),
        )
        return
      }
      if (method === 'Log.entryAdded' && params.entry?.level === 'error') {
        errors.push(`log: ${(params.entry.text ?? '').split('\n')[0]}`.slice(0, 160))
        return
      }
      if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
        errors.push(
          `console: ${(params.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(' ')}`.slice(0, 160),
        )
        return
      }
      if (method !== 'Network.responseReceived') return
      const url = params.response?.url ?? ''
      if (params.response?.status >= 400 && url.includes('/api/')) {
        missing.push(`${params.response.status} ${url.replace(ORIGIN, '')}`)
      }
    }
    await cdp.send('Network.setCookie', { url: ORIGIN, name: 'mockRole', value: role, path: '/' })
    await cdp.send('Page.navigate', { url: `${ORIGIN}${path}` })
    // Cold vite dev compiles the whole client graph on first hit; the app also
    // renders FullPageLoader until /users/me resolves. Wait for real text.
    let chars = 0
    let landed = ''
    for (let attempt = 0; attempt < 40; attempt++) {
      await sleep(500)
      // Page.navigate resolves before the document is replaced, so polling text
      // alone can measure the previous route. Require the pathname to match.
      const snap = await cdp
        .evaluate('[location.pathname, document.body.innerText.trim().length]')
        .catch(() => null)
      if (!snap) continue
      landed = snap[0]
      if (landed !== path) continue
      chars = snap[1]
      if (chars > 200) break
    }
    // Cold-compiled routes can exceed the 20s budget on their first hit; give
    // an almost-blank page one more stretch before calling it blank.
    if (chars < 200 && landed === path) {
      for (let attempt = 0; attempt < 30 && chars < 200; attempt++) {
        await sleep(1000)
        chars = await cdp.evaluate('document.body.innerText.trim().length').catch(() => chars)
      }
    }
    // The reveal animations (t-stagger-line) start at opacity 0 and finish
    // ~2s after mount, so a 1.2s settle captured pages with empty middles.
    await sleep(2600)
    let measured
    if (landed !== path) {
      measured = { navError: `still on ${landed || 'nothing'} after 20s` }
    } else {
      try {
        measured = await cdp.evaluate(MEASURE)
      } catch (error) {
        measured = { measureError: error.message }
      }
    }
    // The dash/student shells scroll an inner overflow-y div, so the document
    // never scrolls and captureBeyondViewport stays blank — move that div.
    const scrollPx = Number(process.env.SCROLL_PX ?? 0)
    const slug = `${entry.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}${WIDTH !== 390 ? `_w${WIDTH}` : ''}${scrollPx ? `_s${scrollPx}` : ''}`
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
    let shot = null
    try {
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        ...(process.env.FULL ? { captureBeyondViewport: true } : {}),
      })
      shot = `${OUT.pathname.replace(/^\//, '')}${slug}.png`
      await writeFile(shot, Buffer.from(data, 'base64'))
    } catch (error) {
      shot = `screenshot failed: ${error.message}`
    }
    report.push({ route: entry, chars, landed, ...measured, missing: [...new Set(missing)], errors: [...new Set(errors)], shot })
    const errText = chars < 200 ? ` err=[${[...new Set(errors)].slice(0, 3).join(' | ')}]` : ''
    console.log(
      `${entry.padEnd(34)} chars=${String(chars).padEnd(6)} overflowX=${String(measured.pageOverflowX).padEnd(5)} vw=${measured.vw} scrollW=${measured.scrollW} offenders=${(measured.offenders ?? []).length} scrollers=${(measured.scrollers ?? []).length}${measured.navError ? ` ${measured.navError}` : ''}${missing.length ? ` api404=${[...new Set(missing)].join(',')}` : ''}${errText}`,
    )
    cdp.onEvent = null
    cdp.close()
    await fetch(`${DEBUG}/json/close/${tab.id}`).catch(() => {})
  }
  await writeFile(`${OUT.pathname.replace(/^\//, '')}report.json`, JSON.stringify(report, null, 2))
  console.log(`\nreport: ${OUT}report.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
