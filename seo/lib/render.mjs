// Pure render: data + content + templates -> HTML, sitemap.xml and llms.txt. Never calls a model,
// never reads the clock except through today() (SEO_TODAY pins it), so output is reproducible.
import fs from 'node:fs'
import path from 'node:path'
import { CONTENT_DIR, DATA_DIR, ROOT, TEMPLATE_DIR, dateEs, esc, mxn, readJson, readText, sha256, today, usd } from './util.mjs'
import { baseMonthlyMxn, beegenFact, claimState, isBeegenRef, renderable, sourceById } from './facts.mjs'

export function loadData() {
  const site = readJson(path.join(DATA_DIR, 'site.json'))
  const competitors = readJson(path.join(DATA_DIR, 'competitors.json'))
  const snapshot = readJson(path.join(DATA_DIR, 'platform-snapshot.json'))
  const staticPages = readJson(path.join(DATA_DIR, 'static-pages.json'))
  const content = {}
  const dir = path.join(CONTENT_DIR, 'comparar')
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const c = readJson(path.join(dir, f))
      content[`comparar/${c.slug}`] = c
    }
  }
  return { site, competitors, snapshot, staticPages, content, today: today() }
}

/* ── URLs and attribution ─────────────────────────────────── */

export function pageUrl(site, urlPath) {
  return site.site_url + urlPath
}

export function signupUrl(site, moduleId, family, slug) {
  const u = new URL(site.signup_url)
  u.searchParams.set('module', moduleId)
  u.searchParams.set('utm_source', 'seo')
  u.searchParams.set('utm_medium', 'organic')
  u.searchParams.set('utm_campaign', family)
  u.searchParams.set('utm_content', slug)
  return u.toString()
}

/** Adds the page's UTM parameters to every signup link in a chunk of chrome HTML. */
function tagSignupLinks(html, site, family, slug) {
  return html.replace(/https:\/\/app\.beegen\.co\/signup\?module=([a-z_]+)/g, (_, mod) => esc(signupUrl(site, mod, family, slug)))
}

/* ── Shared shell ─────────────────────────────────────────── */

