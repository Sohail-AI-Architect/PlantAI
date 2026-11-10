# PlantAI — Monetization Plan

> Companion docs: PROJECT_PLAN.md, REQUIREMENTS.md, ARCHITECTURE.md, API_DOCUMENTATION.md,
> SEO_STRATEGY.md, CONTENT_STRATEGY.md, LEGAL_AND_COMPLIANCE.md, AI_INTEGRATION_PLAN.md,
> DEPLOYMENT_GUIDE.md, TASKS.md, docs/VERIFIED_FACTS.md.
>
> **Ground rules:** every factual claim about third-party pricing, quotas, approval rules, or policies
> must come from docs/VERIFIED_FACTS.md and is cited as such. Anything else is marked **UNVERIFIED**.
> **No revenue figures, approval promises, or ad-limit numbers are ever fabricated.** AdSense approval
> is discretionary; PlantAI claims no guarantee of approval or revenue anywhere.

---

## Table of Contents

1. [Revenue model vision](#1-revenue-model-vision)
2. [Hosting prerequisite decision (CRITICAL)](#2-hosting-prerequisite-decision-critical)
3. [AdSense plan (web, Phase 5+)](#3-adsense-plan-web-phase-5)
4. [AdMob strategy (Android, Phase 7 only)](#4-admob-strategy-android-phase-7-only)
5. [Premium subscription plan (Phase 7+)](#5-premium-subscription-plan-phase-7)
6. [Cross-monetization rules](#6-cross-monetization-rules)
7. [Roadmap table](#7-roadmap-table)
8. [KPIs & measurement](#8-kpis--measurement)
9. [Risks & mitigations](#9-risks--mitigations)

---

## 1. Revenue model vision

PlantAI's monetization follows a phase-gated sequence — **never during MVP**:

| Layer | What | Phase | Status |
|---|---|---|---|
| **Web display ads** | Google AdSense on content pages only (library, guides, blog) | 5 (prep) → 6 (live, if approved) | Planned, apply-not-decide |
| **Mobile display ads** | Google AdMob in the Android app, banners only | 7 | Future; research gate in Phase 7 |
| **Premium subscription** | Ad-free + extended care features (see §5) | 7+ | Deferred pending proven demand |

**Realistic honesty (product principle).** The plant-identification / gardening niche is a
content-for-hobbyists vertical; industry-wide, display-ad RPMs in such niches are generally
modest compared with finance, tech, or B2B. This document deliberately contains **no revenue
estimates or projections** — none are verifiable and none may be invented. The realistic framing is:

- Monetization is a *cover-the-costs* play first (hosting, future Supabase Pro, domain), not a
  primary income stream.
- Ads exist because PlantAI is free to users; they must never degrade the identification experience.
- Premium subscription is the higher-value lever *if* user demand appears, but it carries a
  complexity spike (see §5), so it comes last.

Sequence summary (per canonical project decisions):
**Phase 5** = production deployment + monetization *preparation* (AdSense application allowed only
after content threshold + legal pages live). **Phase 7** = Android (Capacitor) + AdMob +
premium subscription. **MVP (Phases 0–4): no AdSense application, no ads, no subscription.**

---

## 2. Hosting prerequisite decision (CRITICAL)

**Verified fact** (docs/VERIFIED_FACTS.md, Vercel section): the Vercel Hobby plan is restricted to
**personal, non-commercial use**, and Vercel's fair-use guidelines explicitly define commercial usage
to include the inclusion of advertisements — *"including but not limited to online advertising
platforms like Google AdSense."* Enforcement may include disabling the deployment without notice.

**Consequence:** Ads cannot be enabled while PlantAI is on Vercel Hobby — full stop. Any host with
ads becomes a real cost or requires migration.

| Path | What | Cost | Status |
|---|---|---|---|
| **A — Upgrade to Vercel Pro** | Stay on Vercel, pay for the commercial-use right | **$20/month** per deploying seat, incl. $20 usage credit (docs/VERIFIED_FACTS.md, Vercel section) | **VERIFIED** — price & condition confirmed 2026-11-10 |
| **B — Migrate to Netlify (free)** | Move to a host whose free tier reportedly permits commercial use | $0 if terms permit | **UNVERIFIED** — only a third-party review (2026-09-23) supports this; verify against Netlify's *own current terms* in Phase 5 |
| **C — Migrate to Cloudflare Pages (free)** | Free commercial-friendly alternative, Next.js via OpenNext adapter | $0 (limits unknown) | **UNVERIFIED** — limits and compatibility not checked; verify in Phase 5 |

### Decision matrix

| Criterion | Path A: Vercel Pro | Path B: Netlify free | Path C: CF Pages free |
|---|---|---|---|
| Monthly cost | $20 (VERIFIED) | $0 (UNVERIFIED terms) | $0 (UNVERIFIED terms/limits) |
| Commercial use incl. ads | Explicitly allowed (VERIFIED) | UNVERIFIED — plausible per third-party review | UNVERIFIED |
| Migration effort | None | Medium: re-deploy, DNS, re-test server-side routes | Medium-high: OpenNext adapter, function/runtime differences |
| Pl@ntNet server-side proxy compat | Yes (VERIFIED runtime) | Needs re-validation in Phase 5 | Needs re-validation (OpenNext) — UNVERIFIED |
| Risk of surprise policy change | Low-moderate | Unknown until Phase 5 | Unknown until Phase 5 |

### Recommendation

**Evaluate Path B first in Phase 5; keep Path A as the paid fallback.** Concretely:

1. In Phase 5, verify Netlify's own current terms (commercial use on free tier) and Cloudflare Pages
   limits (docs/VERIFIED_FACTS.md → research item #1 and #2). If both permit commercial use at the
   volumes PlantAI realistically sees, migrate **before** enabling ads.
2. Keep Path A as the fallback whenever migration cost or verification fails: **$20/mo is the first
   real cost event** in this project and is acceptable once revenue exists or traffic demands it.
3. **Portability insurance (act now, not in Phase 5):** keep the app a **standard Next.js** build with
   no Vercel-proprietary runtime dependencies beyond what Next itself requires (no vendor-locked
   cron, no Vercel-only libraries in core paths). DATABASE_SCHEMA.md and ARCHITECTURE.md already
   separate data (Supabase) from hosting, which helps. A hand-written migration checklist goes in
   DEPLOYMENT_GUIDE.md at Phase 5.

---

## 3. AdSense plan (web, Phase 5+)

### 3.1 Preconditions checklist (all must be checked before applying)

| # | Precondition | Verified basis (docs/VERIFIED_FACTS.md, AdSense section) | PlantAI status |
|---|---|---|---|
| 1 | Owner account, applicant **18+**, one AdSense account per person | Eligibility item (4) | Developer action at application time |
| 2 | **Original, high-quality content that attracts an audience** | Eligibility item (1) | CONTENT_STRATEGY goal: **25+ quality library/guide pages + blog foundation** before applying (our internal recommendation — Google publishes *no* fixed minimum) |
| 3 | Ability to access/modify site HTML | Eligibility item (2) | ✅ VERIFIED — we host the Next.js app; full HTML control |
| 4 | Live, navigable site | Publisher requirement | Production deployment (M5.1) precedes application |
| 5 | **Privacy policy disclosing advertising cookies / third-party advertising** | Publisher requirement | `/privacy` + `/cookie-policy` live (LEGAL_AND_COMPLIANCE.md) — wording extended for ad use in Phase 5 |
| 6 | Compliance with AdSense Program Policies + Google Publisher Policies | Eligibility item (3) | See compliance mapping in LEGAL_AND_COMPLIANCE.md §"Google AdSense compliance mapping" |
| 7 | Other required pages: About, Contact, Terms | Standard quality signals | `/about`, `/contact`, `/terms` (URLs fixed in project decisions) |
| 8 | EU/UK cookie consent UX before personalized ads | Legal requirement noted as general ePrivacy/GDPR point (marked verify-in-Phase-5 in the facts file) | Consent banner + consent-gated ad loading — exact mechanics **UNVERIFIED** (research item #8, Phase 5) |

### 3.2 Application timing guidance

- **Verified:** Google publishes **no fixed minimum** for content volume, word count, traffic, or
  domain age; unofficial community advice (e.g. "20–30 articles") is not a rule. The most common
  rejection reason is **"low value content."** Approval is discretionary — **no guaranteed approval
  and no guaranteed revenue may ever be claimed.**
- **Why we wait anyway (our judgment, not a Google rule):** traffic existence is *not* a stated
  requirement, but a thin site applied too early risks a "low value content" rejection that is slow
  to recover from. Our gate: **≥ 25 quality pages published (SEO_STRATEGY/CONTENT_STRATEGY content
  plan largely shipped) + stable production deployment + legal pages live.** Apply once in Phase 5/6
  after that gate — then treat the result as an apply-now-not-decision (apply once, monitor, improve
  and resubmit only if rejected; do not churn applications).

### 3.3 ads.txt procedure (post-approval only)

- **Verified:** ads.txt is required **at ad-serving time**, not for approval. Publish it **only
  after** account approval, containing the publisher ID from the approved AdSense account.
- Implementation: static file at **domain root** — `https://<domain>/ads.txt` — served from the
  Next.js `public/` folder or a root-level route. Where it lives and how it's deployed is documented
  in DEPLOYMENT_GUIDE.md (Phase 5 task). Never publish a placeholder publisher ID.

### 3.4 Ad unit inventory proposal (approve-now-hide-later zones)

Design principle: build zones that can be *enabled later without redesign* — approved now as layout
reservations (CSS slots), not activated until the Phase 5/6 gate.

| Zone | Pages | Position | Predictable navigation? |
|---|---|---|---|
| **Article top** | Plant library entries, guides, blog posts | Above title? No — *below* title, above body | Yes |
| **In-content** | Guides & blog long-form | Body flow (never inside a step that breaks mid-task) | Yes |
| **Sidebar (desktop only)** | Content templates | Sticky-free, scrolls with page | Yes |

**Hard exclusions (no exceptions):**

- ❌ **Never** in the identify/upload/scan flow, camera view, loading, or results screen
  (per canonical decision: ads never inside the identification flow).
- ❌ Never on legal pages (`/privacy`, `/terms`, `/cookie-policy`), `/about`, `/contact`, `/admin`.
- ❌ No pop-ups, interstitials, anchors designed to invite accidental clicks, or anything
  misleading — placement must comply with AdSense policy and be non-intrusive by construction.
- Note: AdSense publishes **no numeric cap** on ad units; the facts file explicitly forbids citing
  numbers. Our rule is qualitative: *reasonable density only*, aimed at the outer article frame.

### 3.5 Cookie-consent requirement (EU users)

- **Verified (general):** the publisher needs a privacy policy covering advertising cookies and
  third-party advertising; serving **personalized** ads to EU/UK users requires consent under
  ePrivacy/GDPR.
- **UNVERIFIED (exact mechanics):** whether a certified Google CMP is required in 2026, and the
  precise consent-signal integration (research item #8 in docs/VERIFIED_FACTS.md — recheck in
  Phase 5 before serving any ads).
- **Documented integration point (works regardless of the exact mechanism):** the consent state from
  the Phase 5 cookie-consent banner gates ad-script loading and is cross-referenced on
  `/cookie-policy` (full inventory and mechanics in LEGAL_AND_COMPLIANCE.md §Cookie Policy). Default
  posture: ads do not load without consent for EU/UK visitors; for others, load only after the
  AdSense activation gate in Phase 6.

---

## 4. AdMob strategy (Android, Phase 7 only)

Prerequisites: the Android app exists. Per canonical decisions Phase 7 builds it with **Capacitor**
wrapping the Next.js PWA; no Android work starts before then. This section is deliberately
high-level only.

1. **AdMob account + app ID** — register the app, obtain app/ad unit IDs; integration is free of
   license cost, but 2026 specifics are **UNVERIFIED** (docs/VERIFIED_FACTS.md → research item #5;
   recheck in Phase 7).
2. **SDK in Capacitor via a community plugin** — plugin ecosystem choice for 2026 is **UNVERIFIED**;
   Phase 7 research task: compare maintained Capacitor AdMob plugins (maintenance activity, Android
   SDK compatibility, consent integration) before choosing. No plugin name is locked in here.
3. **app-ads.txt on the website** — an extension of ads.txt declaring authorized mobile ad sellers.
   It is served on the **website at the domain root** (`https://<domain>/app-ads.txt`, publisher ID
   from the AdMob account), not inside the app binary or the app's manifest. Implementation is the
   same Next.js `public/` route pattern as ads.txt (§3.3), added only after an AdMob account + app
   exist. Content and timing per Google's published requirements — **UNVERIFIED detail**, verify in
   Phase 7 when the account exists.
4. **Play listing compliance bundle** — data safety form, privacy-policy URL in the listing, app
   content rating: draft fields are catalogued in LEGAL_AND_COMPLIANCE.md §"Google Play / AdMob
   future compliance checklist". Google Play Console registration cost ($25 one-time, historically)
   is itself UNVERIFIED for 2026 — verify in Phase 7 (this can be the Android path's first cost).
5. **Ad format policy — banners only, NO interstitials.** This is a standing quality decision:
   plant identification is a short, task-focused session; interstitials in that flow would be both
   anti-quality and policy-risky. Banners sit outside the identification UI in the app (same zones
   philosophy as §3.4).

---

## 5. Premium subscription plan (Phase 7+)

### 5.1 Free tier stays generous (the free users keep)

- Identification **within fair use** of the shared Pl@ntNet quota (500/day pool, API-side behavior
  in API_DOCUMENTATION.md; rate limiting design in ARCHITECTURE.md) — practical daily subcap per
  user will be defined there so the pool survives.
- Full plant library, guides, and blog — content is never paywalled (it is also the ad substrate).
- My Plants basic save + basic reminders (Phase 4 feature set).

### 5.2 Premium feature split (Phase 7+)

| Feature | Free | Premium |
|---|---|---|
| Identification volume | Fair-use subcap | Higher allowance within the Pl@ntNet quota reality |
| Care reminders | Basic | Advanced (recurring schedules, notifications tuning) |
| Ads in app | Yes (banners) | None |
| Offline plant pack | — | Downloadable care-guide pack |

### 5.3 Decisions deliberately pending

- **No pricing invented or estimated** anywhere in this document; pricing study deferred until the
  feature set is real and demand is observed.
- **Payment processor analysis deferred:** Stripe vs free-BaaS options — deferred to Phase 7
  (decisions pending).
- **Honest note:** subscriptions require a payment processor + tax/VAT handling + refund handling =
  a genuine complexity spike for a zero-budget solo project. **Recommendation: defer premium until
  user demand is proven** (retention + usage KPIs in §8, plus qualitative signals), not launched on
  speculation alongside the Phase 7 ad layer.

---

## 6. Cross-monetization rules

1. **No affiliate spam.** Affiliate links are out of scope for MVP and, later, only ever editorial
   (disclosed, relevant, never auto-injected). No link farms.
2. **No misleading native ads.** Any sponsored content (if ever accepted) is clearly labeled;
   unlabeled ad-styled cards are forbidden.
3. **Ads never inside the identification flow** — applies to web and app alike (standing rule).
4. Ad relevance limits: no ad categories that misrepresent PlantAI's function (e.g., ads that appear
   to be identification results would be a misleading-place risk — excluded by the zone design in §3.4).
5. All ads are disclosed in the privacy policy / cookie policy as third-party advertising
   (LEGAL_AND_COMPLIANCE.md).

---

## 7. Roadmap table

| Milestone | Phase | Contains | Gate / note |
|---|---|---|---|
| M0.x | 0 (now) | This plan written; hosting & ad strategy locked as decisions | No revenue activity |
| M5.1 | 5 | Production deploy + **hosting decision verified** (Path B vs A per §2) | Blocks all monetization |
| M5.2 | 5 | Legal pages live incl. ad-relevant privacy/cookie wording; consent banner | Blocks ads; see LEGAL_AND_COMPLIANCE.md |
| M5.3 | 5 | Content gate met: **25+ quality pages** + blog foundation | Blocks AdSense application |
| M5.4 | 5 | Ad slots reserved in layout (invisible), policy-ready | Apply-not decision lands here |
| M6.1 | 6 | AdSense application **if** M5.1–M5.3 pass | No approval promised |
| M6.2 | 6 | On approval: ads.txt publisher ID, zones enabled, consent-gated | ads.txt only post-approval |
| M7.1 | 7 | Capacitor Android build | Blocks AdMob |
| M7.2 | 7 | AdMob research gate (plugin, 2026 policies, Play fee UNVERIFIED items) | Research task in TASKS.md |
| M7.3 | 7 | app-ads.txt at domain root | After AdMob account exists |
| M7.4 | 7 | Banners live in app outside identification UI | No interstitials, ever |
| M7.5 | 7+ | Premium decision gate (§5.3) | Demand-gated, may slip indefinitely |

## 8. KPIs & measurement

| KPI | Why | Tool |
|---|---|---|
| Sessions & top pages | Ad inventory reality check | Search Console + Vercel analytics |
| Identification usage (requests/day on the shared quota) | Capacity & Pl@ntNet quota pressure | App telemetry events on Vercel analytics; §KPIs measured only, count via server logs approach in ARCHITECTURE.md |
| Retention (returning users, My Plants usage) | Premium demand signal | Vercel analytics events |
| Content performance (CTR from search) | AdSense "value content" risk proxy | Search Console |

- **GA4 decision: deferred and marked UNVERIFIED-adjacent** — adding GA4 would add new privacy/cookie
  surface area; the decision (including whether its data practice fits the zero-cost legal posture)
  is deliberately deferred and reviewed at Phase 5 alongside the consent banner. Vercel's built-in
  analytics (50K events/mo on Hobby per docs/VERIFIED_FACTS.md) suffices pre-ads.
- No revenue KPIs exist yet (nothing is monetized). When ads go live (Phase 6), add RPM-agnostic
  operational checks only (ads serving, ad uptime) — no fabricated revenue targets.

## 9. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **AdSense rejection ("low value content")** | Moderate | Delayed ads only | Raise content quality; expand library/guides (CONTENT_STRATEGY); resubmit path: fix → wait a meaningful period → reapply once. Never spam applications. |
| **Vercel ToS (Hobby + ads)** | Certain if ignored | Deployment disabled without notice | Fixed structurally: no ads before hosting decision (§2). Hosting change or Pro upgrade precedes any ad serving. |
| **Ad/hosting policy changes** | Moderate | Strategy churn | **Quarter-ly policy check task** added to TASKS.md (recheck AdSense policy news, Vercel fair-use updates, host ToS on commercial use). |
| **Pl@ntNet quota pressure** | Moderate | Identification UX degraded, not a revenue risk | Server-side pool management (API_DOCUMENTATION.md); Pro plan as last resort (price to re-verify: docs/VERIFIED_FACTS.md research item #4). |
| **Consent/legal guidance shifts (EU)** | Moderate | Consent banner rework | Research item #8 recheck in Phase 5 (docs/VERIFIED_FACTS.md). |
| **No ads ever approved / revenue ~zero** | Possible | Aspirational goals unmet | Product survives: zero-cost architecture everywhere else; ads were always "cover costs", never the plan's backbone. |
