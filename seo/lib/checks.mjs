// Validators 1 to 18 of docs/seo-engine-plan.md section 8. Any "fail" blocks the pull request.
// A "skip" says why a check could not run (no network, no platform checkout, no base ref); CI
// treats skips as notices, not passes, and the PR description lists them.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { DATA_DIR, CONTENT_DIR, ROOT, fileForUrlPath, listSiteHtml, normalizeSpace, readJson, readText, visibleText, words } from './util.mjs'
import { buildSnapshot, platformDir, registryPath } from './snapshot.mjs'
import { contentHash, renderAll, robotsFor, signupUrl } from './render.mjs'
import { allowedNumbers, baseMonthlyMxn, beegenFact, claimState, contentFactIds, factsHash, isBeegenRef, numbersIn, renderable } from './facts.mjs'

// Emoji presentation characters, or pictographs forced to emoji style; plain symbols such as the
// copyright sign are allowed.
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|\u20E3/u
const EM_DASH = /—/
const DENY = ['peor', 'peores', 'estafa', 'estafas', 'engañoso', 'engañosa', 'malo', 'mala', 'pésimo', 'pésima']

function result(id, name) {
  const r = { id, name, status: 'pass', details: [] }
  r.fail = (msg) => { r.status = 'fail'; r.details.push(msg) }
  r.skip = (msg) => { if (r.status === 'pass') r.status = 'skip'; r.details.push(`skipped: ${msg}`) }
  r.note = (msg) => r.details.push(msg)
  return r
}

function baseRef() {
  const ref = process.env.SEO_BASE_REF ?? 'origin/main'
  try {
    execFileSync('git', ['-C', ROOT, 'rev-parse', '--verify', '--quiet', ref], { stdio: 'ignore' })
    return ref
  } catch {
    return null
  }
}

