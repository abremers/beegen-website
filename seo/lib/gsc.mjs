// Search Console export for the weekly loop (plan section 10.2). Reads the service account JSON
// from GSC_SERVICE_ACCOUNT_JSON, signs its own OAuth token (no Google SDK), and writes
// seo/metrics/<date>/*.json. Read-only: the scope is webmasters.readonly.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { SEO_DIR, today } from './util.mjs'
import { loadData, renderAll } from './render.mjs'

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const PROPERTY = process.env.GSC_PROPERTY ?? 'sc-domain:beegen.co'
const API = 'https://searchconsole.googleapis.com'
// Search Console data settles about three days after the fact.
const LAG_DAYS = 3
const INSPECTION_CAP = Number(process.env.GSC_INSPECTION_CAP ?? 400)

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

export function signJwt(account, nowSec = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: account.token_uri ?? 'https://oauth2.googleapis.com/token', iat: nowSec, exp: nowSec + 3600 }))
  const signature = crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key)
  return `${header}.${claims}.${b64url(signature)}`
}

async function accessToken(account) {
  const res = await fetch(account.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signJwt(account) }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`token request failed (${res.status}): ${body.error_description ?? body.error ?? 'unknown'}`)
  return body.access_token
}

async function call(token, url, payload) {
  const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  const body = await res.json()
  if (!res.ok) {
    const hint = res.status === 403 ? ` (is ${PROPERTY} shared with the service account in Search Console > Settings > Users and permissions?)` : ''
    throw new Error(`${url} failed (${res.status}): ${body.error?.message ?? 'unknown'}${hint}`)
  }
  return body
}

function isoDaysAgo(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

async function searchAnalytics(token, startDate, endDate, dimensions) {
  const rows = []
  for (let startRow = 0; ; startRow += 25000) {
    const body = await call(token, `${API}/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}/searchAnalytics/query`, {
      startDate, endDate, dimensions, rowLimit: 25000, startRow, dataState: 'final',
      dimensionFilterGroups: [{ filters: [{ dimension: 'country', operator: 'equals', expression: 'mex' }] }],
    })
    rows.push(...(body.rows ?? []))
    if (!body.rows || body.rows.length < 25000) break
  }
  return rows.map((r) => ({ keys: r.keys, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }))
}

/** URLs to inspect: every sitemap entry plus every generated page, indexable or not. */
export function inspectionTargets(data = loadData()) {
  const { pages } = renderAll(data)
  const urls = [
    ...data.staticPages.pages.map((p) => data.site.site_url + (p.path === '/' ? '/' : p.path)),
    ...pages.map((p) => data.site.site_url + p.urlPath),
  ]
  return [...new Set(urls)]
}

async function inspect(token, urls) {
  const out = []
  for (const url of urls.slice(0, INSPECTION_CAP)) {
    try {
      const body = await call(token, `${API}/v1/urlInspection/index:inspect`, { inspectionUrl: url, siteUrl: PROPERTY, languageCode: 'es-MX' })
      const r = body.inspectionResult?.indexStatusResult ?? {}
      out.push({ url, verdict: r.verdict ?? null, coverageState: r.coverageState ?? null, indexingState: r.indexingState ?? null, robotsTxtState: r.robotsTxtState ?? null, lastCrawlTime: r.lastCrawlTime ?? null, googleCanonical: r.googleCanonical ?? null, userCanonical: r.userCanonical ?? null })
    } catch (err) {
      out.push({ url, error: err.message })
    }
  }
  return out
}

export async function exportSearchConsole({ outRoot = path.join(SEO_DIR, 'metrics') } = {}) {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('GSC_SERVICE_ACCOUNT_JSON is not set')
  const account = JSON.parse(raw)
  const token = await accessToken(account)
  const runDate = today()
  const end = isoDaysAgo(runDate, LAG_DAYS)
  const start28 = isoDaysAgo(end, 27)
  const start7 = isoDaysAgo(end, 6)
  const dir = path.join(outRoot, runDate)
  fs.mkdirSync(dir, { recursive: true })
  const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n')

  const queries28 = await searchAnalytics(token, start28, end, ['query'])
  const pages28 = await searchAnalytics(token, start28, end, ['page'])
  const queryPage28 = await searchAnalytics(token, start28, end, ['query', 'page'])
  const queries7 = await searchAnalytics(token, start7, end, ['query'])
  const pages7 = await searchAnalytics(token, start7, end, ['page'])
  const inspection = await inspect(token, inspectionTargets())

  write('queries-28d.json', queries28)
  write('pages-28d.json', pages28)
  write('query-page-28d.json', queryPage28)
  write('queries-7d.json', queries7)
  write('pages-7d.json', pages7)
  write('inspection.json', inspection)
  const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0)
  const summary = {
    property: PROPERTY,
    run_date: runDate,
    ranges: { last28: [start28, end], last7: [start7, end] },
    country: 'mex',
    totals_28d: { clicks: sum(pages28, 'clicks'), impressions: sum(pages28, 'impressions'), queries: queries28.length, pages: pages28.length },
    totals_7d: { clicks: sum(pages7, 'clicks'), impressions: sum(pages7, 'impressions') },
    inspection: {
      inspected: inspection.length,
      indexed: inspection.filter((r) => r.verdict === 'PASS').length,
      errors: inspection.filter((r) => r.error).length,
    },
  }
  write('summary.json', summary)
  return { dir, summary }
}

export function summaryMarkdown({ summary }) {
  const s = summary
  return [
    `### Search Console export, ${s.run_date}`,
    `Property \`${s.property}\`, Mexico only.`,
    '',
    '| Range | Clicks | Impressions |',
    '|---|---:|---:|',
    `| ${s.ranges.last28[0]} to ${s.ranges.last28[1]} | ${s.totals_28d.clicks} | ${s.totals_28d.impressions} |`,
    `| ${s.ranges.last7[0]} to ${s.ranges.last7[1]} | ${s.totals_7d.clicks} | ${s.totals_7d.impressions} |`,
    '',
    `${s.totals_28d.queries} queries and ${s.totals_28d.pages} pages with impressions in 28 days. URL inspection: ${s.inspection.indexed} of ${s.inspection.inspected} indexed${s.inspection.errors ? `, ${s.inspection.errors} errors` : ''}.`,
  ].join('\n')
}