const PAGE_STYLE = `<style>
.seo-hero { padding-bottom: 48px; }
.seo-hero > .container { width: 100%; }
.seo-hero .lp-eyebrow { margin-bottom: 16px; }
.seo-crumbs ol { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 0 0 20px; font-size: 14px; color: rgba(255,255,255,.7); }
.seo-crumbs li + li::before { content: "/"; margin-right: 6px; color: rgba(255,255,255,.4); }
.seo-crumbs a { color: rgba(255,255,255,.85); }
.seo-summary p { font-size: 18px; line-height: 1.6; color: rgba(255,255,255,.85); max-width: 760px; margin: 0 0 12px; }
.seo-summary sup a { color: #7fe3cf; font-size: 12px; text-decoration: none; }
.seo-verified { font-size: 14px; color: rgba(255,255,255,.7); margin-top: 20px; }
.seo-verified a { color: #ffffff; text-decoration: underline; }
.seo-hero .seo-draft { display: inline-block; margin-top: 12px; padding: 8px 12px; border-radius: 8px; background: #fff4d6; color: #5c4400; font-size: 14px; font-weight: 600; }
.seo-section { padding: 56px 0; }
.seo-section h2 { margin-bottom: 20px; }
.seo-prose { max-width: 820px; }
.seo-prose p, .seo-prose li { font-size: 16px; line-height: 1.7; color: #334155; }
.seo-prose ul { padding-left: 20px; margin: 0; }
.seo-prose li { margin-bottom: 10px; }
.seo-prose sup a, .compare-table sup a { font-size: 11px; color: var(--teal-dark); text-decoration: none; padding: 0 1px; }
.compare-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid var(--mist); border-radius: var(--radius-lg); background: #fff; max-width: 100%; }
.compare-table { width: 100%; border-collapse: collapse; min-width: 640px; font-size: 14px; }
.compare-table th, .compare-table td { padding: 14px 16px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--mist); line-height: 1.45; }
.compare-table thead th { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: var(--navy); background: var(--cloud); border-bottom: 2px solid var(--mist); }
.compare-table tbody th { font-weight: 700; color: var(--navy); width: 22%; background: #fff; }
.compare-table tbody tr:last-child th, .compare-table tbody tr:last-child td { border-bottom: none; }
.compare-table .compare-beegen { background: rgba(2,195,154,.07); color: var(--navy); font-weight: 600; }
.compare-note { margin: 16px 0 0; max-width: 820px; font-size: 14px; color: #475569; }
.seo-sources ol { padding-left: 20px; }
.seo-sources li { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 8px; word-break: break-word; }
.seo-sources li a, .seo-prose p a { color: var(--navy); text-decoration: underline; }
.seo-disclaimer { font-size: 13px; color: #64748b; margin-top: 20px; max-width: 820px; }
.seo-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.seo-card { display: block; padding: 20px; border: 1px solid var(--mist); border-radius: var(--radius-lg); background: #fff; color: var(--navy); min-height: 44px; }
.seo-card h3 { font-size: 18px; margin: 0 0 8px; }
.seo-card p { font-size: 14px; color: #475569; margin: 0; }
.seo-links { display: flex; flex-wrap: wrap; gap: 12px; padding: 0; list-style: none; }
.seo-links a { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border: 1px solid var(--mist); border-radius: 999px; background: #fff; color: var(--navy); font-weight: 600; font-size: 14px; }
.seo-soon { margin-top: 16px; font-size: 14px; color: rgba(255,255,255,.6); }
.seo-soon a { color: rgba(255,255,255,.85); text-decoration: underline; }
.seo-en-note { display: none; }
html[lang="en"] .seo-en-note { display: block; margin: 0 0 16px; padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,.12); color: #ffffff; font-size: 14px; }
.faq-list .faq-answer p { margin: 0 0 8px; }
</style>`

function shell({ site, urlPath, title, description, robots, jsonld, main, family, slug }) {
  const canonical = pageUrl(site, urlPath)
  const nav = tagSignupLinks(readText(path.join(TEMPLATE_DIR, 'nav.html')), site, family, slug)
  const footer = tagSignupLinks(readText(path.join(TEMPLATE_DIR, 'footer.html')), site, family, slug)
  const ld = jsonld.map((obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`).join('\n')
  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="${robots}">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="https://beegen.co/assets/og-image.png">
<meta property="og:locale" content="es_MX">
<link rel="icon" href="/assets/logos/beegen-logo-color.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/global.css">
${PAGE_STYLE}
${ld}
</head>
<body>
<!-- Generated by seo/cli.mjs render from seo/data and seo/content. Edit those, not this file. -->
${nav}
${main}

${footer}
<script src="/js/main.js?v=3"></script>
<script src="/js/i18n.js?v=3"></script>
</body>
</html>
`
}

const ORG = { '@type': 'Organization', '@id': 'https://beegen.co/#organization', name: 'Beegen', url: 'https://beegen.co/', logo: 'https://beegen.co/assets/logos/beegen-logo-color.svg' }

function breadcrumbLd(site, items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: pageUrl(site, it.path) })),
  }
}

function crumbsHtml(items) {
  return `<nav class="seo-crumbs" aria-label="Ruta de navegación"><ol>${items
    .map((it, i) => (i === items.length - 1 ? `<li aria-current="page">${esc(it.name)}</li>` : `<li><a href="${esc(it.path)}">${esc(it.name)}</a></li>`))
    .join('')}</ol></nav>`
}

/* ── Comparison page ──────────────────────────────────────── */

export function robotsFor(indexable) {
  return indexable ? 'index, follow' : 'noindex, follow'
}

