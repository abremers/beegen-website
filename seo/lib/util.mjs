// Shared helpers for the SEO generator and validators. No dependencies.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const SEO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const ROOT = path.resolve(SEO_DIR, '..')
export const DATA_DIR = path.join(SEO_DIR, 'data')
export const CONTENT_DIR = path.join(SEO_DIR, 'content')
export const TEMPLATE_DIR = path.join(SEO_DIR, 'templates')

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

export function readText(file) {
  return fs.readFileSync(file, 'utf8')
}

export function sha256(text) {
  return 'sha256:' + crypto.createHash('sha256').update(text).digest('hex')
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])
}

/** Today's date in Mexico City as YYYY-MM-DD. SEO_TODAY overrides it for reproducible runs. */
export function today() {
  if (process.env.SEO_TODAY) return process.env.SEO_TODAY
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
}

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000)
}

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export function dateEs(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MONTHS_ES[m - 1]} de ${y}`
}

/** "$1,299 MXN" style, the way the site writes prices. */
export function mxn(amount) {
  const fixed = Number.isInteger(amount) ? amount.toLocaleString('en-US') : amount.toFixed(2)
  return `$${fixed} MXN`
}

export function usd(amount) {
  return `${Number.isInteger(amount) ? amount.toLocaleString('en-US') : amount.toFixed(2)} USD`
}

/** Path of the HTML file that Vercel serves (cleanUrls) for a URL path. */
export function fileForUrlPath(urlPath) {
  if (urlPath === '/') return 'index.html'
  const clean = urlPath.replace(/^\//, '')
  if (fs.existsSync(path.join(ROOT, clean + '.html'))) return clean + '.html'
  if (fs.existsSync(path.join(ROOT, clean, 'index.html'))) return path.join(clean, 'index.html')
  if (fs.existsSync(path.join(ROOT, clean)) && fs.statSync(path.join(ROOT, clean)).isFile()) return clean
  return null
}

/** Every committed HTML page of the site, relative to the root, skipping tooling folders. */
export function listSiteHtml() {
  const out = []
  const skip = new Set(['node_modules', '.git', 'seo', 'docs', '.github', '.claude', '.vercel', '.platform'])
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (skip.has(entry.name)) continue
      const rel = dir ? path.join(dir, entry.name) : entry.name
      if (entry.isDirectory()) walk(rel)
      else if (entry.name.endsWith('.html')) out.push(rel)
    }
  }
  walk('')
  return out.sort()
}

/** Visible text of an HTML fragment: tags, scripts and styles removed, entities decoded, whitespace collapsed. */
export function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function words(text) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+(?:[.,]\d+)*/gu) ?? []
}

export function normalizeSpace(text) {
  return String(text).replace(/\s+/g, ' ').trim()
}
