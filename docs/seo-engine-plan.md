# SEO engine plan (phase 0)

Status: proposal for the founder's approval. Nothing in this document is built yet. Date: 2026-10-29.
Scope: beegen.co (abremers/beegen-website). Beegen facts come from abremers/beegen-platform (`src/lib/modules.ts`, `docs/pricing-rules.md`) and the site's `/pricing` page, nothing else.

## 0. Summary and the decisions this plan asks for

Build a small, dependency-light generator that turns sourced JSON data into static Spanish (es-MX) pages, gate every pull request with validators that fail on duplicate text, unsourced facts, broken links and bad markup, and run a weekly Claude Code task that reads Search Console, proposes and drafts the next pages as pull requests, and writes a report. A human merges everything for the first 60 days. Phase 1 is 10 comparison pages plus the `/comparar` hub, shipped `noindex` until the founder and a lawyer approve each one.

Decisions needed from the founder before phase 1 starts (each is explained later):

1. Approve this plan, the URL scheme (section 3) and the tenth competitor: **Framer** (section 2.3).
2. Confirm the correction mailbox `correcciones@beegen.co` exists or name another (section 5.3).
3. Approve a separate hygiene pull request for problems found in the current site (section 15): canonical URLs that point at redirecting `.html` addresses, `lang="es"` instead of `es-MX`, a stale folio price in `llms.txt`, and a self-redirect in `vercel.json`.
4. Decide whether SEO pages may send trial starts to modules marked "Próximamente" on the site (section 9.4).
5. Do the human steps in section 17 (Search Console, service account, GitHub secrets, beegen.mx check, network allowlist).

## 1. Objectives and success metrics

Objective: rank for high-intent Mexican searches and be cited by ChatGPT, Perplexity and Gemini for questions about WhatsApp CRMs, payment links, reminders, Google reviews, CFDI and websites for small businesses in Mexico, and turn that traffic into trial starts of Beegen modules.

beegen.co is a young domain with 19 URLs and no backlink profile to speak of, so the first 90 days measure whether Google indexes and trusts the pages at all; traffic and trials are the 180-day test. The targets below are proposals to steer by, not forecasts.

| Metric | Source | Day 90 (from phase 1 going index) | Day 180 |
|---|---|---|---|
| Phase 1 URLs indexed (11 = 10 pages plus hub) | URL Inspection API | 8 of 11 (70% is also the phase 2 gate, measured at day 30) | 11 of 11 |
| Total generated pages live and indexed | URL Inspection API | 11 | 30 to 40 (phase 2 started) |
| Impressions per month on generated pages | Search Console | 1,500 | 10,000 |
| Clicks per month on generated pages | Search Console | 40 | 300 |
| Queries with average position 10 or better | Search Console | 15 | 80 |
| Trial starts attributed to `utm_source=seo` | Platform attribution table (section 9) | 10 cumulative | 60 cumulative |
| AI citation rate on a fixed panel of 30 Spanish prompts | Monthly panel (section 8.6) | Beegen cited in at least 3 | at least 9 |
| Factual errors reported through the correction email that were real | `seo/data/corrections.json` | 0 unresolved after 5 business days | same |
| Validator escape rate (a defect found after merge that a validator should have caught) | Weekly report | 0 | 0 |

If phase 1 has fewer than 4 of 11 URLs indexed 45 days after going index, stop drafting new pages and run the indexation playbook in section 12.4 instead.

## 2. Phases

### 2.1 Phase 1: comparison pages (10 plus hub)

`/comparar` (hub) and `/comparar/<slug>` for: Leadsales, Kommo, Whaticket, Callbell, Respond.io, Wix, Hostinger Horizons, Durable, Meta Business Agent, Framer.

Framing per page, chosen so the headline never claims more than the data supports:

| Slug | Competitor | Framing in title and H1 | Why |
|---|---|---|---|
| `leadsales` | Leadsales | "Alternativa a Leadsales" | Same job (WhatsApp CRM in Mexico); "vs" would imply parity on features Beegen is still shipping (shared-inbox basics, `recon-summary.md` decision 6) |
| `kommo` | Kommo | "Alternativa a Kommo" | Kommo is a full CRM with automations Beegen does not match yet |
| `whaticket` | Whaticket | "Beegen vs Whaticket" | Both are inboxes on WhatsApp; Beegen adds a pipeline Whaticket lacks per `whatsapp-crms-recon.md` section 3; still needs lawyer sign-off |
| `callbell` | Callbell | "Alternativa a Callbell" | Overlap on inbox only |
| `respond-io` | Respond.io | "Alternativa a Respond.io" | Respond.io says it is "not a CRM"; different buyer size |
| `wix` | Wix | "Alternativa a Wix para negocios que venden por WhatsApp" | Wix is a general builder; Beegen competes only where the site feeds a CRM and WhatsApp |
| `hostinger-horizons` | Hostinger Horizons | "Alternativa a Hostinger Horizons" | Same job (AI site), very different hosting model |
| `durable` | Durable | "Beegen vs Durable" | Closest model (site plus CRM plus invoices); "vs" is defensible if every row is sourced |
| `meta-business-agent` | Meta Business Agent | "Beegen y Meta Business Agent: qué hace cada uno" | Complement, not attack. See 2.4 |
| `framer` | Framer | "Alternativa a Framer para negocios de servicios" | See 2.3 |

### 2.2 What every comparison page contains

1. H1 and a two-sentence summary (generated, grounded).
2. "Información verificada el <fecha>" line (oldest `accessed_at` among rendered claims) and "¿Ves un dato incorrecto? Escríbenos a <correction_email>".
3. Comparison table: one row per `contrasts[]` entry; competitor cells from claims with a superscript link to the source list; Beegen cells from the platform snapshot. A note when currencies or tax treatment differ (competitor USD before IVA versus Beegen MXN with IVA).
4. "Cuándo te conviene <competidor>" (from `when_competitor_fits_es`, required, at least one item).
5. "Cuándo te conviene Beegen" (generated, grounded in Beegen facts only).
6. Price scenario block for a solo owner, a 3-person team and a 5-person team, computed by the generator, never by the model. USD figures are shown in USD; no exchange rate is applied on the page.
7. FAQ (3 to 5 questions, generated, grounded, rendered as visible text and as `FAQPage` JSON-LD).
8. Sources list (URL, publisher, access date) and a disclaimer: trademarks belong to their owners; Beegen is not affiliated with them; prices may change.
9. Signup CTA to the relevant modules with UTM parameters (section 9).
10. Internal links (section 4).

