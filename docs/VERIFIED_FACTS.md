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

- Source: https://my.plantnet.org/pricing, https://my.plantnet.org/terms_of_use, https://my.plantnet.org/doc/api/identify, https://my.plantnet.org/doc/api/quota, https://my.plantnet.org/doc/references/changelog — verified **2026-11-10**.
- **Free plan: €0, 500 identifications per day.** Commercial use IS allowed up to 500 identifications/day (publisher states this on the homepage: "Commercial use allowed up to 500 identifications per day").
- Never billed on the free plan. When quota is exceeded: **HTTP 429 Too Many Requests** until quota resets at **midnight UTC**.
- Error responses: since **2026-02-13**, an identification request that returns an error **also consumes 1 credit** on the free plan. Properly validating uploads client/server-side is therefore important to protect quota.
- **Concurrency: max 20 simultaneous requests per client**, any plan.
- Quota is per user account, per request category, per day. Lookup routes (`/languages`, `/projects`) don't consume quota. `remainingIdentificationRequests` and rate-limit headers are returned in each identification response.
- **Request format:** `POST /v2/identify/{project}` — 1–5 images per request, must be the **same individual plant**; only `image/jpeg` and `image/png`; total POST size ≤ 50 MB; Pl@ntNet auto-resizes inputs to 1280px on the smaller side.
- **Confidence scores 0–1** (since v2; v1 used 0–100 and is deprecated).
- **Projects/floras:** restrict results by region or theme (crops, invasive, useful plants, etc.) for accuracy.
- **Disease identification is a separate BETA route** (`/v2/diseases/identify`), launched **2025-12-02**, limited to a **small list of species and pathologies (EPPO codes)** — it is NOT equivalent to species identification and must not be misrepresented as a mature disease-diagnosis service. It consumes the same identify quota. A listing route `/v2/diseases` gives identifiable diseases.
- **Varieties identification is a separate BETA route** (`/v2/varieties/identify`, launched 2025-12-02), limited to a small number of well-documented crops.
- Coverage: **87,000+ species**, common names in 50–62 languages, ~6 model updates/year. New AI model trained 2026-01-08 for WCVP floras.
- **Attribution:** On the **free plan**, the "Powered by Pl@ntNet" logo is *appreciated but not required* (required on the Non-profit plan). The terms provide a recommended attribution sentence: *"The image-based plant species identification service used, is based on the Pl@ntNet recognition API, regularly updated and accessible through the site https://my.plantnet.org/."* PlantAI will display attribution regardless (good practice + SEO/licence clarity).
- **Image licensing:** illustration images returned by the API carry citations such as `Pomme Pépin / Pl@ntNet, cc-by-sa` — i.e. CC-BY-SA style attribution applies to third-party images. See https://my.plantnet.org/doc/references/using-images ("Using images") for reuse/citation rules (not yet read — verify during Phase 2 implementation).
- **Account rules:** one free account per person or legal entity; multiple free accounts submitting from the same IP are forbidden; API key is private (client-side/browser use requires explicitly CORS-whitelisting each domain — PlantAI will **not** expose the key; all calls server-side).
- Commercial beyond 500/day = paid (Pro plan; 200,000 identifications per contract period are referenced for Pro). Exact Pro price must re-verified at decision time (not needed in MVP).

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
| 3 | Pl@ntNet "Using images" reuse/citation rules detail | UNVERIFIED | Phase 2 (before displaying third-party images) |
| 4 | Pl@ntNet Pro pricing (if 500/day is ever exceeded) | UNVERIFIED | Only if quota pressure appears |
| 5 | Google Play Console $25 fee + AdMob 2026 policies | UNVERIFIED | Phase 7 |
| 6 | Tailwind major version in use at scaffold time | Verify live | Phase 1 |
| 7 | Node.js current LTS version | UNVERIFIED | Phase 1 |
| 8 | Cookie-consent requirements current guidance (EU) | UNVERIFIED | Phase 5 |
| 9 | GitHub Actions free minutes (2026) | UNVERIFIED | Phase 1 (CI setup, optional) |
| 10 | AdSense numeric ad limits (none published) | N/A — do not cite numbers | — |