/** Everything the comparison template needs, computed once; checks reuse it. */
export function comparisonModel(data, comp) {
  const { competitors, snapshot, site } = data
  const maxAge = competitors.max_claim_age_days ?? 60
  const claims = comp.claims.filter((c) => renderable(c, comp, data.today, maxAge))
  const claimIds = new Set(claims.map((c) => c.id))
  // Number the public sources in order of first use.
  const sourceOrder = []
  const sourceNum = (id) => {
    if (!sourceOrder.includes(id)) sourceOrder.push(id)
    return sourceOrder.indexOf(id) + 1
  }
  const cite = (claimId) => {
    const claim = comp.claims.find((c) => c.id === claimId)
    const st = claimState(claim, comp, data.today, maxAge)
    // A verified claim cites only the pages it was verified on; older search excerpts stay in the data as history.
    const strong = st.publicEvidence.filter((e) => e.method === 'direct_fetch' || e.method === 'human_check')
    return (strong.length ? strong : st.publicEvidence).map((e) => e.source_id).filter((v, i, a) => a.indexOf(v) === i).map(sourceNum)
  }
  const contrasts = comp.contrasts
    .map((r) => ({ ...r, competitor_claim_ids: r.competitor_claim_ids.filter((id) => claimIds.has(id)) }))
    .filter((r) => r.competitor_claim_ids.length > 0)
  const usedInTable = new Set(contrasts.flatMap((r) => r.competitor_claim_ids))
  // Plan-specific connection facts are shown under the price scenarios, when the page has them.
  const hasScenarios = claims.some((c) => c.topic === 'users' && c.plan)
  const connectionNotes = hasScenarios ? claims.filter((c) => c.topic === 'whatsapp_connection' && c.plan) : []
  connectionNotes.forEach((c) => usedInTable.add(c.id))
  const otherClaims = claims.filter((c) => !usedInTable.has(c.id))
  const states = claims.map((c) => claimState(c, comp, data.today, maxAge))
  const oldest = states.map((s) => s.latest).sort()[0]
  const allVerified = states.every((s) => s.verified)
  const content = data.content[`comparar/${comp.slug}`] ?? null
  const modules = comp.beegen_modules.filter((id) => snapshot.modules[id])
  return {
    comp, claims, claimIds, contrasts, otherClaims, connectionNotes, oldest, allVerified, content, cite, sourceOrder,
    available: modules.filter((id) => site.availability[id] === 'available'),
    soon: modules.filter((id) => site.availability[id] !== 'available'),
    urlPath: `/comparar/${comp.slug}`,
    file: `comparar/${comp.slug}.html`,
  }
}

function sentenceHtml(s, model) {
  const sups = s.facts
    .filter((id) => !isBeegenRef(id) && model.claimIds.has(id))
    .flatMap((id) => model.cite(id))
    .filter((v, i, a) => a.indexOf(v) === i)
  return esc(s.text) + supHtml(sups)
}

function supHtml(nums) {
  return nums.length ? `<sup>${nums.map((n) => `<a href="#fuente-${n}">${n}</a>`).join(' ')}</sup>` : ''
}

function claimHtml(claim, model) {
  return esc(claim.text_es) + supHtml(model.cite(claim.id))
}