### 2.3 The tenth competitor: Framer

Framer is the only product besides the nine named ones that `docs/research` covers end to end: it has a full section in `builders-recon.md`, a column in `builders-features.csv`, 37 review rows in `reviews/reviews-framer.csv` and a theme report in `reviews/feedback-framer.md`. That means the page can start with sourced complaints and pricing leads rather than new research. The recon's own finding is the angle: Framer is a design canvas with a learning curve ("Framer has a pretty big learning curve", Capterra; "no one-click website generator", TechRadar), while the service businesses Beegen targets want a site that books and sends leads to WhatsApp. The runner-up was Aurora Inbox (a Mexican WhatsApp CRM vendor that appears in the research only as the author of competitor blog posts); it has no recon, no feature column and no reviews, so it would start from zero sourcing. Revisit if Search Console shows impressions for "aurora inbox".

### 2.4 Meta Business Agent

Meta is Beegen's platform provider (WhatsApp Cloud API) and its agent is a free, native feature. Rules for this page, enforced by a page-level flag `framing: "complemento"`:

- Title and H1 say "Beegen y Meta Business Agent", never "vs" or "alternativa".
- Every Meta claim cites a Meta-owned URL (whatsappbusiness.com, developers.facebook.com, about.fb.com) or a press outlet that quotes Meta; vendor blogs are not enough.
- The page states what Meta's agent does well and that it is free to set up in the WhatsApp Business app, then describes what Beegen adds (CRM, payment links, CFDI, reminders, team inbox) without saying Meta's product lacks them unless Meta's own documentation says so.
- The tagline "Meta te contesta. Beegen te vende." is excluded from this page and from all generated pages. It belongs to brand copy that the founder controls.
- Meta's brand guidelines for WhatsApp and Meta marks apply: word marks only, no logos, "WhatsApp" never part of a Beegen product name on these pages.
- The founder reviews this page with extra care before the lawyer sees it.

### 2.5 Phase 2: industry by module pages

Gate: 70% of phase 1 URLs indexed within 30 days of the index flip.

Eight verticals: clínicas y consultorios, dentistas, salones de belleza, barberías, talleres mecánicos, servicios a domicilio, nutriólogos y entrenadores, gimnasios y estudios. Pairings are chosen for fit, not to fill a grid. Proposed starting set of 18:

| Vertical | Modules |
|---|---|
| Clínicas y consultorios | recordatorios, whatsapp, resenas |
| Dentistas | recordatorios, cobros, resenas |
| Salones de belleza | recordatorios, resenas |
| Barberías | whatsapp, resenas |
| Talleres mecánicos | cotizaciones, cobros |
| Servicios a domicilio | cotizaciones, whatsapp |
| Nutriólogos y entrenadores | recordatorios, cobros |
| Gimnasios y estudios | recordatorios, cobros |

Rules: each page needs at least 3 sourced industry facts unique to that vertical (INEGI, IMSS, PROFECO, SAT, trade associations, academic or official sources; no vendor blogs as the only source); health verticals never state anything clinical; Facturación CFDI pairings wait until the founder decides CFDI may be promoted (the pilot plan says not to promote it yet). City pages exist only where `industries.json` has at least 3 local facts with sources for that city (for example a municipal permit rule or a local INEGI figure); no city pages are planned until such facts exist.

### 2.6 Phase 3: question pages for AI search

Questions come only from Search Console queries that already have impressions (a question form, or a query whose top results are question pages), plus People Also Ask and autocomplete when they match an SC query. Each page answers in its first 60 words, carries `FAQPage` JSON-LD, links to one module page and one comparison or industry page, and is listed in `llms.txt`. Note: since 2023 Google shows FAQ rich results only for government and health sites, so the markup is for machine readability and AI engines, not for a SERP feature.

## 3. URL scheme and hub pages

All URLs are lowercase, ASCII, hyphenated Spanish, no trailing slash (matches `vercel.json`: `cleanUrls: true`, `trailingSlash: false`). Files are committed as `<path>.html` or `<dir>/index.html`; Vercel serves them without the extension.

| Family | URL | File | Hub |
|---|---|---|---|
| Comparison hub | `/comparar` | `comparar/index.html` | links to all comparison pages, grouped: CRMs de WhatsApp, Creadores de sitios, Plataforma (Meta) |
| Comparison | `/comparar/<slug>` | `comparar/<slug>.html` | `/comparar` |
| Industry hub | `/para` | `para/index.html` | lists verticals |
| Vertical hub | `/para/<vertical>` | `para/<vertical>/index.html` | lists that vertical's module pages |
| Industry by module | `/para/<vertical>/<module-slug>` | `para/<vertical>/<module-slug>.html` | `/para/<vertical>` |
| City (only with local facts) | `/para/<vertical>/ciudad/<city>` | same pattern | `/para/<vertical>` |
| Questions hub | `/preguntas` | `preguntas/index.html` | grouped by module |
| Question | `/preguntas/<slug>` | `preguntas/<slug>.html` | `/preguntas` |

Module slugs reuse the existing landing pages: `crm`, `sitio-web`, `whatsapp`, `recordatorios`, `cobros`, `facturacion`, `resenas`, `instagram-messenger`, `cotizaciones`. Vertical slugs: `clinicas-y-consultorios`, `dentistas`, `salones-de-belleza`, `barberias`, `talleres-mecanicos`, `servicios-a-domicilio`, `nutriologos-y-entrenadores`, `gimnasios-y-estudios`.

Canonical: absolute, self-referencing, extensionless (`https://beegen.co/comparar/leadsales`). No hreflang (English has no URLs; `js/i18n.js` swaps text client-side only). A hub goes live only when at least 3 of its children are live, so no thin hubs.

## 4. Internal linking

