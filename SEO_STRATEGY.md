# PlantAI — SEO Strategy

> Status: Phase 0 planning document. SEO is PlantAI's primary growth channel (zero budget, organic-first). This document covers technical SEO for Next.js App Router, on-page rules per template, keyword strategy, structured data, sitemap/robots, internal linking, Core Web Vitals budgets, content tie-ins, and the Google Search Console plan for Phase 3+.
>
> Companion documents: `PROJECT_PLAN.md`, `REQUIREMENTS.md`, `ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, `CONTENT_STRATEGY.md`, `MONETIZATION_PLAN.md`, `LEGAL_AND_COMPLIANCE.md`, `TASKS.md`, `UI_UX_DESIGN.md`, `docs/VERIFIED_FACTS.md`.
>
> Honesty rule: this document makes **no claims about algorithm specifics, ranking guarantees, or third-party rank-tracking promises**. Everything about Google's algorithms is treated as UNVERIFIED unless it is an official Google-published requirement (e.g. AdSense eligibility, `docs/VERIFIED_FACTS.md` §Google AdSense).

## Table of Contents

1. [Strategy summary](#1-strategy-summary)
2. [Technical SEO](#2-technical-seo)
3. [Canonical URL structure](#3-canonical-url-structure)
4. [On-page SEO per template](#4-on-page-seo-per-template)
5. [Keyword strategy](#5-keyword-strategy)
6. [URL & faceting rules (crawl-safe search)](#6-url--faceting-rules-crawl-safe-search)
7. [Metadata system (Open Graph, Twitter, OG images)](#7-metadata-system)
8. [Structured data (JSON-LD) plan](#8-structured-data-json-ld-plan)
9. [Sitemap](#9-sitemap)
10. [Robots.txt](#10-robots)
11. [Internal linking strategy](#11-internal-linking-strategy)
12. [Core Web Vitals budget](#12-core-web-vitals-budget)
13. [Content strategy tie-in](#13-content-strategy-tie-in)
14. [Google Search Console plan (Phase 3+)](#14-google-search-console-plan)
15. [UNVERIFIED items](#15-unverified-items)

---

## 1. Strategy summary

- **Organic-first, zero budget.** No paid ads, no paid backlinks, no magic tools. Growth comes from (1) useful, original, human-verified plant content and (2) an extremely clean, fast technical foundation.
- **Realistic expectations.** A new domain takes months to earn meaningful impressions; a realistic ramp is: weeks 1–8 → indexing of the library and pages, few impressions; months 3–6 → long-tail species queries starting to appear; months 6–12+ → compounding via internal links and blog cadence set in `CONTENT_STRATEGY.md`. Nothing here promises traffic numbers.
- **Our structural advantages** to compensate for a cold-start domain: genuinely useful utility (identification tool) that gives people a reason to link; a plant library of long-tail species pages; and honest, cited content that differentiates from scraped/rotated content farms.
- **Measurement before optimization.** Search Console (free) is the only ranking/traffic tool we rely on; Google Analytics is deferred to Phase 5 (decision recorded in `CONTENT_STRATEGY.md` §7).

---

## 2. Technical SEO

Next.js App Router advantages we exploit (mechanism-level, verifiable in the framework version installed at Phase 1):

| Capability | SEO effect | Where used |
|---|---|---|
| React Server Components + SSR by default | Full HTML in initial response for crawlers with weak-JS support; no SPA-emptiness. | All public routes. |
| Metadata API (`export const metadata` / `generateMetadata`) | Per-route `<title>`, description, canonical, OG tags without extra deps. | Every route (§4). |
| `next/image` | Responsive, lazy, optimized images → LCP/CLS improvements. | All content images; `priority` on hero/LCP images only. |
| `app/sitemap.ts` | Generated at build/runtime from Supabase slugs (static routes + all plant + blog slugs). | §9. |
| `app/robots.ts` | Programmatic robots.txt with disallow list. | §10. |
| Next `next/font` self-hosting | No render-blocking font requests; CLS-safe metrics. | Inter + Source Serif 4 (`UI_UX_DESIGN.md`). |
| Streaming/suspense for interactive bits | Content HTML arrives immediately, hydration later → lower INP risk. | Identify flow only; library & plants stay static-friendly. |
| ISR / on-demand revalidation (route-level) | Plant pages static-like performance while allowing content updates without full rebuilds. Decide per-phase. | Phase 3 decision (when Supabase library publishing matters). |

Technical hygiene checklist (applied before Phase 3 launch): single canonical host (www vs apex decided at Phase 1 env setup); HTTPS enforced; trailing-slash policy consistent; 404 page noindexed by design (404 status); no duplicate content from locale or param echoes (§6).

---

## 3. Canonical URL structure

Canonical routes (final list, aligned with `REQUIREMENTS.md`):

| Route | Canonical slug pattern | Example |
|---|---|---|
| `/` | — | Home |
| `/identify` | — | Identify tool |
| `/plant/{kebab-case scientific-or-common name}` | `genus-species` preferred, lowercase, hyphenated; disambiguate collisions with a secondary word (e.g. `monstera-deliciosa`, `ficus-lyrata-fiddle-leaf-fig` collision-safe form) | `/plant/monstera-deliciosa` |
| `/library` | — (search lives here, `?q=` not canonical) | `/library?q=pothos` |
| `/my-plants` | — (auth) | — |
| `/saved-plants` | — (auth) | — |
| `/dashboard` | — (auth) | — |
| `/reminders` | — (auth) | — |
| `/account` | — (auth) | — |
| `/blog` | — | — |
| `/blog/{slug}` | kebab-case editorial slug, includes season/topic keyword where natural but not forced | `/blog/watering-mistakes-to-avoid` |
| `/about`, `/contact` | — | — |
| `/privacy`, `/terms`, `/cookie-policy` | — | — |
| `/login`, `/signup` | — | — |
| `/admin` | — (noindex + robots-disallowed) | — |

- Every canonical page emits `<link rel="canonical">` pointing to itself (absolute URL).
- Plant detail URLs use the **species' own name**; common-name-only URLs are avoided (they create rename instability); a "known-as" mapping (e.g. `pothos` → `/plant/epipremnum-aureum-pothos`) can be a redirect, but only once a real search demand justifies it.

---

## 4. On-page SEO per template

### Title pattern (`≤ 60 chars` target, exact string templated per route)

| Template | Title pattern | Example |
|---|---|---|
| Home | `PlantAI — AI Plant Identification & Care Guides` | (fits) |
| Identify | `Identify a Plant by Photo (Free) \| PlantAI` | |
| Plant detail | `Monstera Deliciosa Care + ID \| PlantAI` | `{Common Name} Care + ID \| PlantAI` (or scientific name if no common name) |
| Library | `Plant Library — Search Care Guides \| PlantAI` (canonical page; `?q=` variant is noindexed — §6) | |
| Blog post | `{Article Title} \| PlantAI` (H1 stays casual; title tightens for SERP) | |
| Static pages | `Privacy Policy \| PlantAI` etc. | |

### Meta descriptions (140–160 chars), written per page, e.g. plant page: "How to identify and care for {Species}: watering, light, soil and fertilizer basics, common problems, and a free AI-assisted photo ID."

### Heading hierarchy rules

- Exactly one `<h1>` per page; it contains the page's primary topic (species name; guide title).
- `<h2>` for major sections (Care, Identification, Common problems); `<h3>` within; never skip a level; headings phrased as user questions where natural (e.g. "How often should I water a Monstera?") because they map to long-tail queries.

### Image alt guidelines

- Plant/library images: describe the organ and the species — `alt="Monstera deliciosa leaf with fenestrations"`. Never keyword-stuff; do not write `alt="monstera plant care tips"`.
- Decorative images/illustrations: `alt=""`.
- User-submitted identification previews (results): `alt="Photo of your plant specimen"` (privacy-neutral).
- All content images follow the quality checklist in `CONTENT_STRATEGY.md`.

---

## 5. Keyword strategy

Zero-budget approach: target clusters where intent is clear and competition is realistically winnable with quality content. **No rank numbers, no guessed volumes** — direction comes from Search Console's own query data once live (§14).

### Seed clusters

| Cluster | Example target phrasings | Primary page type |
|---|---|---|
| Identification (free / online) | plant identification online free, identify plant by photo app, what plant is this | `/identify`, home |
| Species care | [species] care, [species] care guide, how to care for [species] | `/plant/[slug]` |
| Watering intent | [plant] watering, how often to water [X], water schedule for [species] | `/plant/[slug]` watering section |
| Symptom/problem (educational) | yellow leaves on [plant], [plant] leaves drooping, brown tips on [species] | Problem & disease education pages (Phase 4) |
| Look-alike disambiguation | difference between [Species A] and [Species B] | Identification guides (Content pillar 2) |
| Beginner topics | repot a plant for beginners, best soil for houseplants | Blog / guides (Content pillar 4) |

### Long-tail intent mapping

| Intent | SERP-thinking (intent type) | Page type we target |
|---|---|---|
| "identify plant by photo app" free | Tool/service | `/identify`, `/` |
| "monstera deliciosa care" | Information-navigational | `/plant/[slug]` |
| "how often to water snake plant" | Information (specific) | Species page watering section (headings phrased to match) |
| "yellow leaves on peace lily" | Information-diagnostic (problem page) | Symptom page (Phase 4, educational only) |
| "schefflera vs umbrella plant" | Comparison/ID | Look-alike guide |
| "pothos types with pictures" | Reference/gallery | Guide + library links |

Keyword placement rules: primary phrase appears in H1 and title; natural variants distributed across H2s; no keyword cramming. Empty-content pages are never published to "catch" a keyword (violates `CONTENT_STRATEGY.md` quality bar).

---

## 6. URL & faceting rules (crawl-safe search)

- **Search results are NOT indexed by default.** Library search is a `?q=` parameter on `/library`. Practically:
  1. The `/library` canonical variant emits `<link rel="canonical" href="https://<domain>/library">` even when rendered with a `?q=` response — so parameter variants consolidate to the canonical indexable page.
  2. For responses where a real user search produced no meaningful value-add content (which is the common case), we additionally send `<meta name="robots" content="noindex,follow">`.
  3. `robots.txt` does **not** disallow `/library` (blocking by robots.txt prevents crawling, which can paradoxically leave parameter URLs indexed with no content; meta-robots + canonical is the correct mechanism).
- No crawlable infinite facet URLs: filters (future) do not generate indexable unique URLs unless they have real content (deferred per `UI_UX_DESIGN.md`).
- Sort-order/pagination params, if ever added, follow the same canonical-consolidation rule.
- `/admin`, `/account`, `/my-plants`, `/dashboard`, `/reminders` are fully noindexed (auth pages carry no canonical value) and robots-disallowed (§10).

---

## 7. Metadata system

- **Open Graph:** every public route sets `og:title`, `og:description`, `og:url`, `og:type` (`website` home/tool, `article` for blog, default `website` for plant pages), `og:site_name: PlantAI`, and `og:image`.
- **Twitter cards:** `summary_large_image` for blog and plant pages; `summary` for tool/static pages.
- **OG image generation:** decision — **static templates first** (a small set of pre-designed brand OG images: one per page type, generic), then Phase 4+ adds `next/og`-style dynamic OG generation for blog titles using the design-system fonts/colors (only when the blog cadence in `CONTENT_STRATEGY.md` justifies the effort).
- **Brand asset placeholders (needed by Phase 3):** (1) 1200×630 static OG image; (2) square logo 512×512; (3) favicon set; (4) `apple-touch-icon`; all stored under `app` or `public`, **UNVERIFIED** specific dimension needs per platform are well-documented conventions — verify against official Open Graph / Twitter docs at implementation time.
- All metadata centralized in a small `seo.ts` helper so titles/descriptions follow §4 patterns in one place.

---

## 8. Structured data (JSON-LD) plan

Realistic, high-confidence use of official Schema.org types (no invented rich-result expectations; Google's own published documentation governs what earns enhanced display — treated as the only verified guidance for them):

| Page type | Schema | Notes |
|---|---|---|
| Home | `WebSite` (+ `SearchAction` pointing to `/library?q={search_term_string}`) | Standard, safe. |
| All pages | `Organization` + `logo` on home; `BreadcrumbList` on every non-home public page. | Always present. |
| Plant detail | `Article` markup mapping the care-profile content + `BreadcrumbList`. *Considered and rejected for MVP: `Taxon` schema (the `scholarlyArticle`/`Taxon` route is niche and little tooling supports it — UNVERIFIED benefit); revisit post-launch if evidence shows it matters.* | Care facts as structured text is the practical value. |
| Blog posts | `BlogPosting` (with `headline`, `image`, `datePublished`, `dateModified`, `author` → `Person`/`Organization`). | |
| Guides/FAQ-style problem pages | `Article` + `FAQPage` (only when real Q&A content exists — FAQ rich results have scope limits; never fake Q&A). | Aligned with `CONTENT_STRATEGY.md`. |
| Identification tool | No special schema — honest `WebSite`/`WebApplication`-level minimum only; no invented "AI service" schema claims. | |
| Attribution contact | `Organization` with `contactPoint` (matches `/contact`). | |

Implementation: a single `JsonLd` component injecting `<script type="application/ld+json">` per route; schema data sourced from the same Supabase content fields that render the page (single source of truth — `DATABASE_SCHEMA.md`).

---

## 9. Sitemap

`app/sitemap.ts` generates:

- **Static routes always present:** `/`, `/identify`, `/library`, `/blog`, `/about`, `/contact`, `/privacy`, `/terms`, `/cookie-policy`, `/login`, `/signup` (last three are debatable; included initially, pruned if Search Console shows noise — they are not money pages).
- **All published plant slugs** from Supabase (`plant_library` where `published = true`, `DATABASE_SCHEMA.md`).
- **All published blog slugs** (Phase 4+; `blog_posts`).
- Excluded: `/admin`, `/account`, `/my-plants`, `/saved-plants`, `/dashboard`, `/reminders`, `/api/*`.
- **`lastmod` strategy:** timestamps come from real content `updated_at` fields in Supabase — not the build time (fake churn is a misuse signal); page-level revalidation triggers a regeneration of the sitemap rather than re-writing untouched entries.

---

## 10. Robots (app/robots.ts)

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /account
Disallow: /my-plants
Disallow: /saved-plants
Disallow: /dashboard
Disallow: /reminders
Disallow: /api/

Sitemap: https://<domain>/sitemap.xml
```

(Planned rules; final domain value is injected from environment config at Phase 1/3.) Deliberately *not* disallowed: `/library` (§6 — meta robots handles search consolidation correctly).

---

## 11. Internal linking strategy

| Link path | Purpose |
|---|---|
| Identification results → plant detail (`/plant/[slug]`) | Converts tool users into content readers; strengthens species pages (primary conversion path in the product, see `UI_UX_DESIGN.md` §6.3). |
| Plant detail → care guides / related plants | Distributes link authority within the plant cluster; feeds content pillars 2 & 3. |
| Guides → related plant pages | Reciprocates; guides list the species they cover. |
| Blog → relevant plant page & /identify | Every blog post links to the species pages it concerns. |
| Breadcrumbs | Always visible on plant/blog pages, both visually (`UI_UX_DESIGN.md`) and as `BreadcrumbList` JSON-LD. |
| Footer links | Static + tool + library navigation from every page. |
| Home → Library top species + Blog teaser | Ensures the most important slugs are one hop from the home page. |

Rule: every public page must be reachable within ≤ 3 internal clicks from home; orphan pages are treated as bugs.

---

## 12. Core Web Vitals budget

| Metric | Google field-data threshold (official) | Our stricter internal goal |
|---|---|---|
| LCP | < 2.5 s | **< 2.0 s** (photo-heavy pages) |
| INP | < 200 ms | < 200 ms (about the same; server-heavy pages won't be JS-bound) |
| CLS | < 0.1 | < 0.05 (reserved ad slots, fixed-aspect images, skeleton-matched states) |

How the architecture achieves it (`ARCHITECTURE.md` carries the implementation detail):

1. **RSC-first:** content routes render server-side; client JS limited to interactive components (identify form, minor UI) — plant pages ship nearly zero JS.
2. **Image optimization:** `next/image` with width/height, `priority` only on the actual LCP image (hero/plant-specimen), lazy elsewhere; modern formats via built-in optimization on Vercel Hobby limits (5,000 transformations/mo, `docs/VERIFIED_FACTS.md` — budgeted and monitored; fallback: further compression or a plan review).
3. **Font loading:** `next/font` self-hosts Inter + Source Serif 4 with automatic swap + size-adjust to kill FOUT-induced CLS.
4. **No third-party scripts in MVP** — ads/analytics arrive later, and the reserved-slot CLS design (§ `UI_UX_DESIGN.md` A1–A4, under ad policy) protects CLS from day one.
5. **Monitoring:** Vercel Speed Insights (Hobby quota: 10K events/30d, `docs/VERIFIED_FACTS.md`) from Phase 1; Search Console CWV report from Phase 3.

---

## 13. Content strategy tie-in

This document owns *how* things rank; `CONTENT_STRATEGY.md` owns *what* gets written and its quality bar (original, horticulturally accurate, human-verified, cited, honest disclaimers). The contract between them:

- Templates and heading structures defined here (§4) are the surfaces that editorial fills — titles and descriptions are drafted as part of the editorial checklist.
- **AdSense-readiness dependency:** our content must satisfy "high-quality, original content that attracts an audience" — the only AdSense eligibility element that is a content question (`docs/VERIFIED_FACTS.md` §Google AdSense). Google publishes **no minimum post/word counts** (third-party folklore exists but is unofficial). We nonetheless operate an internal quality bar (≥ 800 words for guides as an *internal editorial standard*, `CONTENT_STRATEGY.md`) — never presented as a platform requirement.
- Content published but not indexed after a reasonable period is escalated to manual indexing requests (§14) only after the page quality checklist is re-verified — chasing indexing of thin pages is a mistake.

---

## 14. Google Search Console plan (Phase 3+)

Depends on owning a real domain (Phase 3 / production deployment, `PROJECT_PLAN.md` Phase 5 note: domain choice happens at deployment prep).

| Step | Action |
|---|---|
| 1 | Set up a **Domain property** in GSC for the root domain (covers www/apex + subdomains in one place). |
| 2 | Verify (recommended: DNS TXT record; alternative: Vercel-provided verification if offered). |
| 3 | Submit `/sitemap.xml` on first deploy after domain is live. |
| 4 | Monitor **Coverage** (indexed vs excluded reasons) and **Page experience**; fix technical exclusions found via `noindex`/canonical mistakes (§6 sanity check). |
| 5 | **Manual indexing requests** ("Request indexing") reserved for money pages (home, `/identify`, top species pages) — used sparingly, never for the whole sitemap. |
| 6 | Use **Performance → Queries** as our zero-budget keyword research feedback loop; feed high-impression/low-position queries into `CONTENT_STRATEGY.md` editorial calendar. |
| 7 | Treat Core Web Vitals field data as our CWV regression alarm after ad slots go live in Phase 5. |

---

## 15. UNVERIFIED items

| # | Item | Status |
|---|---|---|
| 1 | Any statement about *how* Google's ranking algorithm weighs factors beyond Google's own official documentation | **UNVERIFIED — never claimed.** |
| 2 | Rank guarantees from third-party tools/services | **Not used, not endorsed.** We rely on GSC only. |
| 3 | Exact OG image dimensions / rich-result scope limits in 2026 | Verify at implementation (Phase 3) against official Open Graph / Twitter / Google documentation. |
| 4 | `Taxon` (or similar species schema) practical rich-result benefit | UNVERIFIED low value — excluded from MVP (§8). |
| 5 | Tailwind / Next.js exact major-version behaviors at scaffold time (metadata API, image optimizer settings) | Verify live at Phase 1 (`docs/VERIFIED_FACTS.md` pending items). |
| 6 | AdSense approval outcome or content thresholds beyond official eligibility language | Per `docs/VERIFIED_FACTS.md`: Google publishes no fixed minimums; approval is discretionary; no guarantees stated anywhere. |

---

*End of document. Technical SEO changes must be mirrored in `TASKS.md` and reviewed against `ARCHITECTURE.md` before Phase 3 build.*
