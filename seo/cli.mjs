#!/usr/bin/env node
// Beegen SEO engine. Usage: node seo/cli.mjs <command> [options]
//   snapshot                         read beegen-platform src/lib/modules.ts into seo/data/platform-snapshot.json
//   render                           write generated pages, sitemap.xml and llms.txt from data and content
//   check [--offline] [--browser] [--json F]  run every validator; exits 1 on any failure
//   approve --slug S --as founder|lawyer --by "Name"
//   index --slug S                   flip a comparison page to index (refuses unless approvals and claims allow it)
//   verify [--slug S]                list claims that need a direct fetch or a human check
//   rehash --slug S                  record that the page's prose was re-read after its facts changed
import path from 'node:path'
import { DATA_DIR, CONTENT_DIR, readJson, writeJson, today } from './lib/util.mjs'
import { writeSnapshot } from './lib/snapshot.mjs'
import { contentHash, loadData, renderAll, writeOutputs } from './lib/render.mjs'
import { claimState, contentFactIds, factsHash } from './lib/facts.mjs'
import { runChecks, printReport } from './lib/checks.mjs'

const [command, ...rest] = process.argv.slice(2)
const opts = {}
for (let i = 0; i < rest.length; i++) {
  if (!rest[i].startsWith('--')) continue
  const key = rest[i].slice(2)
  const next = rest[i + 1]
  if (next === undefined || next.startsWith('--')) opts[key] = true
  else opts[key] = rest[++i]
}

const COMPETITORS = path.join(DATA_DIR, 'competitors.json')
const LOG = path.join(DATA_DIR, 'approvals.log.json')

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

function findPage(slug) {
  const { pages, data } = renderAll()
  const page = pages.find((p) => p.urlPath === `/comparar/${slug}`)
  if (!page) fail(`No comparison page with slug "${slug}"`)
  return { page, data }
}

async function main() {
  switch (command) {
    case 'snapshot': {
      const snap = await writeSnapshot(path.join(DATA_DIR, 'platform-snapshot.json'))
      console.log(`platform-snapshot.json written from commit ${snap.source.commit ?? 'unknown'}`)
      break
    }
    case 'render': {
      const changed = writeOutputs(renderAll().outputs)
      console.log(changed.length ? `updated: ${changed.join(', ')}` : 'no changes')
      break
    }
    case 'check': {
      const results = await runChecks({ offline: Boolean(opts.offline), browser: Boolean(opts.browser) })
      const failed = printReport(results)
      if (typeof opts.json === 'string') writeJson(opts.json, results.map(({ id, name, status, details }) => ({ id, name, status, details })))
      process.exit(failed ? 1 : 0)
    }
    case 'approve': {
      if (!opts.slug || !['founder', 'lawyer'].includes(opts.as) || typeof opts.by !== 'string') fail('approve --slug S --as founder|lawyer --by "Name"')
      const { page } = findPage(opts.slug)
      const hash = contentHash(page.html)
      const doc = readJson(COMPETITORS)
      const comp = doc.competitors.find((c) => c.slug === opts.slug)
      const entry = { by: opts.by, at: today(), content_hash: hash }
      comp.approvals[opts.as] = entry
      writeJson(COMPETITORS, doc)
      const log = readJson(LOG)
      log.push({ family: 'comparar', slug: opts.slug, action: `approve:${opts.as}`, ...entry })
      writeJson(LOG, log)
      console.log(`${opts.as} approval recorded for ${opts.slug} (${hash})`)
      break
    }
    case 'index': {
      if (!opts.slug) fail('index --slug S')
      const { page, data } = findPage(opts.slug)
      const comp = data.competitors.competitors.find((c) => c.slug === opts.slug)
      const hash = contentHash(page.html)
      const problems = []
      for (const role of ['founder', 'lawyer']) {
        if (!comp.approvals[role]) problems.push(`no ${role} approval`)
        else if (comp.approvals[role].content_hash !== hash) problems.push(`${role} approval is for different content`)
      }
      const maxAge = data.competitors.max_claim_age_days ?? 60
      for (const claim of page.model.claims) {
        if (!claimState(claim, comp, data.today, maxAge).verified) problems.push(`claim ${claim.id} is not verified by direct fetch or human check`)
      }
      if (problems.length) fail(`Refusing to index ${opts.slug}:\n- ${problems.join('\n- ')}`)
      const doc = readJson(COMPETITORS)
      doc.competitors.find((c) => c.slug === opts.slug).indexable = true
      writeJson(COMPETITORS, doc)
      const log = readJson(LOG)
      log.push({ family: 'comparar', slug: opts.slug, action: 'index', by: opts.by ?? null, at: today(), content_hash: hash })
      writeJson(LOG, log)
      const changed = writeOutputs(renderAll().outputs)
      console.log(`${opts.slug} is now indexable; updated ${changed.join(', ')}`)
      break
    }
    case 'verify': {
      const data = loadData()
      const maxAge = data.competitors.max_claim_age_days ?? 60
      for (const comp of data.competitors.competitors) {
        if (opts.slug && comp.slug !== opts.slug) continue
        for (const claim of comp.claims) {
          if (claim.status === 'removed') continue
          const st = claimState(claim, comp, data.today, maxAge)
          if (st.verified && st.ageDays <= maxAge - 15) continue
          const reason = !st.verified ? 'not verified by direct fetch or human check' : `expires in ${maxAge - st.ageDays} days`
          console.log(`${claim.id}: ${reason}`)
          for (const e of claim.evidence) {
            const src = comp.sources.find((s) => s.id === e.source_id)
            console.log(`  ${e.method} ${e.accessed_at} ${src?.url}\n    quote: ${e.quote ?? ''}`)
          }
        }
      }
      break
    }
    case 'rehash': {
      if (!opts.slug) fail('rehash --slug S')
      const data = loadData()
      const comp = data.competitors.competitors.find((c) => c.slug === opts.slug)
      const file = path.join(CONTENT_DIR, 'comparar', `${opts.slug}.json`)
      const content = readJson(file)
      content.facts_hash = factsHash(contentFactIds(content), comp, data.snapshot, data.site)
      writeJson(file, content)
      console.log(`facts_hash updated for ${opts.slug}`)
      break
    }
    default:
      console.log('Commands: snapshot, render, check, approve, index, verify, rehash. See the header of seo/cli.mjs.')
      process.exit(command ? 1 : 0)
  }
}

main().catch((err) => fail(err.stack ?? String(err)))
