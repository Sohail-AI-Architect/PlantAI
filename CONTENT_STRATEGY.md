# PlantAI — Content Strategy

> Status: Phase 0 planning document. Defines PlantAI's editorial mission, content pillars, quality standards, workflow, the plant library entry template, launch content plan, blog roadmap, AdSense-readiness stance, metrics, and content governance.
>
> Companion documents: `PROJECT_PLAN.md` (phases), `REQUIREMENTS.md`, `ARCHITECTURE.md`, `DATABASE_SCHEMA.md` (plant_library + blog storage), `SEO_STRATEGY.md` (how content surfaces technically), `MONETIZATION_PLAN.md` (ads), `LEGAL_AND_COMPLIANCE.md`, `TASKS.md`, `UI_UX_DESIGN.md`, `docs/VERIFIED_FACTS.md`.
>
> Ground rules honored here: identification results are AI output (Pl@ntNet, cited, `docs/VERIFIED_FACTS.md`); care information is **written by us, from horticultural sources, and human-verified** — never presented as AI opinion; no disease diagnosis is promised (education only).

## Table of Contents

1. [Editorial mission](#1-editorial-mission)
2. [Content pillars](#2-content-pillars)
3. [Content quality standards](#3-content-quality-standards)
4. [Editorial workflow](#4-editorial-workflow)
5. [Plant library entry template](#5-plant-library-entry-template)
6. [Launch content plan (MVP)](#6-launch-content-plan-mvp)
7. [Blog roadmap (Phase 4+)](#7-blog-roadmap)
8. [AdSense-readiness of content](#8-adsense-readiness-of-content)
9. [Content metrics](#9-content-metrics)
10. [Governance](#10-governance)

---

## 1. Editorial mission

To be the clearest, most honest beginner's companion for plant people: **original, practical plant care guidance in plain, beginner-friendly English**, backed by the structure of the plant library and strengthened — never replaced — by photo identification.

- **Tone:** warm, plain, specific. Explanations a nervous first-time plant parent can act on today ("water when the top 2–3 cm of soil feels dry", not "maintain adequate moisture").
- **Scope discipline:** houseplants and common garden species first; tropical/collector outreach later (§6).
- **Honesty:** AI identification is a helpful hint, not an oracle; care knowledge is written knowledge; we cite where health/safety claims come from.
- **Language:** English (only, MVP); clear-enough English doubles as a global audience qualifier.

## 2. Content pillars

| # | Pillar | What it is | When |
|---|--------|-----------|------|
| 1 | **Plant Library entries** | Structured, data-driven species care profiles (watering / sunlight / soil / fertilizer / difficulty / temperature / humidity / common problems) — the heart of the site and the supply for care cards shown in results (canonical decision #6). | Phase 3 (launch with §6 seeds) |
| 2 | **Identification guides** | "How to identify X" / look-alike pages: organ-level cues, subtle differentiators (e.g. pothos vs philodendron), photo-rich, honest that photos + organ detail matter (per `docs/VERIFIED_FACTS.md` input guidance). | Phase 3–4 |
| 3 | **Problem & disease education** | Symptom-driven pages ("yellow leaves: the usual causes" checklist) that explain causes and improvements — **without promising a diagnosis**; disease AI exists only as a future beta in a limited Pl@ntNet route (`docs/VERIFIED_FACTS.md`) and is not promised in MVP. | Phase 4+ |
| 4 | **Blog (seasonal / topical)** | Practical articles: watering mistakes, repotting basics, seasonal light changes, beginner equipment-free tips. | Phase 4+ (roadmap §7) |
| 5 | **SEO landing / Q&A pages** | Short, focused answers to specific common questions (e.g. "can I grow pothos from a leaf?") that point into `plant/[slug]` pages and guides — written honestly, not doorway-stuffed; only when they have genuine value. | Phase 4+, continuous |

## 3. Content quality standards

Every piece must satisfy all of these before publishing (this is the *bar*, not a word-count goal; `SEO_STRATEGY.md` un-claims any platform minimums):

- [ ] **Original text.** No scraping, no spinning, no AI-paste-and-go. First drafts may be machine-assisted, but a human author rewrites from scratch with their own structure and voice. Fact-claims get re-checked (§4).
- [ ] **Horticulturally accurate.** Specific, actionable, and consistent with mainstream horticultural practice; no superstition ("ice cubes for orchids"-style myths are either corrected or explicitly noted as debated).
- [ ] **Source-cited when scientific.** Care advice attributed to a named source family: **RHS** (Royal Horticultural Society), university/extension pages (e.g. US state extension guides), Pl@ntNet's published data where relevant, or widely cited horticultural references. Citations are human-toned ("as RHS guidance recommends…") not academic footnotes.
- [ ] **Quality-bar-over-word-count.** No minimum length is a hard rule. As an **internal editorial guideline**, guides aim ≥ 800 words *when the topic warrants it*; Q&A pages may legitimately be shorter. Padding a weak article to hit a number is banned.
- [ ] **Original or properly licensed images**, with attribution recorded and displayed where required (CC-BY-SA example images from Pl@ntNet responses are cited inline, e.g. "Pomme Pépin / Pl@ntNet, cc-by-sa" — `docs/VERIFIED_FACTS.md`).
- [ ] **Honest disclaimers present** where relevant: identification is AI-assisted and can be wrong; content is educational, not veterinary/medical/toxicological advice.
- [ ] **Plant safety discipline.** Any species with known toxicity risk gets a prominent toxic-plant warning on its page *and* the content mentions it in care/problem context. Sources: authoritative toxic-plant references; if we are not certain, we say "check a poison-control/official resource before handling" rather than guess. This is non-negotiable.
- [ ] **English, beginner-friendly, structured** per `UI_UX_DESIGN.md` (headings, tables, 60–75-char measure), H1/H2/H3 per `SEO_STRATEGY.md` §4.
- [ ] **No fake claims anywhere:** no "recommended by botanists", no "approved by…", no invented statistics, no fake authority.

## 4. Editorial workflow

Single-author reality (documented): the same person plans, writes, fact-checks, SEO-reviews, and publishes — so the workflow below is built to fit one human and stay sustainable.

```
IDEA (from quarter backlog / GSC queries / pillar gaps)
  ↓
DRAFT  → quality checklist §3 self-audit
  ↓
FACT-CHECK  → verify every care claim against ≥1 cited source (RHS / extension / Pl@ntNet data);
              flag corrections inline; record source URLs in the entry's `sources` notes
  ↓
SEO REVIEW → title/meta per SEO_STRATEGY.md §4; headings; internal links (min 2 in, 2 out);
             image alt text; JSON-LD-friendly fields (faqQ when used)
  ↓
PUBLISH (Supabase: `published=true`)
  ↓
REVISIT (scheduled: revisit annual for care pages, or on Search Console impression-shift signals)
```

- **Single-author note:** the fact-check step is performed as a *separate sitting* from the draft, never simultaneously with writing — this is the realistic quality-assurance mechanism available to a solo editor.
- **Community contributions** (Phase 7+, not MVP): if ever opened, same checklist + a submission form; expectations set per `LEGAL_AND_COMPLIANCE.md`.

## 5. Plant library entry template

Exact fields match the `plant_library` table (see `DATABASE_SCHEMA.md`); published state gating:

| Field | Type/format | Editorial notes |
|---|---|---|
| `slug` | kebab-case (canonical rule per `SEO_STRATEGY.md` §3) | stable, rename-averse |
| `scientific_name` | text, correctly italicized in rendering | authoritative binomial |
| `common_names` | text[] | all real-world common names, primary first |
| `family` | text | — |
| `genus` | text | — |
| `category` | `plant_category` enum (canonical values from migration 000: `tree`, `shrub`, `herbaceous`, `succulent_cactus`, `fern`, `vine_climber`, `aquatic`, `ornamental_grass`, `houseplant`, `fruit_vegetable`, `other`) | consistent vocabulary — write seeds with these exact enum values |
| `description` | text (2–4 sentences) | written prose, no keyword stuffing |
| `care_watering` | text (1–3 sentences / mini-table) | frequency *and* cue ("top inch dry") |
| `care_sunlight` | text | direction/likeliness in plain terms |
| `care_soil` | text | mix + pot guidance where useful |
| `care_fertilizer` | text | frequency + product class |
| `difficulty` | enum: `easy` / `moderate` / `hard` (canonical values from migration 000 line 52 — reconciled 2026-11-15; the earlier "challenging" wording was not a real DB value) | our own scale, documented once |
| `image_url` | url | hero image, original or licensed+attributed (checklist §3) |
| `is_published` | boolean (canonical column name verified against migration 000 and `/plant/[slug]`) | only `true` entries appear on `/plant/[slug]` and the sitemap |

Optional future fields (tracked as schema changes in `TASKS.md` after Phase 4, not now): temperature, humidity, common problems, toxic-to, sources. MVP launches lean; extend data only when it improves real UX.

## 6. Launch content plan (MVP)

- **~20–30 well-written species entries** to seed the plant library (quality bar §3, one sitting each, spread across Phases 3 windows).
- **5 "how it works / how to identify" pages** (pillar 2) covering the organs users photograph (leaf, flower, fruit, whole-plant habit) and one look-alike pair page.
- **Priority species table (top 10 to write first)** — chosen because they dominate both identification demand and beginner questions:

| # | Species | Why prioritized |
|---|---|---|
| 1 | Monstera deliciosa | Huge beginner interest; distinctive leaf ID cues |
| 2 | Pothos (Epipremnum aureum) | Most-given gift plant; classic look-alike pair (vs philodendron) |
| 3 | Snake Plant (Sansevieria / Dracaena trifasciata) | Tolerant, common, misunderstood watering |
| 4 | ZZ Plant (Zamioculcas zamiifolia) | Low-light staple |
| 5 | Peace Lily (Spathiphyllum) | Flowering; frequent "why yellow/drooping" problems |
| 6 | Philodendron (heartleaf group) | Look-alike pair with pothos (identification guide) |
| 7 | Fiddle Leaf Fig (Ficus lyrata) | Notoriously fussy — high problem-query demand |
| 8 | Aloe Vera | Succulent + topical-safety warning discipline (toxic if ingested) |
| 9 | Jade Plant (Crassula ovata) | Pet-safety / problem-care FAQ surface |
| 10 | Rubber Plant (Ficus elastica) | Common ID confusion with Ficus lyrata |

Plus a **second-wave batch of 10–20 tropical/outreach species** (MVP stretch, Phase 4): Monstera adansonii, golden pothos varieties, Calathea group, ferns, begonias, hoyas, cacti/succulent mix, English ivy, spider plant, dracaena group — written later, on cadence.

## 7. Blog roadmap (Phase 4+)

- **Cadence: 2 posts/month** — chosen as the sustainable solo-author rhythm; less is honest, more is a burnout trap. Nothing in `docs/VERIFIED_FACTS.md` or elsewhere sets a platform minimum for frequency (community figures are unofficial — `SEO_STRATEGY.md` §13).
- Quarter 1 (Phase 4): watering mistakes everyone makes; repotting without shocking the plant; the 5 light spots in your home and what grows there.
- Quarter 2: winter watering changes; plant soils explained; the honest costs of plant care (equipment-free focuses).
- Longer-term: identification-guide spins, problem-page expansions, and Q&As that Search Console query data shows demand for (`SEO_STRATEGY.md` §14).
- Posts live at `/blog/[slug]` (canonical slugs per `SEO_STRATEGY.md` §3) with `BlogPosting` JSON-LD.

## 8. AdSense-readiness of content

- Aligned with `MONETIZATION_PLAN.md`; not a claim of approval, ever. The only AdSense eligibility element inside our control content-wise is "high-quality, original content that attracts an audience" (`docs/VERIFIED_FACTS.md` §Google AdSense).
- Conditions we fulfill before even considering an application (per `PROJECT_PLAN.md` Phase 5): substantial original library content (~30+ quality species pages + a handful of guides/posts), navigable site, privacy + cookie policy live, no ads shown on Vercel Hobby (non-commercial constraint, `docs/VERIFIED_FACTS.md` §Vercel), ad units only in the reserved slots (`UI_UX_DESIGN.md` §10).
- **No fake claims of approval, no "apply and exit" planning** — if content isn't genuinely useful, no amount of preparation helps (AdSense's most common rejection is "Low value content", `docs/VERIFIED_FACTS.md`).

## 9. Content metrics

- **Decision recorded: defer analytics tooling to Phase 5.** No Google Analytics in MVP. Until then:
  - **Google Search Console** (Phase 3+): impressions, clicks, queries — the zero-budget ranking/intent feedback loop (see `SEO_STRATEGY.md` §14).
  - **Vercel Analytics events** ( Hobby tier: 50K events/mo, `docs/VERIFIED_FACTS.md`): count anonymous page events for the surfaces that matter editorially — `plant/[slug]` views, results→detail clickthrough events.
- Content metrics we actually care about (and what proves they work):
  1. **Organic sessions** to library/plant pages (GSC + Vercel events until Phase 5; GA4 or similar only at Phase 5 and only if genuinely needed).
  2. **Identification → library clickthrough** (results → `/plant/[slug]`): the product loop proving content serves the identification experience (`UI_UX_DESIGN.md` §6.3 designs this path prominently).
- We do **not** track for tracking's sake; every metric added must map to an editorial decision we would change.

## 10. Governance

- **Content tasks live in `TASKS.md`**, tagged per phase (Phase 3 library seeds, Phase 4 problem pages and blog, etc.); this document does not duplicate the task list, it defines the quality/workflow contract they implement.
- **Storage decision recorded: blog articles are data, not markdown files in the repo.** Posts are stored in Supabase (`blog_posts`, `DATABASE_SCHEMA.md`: fields such as `slug`, `title`, `excerpt`, `body`, `cover_image`, `published`, `published_at`, `updated_at`, author info). Reasons: consistent with `plant_library` publishing flow, easy edit/update timestamps powering `lastmod` (`SEO_STRATEGY.md` §9), future support for an admin review surface (`/admin`) without repo churn. **Schema addition itself is tracked as a Phase 4 task in `TASKS.md`** (the current `DATABASE_SCHEMA.md` MVP scope may not include `blog_posts` yet).
- **Reviews/revisions:** care pages get an annual human revisit (or earlier if Search Console shows a query pattern proving a page misses a common question); revisions update `updated_at` and are honest about what changed.
- **Deprecation:** content that proves thin or factually insufficient gets improved or unpublished — never left to rot (thin pages hurt trust and are the anti-pattern the entire quality bar exists to prevent).

---

*End of document. Any claim created about third-party platform minimums must be verified in `docs/VERIFIED_FACTS.md` before being added anywhere in this file.*
