// Facts: competitor claims (competitors.json) and Beegen references (platform snapshot, site.json).
// Every number a page shows about Beegen comes through beegenFact(); every competitor statement
// comes from a claim that passes renderable().
import { lookup } from './snapshot.mjs'
import { daysBetween, mxn, sha256 } from './util.mjs'

const STRONG_METHODS = new Set(['direct_fetch', 'human_check'])

export function latestAccess(claim) {
  return claim.evidence.map((e) => e.accessed_at).sort().at(-1)
}

/** Verification state of one claim on a given day. */
export function claimState(claim, competitor, todayIso, maxAgeDays) {
  const publicEvidence = claim.evidence.filter((e) => sourceById(competitor, e.source_id)?.kind !== 'repo_research')
  const latest = latestAccess(claim)
  const ageDays = daysBetween(latest, todayIso)
  const strong = publicEvidence.filter((e) => STRONG_METHODS.has(e.method) && daysBetween(e.accessed_at, todayIso) <= maxAgeDays)
  return {
    latest,
    ageDays,
    expired: ageDays > maxAgeDays,
    verified: strong.length > 0,
    hasPublicSource: publicEvidence.length > 0,
    publicEvidence,
  }
}

export function sourceById(competitor, id) {
  return competitor.sources.find((s) => s.id === id)
}

/**
 * A claim renders when it has a public source, no unresolved conflict, a value, and is neither
 * removed nor past the age limit. Drafts render (pages stay noindex); index needs verified.
 */
export function renderable(claim, competitor, todayIso, maxAgeDays) {
  if (claim.status === 'removed' || claim.conflicts || claim.value === null || claim.value === undefined) return false
  const st = claimState(claim, competitor, todayIso, maxAgeDays)
  return st.hasPublicSource && !st.expired
}

/**
 * Monthly price of a module's first unit. The CRM is the one module whose registry price is per
 * extra seat (its first seat is free), the same rule as bundleSeparatePriceMxn in modules.ts.
 */
export function baseMonthlyMxn(m) {
  return m.id === 'crm' ? 0 : m.priceMxn
}

export function isBeegenRef(id) {
  return /^(modules|bundles|trial|site)\./.test(id)
}

const NUMBER_RE = /\d+(?:[.,]\d+)*/g

/** Numbers in a text, normalized: "5,000" -> 5000, "24/7" -> 24 and 7. */
export function numbersIn(text) {
  return (String(text).match(NUMBER_RE) ?? []).map((n) => Number(n.replace(/,/g, '')))
}

/**
 * Spanish phrase and numeric values for a Beegen reference. Throws on an unknown reference so a
 * typo can never render as a blank cell.
 */
export function beegenFact(ref, snapshot, site) {
  const parts = ref.split('.')
  const status = (id) => (site.availability[id] === 'available' ? '' : ' (próximamente)')
  if (parts[0] === 'site') {
    const claim = site.beegen_claims.find((c) => c.id === parts[1])
    if (!claim) throw new Error(`Unknown Beegen claim ${ref}`)
    return { text: claim.text_es, numbers: numbersIn(claim.text_es) }
  }
  if (parts[0] === 'trial' && parts[1] === 'days') {
    const days = snapshot.trial.days
    return { text: `${days} días de prueba gratis por módulo`, numbers: [days] }
  }
  if (parts[0] === 'bundles') {
    const b = snapshot.bundles[parts[1]]
    if (!b) throw new Error(`Unknown bundle in ${ref}`)
    if (parts[2] === 'priceMxn') return { text: `${b.name}: ${mxn(b.priceMxn)} al mes`, numbers: [b.priceMxn] }
    if (parts[2] === 'grants' && parts[3]) {
      const qty = b.grants[parts[3]]
      if (qty === undefined) throw new Error(`Unknown bundle grant ${ref}`)
      const mod = snapshot.modules[parts[3]]
      if (parts[3] === 'crm') return { text: `${b.name} incluye ${qty} usuarios del CRM`, numbers: [qty] }
      return { text: `${b.name} incluye ${mod.name}${qty > 1 ? ` (${qty})` : ''}`, numbers: [qty] }
    }
  }
  if (parts[0] === 'modules') {
    const m = snapshot.modules[parts[1]]
    if (!m) throw new Error(`Unknown module in ${ref}`)
    const key = parts.slice(2).join('.')
    const value = lookup(m, key)
    if (value === undefined) throw new Error(`Unknown module field ${ref}`)
    switch (key) {
      case 'priceMxn':
        if (m.id === 'crm') return { text: `${m.name}: gratis con ${m.includedQuota.label}; ${mxn(m.priceMxn)} al mes ${m.unitLabel}${status(m.id)}`, numbers: [0, m.includedQuota.quantity, m.priceMxn] }
        if (m.priceLabel) return { text: `${m.name}: ${m.priceLabel}${status(m.id)}`, numbers: [m.priceMxn, ...numbersIn(m.priceLabel)] }
        return { text: `${m.name}: ${mxn(m.priceMxn)} al mes${m.unitLabel ? ' ' + m.unitLabel : ''}${status(m.id)}`, numbers: [m.priceMxn] }
      case 'includedQuota.quantity':
        return { text: `${m.name}: ${m.includedQuota.label}`, numbers: [value] }
      case 'meter.included':
        return { text: `${m.name}: incluye ${value} ${m.meter.label} al mes`, numbers: [value] }
      case 'meter.overageMxn':
        return { text: `${m.name}: ${mxn(value)} por ${m.meter.unit} extra`, numbers: [value] }
      case 'tagline':
        return { text: `${m.name}: ${value}`, numbers: numbersIn(value) }
      case 'unitLabel':
        return { text: `${m.name}: ${value}`, numbers: [] }
      default:
        if (typeof value === 'number') return { text: `${m.name}: ${value}`, numbers: [value] }
        return { text: `${m.name}: ${value}`, numbers: numbersIn(value) }
    }
  }
  throw new Error(`Unknown Beegen reference ${ref}`)
}

/** Numbers that a sentence citing these facts may contain. */
export function allowedNumbers(factIds, competitor, snapshot, site) {
  const out = new Set()
  for (const id of factIds) {
    if (isBeegenRef(id)) {
      for (const n of beegenFact(id, snapshot, site).numbers) out.add(n)
      continue
    }
    const claim = competitor?.claims.find((c) => c.id === id)
    if (!claim) continue
    if (typeof claim.value === 'number') out.add(claim.value)
    for (const n of numbersIn(claim.text_es)) out.add(n)
  }
  return out
}

/** Hash of the facts a content file cites: ids, texts and values only, so date refreshes keep it. */
export function factsHash(factIds, competitor, snapshot, site) {
  const rows = [...new Set(factIds)].sort().map((id) => {
    if (isBeegenRef(id)) return [id, beegenFact(id, snapshot, site).text]
    const c = competitor?.claims.find((x) => x.id === id)
    return [id, c ? c.text_es : null, c ? c.value : null]
  })
  return sha256(JSON.stringify(rows))
}

export function contentFactIds(content) {
  const ids = []
  const add = (sentences) => sentences.forEach((s) => ids.push(...s.facts))
  add(content.blocks.summary)
  add(content.blocks.beegen_fits)
  content.blocks.faq.forEach((f) => add(f.a))
  return ids
}