- Global: one footer link "Comparar" to `/comparar` once phase 1 is index, added to the existing pages in the hygiene PR (not before, so noindex pages are not linked from indexed ones during review).
- Comparison page: breadcrumb (Inicio > Comparar > X), 2 links to module landing pages the comparison touches, 2 to sibling comparisons in the same group, 1 to `/pricing`.
- Industry page: breadcrumb (Inicio > Para tu negocio > Vertical > Módulo), the module landing page, the vertical hub, at most 2 sibling module pages for the same vertical, at most 1 comparison page.
- Question page: the module landing page, 1 related industry or comparison page, the questions hub.
- Module landing pages (existing, hand-written): a "Compara" and "Por industria" block linking to the 3 most relevant generated pages, added by the generator between marker comments (`<!-- seo:related:start -->` / `<!-- seo:related:end -->`) so the rest of the hand-written page is never touched.
- Anchors are descriptive Spanish ("alternativa a Kommo", "recordatorios para dentistas"), never "clic aquí". The generator builds the link graph from data, so no orphan pages: every generated URL has at least 2 internal inbound links (validator).
- Noindex pages may link to indexed pages, but indexed pages do not link to noindex pages.

## 5. Data model

Everything under `seo/` in this repository.

```
seo/
  data/
    competitors.schema.json     JSON Schema (draft 2020-12), in this PR
    competitors.json            phase 1 data; Leadsales filled, in this PR
    industries.schema.json      phase 2
    industries.json             phase 2
    questions.schema.json       phase 3
    questions.json              phase 3
    platform-snapshot.json      generated from beegen-platform at generation time; committed
    approvals.log.json          append-only record of approvals and index flips
    corrections.json            reports received through the correction email and their outcome
  content/<family>/<slug>.json  generated unique blocks (model output), each sentence tagged with fact ids
  templates/                    HTML templates and static blocks
  runs/<date>.json              weekly task log: token budget, spend, actions
  reports/<date>.md             weekly report
  metrics/                      Search Console exports (written by the weekly data workflow, section 7.2)
  PAUSE                         when present, the weekly task stops at once
  cli.mjs and lib/              generator and validators
```

### 5.1 competitors.json

Schema in `seo/data/competitors.schema.json`; the Leadsales entry in `seo/data/competitors.json` is the worked example. Key rules the schema encodes:

- Every claim has a stable id (`leadsales.price.basico`), es-MX text, a machine value and unit, and at least one evidence item with `source_id`, `accessed_at` and `method`.
- `method` is `direct_fetch`, `human_check` or `search_excerpt`. A claim is `verified` only with a `direct_fetch` or `human_check` inside 60 days. `search_excerpt` claims may appear in noindex drafts for review but block `indexable: true`.
- `conflicts` records disagreements between sources; a conflicted claim renders only the official figure or not at all.
- `contrasts[]` defines table rows; the Beegen side is a path into `platform-snapshot.json`, never a literal number.
- `when_competitor_fits_es` is required.
- `indexable` is the one-line flip; it is valid only when `approvals.founder` and `approvals.lawyer` both carry a `content_hash` equal to the current hash of the rendered main content.
- `repo_research` sources (files in `beegen-platform/docs/research`) explain provenance but cannot be the only evidence on an indexable page.

State of the Leadsales example: all 14 claims are `draft`. This session's network policy blocked `leadsales.io` and its help center (DNS refused), the same limit the 2026-10-19 research hit, so every claim rests on search excerpts: the research file's excerpts from 2026-10-19 and a fresh search excerpt from 2026-10-29 that confirms the three plan prices (97, 133, 247 USD per month), users (3 and 4) and funnels (5 and 10). The page can be drafted from this, but it cannot go index until a direct fetch or a human check upgrades each claim. The extra-user price is recorded as a conflict (13 versus 10 USD) and will not render a number.

### 5.2 industries.json (phase 2)

```json
{
  "version": 1,
  "verticals": [
    {
      "slug": "dentistas",
      "name_es": "Dentistas",
      "scian_code": "621211",
      "sensitive": "health",
      "facts": [
        {
          "id": "dentistas.inegi.unidades",
          "text_es": "<hecho con cifra>",
          "value": 0,
          "unit": "unidades económicas",
          "geo": "MX",
          "evidence": [{ "source_id": "inegi-denue", "accessed_at": "2026-11-15", "method": "direct_fetch", "quote": "..." }],
          "status": "verified"
        }
      ],
      "pairings": [
        { "module": "recordatorios", "why_es": "...", "fact_ids": ["...", "...", "..."], "indexable": false, "approvals": { "founder": null } }
      ],
      "cities": []
    }
  ],
  "sources": []
}
```

Same evidence rules as competitors. Pairings need at least 3 fact ids not used by any other pairing page. Industry pages need only the founder's approval (no competitor named), unless the page names a competitor, in which case the lawyer approves too.

### 5.3 Beegen facts: platform-snapshot.json

At generation time `seo/cli.mjs snapshot` reads `src/lib/modules.ts` from a checkout of `abremers/beegen-platform` (path from `BEEGEN_PLATFORM_DIR`, default `../beegen-platform`). `modules.ts` has no imports, so Node 24 imports it directly with built-in TypeScript type stripping (Node 22 needs `--experimental-strip-types`); no TypeScript toolchain is added. The snapshot stores, for every visible module (not `hidden`): id, Spanish name, tagline, `priceMxn`, `priceLabel`, `unitLabel`, included quota, meters (included, overage), `trialable`; the two bundles and their visible grants; `TRIAL_DAYS`; and the platform commit SHA. Voz is hidden and never appears.

CI re-reads `modules.ts` from the platform's `main` (read-only token, section 17) and fails if the committed snapshot differs, so a price change in the platform blocks SEO PRs until the snapshot is regenerated. Any number on a generated page about Beegen must equal a snapshot value (numeric validator, section 6).

Cross-check with the `/pricing` page: the snapshot step also parses the module prices shown on `pricing.html` and fails if they disagree with the registry, which catches drift in the hand-edited site. This check would fail today on `llms.txt` (section 15).

### 5.4 content/<family>/<slug>.json (generated blocks)

```json
{
  "slug": "leadsales",
  "family": "comparar",
  "model": "<recorded at generation time, not in page HTML>",
  "prompt_version": "comparar-v1",
  "input_hash": "sha256:...",
  "blocks": {
    "summary": [{ "text": "...", "facts": ["leadsales.price.basico", "modules.wa_agent.priceMxn"] }],
    "beegen_fits": [{ "text": "...", "facts": ["modules.payments.priceLabel"] }],
    "faq": [{ "q": "...", "a": [{ "text": "...", "facts": ["..."] }] }]
  }
}
```