/** Price scenarios: cheapest published plan that covers n users, against Beegen's agent plus seats. */
function scenarioRows(model, data) {
  const { claims } = model
  const { snapshot } = data
  const prices = claims.filter((c) => c.topic === 'pricing' && c.plan && typeof c.value === 'number')
  const users = claims.filter((c) => c.topic === 'users' && c.plan && typeof c.value === 'number')
  const plans = prices
    .map((p) => ({ plan: p.plan, price: p.value, unit: p.unit, priceClaim: p, usersClaim: users.find((u) => u.plan === p.plan) }))
    .filter((p) => p.usersClaim)
    .sort((a, b) => a.price - b.price)
  const agent = snapshot.modules.wa_agent
  const crm = snapshot.modules.crm
  return [1, 3, 5].map((n) => {
    const fit = plans.find((p) => p.usersClaim.value >= n)
    const extraSeats = Math.max(0, n - crm.includedQuota.quantity)
    const beegenTotal = agent.priceMxn + extraSeats * crm.priceMxn
    const beegenText = `${mxn(beegenTotal)} al mes: ${agent.name} (${mxn(agent.priceMxn)})${extraSeats ? ` y ${extraSeats} ${extraSeats === 1 ? 'usuario extra' : 'usuarios extra'} del CRM (${mxn(crm.priceMxn)} cada uno)` : ' y el CRM gratis con 1 usuario'}`
    const compText = fit
      ? `${fit.unit === 'USD/mes' ? usd(fit.price) : fit.price + ' ' + fit.unit} al mes: plan ${fit.plan} (${fit.usersClaim.value} usuarios)` + supHtml([...new Set([...model.cite(fit.priceClaim.id), ...model.cite(fit.usersClaim.id)])])
      : 'Sin un plan con ese número de usuarios en los datos que revisamos'
    return { n, compText, beegenText }
  })
}

