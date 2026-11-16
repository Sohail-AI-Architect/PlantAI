# PlantAI — Verified Facts & Research Log

> Purpose: single source of truth for all free-tier terms, quotas, and pricing verified during planning.
> Every other document MUST reference this file for factual claims about third-party services.
> Rule: never restate a quota or price here as fact unless it has a source and verification date below. Anything not verified below must be marked **UNVERIFIED** in other documents.

**Primary verification date: 2026-11-10 (web search against official/publisher pages).**

---

## Table of Contents

1. [Pl@ntNet API](#plantnet-api)
2. [Supabase](#supabase)
3. [Vercel](#vercel)
4. [Alternative hosting (Netlify / Cloudflare Pages)](#alternative-hosting-netlify--cloudflare-pages)
5. [Google AdSense](#google-adsense)
6. [Google AdMob / Google Play Console](#google-admob--google-play-console)
7. [Open-source stack (Next.js, React, TypeScript, Tailwind, Capacitor, GitHub, OpenCode)](#open-source-stack-nextjs-react-typescript-tailwind-capacitor-github-opencode)
8. [Research notes & pending verifications](#research-notes--pending-verifications)

---

## Pl@ntNet API

- **Sources (all official, verified 2026-11-12 — Stage A1 documentation verification):**
  https://my.plantnet.org/doc/getting-started/introduction · https://my.plantnet.org/doc/api/identify ·
  https://my.plantnet.org/doc/api/quota · https://my.plantnet.org/doc/api/taxonomy ·
  https://my.plantnet.org/doc/references/using-images · https://my.plantnet.org/doc/references/changelog ·
  https://my.plantnet.org/pricing · https://my.plantnet.org/terms_of_use
  (Initially verified 2026-11-10; re-verified and extended 2026-11-12 from the official doc pages.)
- **API host: `https://my-api.plantnet.org`** — the API gateway. `my.plantnet.org` is the documentation/portal site and is NOT the API host (all official code examples target `my-api.plantnet.org`).
- **Identification endpoint:** `POST https://my-api.plantnet.org/v2/identify/{project}` (a `GET` variant also exists for URL-based images).
- **Authentication:** the private API key is passed as the **`api-key` query parameter** (official examples: "pass your API key as a query parameter (not in body)"). Consequence: the key appears in request URLs — **the full request URL must never be logged**; errors/diagnostics must be redacted.
- **Default project: `all`** ("If you don't know which project to use, set `project` to `all`"). Projects/floras restrict results by region/theme; `/v2/projects` lists them and is quota-free (docs name `/languages` and `/projects` as unlimited). Legacy projects (`type=legacy`) run an outdated model that "will be dropped in the near future" — never use.
- **Free plan: €0, 500 identifications per day** (pricing page: "free up to 500 identifications per day… Commercial use allowed"). Reset at midnight UTC; over-quota → **HTTP 429** with `Retry-After`.
- Error responses: since **2026-02-13**, an identification request that returns an error **also consumes 1 credit** on the free plan (not Pro). Strict upstream-side validation before any call is a quota-protection design point.
- **Concurrency: max 20 simultaneous requests per client** (terms of use, any plan).
- Quota is per user account, per request category, per day. Lookup routes (`/languages`, `/projects`) don't consume quota. Quota routes: `/v2/quota`, `/v2/quota/daily` (count/total/remaining), `/v2/quota/history` (contracted accounts). Whether `/v2/quota*` calls are themselves quota-free is **UNVERIFIED**.
- **Quota headers (documented, draft-ietf-httpapi-ratelimit-headers-08):** `RateLimit-Policy: "dailyQuota";q=<granted>;w=86400;pk=<user+request type>` · `RateLimit: "dailyQuota";r=<remaining>;t=<seconds to reset>;pk=…` · `Retry-After: <RFC 7231 date>` (returned **with HTTP 429**).
- **Request format:** `POST /v2/identify/{project}` — 1–5 images per request, must be the **same individual plant**; only `image/jpeg` and `image/png`; total POST size ≤ 50 MB; Pl@ntNet auto-resizes inputs to 1280px on the smaller side (never upscaled; identification not guaranteed below 800×800 px; JPEG quality ~90% recommended; send images with POST for speed).
- **`organs` parameter (plural):** one repeated `organs` form value **per image, matched in image order**; repeat the same value when several images show the same organ; **omitting `organs` sets every image to `auto`**. Valid values: **`leaf`, `flower`, `fruit`, `bark`**, plus **`auto`** (AI detection). `lateral`/`root` are NOT valid upstream values. Documented organ informativeness: flower > fruit > leaf > entire plant > bark.
- **Non-plant rejection:** images identified as non-plants → **HTTP 404 "Species not found"**. `no-reject=true` (default `false`) returns less-probable plant predictions when the top result is not a plant; when NO plant species is predicted at all, 404 returns regardless.
- **Confidence scores 0–1** (since v2; v1 used 0–100 and is deprecated).
- **Response body:** `results[]` (score-descending; each with `species.{scientificNameWithoutAuthor, scientificNameAuthorship, scientificName, genus.{scientificNameWithoutAuthor,…}, family.{…}, commonNames[]}` — genus/family/commonNames live INSIDE the species object — and TOP-LEVEL result siblings `gbif: {id}` / `powo: {id}`; the official output example shows **string** ids: gbif `"2927079"`, powo `"444576-1"`), plus `query` (project, images, organs, includeRelatedImages, noReject, `type: null`), `predictedOrgans` (top-1 organ + score per submitted image, since 2025-01-14; items `{image, filename, organ, score}`), `bestMatch`, `language`, `preferedReferential`, `version` (AI engine version; model updates ~every 2 months), and **`remainingIdentificationRequests`** (quota remaining today, response-body field). `otherResults` (per-genus/family) only when `detailed=true` (default **false** since 2025-09-23).
- **Optional parameters:** `include-related-images` (default **false**), `no-reject` (default **false**), `detailed` (default **false**), `nb-results` (integer ≥ 1 — **default undocumented**), `lang` (a code from `/v2/languages`). **`en` is observed in official examples omitting `lang`, but is not prose-documented as the default** — example-observed, not verified.
- **Disease identification is a separate BETA route** (`/v2/diseases/identify`), launched **2025-12-02**, limited to a **small list of species and pathologies (EPPO codes)** — it is NOT equivalent to species identification and must not be misrepresented as a mature disease-diagnosis service. It consumes the same identify quota. A listing route `/v2/diseases` gives identifiable diseases.
- **Varieties identification is a separate BETA route** (`/v2/varieties/identify`, launched 2025-12-02), limited to a small number of well-documented crops.
- Coverage: **87,000+ species**, common names in 50+ languages; model updates ~every 2 months (AI engine `version` field in responses). New AI model trained 2026-01-08 for WCVP floras.
- **Image licensing/attribution (Using-images doc, verified 2026-11-12):** identify-family routes return images under `.images` with fields **`author`**, **`license`**, **`citation`** (taxonomy example also shows `organ`, `date {timestamp, string}`, `url {o, m, s}`, citation form `"Fabrice Rubio / Pl@ntNet, cc-by-sa"`). Images "are **usually** licensed CC BY-SA" — reuse permitted with **Attribution + ShareAlike**; required attribution = contributor credit + Pl@ntNet credit + license indication; documented pattern: `Photo(s): [Contributor] / Pl@ntNet, CC BY-SA`. **Only CC BY-SA is the documented reusable case; the full license-value vocabulary is not documented — unknown/missing license values must prevent image display in PlantAI.**
- **Attribution:** On the **free plan**, the "Powered by Pl@ntNet" logo is *appreciated but not required* (required on the Non-profit plan). The terms provide a recommended attribution sentence: *"The image-based plant species identification service used, is based on the Pl@ntNet recognition API, regularly updated and accessible through the site https://my.plantnet.org/."* PlantAI will display attribution regardless (good practice + SEO/licence clarity).
- **Retention / privacy (terms_of_use, verified 2026-11-12):** submitted **photos are NOT stored** — "only kept in our server volatile memory during the identification process". Pl@ntNet **does store query history** per account: **date, time and image URL(s) of submitted queries** (not the images), for quota control and statistics, tied to the account's unique numeric id. Account data (e-mail) stored until account cancellation; GDPR rights listed in the terms. PlantAI must not claim "we store no data" merely because Pl@ntNet doesn't store the image files — PlantAI's own Supabase Storage retention is a separate, distinct duty.
- **Account rules:** one free account per person or legal entity; multiple free accounts submitting from the same IP are forbidden; API key is private (client-side/browser use requires explicitly CORS-whitelisting each domain — PlantAI will **not** expose the key; all calls server-side).
- Commercial beyond 500/day = paid (Pro plan, verified 2026-11-12 pricing: **€1,000/year**, 200,000 identifications included, decreasing per-unit pricing €0.005→€0.002 per identification at 3M/30M/300M+ tiers, 1M/day safety limit, one-year contract). Non-profit plan: €0 on request, 500–10,000/day, logo **required**, ad/subscription apps refused.

## Supabase

- Source: https://supabase.com/pricing, https://supabase.com/docs/guides/platform/free-project-pausing, https://supabase.com/docs/guides/platform/billing-faq, and Supabase KB FAQ — verified **2026-11-10** (pricing page cross-checked by third-party summaries dated 2026-10-30/11-03).
- **Free plan: $0/month.**
  - Database size: **500 MB** (shared CPU, 500 MB RAM)
  - Egress: **5 GB** (+ 5 GB cached egress)
  - File storage: **1 GB**
  - Monthly active users (auth): **50,000 MAU**
  - API requests: unlimited on all plans
  - Projects: **2 active free projects** (paused ones don't count)
- **Inactivity pausing:** Free projects are **paused after ~1 week of low database activity**. Warning email ~1 week before, confirmation email after. A few real requests/day usually keeps it alive (not guaranteed). Paused projects are restored via dashboard with all data; **restore window is 1 year** (backups retention). No charge for paused projects.
- **No automatic backups on Free** — DB-only project; plan for manual SQL dumps during development.
- Pro: **from $25/month** (no inactivity pausing, 8 GB DB, more storage). This is the first "likely future cost" for PlantAI growth.
- Auth: email/password, magic links, OAuth (e.g. Google) available on Free; SSO (SAML) is not available on Free.

## Vercel

- Source: https://vercel.com/docs/plans/hobby, https://vercel.com/docs/limits/fair-use-guidelines, https://vercel.com/terms, https://vercel.com/pricing — verified **2026-11-10** (docs last updated 2026-09-14; ToS update effective 2026-10-19 which kept the Hobby restriction).
- **Hobby plan: $0** — 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, 1,000,000 Function Invocations, 1,000 GB-hours Serverless Function Execution, 5,000 Image Transformations, 100 builds/day (approx.), 1 concurrent build, analytics 50K events/mo, Speed Insights 10K events/30d.
- **CRITICAL: Hobby is restricted to personal, NON-COMMERCIAL use.** Vercel's fair-use guidelines explicitly define commercial usage to include payment processing AND **"the inclusion of advertisements, including but not limited to online advertising platforms like Google AdSense."** → **Running AdSense on Vercel Hobby violates the ToS.** Enforcement may include disabling the deployment without notice.
- Exceeding Hobby caps: feature pauses until 30 days pass (no billing on Hobby).
- Pro: **$20/month** per deploying seat including $20 usage credit — required when the site becomes commercial (ads or subscription).

> Conclusion recorded in architecture/monetization docs: PlantAI may develop and initially deploy on Vercel Hobby **only while non-commercial (no AdSense, no premium)**. Before enabling AdSense, either upgrade to Vercel Pro or migrate to a host whose free tier permits commercial use (see below). This is the project's most important hosting constraint.

## Alternative hosting (Netlify / Cloudflare Pages)

- A published third-party review (Figment, 2026-09-23, checking Netlify's terms) states Netlify **allows commercial use on its free plan** — this is a real point of difference vs Vercel. UNVERIFIED against Netlify's own current terms (verify in Phase 5 before relying on it).
- Cloudflare Pages free tier is commonly used for commercial/Next.js projects (via OpenNext adapter), but specifics were **not verified** in this research pass — mark all Cloudflare claims UNVERIFIED until checked in Phase 5.

## Google AdSense

- Source: https://support.google.com/adsense/answer/9724 (eligibility), https://support.google.com/adsense/answer/48182 (program policies), https://support.google.com/adsense/answer/23921 — verified **2026-11-10**.
- **Official eligibility:** (1) own high-quality, original content that attracts an audience; (2) ability to access/modify the site's HTML; (3) compliance with AdSense Program Policies + Google Publisher Policies; (4) applicant age **18+**. One account per person; can serve multiple sites.
- **Google publishes NO fixed minimum** for number of posts, word count, traffic, or domain age. Community advice (e.g. 20–30 articles) is unofficial. Most common rejection: **"Low value content."**
- Publisher must run ads on a **live, navigable site**; required disclosures include a **privacy policy covering advertising cookies / third-party advertising** (Cookie Policy + consent UX needed in EU/UK under ePrivacy/GDPR — general legal requirement, verify during Phase 5 with current consent guidance).
- **ads.txt is required at ad-serving time** (not strictly for approval) — publish AFTER account approval with the publisher ID from AdSense.
- Approval is discretionary; **no guaranteed approval and no guaranteed revenue** may ever be claimed anywhere in PlantAI materials.
- Site quality: max 3 ad units... (No — AdSense no longer caps unit counts numerically; do not state a numeric ad-unit limit. Only require "reasonable density, no misleading placement".)

## Google AdMob / Google Play Console

- AdMob: ad SDK for mobile apps, part of Google's ad business; no cost to integrate. UNVERIFIED for 2026 specifics — verify in Phase 7 before Android launch.
- Google Play Console registration: **$25 one-time fee** (widely documented historically). UNVERIFIED for 2026 — verify in Phase 7. This would be PlantAI's **first explicit cost** on the future Android path.

## Open-source stack (Next.js, React, TypeScript, Tailwind, Capacitor, GitHub, OpenCode)

- Next.js, React, TypeScript, Tailwind CSS, Capacitor: open-source, MIT-licensed — no license cost. (License files on respective repos; re-confirm at scaffold time.)
- GitHub: free public/private repositories; Actions free minutes mostly relevant to private repos (2,000 min/month historically) — UNVERIFIED for 2026 details, not critical because PlantAI will use public repo + simple CI.
- OpenCode: open-source AI coding agent, free to use for planning/coding assistance; costs depend only on the model provider chosen — no assumption applies to PlantAI's product.
- Node.js LTS on Windows + npm: free and standard; exact versions to be decided in ENVIRONMENT_SETUP.md (verify current LTS at Phase 1 — as of 2026, Node.js 22.x LTS is a reasonable target, **UNVERIFIED**).

## Research notes & pending verifications

| # | Item | Status | When to verify |
|---|------|--------|----------------|
| 1 | Netlify free tier commercial-use allowance (current terms) | UNVERIFIED | Phase 5 (before monetization) |
| 2 | Cloudflare Pages free tier limits + Next.js/OpenNext compatibility | UNVERIFIED | Phase 5 |
| 3 | Pl@ntNet "Using images" reuse/citation rules detail | **VERIFIED 2026-11-12** (Stage A1): CC BY-SA = documented reusable case (Attribution + ShareAlike; pattern `Photo(s): [Contributor] / Pl@ntNet, CC BY-SA`); other license values undocumented → PlantAI displays only images whose returned `license` field is a documented-reusable value | Done — Stage A1/A2 |
| 4 | Pl@ntNet Pro pricing (if 500/day is ever exceeded) | **VERIFIED 2026-11-12**: €1,000/year, 200,000 identifications included, decreasing per-unit beyond, 1M/day safety cap | Done — recheck only if quota pressure appears |
| 5 | Google Play Console $25 fee + AdMob 2026 policies | UNVERIFIED | Phase 7 |
| 6 | Tailwind major version in use at scaffold time | Verify live | Phase 1 |
| 7 | Node.js current LTS version | UNVERIFIED | Phase 1 |
| 8 | Cookie-consent requirements current guidance (EU) | UNVERIFIED | Phase 5 |
| 9 | GitHub Actions free minutes (2026) | UNVERIFIED | Phase 1 (CI setup, optional) |
| 10 | AdSense numeric ad limits (none published) | N/A — do not cite numbers | — |