Every sentence lists the fact ids that support it. The renderer refuses a sentence with no facts unless it is in a short allowlist of connective phrasing. Re-rendering never calls a model: the HTML is a pure function of data, content files and templates, so a merged page can be rebuilt byte for byte.

## 6. Templates: generated versus static

| Block | Comparison | Industry | Question | Who writes it |
|---|---|---|---|---|
| `<head>`: title, description, canonical, robots, OG, JSON-LD | yes | yes | yes | Generator from data (title and description are data fields a human can edit) |
| Nav, footer, CSS, `js/i18n.js` hook | yes | yes | yes | Static, copied from existing pages so the site looks the same |
| Breadcrumb | yes | yes | yes | Generator |
| H1 | yes | yes | yes | Data (`title_es` pattern) |
| Verification line and correction email | yes | yes | yes | Generator |
| Summary (2 to 3 sentences) | yes | yes | answer in first 60 words | Claude, grounded |
| Comparison table and price scenarios | yes | no | no | Generator only (numbers never from the model) |
| "Cuándo te conviene X" | yes | no | no | Data (`when_competitor_fits_es`), written or approved by a human |
| "Cuándo te conviene Beegen" / "Cómo lo usa un <vertical>" | yes | yes | no | Claude, grounded |
| Industry facts list | no | yes | no | Generator from `industries.json` |
| FAQ | yes | yes | the page itself | Claude, grounded; human edits allowed |
| Module CTA with UTM | yes | yes | yes | Generator |
| Sources list | yes | yes | yes | Generator |
| Related links | yes | yes | yes | Generator from the link graph |

English: generated pages get `data-i18n` keys only on static chrome (nav, footer, CTA buttons). Unique blocks stay Spanish-only; the English toggle shows a one-line note that the comparison is available in Spanish. This keeps `js/i18n.js` from growing by hundreds of keys and avoids an unreviewed English version of legal-sensitive comparisons.

Copy rules applied by template and validator: no emojis, no em dashes, no "beegen.mx", prices as "$299 MXN" with "IVA incluido" where Beegen prices appear, Spanish for Mexico ("cotización", "celular", "factura"), usted is not used (the site uses tú).

## 7. Generator CLI

Node 24, ES modules, no runtime dependencies. `package.json` exists only for dev dependencies the validators need: `ajv` and `ajv-formats` (schema validation), `lighthouse` (budgets). Playwright and Chromium are used from the CI image or the environment, not added as dependencies if avoidable. No build command on Vercel; generated HTML is committed.

```
node seo/cli.mjs snapshot                         read beegen-platform modules.ts and pricing.html, write platform-snapshot.json
node seo/cli.mjs draft   --family comparar --slug kommo [--model <id>] [--max-tokens N]
                                                  call Claude for the unique blocks only, write seo/content/comparar/kommo.json
node seo/cli.mjs render  [--family F] [--slug S]  pure render: data + content + templates -> HTML files, sitemap.xml, llms.txt
node seo/cli.mjs check   [--changed-only]         run every validator, exit non-zero on any failure, print a table
node seo/cli.mjs approve --slug S --as founder|lawyer --by "<name>"
                                                  compute content_hash, write it to the approval, append to approvals.log.json
node seo/cli.mjs index   --slug S                 set indexable: true (refuses unless approvals match the current hash)
node seo/cli.mjs verify  --slug S                 list claims older than 45 days or not directly verified, with their URLs
node seo/cli.mjs report  --week YYYY-WW           build the weekly report from seo/metrics and the attribution export
```

`render` regenerates `sitemap.xml` and `llms.txt` from a single page registry that includes the existing hand-written pages (listed in `seo/data/static-pages.json`), so the two files can never disagree with what exists. Noindex pages are excluded from both. The hand-written part of `llms.txt` moves into a template whose module and pricing lines come from the snapshot, which also fixes the stale folio price.

`draft` prompt design: system prompt with the copy rules, the page's facts as a numbered list with ids, the snapshot facts the page may use, the template's block list, and the instruction to output JSON only, every sentence tagged with fact ids, no number that is not in a cited fact. Temperature low. The model never sees other pages' text, which reduces template echo; the duplicate validator catches what remains.

## 8. Validators (every pull request; any failure blocks)

All run in `node seo/cli.mjs check`. Scope: generated pages always; `sitemap.xml`, `llms.txt` and `vercel.json` always; hand-written pages only for link resolution and the copy rules on lines the PR changed (so legacy pages do not block until the hygiene PR fixes them).