export function renderComparison(data, comp) {
  const { site, snapshot, competitors } = data
  const m = comparisonModel(data, comp)
  const c = m.content
  if (!c) throw new Error(`Missing seo/content/comparar/${comp.slug}.json`)
  const name = comp.name
  const h1 = comp.title_es.replace(/\s*\|\s*Beegen$/, '')
  const crumbs = [{ name: 'Inicio', path: '/' }, { name: 'Comparar', path: site.families.comparar.hub_path }, { name, path: m.urlPath }]

  const rows = m.contrasts
    .map((r) => {
      const left = r.competitor_claim_ids.map((id) => claimHtml(comp.claims.find((x) => x.id === id), m)).join('<br>')
      const right = r.beegen_fact_refs.map((ref) => esc(beegenFact(ref, snapshot, site).text)).join('<br>')
      return `<tr><th scope="row">${esc(r.topic)}</th><td>${left}</td><td class="compare-beegen">${right}</td></tr>`
    })
    .join('\n')
  const notes = m.contrasts.filter((r) => r.note_es).map((r) => esc(r.note_es))
  const usdPrices = m.claims.some((x) => x.unit === 'USD/mes')
  if (usdPrices) notes.push(`${esc(name)} publica sus precios en dólares; los mostramos tal cual, sin convertir. Los precios de Beegen están en pesos mexicanos con IVA incluido.`)

  // Seat-based price scenarios only make sense when the competitor publishes plans with user counts.
  const scenarioData = m.claims.some((x) => x.topic === 'users' && x.plan) ? scenarioRows(m, data) : []
  const scenarios = scenarioData
    .map((s) => `<tr><th scope="row">${s.n} ${s.n === 1 ? 'persona' : 'personas'}</th><td>${s.compText}</td><td class="compare-beegen">${esc(s.beegenText)}</td></tr>`)
    .join('\n')
  const connectionNotes = m.connectionNotes.map((x) => `<li>${claimHtml(x, m)}</li>`)

  const other = m.otherClaims.map((x) => `<li>${claimHtml(x, m)}</li>`).join('\n')
  const fits = comp.when_competitor_fits_es.map((f) => `<li>${esc(f.text_es)}${supHtml([...new Set(f.facts.filter((id) => m.claimIds.has(id)).flatMap((id) => m.cite(id)))])}</li>`).join('\n')
  const beegenFits = c.blocks.beegen_fits.map((s) => `<li>${sentenceHtml(s, m)}</li>`).join('\n')
  const summary = c.blocks.summary.map((s) => sentenceHtml(s, m)).join(' ')
  const faq = c.blocks.faq
    .map(
      (f) => `      <div class="faq-item">
        <button class="faq-question" type="button" aria-expanded="false">
          <span>${esc(f.q)}</span>
          <span class="faq-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg></span>
        </button>
        <div class="faq-answer">
          <p>${f.a.map((s) => sentenceHtml(s, m)).join(' ')}</p>
        </div>
      </div>`,
    )
    .join('\n')

  // Sources are listed after everything above has been cited, in citation order.
  const sources = m.sourceOrder
    .map((id, i) => {
      const src = sourceById(comp, id)
      const accessed = comp.claims
        .filter((x) => m.claimIds.has(x.id))
        .flatMap((x) => x.evidence.filter((e) => e.source_id === id).map((e) => e.accessed_at))
        .sort()
        .at(-1)
      return `<li id="fuente-${i + 1}">${esc(src.publisher)}. <a href="${esc(src.url)}" rel="nofollow noopener" target="_blank">${esc(src.url)}</a>. Consultado el ${esc(dateEs(accessed))}.</li>`
    })
    .join('\n')

  const ctas = m.available
    .map((id) => {
      const mod = snapshot.modules[id]
      const label = mod.trialable ? `Probar ${mod.name} ${snapshot.trial.days} días gratis` : `Empezar gratis con el ${mod.name}`
      return `<a href="${esc(signupUrl(site, id, 'comparar', comp.slug))}" class="btn btn-primary btn-lg">${esc(label)}</a>`
    })
    .join('\n        ')
  const soon = m.soon.length
    ? `<p class="seo-soon">Próximamente: ${m.soon.map((id) => `<a href="${esc(site.module_pages[id])}">${esc(snapshot.modules[id].name)}</a>`).join(', ')}.</p>`
    : ''
  const related = [
    ...m.available.map((id) => ({ href: site.module_pages[id], text: snapshot.modules[id].name })),
    { href: '/pricing', text: 'Todos los módulos y precios' },
    { href: site.families.comparar.hub_path, text: 'Más comparaciones' },
  ]

  const verified = m.allVerified
    ? `Información verificada el ${dateEs(m.oldest)}.`
    : `Información consultada el ${dateEs(m.oldest)}.`
  const draft = m.allVerified ? '' : `<p class="seo-draft">Borrador: hay datos pendientes de verificación directa. Esta página no se indexa hasta revisarlos.</p>`

  const main = `<main id="contenido" data-seo-main="comparar/${esc(comp.slug)}">
<section class="page-hero lp-hero seo-hero">
  <div class="container">
    ${crumbsHtml(crumbs)}
    <p class="seo-en-note">This comparison is available in Spanish only.</p>
    <div class="lp-eyebrow"><span>Comparativa</span></div>
    <h1>${esc(h1)}</h1>
    <div class="seo-summary"><p>${summary}</p></div>
    <p class="seo-verified">${verified} ¿Ves un dato incorrecto? Escríbenos a <a href="mailto:${esc(competitors.correction_email)}">${esc(competitors.correction_email)}</a>.</p>
    ${draft}
  </div>
</section>

<section class="section seo-section" id="comparacion" style="background:#ffffff;">
  <div class="container">
    <h2>${esc(name)} y Beegen, punto por punto</h2>
    <div class="compare-wrap">
      <table class="compare-table">
        <thead><tr><th scope="col">Tema</th><th scope="col">${esc(name)}</th><th scope="col" class="compare-beegen">Beegen</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table>
    </div>
    ${notes.map((n) => `<p class="compare-note">${n}</p>`).join('\n    ')}
  </div>
</section>

${scenarios ? `<section class="section seo-section" id="escenarios" style="background:var(--cloud);">
  <div class="container">
    <h2>Cuánto pagarías al mes según el tamaño de tu equipo</h2>
    <div class="compare-wrap">
      <table class="compare-table">
        <thead><tr><th scope="col">Equipo</th><th scope="col">${esc(name)}</th><th scope="col" class="compare-beegen">Beegen</th></tr></thead>
        <tbody>
${scenarios}
        </tbody>
      </table>
    </div>
    <p class="compare-note">Cálculo con el plan más barato que cubre ese número de usuarios en cada caso. No incluye las tarifas de Meta por mensajes de WhatsApp.</p>
    ${connectionNotes.length ? `<div class="seo-prose"><ul class="compare-note">\n${connectionNotes.join('\n')}\n</ul></div>` : ''}
  </div>
</section>
` : ''}
${other ? `<section class="section seo-section" id="otros-datos" style="background:#ffffff;">
  <div class="container"><div class="seo-prose">
    <h2>Otros datos que publica ${esc(name)}</h2>
    <ul>
${other}
    </ul>
  </div></div>
</section>
` : ''}
<section class="section seo-section" id="cuando-conviene" style="background:var(--cloud);">
  <div class="container"><div class="seo-prose">
    <h2>Cuándo te conviene ${esc(name)}</h2>
    <ul>
${fits}
    </ul>
    <h2 style="margin-top:40px;">Cuándo te conviene Beegen</h2>
    <ul>
${beegenFits}
    </ul>
  </div></div>
</section>

<section class="section seo-section" id="faq" style="background:#ffffff;">
  <div class="container">
    <h2>Preguntas frecuentes</h2>
    <div class="faq-list">
${faq}
    </div>
  </div>
</section>

<section class="section seo-section seo-sources" id="fuentes" style="background:var(--cloud);">
  <div class="container"><div class="seo-prose">
    <h2>Fuentes</h2>
    <ol>
${sources}
    </ol>
    <p class="seo-disclaimer">${esc(name)} es una marca de su titular. Beegen no está afiliado con ${esc(name)}. Los precios y las funciones pueden cambiar; revisa cada fuente antes de decidir.</p>
    <h2 style="margin-top:40px;">Sigue comparando</h2>
    <ul class="seo-links">
${related.map((r) => `      <li><a href="${esc(r.href)}">${esc(r.text)}</a></li>`).join('\n')}
    </ul>
  </div></div>
</section>

<section class="cta-band">
  <div class="container">
    <h2>Prueba Beegen con tus propios clientes</h2>
    <p>${esc(beegenFact('site.trial_no_card', snapshot, site).text)}</p>
    <div class="cta-band-actions">
        ${ctas}
    </div>
    ${soon}
  </div>
</section>
</main>`

  const offers = m.available.map((id) => {
    const mod = snapshot.modules[id]
    const price = baseMonthlyMxn(mod)
    return { '@type': 'Offer', name: mod.name, price, priceCurrency: 'MXN', url: pageUrl(site, site.module_pages[id]) }
  })
  const jsonld = [
    {
      '@context': 'https://schema.org',
      '@graph': [
        ORG,
        breadcrumbLd(site, crumbs),
        { '@type': 'SoftwareApplication', name: 'Beegen', url: 'https://beegen.co/', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'es-MX', provider: { '@id': ORG['@id'] }, offers },
        {
          '@type': 'FAQPage',
          mainEntity: c.blocks.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a.map((s) => s.text).join(' ') } })),
        },
      ],
    },
  ]
  const html = shell({ site, urlPath: m.urlPath, title: comp.title_es, description: comp.description_es, robots: robotsFor(comp.indexable), jsonld, main, family: 'comparar', slug: comp.slug })
  return { file: m.file, urlPath: m.urlPath, html, model: m, indexable: comp.indexable }
}