function gitShow(ref, rel) {
  try {
    return execFileSync('git', ['-C', ROOT, 'show', `${ref}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

function attr(html, re) {
  return [...html.matchAll(re)].map((m) => m[1])
}

function jsonLdBlocks(html) {
  return attr(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
}

function typesIn(node, out = []) {
  if (Array.isArray(node)) node.forEach((n) => typesIn(n, out))
  else if (node && typeof node === 'object') {
    if (node['@type']) [].concat(node['@type']).forEach((t) => out.push(t))
    Object.values(node).forEach((v) => typesIn(v, out))
  }
  return out
}

function shingles(text, n = 5) {
  const w = words(text)
  const out = new Set()
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '))
  return out
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

/** Text written for this page alone: summary, fit lists, FAQ. Template strings are not counted. */
function writtenProse(page, data) {
  if (page.model.hub) return ''
  const { comp, content } = page.model
  const parts = []
  content.blocks.summary.forEach((s) => parts.push(s.text))
  content.blocks.beegen_fits.forEach((s) => parts.push(s.text))
  content.blocks.faq.forEach((f) => { parts.push(f.q); f.a.forEach((s) => parts.push(s.text)) })
  comp.when_competitor_fits_es.forEach((f) => parts.push(f.text_es))
  return parts.join(' ')
}

function variableText(page, data) {
  if (page.model.hub) return ''
  return writtenProse(page, data) + ' ' + page.model.claims.map((c) => c.text_es).join(' ')
}

async function linkOk(url) {
  const opts = { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Mozilla/5.0 (compatible; BeegenLinkCheck/1.0; +https://beegen.co)' } }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let res = await fetch(url, { ...opts, method: 'HEAD' })
      if (res.status === 405 || res.status === 403 || res.status >= 500) res = await fetch(url, { ...opts, method: 'GET' })
      if (res.status < 400) return { ok: true, status: res.status }
      if (attempt === 2) return { ok: false, status: res.status }
    } catch (err) {
      if (attempt === 2) return { ok: false, status: String(err.cause?.code ?? err.name) }
    }
  }
  return { ok: false, status: 'unknown' }
}

async function groundingModelCheck(page, r) {
  const key = process.env.ANTHROPIC_API_KEY
  const model = process.env.SEO_GROUNDING_MODEL
  if (!key || !model) {
    r.skip(`model grounding check needs ANTHROPIC_API_KEY and SEO_GROUNDING_MODEL (${page.file})`)
    return
  }
  const { comp, content } = page.model
  const factText = (id) => (isBeegenRef(id) ? `${id}: ${beegenFact(id, page.snapshot, page.site).text}` : `${id}: ${comp.claims.find((c) => c.id === id)?.text_es}`)
  const items = []
  const add = (s) => items.push({ text: s.text, facts: s.facts.map(factText) })
  content.blocks.summary.forEach(add)
  content.blocks.beegen_fits.forEach(add)
  content.blocks.faq.forEach((f) => f.a.forEach(add))
  comp.when_competitor_fits_es.forEach((f) => items.push({ text: f.text_es, facts: f.facts.map(factText) }))
  const prompt = `You check Spanish marketing sentences against facts. For each item, answer whether every factual statement in "text" is supported by its "facts" (wording may differ; added facts, numbers, comparisons or judgments not in the facts are unsupported). Reply with JSON only: an array of {"i": index, "supported": true|false, "reason": "short"}.\n\n${JSON.stringify(items.map((it, i) => ({ i, ...it })), null, 1)}`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 2000, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    r.fail(`${page.file}: grounding model call failed with HTTP ${res.status}`)
    return
  }
  const body = await res.json()
  const text = body.content?.map((c) => c.text ?? '').join('') ?? ''
  r.note(`${page.file}: grounding model used ${body.usage?.input_tokens ?? '?'} input and ${body.usage?.output_tokens ?? '?'} output tokens`)
  let verdicts
  try {
    verdicts = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1))
  } catch {
    r.fail(`${page.file}: grounding model reply was not JSON`)
    return
  }
  for (const v of verdicts) if (!v.supported) r.fail(`${page.file}: unsupported sentence "${items[v.i]?.text}" (${v.reason})`)
}

export async function runChecks({ offline = false, browser = false } = {}) {
  const { data, pages, outputs } = renderAll()
  for (const p of pages) { p.snapshot = data.snapshot; p.site = data.site }
  const generated = pages
  const comparisonPages = pages.filter((p) => !p.model.hub)
  const competitorsDoc = data.competitors
  const maxAge = competitorsDoc.max_claim_age_days ?? 60
  const base = baseRef()
  const siteHtml = listSiteHtml()
  const generatedFiles = new Set(generated.map((p) => p.file))
  const results = []

  /* 1 Schema and cross-references */
  {
    const r = result(1, 'Schema')
    const { default: Ajv } = await import('ajv/dist/2020.js')
    const { default: addFormats } = await import('ajv-formats')
    const ajv = new Ajv({ allErrors: true, strict: false })
    addFormats(ajv)
    const validate = (schemaFile, value, label) => {
      const ok = ajv.validate(readJson(path.join(DATA_DIR, schemaFile)), value)
      if (!ok) for (const e of ajv.errors) r.fail(`${label}${e.instancePath}: ${e.message}`)
    }
    validate('competitors.schema.json', competitorsDoc, 'competitors.json')
    for (const [key, c] of Object.entries(data.content)) validate('content.schema.json', c, `content/${key}.json`)
    const snapModules = data.snapshot.modules ?? {}
    for (const id of Object.keys(data.site.availability)) if (!snapModules[id]) r.fail(`site.json availability lists ${id}, which is not a visible module in the snapshot`)
    for (const id of Object.keys(snapModules)) if (!data.site.availability[id]) r.fail(`site.json availability is missing ${id}`)
    for (const comp of competitorsDoc.competitors) {
      const sources = new Set(comp.sources.map((s) => s.id))
      const claimIds = new Set(comp.claims.map((c) => c.id))
      if (claimIds.size !== comp.claims.length) r.fail(`${comp.slug}: duplicate claim ids`)
      for (const c of comp.claims) {
        if (!c.id.startsWith(comp.slug.replace(/-/g, '') + '.') && !c.id.startsWith(comp.slug + '.')) r.fail(`${comp.slug}: claim ${c.id} must start with the slug`)
        for (const e of c.evidence) if (!sources.has(e.source_id)) r.fail(`${c.id}: unknown source ${e.source_id}`)
      }
      for (const row of comp.contrasts) {
        for (const id of row.competitor_claim_ids) if (!claimIds.has(id)) r.fail(`${comp.slug} contrast "${row.topic}": unknown claim ${id}`)
        for (const ref of row.beegen_fact_refs) { try { beegenFact(ref, data.snapshot, data.site) } catch (err) { r.fail(`${comp.slug} contrast "${row.topic}": ${err.message}`) } }
      }
      for (const f of comp.when_competitor_fits_es) for (const id of f.facts) if (!claimIds.has(id)) r.fail(`${comp.slug} when_competitor_fits: unknown claim ${id}`)
      for (const id of comp.beegen_modules) if (!snapModules[id]) r.fail(`${comp.slug}: beegen_modules lists unknown or hidden module ${id}`)
      const content = data.content[`comparar/${comp.slug}`]
      if (!content) { r.fail(`${comp.slug}: missing seo/content/comparar/${comp.slug}.json`); continue }
      for (const id of contentFactIds(content)) {
        if (isBeegenRef(id)) { try { beegenFact(id, data.snapshot, data.site) } catch (err) { r.fail(`content ${comp.slug}: ${err.message}`) } }
        else if (!claimIds.has(id)) r.fail(`content ${comp.slug}: unknown fact ${id}`)
      }
    }
    results.push(r)
  }

  /* 2 Duplicate and near-duplicate text */
  {
    const r = result(2, 'Duplicate and near-duplicate text')
    const sets = comparisonPages.map((p) => ({ p, sh: shingles(variableText(p, data)), sents: sentences(writtenProse(p, data)) }))
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const sim = jaccard(sets[i].sh, sets[j].sh)
        if (sim >= 0.2) r.fail(`${sets[i].p.file} and ${sets[j].p.file}: 5-gram Jaccard ${sim.toFixed(2)} (limit 0.20 within the family)`)
        for (const s of sets[i].sents) {
          if (words(s).length >= 12 && sets[j].sents.some((t) => normalizeSpace(t).toLowerCase() === normalizeSpace(s).toLowerCase())) r.fail(`shared sentence on ${sets[i].p.file} and ${sets[j].p.file}: "${s}"`)
        }
      }
    }
    for (const { p } of sets) {
      // Written prose must reach 300 words; page-specific text (prose plus this competitor's
      // claims) must be at least 40% of <main>, so the template never dominates a page.
      const prose = words(writtenProse(p, data)).length
      const specific = words(variableText(p, data)).length
      const total = words(visibleText(p.html.match(/<main[\s\S]*<\/main>/)[0])).length
      const share = specific / total
      r.note(`${p.file}: ${prose} written words; ${specific} page-specific words of ${total} in main (${Math.round(share * 100)}%)`)
      if (prose < 300) r.fail(`${p.file}: ${prose} written words, minimum 300`)
      if (share < 0.4) r.fail(`${p.file}: page-specific words are ${Math.round(share * 100)}% of main content, minimum 40%`)
    }
    results.push(r)
  }

  /* 3 Sourced facts */
  {
    const r = result(3, 'Sourced facts')
    for (const p of comparisonPages) {
      const { comp, claims } = p.model
      if (claims.length < 3) r.fail(`${p.file}: ${claims.length} renderable sourced facts, minimum 3`)
      for (const c of comp.claims) {
        const st = claimState(c, comp, data.today, maxAge)
        if (c.status !== 'removed' && st.expired) r.fail(`${c.id}: last accessed ${st.latest}, older than ${maxAge} days; re-verify or set status "removed"`)
        if (c.status === 'verified' && !st.verified) r.fail(`${c.id}: status "verified" needs a direct_fetch or human_check within ${maxAge} days`)
      }
      if (comp.indexable) for (const c of claims) if (!claimState(c, comp, data.today, maxAge).verified) r.fail(`${p.file} is indexable but ${c.id} is not verified`)
      const drafts = claims.filter((c) => !claimState(c, comp, data.today, maxAge).verified).map((c) => c.id)
      if (drafts.length) r.note(`${p.file}: ${drafts.length} of ${claims.length} rendered claims still need a direct fetch or human check`)
    }
    results.push(r)
  }

  /* 4 Grounding */
  {
    const r = result(4, 'Grounding')
    for (const p of comparisonPages) {
      const { comp, content } = p.model
      const check = (s, where) => {
        for (const id of s.facts) {
          if (isBeegenRef(id)) continue
          const claim = comp.claims.find((c) => c.id === id)
          if (claim && !renderable(claim, comp, data.today, maxAge)) r.fail(`${where}: cites ${id}, which does not render (conflict, no public source, removed or expired)`)
        }
        const allowed = allowedNumbers(s.facts, comp, data.snapshot, data.site)
        for (const n of numbersIn(s.text)) if (!allowed.has(n)) r.fail(`${where}: number ${n} in "${s.text}" is not in its cited facts`)
      }
      content.blocks.summary.forEach((s) => check(s, `${p.file} summary`))
      content.blocks.beegen_fits.forEach((s) => check(s, `${p.file} beegen_fits`))
      content.blocks.faq.forEach((f) => { f.a.forEach((s) => check(s, `${p.file} faq "${f.q}"`)); if (numbersIn(f.q).some((n) => !allowedNumbers(f.a.flatMap((s) => s.facts), comp, data.snapshot, data.site).has(n))) r.fail(`${p.file} faq question "${f.q}" has a number its answer does not cite`) })
      comp.when_competitor_fits_es.forEach((f) => check({ text: f.text_es, facts: f.facts }, `${p.file} when_competitor_fits`))
      const hash = factsHash(contentFactIds(content), comp, data.snapshot, data.site)
      if (hash !== content.facts_hash) r.fail(`${p.file}: the cited facts changed since the prose was written; re-read it, then run node seo/cli.mjs rehash --slug ${comp.slug}`)
      await groundingModelCheck(p, r)
    }
    results.push(r)
  }

  /* 5 Beegen facts */
  {
    const r = result(5, 'Beegen facts')
    const regFile = registryPath()
    if (fs.existsSync(regFile)) {
      const fresh = await buildSnapshot(platformDir())
      const committed = { ...data.snapshot, source: { ...data.snapshot.source } }
      delete committed.source.commit
      if (JSON.stringify(fresh) !== JSON.stringify(committed)) r.fail('platform-snapshot.json differs from src/lib/modules.ts in the platform checkout; run node seo/cli.mjs snapshot')
    } else {
      r.skip(`no platform checkout at ${platformDir()} (set BEEGEN_PLATFORM_DIR); snapshot drift not checked`)
    }
    const pricing = readText(path.join(ROOT, 'pricing.html'))
    for (const m of pricing.matchAll(/id="mod-([a-z_]+)"([\s\S]*?)(?=id="mod-|<\/section>)/g)) {
      const id = m[1]
      const mod = data.snapshot.modules[id]
      if (!mod) continue
      const amount = Number((m[2].match(/module-amount">\$([\d,]+)/) || [])[1]?.replace(/,/g, ''))
      const expected = baseMonthlyMxn(mod)
      if (amount !== expected) r.fail(`pricing.html shows $${amount} for ${id}; the registry says ${expected}`)
      const status = (m[2].match(/module-status (\w+)/) || [])[1]
      const avail = data.site.availability[id] === 'available' ? 'live' : 'soon'
      if (status !== avail) r.fail(`pricing.html marks ${id} as "${status}" but site.json availability says ${data.site.availability[id]}`)
    }
    const pricingText = normalizeSpace(visibleText(pricing))
    for (const claim of data.site.beegen_claims) {
      if (claim.source === 'pricing.html') {
        if (!pricingText.includes(normalizeSpace(claim.quote))) r.fail(`site.json claim ${claim.id}: quote not found in pricing.html`)
      } else if (claim.source.startsWith('platform:')) {
        const f = path.join(platformDir(), claim.source.slice('platform:'.length))
        if (!fs.existsSync(f)) r.skip(`claim ${claim.id}: ${claim.source} not available`)
        else if (!normalizeSpace(readText(f)).includes(normalizeSpace(claim.quote))) r.fail(`site.json claim ${claim.id}: quote not found in ${claim.source}`)
      } else r.fail(`site.json claim ${claim.id}: source must be pricing.html or platform:<path>`)
    }
    const llms = readText(path.join(ROOT, 'llms.txt'))
    for (const line of llms.split('\n')) {
      const m = line.match(/\(`([a-z_]+)`\): \$([\d,]+)/)
      if (!m || !data.snapshot.modules[m[1]]) continue
      const mod = data.snapshot.modules[m[1]]
      if (Number(m[2].replace(/,/g, '')) !== mod.priceMxn) r.fail(`llms.txt lists ${m[1]} at $${m[2]}; the registry says ${mod.priceMxn}`)
      const over = line.match(/\$([\d.]+) per extra (conversation|folio)/)
      if (over && mod.meter && Number(over[1]) !== mod.meter.overageMxn) r.fail(`llms.txt lists $${over[1]} per extra ${over[2]} for ${m[1]}; the registry says ${mod.meter.overageMxn}`)
    }
    results.push(r)
  }

  /* 6 Links */
  {
    const r = result(6, 'Links')
    const redirects = readJson(path.join(ROOT, 'vercel.json')).redirects ?? []
    const redirectSources = new Set(redirects.map((x) => x.source))
    const resolve = (href) => redirectSources.has(href) || fileForUrlPath(href.replace(/\/$/, '') || '/') !== null || generated.some((p) => p.urlPath === href)
    const inbound = new Map(generated.map((p) => [p.urlPath, new Set()]))
    const noindexGenerated = new Set(generated.filter((p) => !p.indexable).map((p) => p.urlPath))
    for (const rel of siteHtml) {
      const html = generatedFiles.has(rel) ? outputs.get(rel) : readText(path.join(ROOT, rel))
      const isNoindex = /<meta name="robots" content="[^"]*noindex/.test(html)
      const selfPath = generated.find((p) => p.file === rel)?.urlPath
      for (const href of attr(html, /href="(\/[^"#?]*)/g)) {
        if (!resolve(href)) r.fail(`${rel}: internal link ${href} does not resolve`)
        const target = href.replace(/\/$/, '') || '/'
        if (inbound.has(target) && target !== selfPath) inbound.get(target).add(rel)
        if (!isNoindex && noindexGenerated.has(target)) r.fail(`${rel} is indexable and links to noindex page ${target}`)
      }
    }
    for (const p of generated) {
      const n = inbound.get(p.urlPath).size
      if (p.indexable && n < 2) r.fail(`${p.urlPath}: ${n} internal pages link to it, minimum 2`)
      else if (n < 2) r.note(`${p.urlPath}: ${n} inbound internal links (required once it is indexable)`)
    }
    const external = [...new Set(generated.flatMap((p) => attr(p.html, /<a [^>]*href="(https?:\/\/[^"]+)"/g)).map((u) => u.replace(/&amp;/g, '&')))]
      .filter((u) => !u.startsWith('https://app.beegen.co/') && !u.startsWith('https://beegen.co/'))
    if (offline) r.skip(`--offline: ${external.length} external links not requested`)
    else {
      const botBlocked = new Set(data.site.link_check_bot_blocked_hosts?.hosts ?? [])
      for (const url of external) {
        const res = await linkOk(url)
        if (res.ok) continue
        if (res.status === 403 && botBlocked.has(new URL(url).hostname)) r.note(`external link ${url} returned 403 to the checker (host blocks bots; open it by hand during review)`)
        else r.fail(`external link ${url} returned ${res.status}`)
      }
      r.note(`${external.length} external links requested`)
    }
    results.push(r)
  }

  /* 7 Canonical and robots */
  {
    const r = result(7, 'Canonical and robots')
    for (const p of generated) {
      const canon = attr(p.html, /<link rel="canonical" href="([^"]*)"/g)
      if (canon.length !== 1) r.fail(`${p.file}: ${canon.length} canonical tags`)
      else if (canon[0] !== data.site.site_url + p.urlPath) r.fail(`${p.file}: canonical ${canon[0]} is not ${data.site.site_url + p.urlPath}`)
      const robots = attr(p.html, /<meta name="robots" content="([^"]*)"/g)
      if (robots.length !== 1 || robots[0] !== robotsFor(p.indexable)) r.fail(`${p.file}: robots "${robots.join(',')}" should be "${robotsFor(p.indexable)}"`)
    }
    results.push(r)
  }

  /* 8 No hreflang */
  {
    const r = result(8, 'No hreflang')
    for (const p of generated) if (/hreflang/i.test(p.html)) r.fail(`${p.file} has hreflang`)
    if (/hreflang/i.test(outputs.get('sitemap.xml'))) r.fail('sitemap.xml has hreflang')
    results.push(r)
  }

  /* 9 Language */
  {
    const r = result(9, 'Language')
    for (const p of generated) {
      if (!p.html.includes('<html lang="es-MX">')) r.fail(`${p.file}: html lang is not es-MX`)
      if (!p.html.includes('<meta property="og:locale" content="es_MX">')) r.fail(`${p.file}: og:locale is not es_MX`)
    }
    results.push(r)
  }

  /* 10 Title and description */
  {
    const r = result(10, 'Title and description')
    const titles = new Map()
    const descs = new Map()
    for (const rel of siteHtml) {
      const html = generatedFiles.has(rel) ? outputs.get(rel) : readText(path.join(ROOT, rel))
      if (/<meta name="robots" content="[^"]*noindex/.test(html) && !generatedFiles.has(rel)) continue
      const t = (html.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1]
      const d = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1]
      if (t) titles.set(t, [...(titles.get(t) ?? []), rel])
      if (d) descs.set(d, [...(descs.get(d) ?? []), rel])
    }
    for (const p of generated) {
      const t = (p.html.match(/<title>([^<]*)<\/title>/) || [])[1] ?? ''
      const d = (p.html.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? ''
      const tl = [...t.replace(/&amp;/g, '&')].length
      const dl = [...d.replace(/&amp;/g, '&')].length
      if (tl < 30 || tl > 60) r.fail(`${p.file}: title is ${tl} characters (30 to 60)`)
      if (dl < 120 || dl > 155) r.fail(`${p.file}: description is ${dl} characters (120 to 155)`)
      if ((titles.get(t) ?? []).length > 1) r.fail(`${p.file}: title also used by ${titles.get(t).filter((x) => x !== p.file).join(', ')}`)
      if ((descs.get(d) ?? []).length > 1) r.fail(`${p.file}: description also used by ${descs.get(d).filter((x) => x !== p.file).join(', ')}`)
    }
    results.push(r)
  }

  /* 11 JSON-LD */
  {
    const r = result(11, 'JSON-LD')
    const ALLOWED = {
      comparison: new Set(['Organization', 'BreadcrumbList', 'ListItem', 'SoftwareApplication', 'Offer', 'FAQPage', 'Question', 'Answer']),
      hub: new Set(['Organization', 'BreadcrumbList', 'ListItem']),
    }
    for (const p of generated) {
      const allowed = p.model.hub ? ALLOWED.hub : ALLOWED.comparison
      const blocks = jsonLdBlocks(p.html)
      if (!blocks.length) r.fail(`${p.file}: no JSON-LD`)
      for (const b of blocks) {
        let parsed
        try { parsed = JSON.parse(b) } catch (err) { r.fail(`${p.file}: JSON-LD does not parse (${err.message})`); continue }
        const types = typesIn(parsed)
        for (const t of types) if (!allowed.has(t)) r.fail(`${p.file}: JSON-LD type ${t} is not allowed here`)
        if (!types.includes('Organization') || !types.includes('BreadcrumbList')) r.fail(`${p.file}: JSON-LD needs Organization and BreadcrumbList`)
        const text = normalizeSpace(visibleText(p.html))
        const faq = (parsed['@graph'] ?? []).find((n) => n['@type'] === 'FAQPage')
        if (faq) for (const q of faq.mainEntity) {
          if (!text.includes(normalizeSpace(q.name))) r.fail(`${p.file}: FAQ question "${q.name}" is not visible on the page`)
          if (!text.includes(normalizeSpace(q.acceptedAnswer.text).slice(0, 60))) r.fail(`${p.file}: FAQ answer to "${q.name}" is not visible on the page`)
        }
        for (const offer of (parsed['@graph'] ?? []).flatMap((n) => n.offers ?? [])) {
          const id = Object.keys(data.snapshot.modules).find((k) => data.snapshot.modules[k].name === offer.name)
          if (!id) { r.fail(`${p.file}: offer ${offer.name} is not a registry module`); continue }
          const mod = data.snapshot.modules[id]
          if (offer.price !== baseMonthlyMxn(mod) || offer.priceCurrency !== 'MXN') r.fail(`${p.file}: offer ${offer.name} price ${offer.price} does not match the registry`)
          if (data.site.availability[id] !== 'available') r.fail(`${p.file}: offer for ${offer.name}, which is not available yet`)
        }
      }
    }
    results.push(r)
  }

  /* 12 Copy rules */
  {
    const r = result(12, 'Copy rules')
    for (const p of generated) {
      const text = visibleText(p.html)
      if (EMOJI.test(text)) r.fail(`${p.file}: emoji in visible text`)
      if (EM_DASH.test(text)) r.fail(`${p.file}: em dash in visible text`)
      if (/beegen\.mx/i.test(p.html)) r.fail(`${p.file}: mentions beegen.mx`)
      if (/meta te contesta/i.test(text)) r.fail(`${p.file}: uses the "Meta te contesta" tagline`)
      for (const w of words(text)) if (DENY.includes(w)) r.fail(`${p.file}: word "${w}" is on the deny list for comparisons`)
    }
    const scanFiles = [
      ...fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(DATA_DIR, f)),
      ...fs.readdirSync(CONTENT_DIR, { recursive: true }).filter((f) => String(f).endsWith('.json')).map((f) => path.join(CONTENT_DIR, String(f))),
      path.join(ROOT, 'sitemap.xml'),
      path.join(ROOT, 'llms.txt'),
    ]
    for (const f of scanFiles) {
      const t = readText(f)
      const rel = path.relative(ROOT, f)
      if (/beegen\.mx/i.test(t)) r.fail(`${rel}: mentions beegen.mx`)
      if (EMOJI.test(t)) r.fail(`${rel}: emoji`)
      if (EM_DASH.test(t)) r.fail(`${rel}: em dash`)
    }
    if (base) {
      let diff = ''
      try { diff = execFileSync('git', ['-C', ROOT, 'diff', '--unified=0', `${base}...HEAD`, '--', '*.html', ':!seo/**', ':!comparar/**'], { encoding: 'utf8' }) } catch { diff = '' }
      let file = ''
      for (const line of diff.split('\n')) {
        if (line.startsWith('+++ ')) file = line.slice(6)
        else if (line.startsWith('+') && !line.startsWith('+++')) {
          if (EMOJI.test(line)) r.fail(`${file}: added line has an emoji`)
          if (EM_DASH.test(line)) r.fail(`${file}: added line has an em dash`)
          if (/beegen\.mx/i.test(line)) r.fail(`${file}: added line mentions beegen.mx`)
        }
      }
    } else r.skip('no base ref; changed lines of hand-written pages not scanned')
    results.push(r)
  }

  /* 13 and 14 run in a browser */
  if (browser) {
    const { runBrowserChecks } = await import('./browser-checks.mjs')
    results.push(...(await runBrowserChecks(generated)))
  } else {
    const r13 = result(13, 'Mobile layout')
    r13.skip('run with --browser')
    const r14 = result(14, 'Lighthouse budgets')
    r14.skip('run with --browser')
    results.push(r13, r14)
  }

  /* 15 Generated files are current */
  {
    const r = result(15, 'Generated files match the data')
    for (const [rel, html] of outputs) {
      const file = path.join(ROOT, rel)
      if (!fs.existsSync(file)) r.fail(`${rel} is missing; run node seo/cli.mjs render`)
      else if (readText(file) !== html) r.fail(`${rel} differs from what the data renders; run node seo/cli.mjs render and do not edit generated files by hand`)
    }
    for (const dir of ['comparar']) {
      const abs = path.join(ROOT, dir)
      if (!fs.existsSync(abs)) continue
      for (const f of fs.readdirSync(abs)) if (!outputs.has(path.join(dir, f))) r.fail(`${dir}/${f} is not produced by the generator; remove it or add its data`)
    }
    results.push(r)
  }

  /* 16 Redirect safety */
  {
    const r = result(16, 'Redirect safety')
    const redirects = readJson(path.join(ROOT, 'vercel.json')).redirects ?? []
    for (const x of redirects) if (x.source === x.destination) r.fail(`vercel.json redirects ${x.source} to itself`)
    if (base) {
      let out = ''
      try { out = execFileSync('git', ['-C', ROOT, 'diff', '--name-status', '--diff-filter=DR', `${base}...HEAD`], { encoding: 'utf8' }) } catch { out = '' }
      for (const line of out.split('\n').filter(Boolean)) {
        const [, oldPath] = line.split('\t')
        if (!oldPath.endsWith('.html') || /^(seo|docs|\.github)\//.test(oldPath)) continue
        const url = '/' + oldPath.replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '')
        const urlPath = url === '/' ? '/' : url.replace(/\/$/, '')
        const red = redirects.find((x) => x.source === urlPath)
        if (!red || red.permanent !== true) r.fail(`${oldPath} was removed or renamed without a permanent redirect from ${urlPath} in vercel.json`)
      }
    } else r.skip('no base ref; removed pages not checked')
    results.push(r)
  }

  /* 17 Approval integrity */
  {
    const r = result(17, 'Approval integrity')
    for (const p of comparisonPages) {
      const comp = p.model.comp
      if (!comp.indexable) continue
      const hash = contentHash(p.html)
      for (const role of ['founder', 'lawyer']) {
        const a = comp.approvals[role]
        if (!a) r.fail(`${comp.slug} is indexable without a ${role} approval`)
        else if (a.content_hash !== hash) r.fail(`${comp.slug}: ${role} approval is for different content (${a.content_hash} vs ${hash})`)
      }
    }
    const log = readJson(path.join(DATA_DIR, 'approvals.log.json'))
    if (base) {
      const prev = gitShow(base, 'seo/data/approvals.log.json')
      if (prev) {
        const old = JSON.parse(prev)
        if (old.length > log.length || old.some((e, i) => JSON.stringify(e) !== JSON.stringify(log[i]))) r.fail('approvals.log.json is append-only: an earlier entry was changed or removed')
      }
    } else r.skip('no base ref; append-only log not compared')
    results.push(r)
  }

  /* 18 UTM links */
  {
    const r = result(18, 'UTM signup links')
    for (const p of generated) {
      const slug = p.model.hub ? 'index' : p.model.comp.slug
      for (const raw of attr(p.html, /href="(https:\/\/app\.beegen\.co\/signup[^"]*)"/g)) {
        const u = new URL(raw.replace(/&amp;/g, '&'))
        const want = { utm_source: 'seo', utm_medium: 'organic', utm_campaign: 'comparar', utm_content: slug }
        for (const [k, v] of Object.entries(want)) if (u.searchParams.get(k) !== v) r.fail(`${p.file}: signup link ${raw} has ${k}=${u.searchParams.get(k)}, expected ${v}`)
        const mod = u.searchParams.get('module')
        if (!data.snapshot.modules[mod]) r.fail(`${p.file}: signup link to unknown module ${mod}`)
        else if (data.site.availability[mod] !== 'available') r.fail(`${p.file}: signup link to ${mod}, which is not available yet`)
        if (u.toString() !== signupUrl(data.site, mod, 'comparar', slug)) r.fail(`${p.file}: signup link ${raw} is not built by signupUrl`)
      }
    }
    results.push(r)
  }

  return results.sort((a, b) => a.id - b.id)
}

export function printReport(results) {
  let failed = false
  for (const r of results) {
    const mark = r.status === 'pass' ? 'PASS' : r.status === 'skip' ? 'SKIP' : 'FAIL'
    if (r.status === 'fail') failed = true
    console.log(`${mark}  ${String(r.id).padStart(2)}  ${r.name}`)
    for (const d of r.details) console.log(`        ${d}`)
  }
  console.log(failed ? '\nValidation failed.' : '\nAll checks passed (skips are listed above).')
  return failed
}