| # | Validator | Pass criteria |
|---|---|---|
| 1 | Schema | `competitors.json`, `industries.json`, `questions.json`, content files and the snapshot validate against their schemas |
| 2 | Duplicate and near-duplicate text | Main content only (static chrome removed). Word 5-gram shingles, Jaccard similarity against every other generated page below 0.30, and below 0.20 within the same family; no shared sentence of 12 or more words between two pages except in the allowlisted template strings; unique (model or human written) words at least 40% of main content and at least 300 words |
| 3 | Sourced facts | At least 3 distinct facts per page that no other page renders (competitor or industry facts, not Beegen prices); every rendered competitor or industry fact has evidence; every claim on an indexable page is `verified` with evidence no older than 60 days |
| 4 | Grounding | Every generated sentence cites at least one fact id that exists; every number, percentage and currency amount in generated text equals a value in its cited facts or the snapshot (deterministic check); plus a model-based check (small model, temperature 0) that each sentence is supported by its cited facts, failing on "unsupported" |
| 5 | Beegen facts | Every Beegen price, quota and trial length on the page equals the snapshot; snapshot equals platform `main`; `pricing.html` agrees with the snapshot |
| 6 | Links | Every internal link resolves to a file in the repo (with cleanUrls mapping) or a `vercel.json` redirect; every external link returns 2xx or 3xx (HEAD, then GET), retried twice, with an allowlist for hosts that block bots, logged not ignored; every generated page has at least 2 internal inbound links; no indexed page links to a noindex page |
| 7 | Canonical and robots | Exactly one `<link rel="canonical">`, absolute, `https://beegen.co`, self-referencing, extensionless; `<meta name="robots">` is `noindex, follow` unless `indexable` and approvals are valid, then `index, follow` |
| 8 | No hreflang | No `hreflang` attribute anywhere in generated pages or the sitemap |
| 9 | Language | `<html lang="es-MX">` on generated pages; `og:locale` `es_MX` |
| 10 | Title and description | Title 30 to 60 characters, unique across the site; description 120 to 155 characters, unique |
| 11 | JSON-LD | Parses; types allowed per family: `Organization` (Beegen) and `BreadcrumbList` everywhere, `SoftwareApplication` for Beegen with `offers` from the snapshot (price in MXN), `FAQPage` only when the same Q&A is visible on the page; no `AggregateRating` or `Review` (Beegen has no reviews to cite); no markup describing a competitor's product |
| 12 | Copy rules | No emoji (`\p{Extended_Pictographic}` and variation selectors), no em dash (U+2014), no "beegen.mx" in generated pages, `seo/data`, `sitemap.xml` or `llms.txt`, no "Meta te contesta" on generated pages, no superlatives about competitors from a deny list ("peor", "estafa", "engañoso", "malo") |
| 13 | Mobile layout | Playwright at 390x844 and 1280x800: no horizontal scroll, no element wider than the viewport, tap targets at least 44 px, table scrolls inside its container |
| 14 | Lighthouse budgets (mobile) | Performance at least 90, Accessibility at least 95, Best Practices at least 95, SEO 100; LCP 2.5 s or less, CLS 0.1 or less, total transfer 400 KB or less excluding web fonts |
| 15 | Sitemap and llms.txt | Regenerated output equals the committed files byte for byte; sitemap lists exactly the indexable pages; `llms.txt` lists exactly the indexable generated pages and every module line matches the snapshot |
| 16 | Redirect safety | No HTML file removed or renamed without a matching permanent redirect in `vercel.json`; no redirect whose source equals its destination |
| 17 | Approval integrity | `indexable: true` only with founder and (for pages naming a competitor) lawyer approvals whose `content_hash` matches; `approvals.log.json` is append-only (no removed lines) |
| 18 | UTM links | Every signup link on a generated page carries `utm_source=seo&utm_medium=organic&utm_campaign=<family>&utm_content=<slug>` and a valid, visible `module` id |

### 8.6 AI citation panel (measurement, not a validator)

30 fixed Spanish prompts in `seo/data/ai-panel.json` (for example "¿qué CRM de WhatsApp conviene a un consultorio en México?", "alternativas a Leadsales más baratas"). Once a month a person runs them in ChatGPT, Perplexity and Gemini and records whether beegen.co is cited, in a form the weekly task turns into a row of the report. Automating this needs paid API access to those engines; it is listed as a later option, not a dependency.

## 9. Attribution

### 9.1 Links

Every signup link on a generated page:

```
https://app.beegen.co/signup?module=<id>&utm_source=seo&utm_medium=organic&utm_campaign=<family>&utm_content=<slug>
```

`family` is `comparar`, `para` or `preguntas`; `slug` is the page path below the family with `/` replaced by `--` (`dentistas--recordatorios`). Bundle CTAs keep the existing `&bundle=ventas|negocio`.

### 9.2 What the platform must store (built by the orchestrator, separately)

The signup page already keeps the module intent in a cookie (`MODULE_INTENT_COOKIE` in `src/lib/moduleIntent.ts`). The same mechanism should carry attribution:

1. On `/signup` and `/login`, read `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, plus `document.referrer` host, and store them first-touch in a cookie `beegen_attr` (30 days, `SameSite=Lax`, values truncated to 100 characters, only `[a-z0-9_-]` kept).
2. When the account is created (auth callback), insert one row into a new table:

```
public.signup_attribution
  user_id        uuid primary key references auth.users
  created_at     timestamptz default now()
  utm_source     text
  utm_medium     text
  utm_campaign   text
  utm_content    text
  utm_term       text
  referrer_host  text
  intent_module  text      -- the existing ?module= intent
  landing_path   text      -- '/signup' or '/login'
```

RLS: no client access; service role only.

3. A trial start is already recorded in `entitlements` (`status = 'trialing'`, `trial_ends_at`). The report joins `signup_attribution` to `entitlements` by `user_id` to count trial starts by module, and to Stripe-backed `status = 'active'` for paid conversions.
4. A read-only export for the weekly report: `GET https://app.beegen.co/api/internal/seo-attribution?since=YYYY-MM-DD`, bearer token from an env var (`SEO_REPORT_TOKEN`), returning aggregated rows only (no emails, no user ids): `week, utm_campaign, utm_content, intent_module, signups, trial_starts, trial_starts_by_module{}, paid`.

Privacy: this is first-party data tied to an account the person creates. Whether the privacy notice needs a sentence about it is the founder's and lawyer's call; this plan does not change legal text.

### 9.3 Report table (consumes the export once it exists)

| utm_content | family | signups | trial starts | by module | paid |
|---|---|---|---|---|---|

Until the platform ships the table, the report prints "attribution not available" and shows Search Console clicks to the signup host as the proxy.

### 9.4 Coming-soon modules

`llms.txt` and the site mark Recordatorios, Cobros, Facturación, Reseñas, Instagram y Messenger and Cotizaciones as coming soon, and the pilot plan says not to promote CFDI yet. Decision needed: either generated pages link CTAs only to modules available now (CRM, Sitio web, Agente de WhatsApp) and mention the others as "próximamente", or they link every module's trial as the pricing page does today. Recommendation: the first option until each module is marked available on its landing page, with the generator reading availability from one data field so the switch is a one-line change.

## 10. GitHub Actions design

Two workflows. Neither deploys; Vercel deploys `main` after a human merge as it does today.

### 10.1 `seo-validate.yml` (pull requests)

