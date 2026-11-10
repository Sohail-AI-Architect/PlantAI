# PlantAI — Project Plan

> **Document:** PROJECT_PLAN.md · **Phase:** 0 (Planning & Documentation) · **Status:** Draft for user approval
> **Date:** 2026-11-10
>
> PlantAI is an AI-powered plant identification and plant-care platform: a responsive website + PWA that helps people identify plants from a photo and teaches them how to keep those plants healthy. Built with Next.js (App Router) + TypeScript (strict) + Tailwind CSS, backed by the Supabase Free Tier, powered by the Pl@ntNet API v2, and developed with a zero budget on Windows / VS Code / OpenCode.
>
> This document is the top-level plan. It is complemented by: ARCHITECTURE.md (system design), REQUIREMENTS.md (functional & non-functional requirements), DEVELOPMENT_ROADMAP.md (per-phase task breakdown), DATABASE_SCHEMA.md, API_DOCUMENTATION.md, UI_UX_DESIGN.md, SECURITY.md, MONETIZATION_PLAN.md, TESTING_PLAN.md, SEO_STRATEGY.md, TECH_STACK.md (if present), TASKS.md, ENVIRONMENT_SETUP.md, DEPLOYMENT_GUIDE.md, LEGAL_AND_COMPLIANCE.md, CONTENT_STRATEGY.md, AI_INTEGRATION_PLAN.md, CHANGELOG.md.
>
> **Facts rule:** every claim about third-party services (quotas, prices, terms) in this plan is either cited from `docs/VERIFIED_FACTS.md` or explicitly marked **UNVERIFIED**. Nothing about future revenue or AdSense approval is ever stated as guaranteed.

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Goals & Measurable Objectives](#2-goals--measurable-objectives)
3. [Scope: In / Out](#3-scope-in--out)
4. [Target Users & Platforms](#4-target-users--platforms)
5. [Feature List A–Z (Tiers & Phases)](#5-feature-list-az-tiers--phases)
6. [Development Phases & Milestones](#6-development-phases--milestones)
7. [Success Criteria](#7-success-criteria)
8. [Budget & Zero-Cost Commitments](#8-budget--zero-cost-commitments)
9. [Risks & Mitigations](#9-risks--mitigations)
10. [Non-Goals](#10-non-goals)

---

## 1. Project Vision

**Help people identify and care for plants.**

Anyone can take a photo of a plant and, within seconds, learn what it is, whether it is safe around pets, and how to water, light, feed, and repot it. PlantAI turns a single snapshot into practical care knowledge — with a carefully curated plant library, honest educational content (never fake AI claims), and a personal space where users track their own plants.

Two principles govern every decision:

- **Honesty over marketing** — we show Pl@ntNet confidence scores as estimates, we never promise disease diagnosis in the MVP, and we never invent prices, quotas, or guarantees.
- **Zero budget by design** — every infrastructure choice in the MVP costs €0. The first possible costs are documented, dated, and gated on real growth or monetization (Section 8).

## 2. Goals & Measurable Objectives

| # | Goal | Measurable objective | How measured | Phase |
|---|------|----------------------|--------------|-------|
| G1 | Fast, reliable identification | A common plant identified from a clear photo in **< 15 s** end-to-end (upload → results), excluding network conditions we do not control | Manual timing in TESTING_PLAN.md test ID matrix; later Web Vitals custom timing | 2 |
| G2 | Identification correctness | Top-3 Pl@ntNet results shown with confidence scores; a recognizable common plant (e.g. *Monstera deliciosa*, pothos, tomato) appears in top-3 for clear photos | Structured manual test set of ≥ 20 photos in TESTING_PLAN.md | 2 |
| G3 | SEO quality | **Lighthouse SEO score > 90** on `/`, `/identify`, `/library`, and a sample `/plant/[slug]` page | Lighthouse CI run per TESTING_PLAN.md | 3 |
| G4 | Core Web Vitals | LCP < 2.5 s and CLS < 0.1 on 4G-throttled mobile for the 4 key routes | Lighthouse / Speed Insights (Vercel Hobby includes 10K events/30d — `docs/VERIFIED_FACTS.md`) | 3+ |
| G5 | Zero infra cost in MVP | **Total infrastructure cost €0** from Phase 0 through MVP completion (Phases 0–3) | Ledger in MONETIZATION_PLAN.md §cost-events | 0–3 |
| G6 | Quota discipline | Pl@ntNet daily usage stays within 500 identifications/day with rate limits (5/day anonymous, 20/day authenticated, adjustable via `app_settings`) and image-hash dedup; zero "silent" quota burn | Quota counters + `remainingIdentificationRequests` headers (`docs/VERIFIED_FACTS.md`) logged server-side | 2 |
| G7 | Content library at MVP | ≥ 25 plant detail pages and care guides live, each with human-written (or AI-assisted, human-reviewed) care sections | Content log in CONTENT_STRATEGY.md | 3 |
| G8 | Accessibility | No WCAG 2.1 AA blocking issues on the 4 key routes (audit checklist in TESTING_PLAN.md) | Manual + axe scan | 3 |
| G9 | Usable offline-notation PWA foundation | App installable with proper metadata by Phase 6 (install prompts, offline shell for cached routes) | Lighthouse PWA checks | 6 |

Objectives G1–G8 are MVP targets. G9 is a Phase 6 target. Business goals (traffic, AdSense) are treated only as **aspirational**, not commitments — see Section 7 caveats.

## 3. Scope: In / Out

| Area | In scope | Out of scope (for now) |
|------|----------|------------------------|
| Platforms | Responsive website + installable PWA (Phase 6) | Native iOS; Android app shelved to Phase 7 via Capacitor |
| Identification | Photo upload → Pl@ntNet v2 top matches with confidence, common/scientific names, care summary; image-hash dedup cache; quota-aware UX | Disease/pest diagnosis from photos (**Phase 7 research only** — Pl@ntNet diseases route is BETA with limited coverage, `docs/VERIFIED_FACTS.md`); varieties route; multi-plant "1–5 images" expert use (returns supported server-side, UI stays 1 image) |
| Content | Plant library, care guides (watering, sunlight, soil, fertilizer), About/Contact/Privacy/Terms, blog (Phase 3 core / Phase 4 for admin moderation of it) | User-generated content, comments, forums |
| Personal features | Accounts, saved plants, My Plants, reminders, dashboard | Plant journal photos timeline, sharing/social features |
| Data | Supabase Postgres + Auth + minimal storage use | Email service (SMTP) beyond free Supabase built-in; analytics beyond free tiers |
| Monetization | Preparation only in Phases 0–4 (ad slot design, policy pages, ads.txt plan) — **no ads live before Phase 5 and only after content threshold + policy review (MONETIZATION_PLAN.md)** | Subscriptions, AdMob, paid APIs |
| Languages | English UI (single locale at MVP) | i18n / multi-language UI |

## 4. Target Users & Platforms

**Primary personas** (detailed in REQUIREMENTS.md §User requirements and UI_UX_DESIGN.md):

1. **Casual plant owner** — "What is this plant and will my cat get sick?" Wants a fast answer, plain language, pet-safety flag.
2. **Plant hobbyist** — owns 10–50 plants, wants reminders, a personal dashboard, and deeper care guides.
3. **Content researcher / SEO visitor** — arrives from Google at `/plant/[slug]` or a care-guide landing page; wants readable, well-structured content with clear headings and internal links into `/identify`.

**Platforms:** desktop and mobile browsers (latest 2 versions of Chrome, Firefox, Safari, Edge + Android Chrome — full matrix in REQUIREMENTS.md NFR-B-002); responsive layouts per UI_UX_DESIGN.md; PWA installation in Phase 6; future Android via Capacitor wrap in Phase 7 (same codebase, no rewrite).

## 5. Feature List A–Z (Tiers & Phases)

Tier mapping (canonical): **Tier 1** = MVP identification core · **Tier 2** = Content/SEO · **Tier 3** = Personal plant management · **Tier 4** = Monetization/PWA/production · **Tier 5** = Future. MVP = Phases 1–3.

| Feature | Description | Tier | Phase | Route(s) |
|---------|-------------|------|-------|----------|
| About page | Project story, honest "how identification works" explanation | 2 | 3 | `/about` |
| Admin architecture | `profiles.role = 'admin'`; protected `/admin` area for plant library & blog moderation, contact inbox, identifications abuse view | 3 (architecture in 2) | 4 | `/admin` |
| Auth | Supabase Auth: email/password + magic link (Google OAuth optional, Phase 4+) | 1 | 2 | `/login`, `/signup` |
| Blog | SEO content: plant care articles, project updates | 2 (publish)/3 (admin moderation) | 3 (core) / 4 (full admin) | `/blog`, `/blog/[slug]` |
| Care guides | Human-edited watering, sunlight, soil, fertilizer guidance per plant page | 2 | 3 | `/plant/[slug]` |
| Contact | Form → `contact_messages` table + admin inbox | 2 | 3 | `/contact` |
| Dashboard | Personal stats: plants owned, reminders due, identification history | 3 | 4 | `/dashboard` |
| Disease education | Educational guides on common symptoms/diseases — explicitly **not** photo-based diagnosis; no false AI claims | 2 | 3 | `/library` + guides |
| Identification flow | Upload → client+server validation (JPEG/PNG ≤ 10 MB) → server-side Pl@ntNet proxy → results; loading, quota-reached, and error states | 1 | 2 | `/identify` |
| Legal pages | Privacy Policy, Terms, Cookie Policy (linked in footer; prerequisite for future AdSense per `docs/VERIFIED_FACTS.md`) | 2 | 3 | `/privacy`, `/terms`, `/cookie-policy` |
| Monetization ads | AdSense slots designed but unpopulated until Phase 5 gates pass | 4 | 5 | site-wide slots |
| My Plants | User's plant collection: nickname, watering notes, reminder links | 3 | 4 | `/my-plants` |
| PWA | Installable app, offline shell for cached routes, manifest + service worker | 4 | 6 | site-wide |
| Plant Library | Browsable/searchable catalog with `?q=` search; only published rows public | 2 | 3 | `/library` |
| Plant detail page | Scientific + common names, family, care summary, gallery (with CC-BY-SA attribution), internal links | 2 | 3 | `/plant/[slug]` |
| Premium subscription | (Future) ad-free tier / supporter plan | 5 | 7 | — |
| Reminders | CRUD care reminders (watering/fertilizing) + due list | 3 | 4 | `/reminders` |
| Results display | Top matches with confidence bars, images with attribution, "is this plant toxic?" flag where data allows, care summary card | 1 | 2 | `/identify` (result view) |
| Saved Plants | Bookmark plants from results/library | 3 | 4 | `/saved-plants` |
| SEO landing pages | Long-tail keyword pages driven by SEO_STRATEGY.md keyword map (e.g. "how often to water monstera") | 2 | 3–4 | `/plant/[slug]`, `/blog/[slug]` |
| Upload experience | Drag & drop, camera capture on mobile, client-side compression/validation | 1 | 2 | `/identify` |
| Account page | Profile view/edit, delete-account affordance (GDPR-aware; see LEGAL_AND_COMPLIANCE.md) | 3 | 4 | `/account` |

## 6. Development Phases & Milestones

Canonical phases (details, task breakdowns, and exit criteria in DEVELOPMENT_ROADMAP.md):

| Phase | Name | Summary | Milestone | Milestone deliverables | Exit criteria (summary) |
|-------|------|---------|-----------|------------------------|--------------------------|
| 0 | Planning & Documentation | The 18 planning docs including this one | **M0 — Planning complete** | PROJECT_PLAN, REQUIREMENTS, ARCHITECTURE, DATABASE_SCHEMA, API_DOCUMENTATION, UI_UX_DESIGN, SEO_STRATEGY, SECURITY, TESTING_PLAN, TASKS, MONETIZATION_PLAN, ENVIRONMENT_SETUP, DEPLOYMENT_GUIDE, LEGAL_AND_COMPLIANCE, CONTENT_STRATEGY, AI_INTEGRATION_PLAN, CHANGELOG, DEVELOPMENT_ROADMAP + docs/VERIFIED_FACTS.md | All 18 docs exist, mutually consistent, user approved |
| 1 | Environment & Project Scaffold | Node/Git/VS Code env; Next.js + TS strict + Tailwind scaffold; Supabase project; repo layout; CI-lite | **M1 — Hello PlantAI deployed** | Scaffolded repo, deployed skeleton on Vercel, env vars wired | `npm run dev` clean; deploy previews pass; DATABASE_SCHEMA.md implemented as migration 0001 (profiles skeleton) |
| 2 | MVP Identification | Upload → identify → results; auth; rate limits; dedup cache | **M2 — Identify & sign up** | `/identify` end-to-end with QuotaUI, `/login`, `/signup` | G1/G2/G6 met; Pl@ntNet attribution rendered; graceful quota state demo-able |
| 3 | Content & SEO | Plant library, plant pages, care guides, static pages, blog publish, SEO | **M3 — MVP!** | ≥ 25 plant pages, 4 static pages, blog shell | G3/G7/G8 met; sitemap+robots+structured data live; MVP definition satisfied |
| 4 | Personal Plant Management | My Plants, Saved, Reminders, Dashboard, `account`, admin moderation | **M4 — Personal plant manager** | Tier-3 features + admin panel | CRUD flows pass TESTING_PLAN.md; RLS re-audited by SECURITY.md checklist |
| 5 | Production Deployment & Monetization Prep | Hosting decision (upgrade vs migrate), content threshold check, ad slots, cookie consent | **M5 — Productionized** | Production-ready config, monetization go/no-go decision documented | Ads enabled **only if** gates pass; cost ledger updated; hosting compliant (Vercel Pro or migrated host — VERIFIED in Phase 5) |
| 6 | PWA & Launch Hardening | Manifest, service worker, install UX, perf hardening, final QA | **M6 — Launch** | Installable PWA, hardening pass | G9 met; launch checklist in DEPLOYMENT_GUIDE.md complete |
| 7 | Future | Android (Capacitor + Google Play $25 one-time — verify first), AdMob, premium, disease-beta research | **M7 — Platform expansion** | Per-feature decisions | Each future feature re-planned with own mini-doc before build |

## 7. Success Criteria

**Technical**

- All MVP routes score Lighthouse SEO > 90 (G3); LCP < 2.5 s mobile (G4).
- TypeScript strict with zero `any` escapes in committed code (lint config per ARCHITECTURE.md).
- Rate limiting and dedup demonstrably prevent quota burn even when machine-gun testing occurs (G6).
- No secret ever reaches the client bundle; `NEXT_PUBLIC_`-free Pl@ntNet key (SECURITY.md).

**Product**

- A first-time visitor can complete an identification in under 15 s with no account (G1), and can sign up without leaving the results flow.
- A Persona-1 user can answer "is this pet-safe / how do I water it?" from a single plant page (G7-supported).
- Quota-reached and offline/error states are designed, reviewable in UI_UX_DESIGN.md, and reachable in a demo.

**Business — with honest caveats**

- Business "success" during Phases 0–4 is defined as: zero infra spend preserved (G5) and monetization readiness (policy pages, ad slots, cookie consent plan) — **not** as revenue.
- **AdSense approval is discretionary and NOT guaranteed; revenue is NOT guaranteed and may be zero.** Google publishes no minimum traffic/content threshold; the most common rejection reason is "low value content" (`docs/VERIFIED_FACTS.md` §Google AdSense). MONETIZATION_PLAN.md tracks the go/no-go gates.
- Any future milestone involving money requires explicit user approval.

## 8. Budget & Zero-Cost Commitments

**Current state: every line item costs €0.** Sources: `docs/VERIFIED_FACTS.md` (verified 2026-11-10).

| Component | MVP cost | Future first-cost event |
|-----------|----------|--------------------------|
| Hosting — Vercel Hobby | €0 | **$20/month** if we run AdSense/premium without migrating (non-commercial limit!). Alternative: verify Netlify/Cloudflare Pages free commercial use in Phase 5 (**UNVERIFIED** today) |
| Database/Auth — Supabase Free | €0 | **from $25/month** if growth demands (500 MB DB / 5 GB egress / 50K MAU caps, ~1 week inactivity pausing) |
| Identification — Pl@ntNet Free | €0 (500/day; errors also consume quota) | Paid Pro plan only if > 500/day ever needed — price **must be re-verified** at decision time |
| Frameworks & tools | €0 (Next.js, React, TypeScript, Tailwind, OpenCode — MIT/open) | — |
| Android (Phase 7) | — | **$25 one-time** Google Play Console fee (**UNVERIFIED for 2026** — verify before purchase) |
| Domain | — | Optional; **no purchase assumed** in MVP; if purchased, it is the first user-approved cost and goes in the ledger & CHANGELOG.md |

Zero-budget rules (canonical, restated): no paid dependency without user approval; never invent prices; "free in development" ≠ "free at scale" — commercial-use limits are documented per service in LEGAL_AND_COMPLIANCE.md and MONETIZATION_PLAN.md.

## 9. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| R1 | Pl@ntNet 500/day quota exhausted (burst traffic, errors also burn quota) | Medium | Identification down until midnight UTC reset | Client+server upload validation (JPEG/PNG ≤ 10 MB); per-IP/user limits (5/20 per day, tunable via `app_settings`); image-hash dedup; HTTP 429-aware graceful UI (`/identify` "quota reached" state); quota counters logged; AI_INTEGRATION_PLAN.md holds the failure-mode matrix |
| R2 | Vercel Hobby commercial-use violation (ads on Hobby breach ToS) | High **if** ads enabled without action | Deployment disabled without notice | Hard rule: no AdSense/premium until Phase 5 gate passes with either Vercel Pro **or** a verified migration target (Netlify/Cloudflare — currently UNVERIFIED); MONETIZATION_PLAN.md owns the go/no-go |
| R3 | Supabase free project paused after ~1 week inactivity | Medium | "Down"-looking errors, confusing dev days | A few real requests/day keeps it warm (not guaranteed); dev session start = health-check + manual SQL dump reminder (no automatic backups on Free — `docs/VERIFIED_FACTS.md`); DEPLOYMENT_GUIDE.md checklist |
| R4 | SEO ramp-up slow — cold-start library traffic is near zero | High | Perceived failure though product works | SEO_STRATEGY.md keyword-first content plan (≥ 25 pages by M3), sitemap, structured data, internal linking; success measured by G3/G4 during MVP, traffic targets treated as later-stage indicators only |
| R5 | AdSense rejection ("low value content") or near-zero revenue | Medium–High | Phase 5 plan yields nothing | Content threshold gate before applying; never claim guaranteed approval/revenue anywhere (docs/legal/UI); fallback: keep site ad-free and treat as portfolio project |
| R6 | Single developer (human + AI agents) capacity in evenings/weekends | High | Slipped phases | Rough complexity sizing M/S/L per task (DEVELOPMENT_ROADMAP.md), MVP cut to smallest demo-able slice, phases sequenced for an always-deployable repo; no fake dates — relative estimates only |
| R7 | Third-party image licensing slip (CC-BY-SA) on results/library images | Low | Legal correctness issue | Display attribution + license notice wherever Pl@ntNet images render (canonical decision #9); verify "Using images" rules in Phase 2 (`docs/VERIFIED_FACTS.md` pending item 3) |
| R8 | Disease-detection over-promise by AI-written copy | Medium | Trust/legal harm | Canonical decision #10: MVP ships only human-written disease *education*; disease photo-diagnosis deferred to Phase 7 research; copy review checklist in CONTENT_STRATEGY.md |

## 10. Non-Goals

1. **No fake AI claims.** Identification results are Pl@ntNet model outputs with confidence scores — presented as estimates, never as certainty; no fabricated "advanced AI" marketing.
2. **No disease-diagnosis promise in the MVP.** The Pl@ntNet diseases route is BETA with limited species/pathology coverage (`docs/VERIFIED_FACTS.md`); MVP ships educational disease content only. Disease photo-diagnosis is Phase 7 research.
3. **No paid APIs or paid dependencies in Phases 0–4** without documented user approval.
4. **No social network features** (comments, follows, public profiles) in the MVP.
5. **No native iOS builds**; no App Store presence assumed.
6. **No guaranteed-revenue claims** anywhere in the product, docs, or legal pages.
7. **No user-uploaded-plant photo storage at scale in MVP** — identification images are processed server-side (hash cached, metadata minimal); bulk permanent hosting of user photos stays out of MVP scope to protect the 1 GB Supabase storage cap.

---

*Change management: edits to this plan's canonical decisions require a CHANGELOG.md entry; stack or hosting changes additionally require updating ARCHITECTURE.md and explicit user approval (see DEVELOPMENT_ROADMAP.md §Change management).*
