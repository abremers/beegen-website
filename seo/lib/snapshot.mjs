// Reads Beegen's module registry (beegen-platform src/lib/modules.ts) and reduces it to the
// facts SEO pages may use. The registry is the only source of Beegen prices and quotas.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { ROOT, sha256 } from './util.mjs'

export function platformDir() {
  return path.resolve(ROOT, process.env.BEEGEN_PLATFORM_DIR ?? '../beegen-platform')
}

export function registryPath(dir = platformDir()) {
  return path.join(dir, 'src/lib/modules.ts')
}

async function importRegistry(file) {
  // Copy to a .mts file so Node strips the types as an ES module without package.json hints.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'beegen-modules-'))
  const copy = path.join(tmp, 'modules.mts')
  fs.copyFileSync(file, copy)
  try {
    return await import(pathToFileURL(copy).href)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

function gitCommit(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

const es = (localized) => (localized ? localized.es : null)

function meterFacts(meter) {
  if (!meter) return null
  return { metric: meter.metric, included: meter.included, overageMxn: meter.overageMxn, unit: es(meter.unit), label: es(meter.label) }
}

/** Snapshot data, without the commit, so the comparison only fails on real registry changes. */
export async function buildSnapshot(dir = platformDir()) {
  const file = registryPath(dir)
  if (!fs.existsSync(file)) throw new Error(`Registry not found at ${file}. Set BEEGEN_PLATFORM_DIR to a beegen-platform checkout.`)
  const reg = await importRegistry(file)
  const modules = {}
  for (const id of reg.MODULE_IDS) {
    const m = reg.MODULES[id]
    if (m.hidden) continue
    modules[id] = {
      id,
      name: es(m.name),
      tagline: es(m.tagline),
      priceMxn: m.priceMxn,
      priceLabel: es(m.priceLabel),
      unitLabel: es(m.unitLabel),
      includedQuota: m.includedQuota ? { quantity: m.includedQuota.quantity, label: es(m.includedQuota.label) } : null,
      meter: meterFacts(m.meter),
      extraMeters: (m.extraMeters ?? []).map(meterFacts),
      trialable: m.trialable,
    }
  }
  const bundles = {}
  for (const b of reg.BUNDLE_LIST) {
    const grants = Object.fromEntries(Object.entries(b.grants).filter(([id]) => modules[id]))
    bundles[b.id] = { id: b.id, name: es(b.name), description: es(b.description), priceMxn: b.priceMxn, grants }
  }
  return {
    source: { repo: 'abremers/beegen-platform', path: 'src/lib/modules.ts', registry_sha256: sha256(fs.readFileSync(file, 'utf8')) },
    trial: { days: reg.TRIAL_DAYS },
    modules,
    bundles,
  }
}

export async function writeSnapshot(target) {
  const dir = platformDir()
  const snap = await buildSnapshot(dir)
  const commit = gitCommit(dir)
  const out = { ...snap, source: { ...snap.source, commit } }
  fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n')
  return out
}

/** Value at a dotted path such as "modules.wa_agent.meter.included". */
export function lookup(snapshot, ref) {
  return ref.split('.').reduce((o, k) => (o == null ? undefined : o[k]), snapshot)
}