```yaml
on:
  pull_request:
    branches: [main]
    paths: ['**/*.html', 'seo/**', 'sitemap.xml', 'llms.txt', 'vercel.json', 'css/**', 'js/**', 'package.json']
permissions: { contents: read }
concurrency: { group: seo-validate-${{ github.ref }}, cancel-in-progress: true }
jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - checkout (this repo)
      - checkout abremers/beegen-platform at main, sparse: src/lib/modules.ts only, token PLATFORM_READ_TOKEN
      - setup-node 24, npm ci
      - node seo/cli.mjs render && git diff --exit-code   # committed output must equal regenerated output
      - node seo/cli.mjs check                            # validators 1 to 12, 15 to 18
      - serve the repo statically, run Playwright (13) and Lighthouse (14) on changed generated pages
      - upload the check table and Lighthouse reports as artifacts; post a summary to the job summary
```

The grounding validator's model call uses `ANTHROPIC_API_KEY` with a per-run cap (section 13). Branch protection on `main` makes `validate` a required check (human step).

### 10.2 `seo-weekly-data.yml` (schedule, data only)

```yaml
on:
  schedule: [{ cron: '17 5 * * 1' }]   # Mondays 05:17 UTC, before the weekly task
  workflow_dispatch: {}
permissions: { contents: write }
```

Steps: read `GSC_SERVICE_ACCOUNT_JSON`; call the Search Console API for property `sc-domain:beegen.co` (Search Analytics: last 28 days and last 7 days by query, page, country=mex, device; URL Inspection for every generated URL, oldest inspection first, capped at 400 per run against the 2,000 per day quota); fetch the attribution export when `SEO_REPORT_TOKEN` exists; write `seo/metrics/<date>/*.json`; commit to the branch `seo-data` (never `main`). Keeping the Google credential in GitHub Actions means the Claude Code task never holds it.

## 11. Weekly scheduled task (Claude Code)

A Claude Code scheduled task, Mondays at 07:43 America/Mexico_City (after the data workflow), fresh session per run, repository `abremers/beegen-website`, created only after the founder approves phase 1.

Run order:

1. If `seo/PAUSE` exists on `main`, write `seo/runs/<date>.json` with `"status": "paused"` and stop.
2. Read the token budget for this run from `seo/data/budget.json` (default in section 13). Track spend from API usage fields after every model call; stop drafting when 80% is used and finish the report.
3. Pull `seo-data` and read the newest `seo/metrics/<date>`.
4. Indexation: list generated URLs with their coverage state, last crawl, and days since going index. Compute the current wave's indexed share.
5. Expiry: list claims that are older than 45 days (warn) or 60 days (expired). For expired claims, try a direct fetch; if the quote is still there, open a PR that updates `accessed_at`; if not, open a PR that removes the claim and, if the page falls under 3 unique facts, sets it to noindex.
6. Candidates. Sources: SC queries with impressions but no matching page, or with average position between 8 and 40 on a page that does not target them; People Also Ask and autocomplete (Google suggest endpoint with `hl=es-MX&gl=mx`, called politely, a few dozen requests per run) only to expand SC queries; questions in competitor help centers and in `docs/research/reviews`. The web search tool available to the session returns US results, so it is used for reading pages, never for judging Mexican rankings. No Ahrefs.
7. Score each candidate: `score = intent x fit x volume`, where intent is 3 for "alternativa", "precio", "vs", "para <vertical>", 2 for "cómo", "qué es" tied to a module, 1 otherwise; fit is 3 when a visible module solves it, 2 when a coming-soon module does, 0 when nothing does (dropped); volume is `log10(impressions_28d + 10)`. Ties go to candidates that strengthen an existing hub.
8. Draft up to the wave size (section 12): `draft`, `render`, `check`; fix failures up to two attempts per page, otherwise drop the page and log why. Open one PR per page family per week, titled `SEO wave <n>: <family> (<count> pages)`, every page noindex, with the check table, the claims list with evidence methods, and the approval commands in the description.
9. Write `seo/reports/<date>.md` and `seo/runs/<date>.json` in a separate PR `SEO weekly report <date>` (data only, no pages).
10. Never merge, never push to `main`, never flip `indexable`, never edit legal pages, pricing, `vercel.json` redirects or DNS.

### 11.1 Report format (`seo/reports/<date>.md`)

```
# SEO weekly report, week 2026-W45

## Summary (three lines: what moved, what is blocked, what needs a human)

## Indexation
| URL | family | live since | coverage state | last crawl | indexed |
Wave n: x of y indexed (z%). Gate for next wave: 70%.

## Search performance (last 7 days, Mexico)
| page | impressions | clicks | CTR | avg position | delta vs previous week |
Top 20 queries by impressions, new queries this week.

## Trial starts
| utm_content | family | signups | trial starts | by module | paid |
(or "attribution not available" with the proxy figure)

## Facts
Claims expiring within 15 days; claims removed; corrections received and status.

## Candidates
| query or topic | source | intent | fit | volume | score | decision |

## This week's PRs
## Spend
| step | input tokens | output tokens | budget | used % |
## Needs a human
```

### 11.2 Run log (`seo/runs/<date>.json`)

```json
{
  "date": "2026-11-09",
  "status": "ok | paused | budget_stopped | error",
  "budget": { "input_tokens": 1500000, "output_tokens": 120000 },
  "spend": { "input_tokens": 0, "output_tokens": 0, "by_step": {} },
  "metrics_snapshot": "seo/metrics/2026-11-09",
  "prs_opened": [],
  "pages_drafted": [],
  "pages_dropped": [{ "slug": "", "reason": "" }],
  "errors": []
}
```

## 12. Human review flow, ramp and refresh

### 12.1 Review flow

1. The weekly task (or a person) opens a PR with noindex pages. CI must be green.
2. The founder reads the rendered preview (Vercel preview deployment of the PR), edits data or content files if needed, and runs `node seo/cli.mjs approve --slug <s> --as founder --by "<name>"` in the PR. Any later change to the page's main content voids the hash.
3. For pages naming a competitor, the lawyer reviews the preview URL and the claim list with sources; the founder records it with `--as lawyer --by "<lawyer name>"`.
4. The PR merges with the pages still noindex. They are live but not indexable, which lets both reviewers check production.
5. A second small PR runs `node seo/cli.mjs index --slug <s>`: `indexable: true`, robots flips to `index, follow`, the page enters `sitemap.xml` and `llms.txt`, and related-link blocks on indexed pages start linking to it. The validator refuses the flip if any claim is not verified or any approval hash is stale.
6. After merge, the founder submits the sitemap again in Search Console and requests indexing for the hub (manual, a few URLs per day; the API cannot request indexing for ordinary pages).