/* ── Hub ──────────────────────────────────────────────────── */

export function hubIndexable(data) {
  const fam = data.site.families.comparar
  return data.competitors.competitors.filter((c) => c.indexable).length >= fam.hub_min_indexable_children
}

export function renderHub(data) {
  const { site, competitors } = data
  const fam = site.families.comparar
  const indexable = hubIndexable(data)
  // An indexable hub links only to indexable children; a draft hub lists every draft for review.
  const children = competitors.competitors.filter((c) => !indexable || c.indexable)
  const crumbs = [{ name: 'Inicio', path: '/' }, { name: 'Comparar', path: fam.hub_path }]
  const groups = fam.groups
    .map((g) => {
      const items = children.filter((c) => g.categories.includes(c.category))
      if (!items.length) return ''
      return `<h2 style="margin:32px 0 16px;">${esc(g.title_es)}</h2>
    <div class="seo-cards">
${items.map((c) => `      <a class="seo-card" href="/comparar/${esc(c.slug)}"><h3>${esc(c.title_es.replace(/\s*\|\s*Beegen$/, ''))}</h3><p>${esc(c.description_es)}</p></a>`).join('\n')}
    </div>`
    })
    .filter(Boolean)
    .join('\n    ')
  const main = `<main id="contenido" data-seo-main="comparar/index">
<section class="page-hero lp-hero seo-hero">
  <div class="container">
    ${crumbsHtml(crumbs)}
    <p class="seo-en-note">This comparison is available in Spanish only.</p>
    <h1>${esc(fam.hub_h1_es)}</h1>
    <div class="seo-summary"><p>${esc(fam.hub_intro_es)}</p></div>
    <p class="seo-verified">¿Ves un dato incorrecto? Escríbenos a <a href="mailto:${esc(competitors.correction_email)}">${esc(competitors.correction_email)}</a>.</p>
  </div>
</section>

<section class="section seo-section" style="background:#ffffff;">
  <div class="container">
    ${groups}
    <ul class="seo-links" style="margin-top:40px;">
      <li><a href="/pricing">Todos los módulos y precios</a></li>
    </ul>
  </div>
</section>
</main>`
  const jsonld = [{ '@context': 'https://schema.org', '@graph': [ORG, breadcrumbLd(site, crumbs)] }]
  const html = shell({ site, urlPath: fam.hub_path, title: fam.hub_title_es, description: fam.hub_description_es, robots: robotsFor(indexable), jsonld, main, family: 'comparar', slug: 'index' })
  return { file: 'comparar/index.html', urlPath: fam.hub_path, html, indexable, model: { hub: true, children } }
}

