// Validators 13 (mobile layout) and 14 (Lighthouse budgets) on generated pages, served from the
// working tree by a small static server that maps clean URLs the way Vercel's cleanUrls does.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'
import { ROOT, SEO_DIR } from './util.mjs'

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' }
const BUDGET = { performance: 0.9, accessibility: 0.95, 'best-practices': 0.95, seo: 1 }
const LCP_MS = 2500
const CLS = 0.1
const TRANSFER_BYTES = 400 * 1024

export function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const candidates = rel === '' ? ['index.html'] : [rel, rel + '.html', path.join(rel, 'index.html')]
    const file = candidates.map((c) => path.join(ROOT, c)).find((f) => f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile())
    if (!file) { res.writeHead(404); res.end('not found'); return }
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream'
    // Vercel compresses text responses; do the same so transfer sizes are comparable.
    const gzip = /text|javascript|json|xml|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] ?? '')
    res.writeHead(200, { 'content-type': type, 'cache-control': 'max-age=3600', ...(gzip ? { 'content-encoding': 'gzip' } : {}) })
    const stream = fs.createReadStream(file)
    ;(gzip ? stream.pipe(zlib.createGzip()) : stream).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

function result(id, name) {
  const r = { id, name, status: 'pass', details: [] }
  r.fail = (m) => { r.status = 'fail'; r.details.push(m) }
  r.note = (m) => r.details.push(m)
  return r
}

async function launch(chromium, args = []) {
  const opts = { args }
  if (process.env.SEO_CHROMIUM_PATH) opts.executablePath = process.env.SEO_CHROMIUM_PATH
  return chromium.launch(opts)
}

export async function runBrowserChecks(pages) {
  const { chromium } = await import('playwright')
  fs.mkdirSync(path.join(SEO_DIR, '.artifacts'), { recursive: true })
  const server = await startServer()
  const origin = `http://127.0.0.1:${server.address().port}`
  const r13 = result(13, 'Mobile layout')
  const r14 = result(14, 'Lighthouse budgets')
  try {
    const browser = await launch(chromium)
    for (const p of pages) {
      for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
        const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 500, hasTouch: vp.width < 500 })
        const page = await ctx.newPage()
        // Third-party fonts are not part of the budget and may be unreachable in CI.
        await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort())
        await page.goto(origin + p.urlPath, { waitUntil: 'load' })
        const m = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth
          const wide = [...document.querySelectorAll('main *')]
            .filter((el) => !el.closest('.compare-wrap'))
            .filter((el) => el.getBoundingClientRect().right > vw + 1)
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
          const small = [...document.querySelectorAll('main a.btn, main button, main .seo-links a, main .seo-card')]
            .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && (b.height < 44 || b.width < 44) })
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 40)}"`)
          return { scroll: document.documentElement.scrollWidth, vw, wide, small }
        })
        if (m.scroll > m.vw) r13.fail(`${p.urlPath} at ${vp.width}px: page scrolls horizontally (${m.scroll} > ${m.vw})`)
        for (const w of m.wide) r13.fail(`${p.urlPath} at ${vp.width}px: ${w} is wider than the viewport`)
        if (vp.width < 500) for (const s of m.small) r13.fail(`${p.urlPath} at ${vp.width}px: tap target smaller than 44px: ${s}`)
        await page.screenshot({ path: path.join(SEO_DIR, '.artifacts', `${p.file.replace(/[\/]/g, '_')}-${vp.width}.png`), fullPage: true }).catch(() => {})
        await ctx.close()
      }
    }
    await browser.close()

    const { default: lighthouse } = await import('lighthouse')
    const port = 9300 + Math.floor(Math.random() * 500)
    const lhBrowser = await launch(chromium, [`--remote-debugging-port=${port}`])
    for (const p of pages) {
      const run = await lighthouse(origin + p.urlPath, { port, output: 'json', logLevel: 'error', blockedUrlPatterns: ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] }, { extends: 'lighthouse:default', settings: { formFactor: 'mobile', onlyCategories: Object.keys(BUDGET) } })
      const lhr = run.lhr
      const scores = Object.fromEntries(Object.keys(BUDGET).map((k) => [k, lhr.categories[k]?.score ?? 0]))
      const lcp = lhr.audits['largest-contentful-paint']?.numericValue ?? Infinity
      const cls = lhr.audits['cumulative-layout-shift']?.numericValue ?? Infinity
      const bytes = lhr.audits['total-byte-weight']?.numericValue ?? Infinity
      // A noindex page loses the SEO "is-crawlable" audit by design; judge the rest.
      if (!p.indexable) {
        const refs = lhr.categories.seo.auditRefs.filter((a) => a.weight > 0 && a.id !== 'is-crawlable')
        const total = refs.reduce((s, a) => s + a.weight, 0)
        scores.seo = refs.reduce((s, a) => s + a.weight * (lhr.audits[a.id].score ?? 1), 0) / total
      }
      r14.note(`${p.urlPath}: performance ${Math.round(scores.performance * 100)}, accessibility ${Math.round(scores.accessibility * 100)}, best practices ${Math.round(scores['best-practices'] * 100)}, SEO ${Math.round(scores.seo * 100)}${p.indexable ? '' : ' (without is-crawlable: page is noindex)'}, LCP ${Math.round(lcp)} ms, CLS ${cls.toFixed(3)}, ${Math.round(bytes / 1024)} KB`)
      for (const [k, min] of Object.entries(BUDGET)) {
        const score = scores[k]
        if (score < min) {
          const failing = lhr.categories[k].auditRefs.filter((a) => a.weight > 0 && (lhr.audits[a.id].score ?? 1) < 1 && !(k === 'seo' && a.id === 'is-crawlable' && !p.indexable)).map((a) => a.id)
          r14.fail(`${p.urlPath}: ${k} ${Math.round(score * 100)} is under ${Math.round(min * 100)} (${failing.join(', ')})`)
        }
      }
      if (lcp > LCP_MS) r14.fail(`${p.urlPath}: LCP ${Math.round(lcp)} ms is over ${LCP_MS} ms`)
      if (cls > CLS) r14.fail(`${p.urlPath}: CLS ${cls.toFixed(3)} is over ${CLS}`)
      if (bytes > TRANSFER_BYTES) r14.fail(`${p.urlPath}: transfer ${Math.round(bytes / 1024)} KB is over ${TRANSFER_BYTES / 1024} KB`)
    }
    await lhBrowser.close()
  } finally {
    server.close()
  }
  return [r13, r14]
}