Nothing publishes without a human merge during the first 60 days after phase 1 goes index. After 60 days the founder may decide to let validated data-only PRs (claim date refreshes) auto-merge; page creation always stays human.

### 12.2 Ramp

Wave 1 is phase 1 (10 pages plus hub). The next wave may be drafted only when at least 70% of the previous wave's URLs are indexed. Wave size starts at 10 and grows by 5 per qualifying wave, capped at 25 per wave in the first 180 days. If a wave falls under 50% indexed 45 days after going index, the next wave size drops back to 10.

### 12.3 Refresh and retirement

- A page with zero impressions 90 days after going index is refreshed once: re-verify all claims, add at least 2 new sourced facts, rewrite the summary against the queries that do show impressions for its family, retitle if Search Console suggests a better query.
- Still zero impressions 60 days after the refresh: set noindex and remove from sitemap and `llms.txt`. The URL stays live.
- Deleting a URL requires a permanent redirect in `vercel.json` to the closest page (hub at worst) in the same PR; validator 16 enforces it.
- Competitor rebrands or shutdowns: page updated or redirected to the hub within 14 days of detection.

### 12.4 Indexation playbook (if pages are not indexed)

Check robots and canonical on the live page, internal links from indexed pages (hub linked from the footer and from module pages), sitemap submitted and read, URL Inspection "Discovered, currently not indexed" versus "Crawled, currently not indexed" (the second means quality: strengthen unique content before drafting more), and request indexing manually for the hub and 2 to 3 pages. Do not add more pages while the existing ones are not indexed.

## 13. Token budget

Estimates; the run log records real spend and the budget is adjusted after the first four runs.

| Step | Input tokens | Output tokens | Notes |
|---|---|---|---|
| Draft one comparison page (unique blocks) | 8,000 to 12,000 | 1,500 to 2,500 | facts, snapshot excerpt, copy rules, block spec |
| One repair attempt after a failed check | 6,000 | 1,500 | at most 2 per page |
| Grounding check per page (CI, small model) | 4,000 to 6,000 | 500 | one call per page per CI run |
| Industry page | 7,000 to 10,000 | 1,200 to 2,000 | |
| Question page | 4,000 to 6,000 | 600 to 1,000 | |
| Weekly run orchestration (the Claude Code session itself: reading metrics, scoring, git, PR text, report) | 400,000 to 900,000 | 40,000 to 80,000 | dominated by reading files and tool output; most of it is cache reads |

Per page, drafting plus checks: about 20,000 to 30,000 input and 4,000 to 6,000 output tokens. Per weekly run with 10 pages: about 0.6 to 1.2 million input and 80,000 to 140,000 output tokens. Default cap in `seo/data/budget.json`: 1.5 million input and 150,000 output tokens per run, 50,000 input per CI run. Dollar cost is computed in the run log from the usage the API returns and the price list current at the time, not fixed in this plan.

## 14. Risks and mitigations

| Risk | What could happen | Mitigation |
|---|---|---|
| Google scaled content abuse policy (spam policies since March 2024) | Many templated pages with little unique value are demoted or the site gets a manual action | Small waves gated on indexation, at least 3 unique sourced facts and 40% unique text per page, duplicate validator, pairings chosen for fit (18, not 72), no city pages without local facts, refresh or noindex pages nobody sees, a human reads every page |
| Comparative advertising and trademarks in Mexico | PROFECO action under the Ley Federal de Protección al Consumidor, article 32 (advertising must be truthful, verifiable and not misleading, including through marks), fines; a trademark owner alleging discrediting under the industrial property law (the former LPI article 213, fraction X allowed informative comparison that is not "tendenciosa, falsa o exagerada"; the lawyer confirms the current article in the 2020 Ley Federal de Protección a la Propiedad Industrial) | Every claim sourced and dated, verifiable attributes only (price, plan limits, documented features), no opinions or review-site insults, "cuándo te conviene X" on every page, word marks only, no logos, disclaimer of non-affiliation, correction email answered within 5 business days, lawyer approval before index, removal path that takes one PR |
| Meta relationship | Meta reads the page as an attack on a platform feature; API access or app review is affected | "Complemento" framing, Meta-owned sources only, no tagline, founder plus lawyer review, page can stay noindex indefinitely if the founder prefers |
| Indexation of a new domain | Google crawls but does not index the pages; months pass with no data | Fix canonical and lang hygiene first (section 15), link the hub from indexed pages, sitemap, manual indexing requests, the 70% gate stops more pages until indexation works |
| Hallucinated facts | A wrong price or feature for a competitor or for Beegen goes live | Numbers only from data and the snapshot, every sentence tagged with fact ids, deterministic numeric check, model grounding check, `search_excerpt` evidence cannot go index, 60-day expiry, human review |
| Stale Beegen facts | A price changes in the platform and SEO pages lag | Snapshot compared with platform `main` on every PR; weekly task opens a re-render PR on drift |
| Competitor changes prices | Page shows an outdated price | 60-day expiry, weekly expiry list, the visible verification date |
| Ahrefs or other paid tools unavailable | No keyword volumes | Search Console impressions are the volume signal; autocomplete and PAA only expand SC queries |
| Network policy blocks sources | Claims stay at `search_excerpt` and pages cannot go index (happened in this session and in the 2026-10-19 research) | Allowlist the source hosts for the Claude Code environment (human step), or a person runs `verify` and records `human_check` |
| The weekly task misbehaves | Unwanted PRs or spend | `seo/PAUSE`, per-run token cap, task cannot merge or push to `main`, everything is a PR |
| Brand voice drift | Emojis, em dashes, odd Spanish | Copy-rule validator, low temperature, founder review |

## 15. Problems found in the current site (for a separate hygiene PR, not in this PR)

These affect indexation of everything, so they should be fixed before phase 1 goes index. Each needs the founder's go-ahead because some touch hand-written pages.