/* ── Sitemap and llms.txt ─────────────────────────────────── */

export function renderSitemap(data, pages) {
  const entries = [
    ...data.staticPages.pages,
    ...pages.filter((p) => p.indexable).map((p) => ({ path: p.urlPath, changefreq: 'monthly', priority: p.model.hub ? '0.6' : '0.7' })),
  ]
  const body = entries
    .map((e) => `  <url>\n    <loc>${data.site.site_url}${e.path === '/' ? '/' : e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

export function renderLlms(data, pages) {
  const base = readText(path.join(TEMPLATE_DIR, 'llms.txt'))
  const listed = pages.filter((p) => p.indexable && !p.model.hub)
  if (!listed.length) return base
  const lines = listed.map((p) => {
    const comp = data.competitors.competitors.find((c) => `/comparar/${c.slug}` === p.urlPath)
    return `- ${comp.title_es.replace(/\s*\|\s*Beegen$/, '')}: ${data.site.site_url}${p.urlPath}`
  })
  return base.replace(/\n*$/, '\n') + `\n## Comparisons (Spanish)\n${lines.join('\n')}\n`
}

/* ── Everything ───────────────────────────────────────────── */

export function renderAll(data = loadData()) {
  const pages = data.competitors.competitors.map((c) => renderComparison(data, c))
  pages.push(renderHub(data))
  const outputs = new Map(pages.map((p) => [p.file, p.html]))
  outputs.set('sitemap.xml', renderSitemap(data, pages))
  outputs.set('llms.txt', renderLlms(data, pages))
  return { data, pages, outputs }
}

export function writeOutputs(outputs) {
  const changed = []
  for (const [rel, html] of outputs) {
    const file = path.join(ROOT, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
    if (prev !== html) {
      fs.writeFileSync(file, html)
      changed.push(rel)
    }
  }
  return changed
}

/** The approved unit: the page's <main> element. Approvals hash it; any change voids them. */
export function mainContent(html) {
  const m = html.match(/<main id="contenido"[\s\S]*?<\/main>/)
  return m ? m[0] : ''
}

export function contentHash(html) {
  return sha256(mainContent(html))
}