1. Canonicals are inconsistent: `crm.html`, `cobros.html` and others declare `https://beegen.co/crm.html`, which Vercel's `cleanUrls` redirects to `/crm`, while `agencias.html` and `cotizaciones.html` declare the clean URL and `sitemap.xml` lists clean URLs. A canonical that points at a redirect is a mixed signal. Fix: clean, self-referencing canonicals everywhere, and internal links without `.html`.
2. Language: 16 pages declare `lang="es"`, not `es-MX`. `login.html`, `404.html`, `privacy.html` and the five blog posts declare `lang="en"`; the blog posts are English content at indexable URLs, which conflicts with "only Spanish is indexable". Fix: `es-MX` on Spanish pages; decide whether the English blog posts are rewritten in Spanish, set to noindex, or kept. `privacy.html` is legal text and is not touched without the founder.
3. `llms.txt` says Facturación costs "$3 per extra folio"; `modules.ts`, `docs/pricing-rules.md` and `pricing.html` say 2 MXN. The generator will produce `llms.txt` from the snapshot, which fixes it; until then it is wrong in production.
4. `vercel.json` redirects `/feature-membership` to `/feature-membership` (a loop for anyone who requests it). Fix: remove or point it somewhere real.
5. No JSON-LD on the home and module pages. Adding `Organization` and `SoftwareApplication` with offers from the snapshot helps both Google and AI engines.
6. No analytics on the site, so organic sessions are invisible except in Search Console. Adding an analytics script is a privacy-notice question for the founder; this plan works without it.
7. The research numbers are partly out of date: `whatsapp-crms-recon.md` section 6 and `relaunch-plan-2026-10.md` section 7 cite 500 included conversations; the registry says 200. SEO pages only use the registry.

## 16. Build order after approval

1. Hygiene PR (section 15), with the founder's approval of each item.
2. `package.json`, `seo/cli.mjs` (snapshot, render, check), templates, validators 1 to 18, `seo-validate.yml`. Proven on the Leadsales page as a noindex draft.
3. The other nine competitor entries and the hub, drafted and validated; claims upgraded to `direct_fetch` or `human_check`.
4. `seo-weekly-data.yml` once Search Console access exists.
5. The weekly scheduled task, after the first manual run of each step.
6. Phase 2 and 3 only when their gates pass.

## 17. Human steps (exact instructions)

### 17.1 Search Console domain property for beegen.co

1. Open https://search.google.com/search-console with the Google account that should own the property.
2. Add property, choose "Domain", enter `beegen.co`, continue.
3. Copy the TXT record shown (`google-site-verification=...`).
4. At the DNS provider for beegen.co, add a TXT record on the root (`@`) with that value. This is a DNS change and is yours to make.
5. Back in Search Console, click "Verify". DNS can take minutes to hours; retry if it fails.
6. Optional but useful: Settings, then "Association", to link Google Analytics later if you add it.

### 17.2 Google Cloud service account

1. Open https://console.cloud.google.com, create a project named `beegen-seo` (no billing needed for these APIs).
2. APIs and Services, Library, search "Google Search Console API", Enable.
3. IAM and Admin, Service Accounts, Create service account: name `seo-reader`, no project roles, Done.
4. Open the account, Keys, Add key, Create new key, JSON. A file downloads; treat it as a password.
5. Copy the service account's email (`seo-reader@beegen-seo.iam.gserviceaccount.com` or similar).
6. In Search Console for `beegen.co`: Settings, Users and permissions, Add user, paste the email, permission "Restricted", Add. If the URL Inspection API later returns 403, change it to "Full".

### 17.3 GitHub Actions secrets in abremers/beegen-website

Settings, Secrets and variables, Actions, New repository secret, one for each:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | An API key from https://console.anthropic.com, ideally from a workspace with a monthly spend limit set |
| `GSC_SERVICE_ACCOUNT_JSON` | The entire contents of the JSON key file from 17.2, pasted as is |
| `PLATFORM_READ_TOKEN` | Added by this plan: a fine-grained personal access token limited to `abremers/beegen-platform`, permission Contents: Read-only, expiry 1 year. Needed so CI can compare the snapshot with `modules.ts`. Create at GitHub, Settings, Developer settings, Fine-grained tokens |
| `SEO_REPORT_TOKEN` | Later, when the platform ships the attribution export (section 9.2): the same random value set as an env var in the platform's Vercel project |

Then Settings, Branches, add a protection rule for `main` requiring the `seo-validate / validate` check (after the workflow exists).

### 17.4 Confirm beegen.mx redirects to beegen.co

From any terminal:

```
curl -sI https://beegen.mx/ | sed -n '1p;/^location/Ip'
curl -sI https://www.beegen.mx/precios | sed -n '1p;/^location/Ip'
curl -sI http://beegen.mx/ | sed -n '1p;/^location/Ip'
```

Expected: a `301` or `308` with `location: https://beegen.co/...` on each, and no `200` page served on beegen.mx. If any returns 200, beegen.mx is serving content that could compete with beegen.co. I could not run this from this session: the network policy refused connections to beegen.co and beegen.mx.

### 17.5 Network allowlist for the Claude Code environment

So that claims can be verified by direct fetch, allow these hosts in the environment's network settings: the competitor domains (`leadsales.io`, `leadsalescrm.zendesk.com`, `kommo.com`, `support.kommo.com`, `whaticket.com`, `help.whaticket.com`, `callbell.eu`, `respond.io`, `wix.com`, `hostinger.com`, `hostinger.mx`, `durable.com`, `help.durable.com`, `framer.com`), Meta's (`whatsappbusiness.com`, `developers.facebook.com`, `about.fb.com`), official Mexican sources for phase 2 (`inegi.org.mx`, `gob.mx`, `sat.gob.mx`), `web.archive.org`, `suggestqueries.google.com`, and `beegen.co` itself for live checks.

### 17.6 Other

- Confirm or create `correcciones@beegen.co` and who answers it.
- Choose the lawyer for comparison pages and agree on a turnaround (target 5 business days per wave).
- Approve this plan in this PR or with a message in the session; building starts only after that.

## 18. What this PR contains

- `docs/seo-engine-plan.md` (this file).
- `seo/data/competitors.schema.json`: JSON Schema for competitor data.
- `seo/data/competitors.json`: the Leadsales example, all claims `draft`, `indexable: false`, approvals empty. Validated against the schema with ajv during this session.

No generator, validator, workflow, page or change to existing files.
