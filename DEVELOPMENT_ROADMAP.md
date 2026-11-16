# PlantAI — Development Roadmap

> **Document:** DEVELOPMENT_ROADMAP.md · **Phase:** 2 complete (implementation 2026-11-11/12; report: `PHASE_2_COMPLETION_REPORT.md`) · **Status:** awaiting owner review + Phase 3 approval gate
>
> Per-phase execution plan for Phases 0–7: goals, prerequisites, numbered task breakdowns (with REQUIREMENTS.md IDs and ARCHITECTURE.md component references), dependencies, S/M/L complexity, exit criteria, explicit exclusions, first-session guidance, dependency graph, assumptions, per-phase risk register, and change management.
>
> Complexity scale: **S** = hours (one evening), **M** = a couple of evenings, **L** = several sessions / a weekend+. Estimates are **relative, no calendar dates** (solo developer + AI agents, evenings/weekends cadence).
>
> Sibling docs: PROJECT_PLAN.md · REQUIREMENTS.md (IDs like FR-ID-002/NFR-S-001) · ARCHITECTURE.md · DATABASE_SCHEMA.md · API_DOCUMENTATION.md · UI_UX_DESIGN.md · SEO_STRATEGY.md · SECURITY.md · MONETIZATION_PLAN.md · TESTING_PLAN.md · TASKS.md · CONTENT_STRATEGY.md · AI_INTEGRATION_PLAN.md · ENVIRONMENT_SETUP.md · DEPLOYMENT_GUIDE.md · LEGAL_AND_COMPLIANCE.md · CHANGELOG.md · docs/VERIFIED_FACTS.md.

---

## Table of Contents

1. [Roadmap Overview](#1-roadmap-overview)
2. [Phase 0 — Planning & Documentation](#2-phase-0--planning--documentation)
3. [Phase 1 — Environment & Project Scaffold](#3-phase-1--environment--project-scaffold)
4. [Phase 2 — MVP Identification](#4-phase-2--mvp-identification)
5. [Phase 3 — Content & SEO (MVP completion)](#5-phase-3--content--seo-mvp-completion)
6. [Phase 4 — Personal Plant Management](#6-phase-4--personal-plant-management)
7. [Phase 5 — Production Deployment & Monetization Prep](#7-phase-5--production-deployment--monetization-prep)
8. [Phase 6 — PWA & Launch Hardening](#8-phase-6--pwa--launch-hardening)
9. [Phase 7 — Future](#9-phase-7--future)
10. [First Development Session of Phase 2 (Day-1 guidance)](#10-first-development-session-of-phase-2-day-1-guidance)
11. [Dependency Graph](#11-dependency-graph)
12. [Complexity & Schedule Assumptions](#12-complexity--schedule-assumptions)
13. [Risk Register per Phase](#13-risk-register-per-phase)
14. [Change Management](#14-change-management)

---

## 1. Roadmap Overview

```
Phase   0        1        2        3        4        5        6        7
Name    Docs     Setup    Identify Content  Personal Production PWA    Future
                 & Build  (MVP core)& SEO    Mgmt     & Money  & Launch (Cap/Ads)
Milestone M0 ---- M1 ----- M2 ----- M3=MVP-- M4 ----- M5 ----- M6 ----- M7
                  └───────── MVP scope (Phases 1–3) ──────────┘
Cost    €0     €0      €0       €0      €0      €0*     €0*     gated*
                                                            * unless growth/monetization gates pass
                                                            (see §7, §Budget ledger in MONETIZATION_PLAN.md)
```

Key rule: the repo is expected to be deployable at the end of every phase (vertical slices over big-bang integration).

## 2. Phase 0 — Planning & Documentation

- **Goal:** produce the complete, mutually consistent planning documentation set; nothing is coded.
- **Prerequisites:** none. (Research baseline: docs/VERIFIED_FACTS.md verified 2026-11-10.)

| # | Task | Depends on | Ref IDs | Size |
|---|------|-----------|---------|------|
| 0.1 | Write PROJECT_PLAN.md (vision, goals, scope, AAA feature table, milestones, risks, budget) | 0.14 verified facts | — | M |
| 0.2 | Write REQUIREMENTS.md (FR/NFR/user/admin/business/technical + acceptance criteria) | 0.1 | FR-*, NFR-* | M |
| 0.3 | Write ARCHITECTURE.md (system design, route/handler map per canonical URL set, rendering strategy, Server Actions vs Route Handlers split) | 0.2 | FR-TEC-003/006 | M |
| 0.4 | Write DATABASE_SCHEMA.md (all 9 canonical tables + identification_cache, columns, FKs, RLS policies) | 0.3 | FR-TEC-004, NFR-S-002 | M |
| 0.5 | Write API_DOCUMENTATION.md (internal routes + Pl@ntNet v2 contract incl. 429/error flows, headers, attribution) | 0.3, VERIFIED_FACTS | FR-ID-001..008 | M |
| 0.6 | Write UI_UX_DESIGN.md (screens, states incl. loading/quota/degraded, breakpoints, component inventory) | 0.2 | FR-UP-*, FR-RES-*, NFR-B-002 | M |
| 0.7 | Write SEO_STRATEGY.md (keyword map, URL mapping, sitemap/robots/structured-data plan) | 0.1 | FR-SEO-* | M |
| 0.8 | Write SECURITY.md (secrets, RLS, rate limiting design, admin bootstrap procedure) | 0.4, 0.5 | NFR-S-* | M |
| 0.9 | Write TESTING_PLAN.md (manual/automated matrix mapped to AC-* IDs) | 0.2 | AC-* | S |
| 0.10 | Write TASKS.md (task list with FR/NFR traceability, ordered per this roadmap) | 0.2, 0.11 | traceability §12 | S |
| 0.11 | Write MONETIZATION_PLAN.md (cost ledger, AdSense gates, hosting escalation options) | 0.1, VERIFIED_FACTS | FR-MON-*, FR-BIZ-005 | M |
| 0.12 | Write ENVIRONMENT_SETUP.md (Windows/VS Code/OpenCode setup, env var how-to, commands) | 0.3 | FR-TEC-002/005 | S |
| 0.13 | Write DEPLOYMENT_GUIDE.md (Vercel deploy, preview flow, env hygiene, Supabase pause checklist) | 0.11, 0.12 | FR-PROD-001 | S |
| 0.14 | Write/dedupe VERIFIED_FACTS.md (this exists; keep it the single fact source) | — | — | S |
| 0.15 | Write LEGAL_AND_COMPLIANCE.md (GDPR data inventory, commercial-use limits, attribute/citation policy) | 0.14 | NFR-PR-*, FR-BIZ-002/003 | M |
| 0.16 | Write CONTENT_STRATEGY.md (plant page template, care-guide sections, honest-AI copy rules) | 0.7 | FR-LIB-003/004 | M |
| 0.17 | Write AI_INTEGRATION_PLAN.md (Pl@ntNet flow, cache, failure matrix, quota budget model) | 0.5, 0.4 | FR-ID-*, AI_INTEGRATION_PLAN | M |
| 0.18 | Create DEVELOPMENT_ROADMAP.md (this document) | 0.1–0.17 | — | M |
| 0.19 | Create CHANGELOG.md and record the Phase 0 doc set | all | — | S |
| 0.20 | **Documentation audit (2026-11-10):** verify all 18 docs + facts file exist; structure completeness check; factual-accuracy check (citations + UNVERIFIED flags); cross-document consistency check; MVP-scope check; results recorded in `PHASE_1_AUDIT_REPORT.md` | 0.1–0.19 | — | S |

**Audit outcome (2026-11-10):** PASSED — 19/19 files verified, 0 missing documents; factual rules upheld (500/day Pl@ntNet cap, error-consumes-credit, Vercel Hobby non-commercial clause, Supabase 1-week pause, AdSense no-guarantee language all present and consistently cited to `docs/VERIFIED_FACTS.md`); MVP scope matches the approved 10-item list; no unresolved contradictions requiring owner arbitration were found. Full detail: `PHASE_1_AUDIT_REPORT.md`.

**Exit criteria (M0):** all 18 planning docs exist (PROJECT_PLAN, REQUIREMENTS, ROADMAP, ARCHITECTURE, DATABASE_SCHEMA, API_DOCUMENTATION, UI_UX_DESIGN, SEO_STRATEGY, SECURITY, TESTING_PLAN, TASKS, MONETIZATION_PLAN, ENVIRONMENT_SETUP, DEPLOYMENT_GUIDE, LEGAL_AND_COMPLIANCE, CONTENT_STRATEGY, AI_INTEGRATION_PLAN, CHANGELOG) + docs/VERIFIED_FACTS.md; cross-references resolve; canonical decisions #1–#11 respected everywhere; documentation audit completed with report (`PHASE_1_AUDIT_REPORT.md`); **explicit user approval** of the doc set.
**Explicitly NOT in Phase 0:** any code, scaffolding, sign-ups beyond Supabase research, or doc-looking code snippets presented as implementation.

## 3. Phase 1 — Environment & Project Scaffold

- **Goal:** clean, deployed skeleton: Next.js + TS strict + Tailwind + Supabase connection, canonical folder layout, canonical URL routes stubbed.
- **Prerequisites:** M0 (user-approved docs); local tools installed per ENVIRONMENT_SETUP.md.

| # | Task | Depends on | Ref IDs | Size |
|---|------|-----------|---------|------|
| 1.1 | Install/verify Node LTS (verify current LTS live — **UNVERIFIED** at planning time), Git, VS Code, OpenCode per ENVIRONMENT_SETUP.md | — | FR-TEC-002 | S |
| 1.2 | Scaffold Next.js App Router + TypeScript (strict) + Tailwind project (exact commands live in ENVIRONMENT_SETUP.md, not here) | 1.1 | FR-TEC-001 | S |
| 1.3 | Establish folder structure per ARCHITECTURE.md (`app/(routes)`, lib, components, supabase) and shared layout/footer with canonical nav links | 1.2 | FR-TEC-006 | S |
| 1.4 | Create Supabase project; apply migration 0001 from DATABASE_SCHEMA.md (profiles, app_settings first slice); configure auth providers (email/password + magic link) | 1.2 | FR-TEC-004, FR-AUTH-* | M |
| 1.5 | Env vars wiring per FR-TEC-005 list (values only in ENVIRONMENT_SETUP.md); server/client separation enforced | 1.4 | NFR-S-001 | S |
| 1.6 | Stub all canonical routes (canonical decision #7) with minimal pages + footer links | 1.3 | FR-TEC-006 | S |
| 1.7 | Lint/format config (TS strict, ESLint, Prettier), CI-lite (typecheck + lint on push) | 1.2 | NFR-B-003 | S |
| 1.8 | First Vercel deploy (Hobby) + preview flow verification per DEPLOYMENT_GUIDE.md | 1.5 | FR-PROD-001 (preview slice) | S |

**Phase 1 implementation record (2026-11-10):** tasks 1.1–1.3, 1.5–1.7 complete
(Next **16.4.6** / React 19.3 / Tailwind **4.3.3** / TypeScript strict / ESLint 9
+ Prettier; **20 canonical route stubs** live; layout header/footer + design
tokens in place; `.env.example` + Supabase client factories with
server/client key separation). Task 1.4 is **prepared but NOT applied** — the
five migration files live in `supabase/migrations/` with an owner
verification checklist in `supabase/README.md`; **no database connection has
been tested from the app**. Task 1.8 (first Vercel deploy) remains an owner
action by design. Full results: `PHASE_1_COMPLETION_REPORT.md`.

**Exit criteria (M1):** skeleton deployed; `npm run dev` & preview deploys clean; stubs of all URLs return 200; Supabase reachable; lint/typecheck pass; docs updated (CHANGELOG entry).
**NOT in Phase 1:** identification logic, auth UI flows beyond enabling providers, content authoring.

## 4. Phase 2 — MVP Identification

- **Goal:** end-to-end identification (upload → proxy → results) with auth and quota protection — the product core.
- **Prerequisites:** M1.

| # | Task | Depends on | Ref IDs | Size |
|---|------|-----------|---------|------|
| 2.1 | `/identify` upload UI per UI_UX_DESIGN.md: picker + camera, drag&drop, client validation | 1.6 | FR-UP-001..003, 005 | M |
| 2.2 | `/api/identify` Route Handler: server validation, streaming proxy to Pl@ntNet v2 (subset: 1 image), typed errors; key server-only | 2.1 scaffold | FR-ID-001, FR-UP-004, NFR-S-001 | L |
| 2.3 | Rate limiting (anon 5/user 20 per day; `app_settings`-driven) + counters storage | 2.2, 1.4 | FR-ID-002/007 | M |
| 2.4 | Image-hash dedup cache (+ `identification_cache` if adopted) | 2.2 | FR-ID-003 | M |
| 2.5 | Auth flows: signup, verify, magic link, reset, logout, profile trigger, header state | 1.4 | FR-AUTH-001..007 | M |
| 2.6 | Results UI: top-3 + confidence bars + images/attributions + care summary slot + save nudge | 2.2 | FR-RES-001..006 | M |
| 2.7 | State design implementation: loading, quota-reached (internal + Pl@ntNet 429), degraded/error (AI_INTEGRATION_PLAN matrix) | 2.2–2.4 | FR-ID-004..006, NFR-R-001 | M |
| 2.8 | Attribution component (Pl@ntNet sentence + "Powered by Pl@ntNet" + CC-BY-SA captions) reused sitewide | 2.6 VERIFIED_FACTS | FR-ID-008, FR-BIZ-002 | S |
| 2.9 | Verify Pl@ntNet image-reuse rules (docs/VERIFIED_FACTS.md pending #3) & lock citation format — **✅ DONE via Stage A1 (2026-11-12):** "Using images" doc verified — CC BY-SA is the documented reusable case (Attribution + ShareAlike, pattern `Photo(s): [Contributor] / Pl@ntNet, CC BY-SA`); display rule = only show images whose returned `license` is documented-reusable (`API_DOCUMENTATION.md` §2.8, `LEGAL_AND_COMPLIANCE.md` §7); license normalization is a flagged future-work item in `TASKS.md` | 2.8 | FR-RES-004 | S |
| 2.10 | Minimal `/plant/[slug]` renderer for seeded demo plants (full library in Phase 3) | 2.6, 1.4 | FR-PLANT-001..003 | S |
| 2.11 | TESTING_PLAN.md Phase-2 cases executed (incl. 429 simulation & dedup replay) | all | AC-UP/FL/RE-* | M |

**Exit criteria (M2):** G1/G2/G6 met on real device & desktop; every designed state reachable; no raw errors; attribution visible; abuse counters logged; downloads stay within Vercel Hobby caps; CHANGELOG updated.
**NOT in Phase 2:** full plant library/search, static legal pages, blog, disease education copy, reminders.

**Day-1 of Phase 2 (first development session) — see §10 for the ordered checklist.**

## 5. Phase 3 — Content & SEO (MVP completion)

> **Numbering note (2026-11-12):** the owner's stage plan redefines "Phase 3" as **live Pl@ntNet
> integration (stages A–H, recorded in `TASKS.md`)**; this section keeps the historical
> "Phase 3 = Content & SEO" numbering and its tasks unchanged. Live-identification stages are
> tracked separately in `TASKS.md` (stages A–H), with gates B (provider code), F (persistence —
> separate owner approval), G (one authorized live smoke), H (production activation — owner only).

- **Goal:** fill the content frame: library, plant pages with care guides, static pages, blog shell, SEO plumbing → **MVP = M3**.
- **Prerequisites:** M2.

| # | Task | Depends on | Ref IDs | Size |
|---|------|-----------|---------|------|
| 3.1 | Migrate full DATABASE_SCHEMA.md (plant_library, blog_posts, contact_messages + RLS policies) | 1.4 | FR-TEC-004, NFR-S-002 | M |
| 3.2 | `/library` list + `?q=` search + pagination (published-only RLS-proven) | 3.1 | FR-LIB-001/002 | M |
| 3.3 | Full `/plant/[slug]` page template per CONTENT_STRATEGY.md (care sections, gallery, structured data) | 3.1 | FR-LIB-003, FR-PLANT-003 | M |
| 3.4 | Seed authoring pass: ≥ 25 plants + care guides (human-written or AI-assisted w/ human review per CONTENT_STRATEGY.md) | 3.3 | FR-LIB-003 | L |
| 3.5 | Static pages `/about` `/contact` `/privacy` `/terms` (+ cookie-policy page shell) with Server Action contact form + honeypot | 1.6 | FR-SEO-001, FR-CNT-001 | M |
| 3.6 | `/blog` + `/blog/[slug]` publishing shell (authoring via admin arrives Phase 4; seed 2–3 posts) | 3.1 | FR-SEO-003 | S |
| 3.7 | SEO plumbing: sitemap.xml, robots.txt, canonical, structured data (JSON-LD), internal linking pass, 404 page | 3.3 | FR-SEO-002, AC-LIB-2 | M |
| 3.8 | SEO landing-page pattern applied (SEO_STRATEGY.md keyword map) | 3.4, 3.7 | FR-SEO-LP-001 | M |
| 3.9 | Lighthouse & a11y audit + fixes (G3/G8) | 3.3–3.7 | AC-NFR-1/2 | M |
| 3.10 | MVP rehearsal: full funnel walkthrough incl. quota state; docs/CHANGELOG sweep; MONETIZATION_PLAN.md readiness note | all | AC-NFR, FR-MON "ready" | S |

**Exit criteria (M3 — MVP!):** ≥ 25 published plant pages; 4 static pages live; blog shell live; Lighthouse SEO > 90 on key routes; a11y blocking issues fixed; TESTING_PLAN §MVP fully green; PROJECT_PLAN.md G5 intact (€0); **user accepts MVP**.
**NOT in Phase 3:** reminders/dashboard/admin UI (Phase 4), ads (no slot can show ad JS), PWA install (Phase 6).

## 6. Phase 4 — Personal Plant Management

- **Goal:** turn MVP into a personal tool: collections, reminders, dashboard, admin moderation.
- **Prerequisites:** M3.

| # | Task | Depends on | Ref IDs | Size |
|---|------|-----------|---------|------|
| 4.1 | Migrate user tables (user_plants, saved_plants, care_reminders) + RLS | 3.1 | FR-TEC-004 | M |
| 4.2 | `/my-plants` CRUD + nickname/notes | 4.1 | FR-MP-001 | M |
| 4.3 | `/saved-plants` bookmark flows wired to results & library | 4.1 | FR-SP-001 | S |
| 4.4 | `/reminders` CRUD + due computation | 4.1 | FR-REM-001/002 | M |
| 4.5 | `/dashboard` stats + due list | 4.2–4.4 | FR-DASH-001 | M |
| 4.6 | `/account` profile + logout + deletion-request path | 2.5 | FR-ACC-001 | S |
| 4.7 | Admin: role bootstrap SQL (SECURITY.md), guarded `/admin` shell | 3.1 | FR-ADMIN-001/006 | M |
| 4.8 | Admin moderation: plant library & blog publish/unpublish + contact inbox + identifications abuse view | 4.7, 2.3 | FR-ADMIN-002..005 | L |
| 4.9 | Optional: Google OAuth (explicit choice, default skip) | 2.5 | FR-FUT-005 | S |
| 4.10 | RLS re-audit + TESTING_PLAN §4 execution | all | AC-NFR-4 | M |

**Exit criteria (M4):** all Tier-3 flows pass tests; RLS re-audited; admin cannot be reached by `role='user'`; CHANGELOG updated.
**NOT in Phase 4:** monetization, PWA, Android.

## 7. Phase 5 — Production Deployment & Monetization Prep

- **Goal:** productionize; make the hosting-vs-monetization decision **before** enabling any ad; gate on content threshold. All hosting/legal claims freshly verified this phase.
- **Prerequisites:** M3 (M4 recommended but issuer order can swap by user choice).

| # | Task | Depends on | Ref IDs | Size |
|---|------|-----------|---------|------|
| 5.1 | Verify & record: Netlify/Cloudflare Pages free-tier commercial allowances (VERIFIED_FACTS pending #1, #2) | — | FR-MON-001 | S |
| 5.2 | Content-threshold check vs MONETIZATION_PLAN.md gates (traffic optional, content mandatory — no invented minimums per VERIFIED_FACTS) | blog/library live | FR-MON gates | S |
| 5.3 | Hosting decision: Vercel Pro **$20/mo** vs migration — documented and user-approved; execute chosen path | 5.1 | canonical #1, FR-PROD-001 | M |
| 5.4 | Cookie-consent implementation + ad-slot components (empty until activation) | 5.3 | FR-MON-001/002 | M |
| 5.5 | AdSense submission (only if 5.2/5.3 pass) — **no promises of approval** | 5.4 | FR-BIZ-001 | S |
| 5.6 | ads.txt post-approval only | 5.5 | FR-MON-003 | S |
| 5.7 | Production hardening: env rotation, error monitoring (free tier), backup habit (manual SQL dumps — no auto backups on Free per VERIFIED_FACTS) | 5.3 | FR-PROD-001 | M |
| 5.8 | Cost ledger update; Supabase upgrade decision if caps near (from $25/mo) | 5.3 | FR-BIZ-005 | S |

**Exit criteria (M5):** hosting state compliant & documented; ads either live-after-approval or consciously deferred; ledger current; no ToS exposure remains.
**NOT in Phase 5:** AdMob/premium builds (Phase 7), PWA (Phase 6).

## 8. Phase 6 — PWA & Launch Hardening

- **Goal:** installable, resilient, fast — ready to "launch" publicly.
- **Prerequisites:** M3 (M5 recommended).

| # | Task | Depends on | Ref IDs | Size |
|---|------|-----------|---------|------|
| 6.1 | Manifest, icons, maskable art, theme colors | 3.7 | FR-PWA-001 | S |
| 6.2 | Service worker: offline shell for cached routes; cache strategy per ARCHITECTURE.md | 6.1 | FR-PWA-001 | M |
| 6.3 | Install prompt UX with dismissal memory | 6.1 | FR-PWA-002 | S |
| 6.4 | Performance hardening pass (bundle split, image audit) | all | NFR-P-* | M |
| 6.5 | Full regression per TESTING_PLAN.md + cross-browser matrix (NFR-B-001) + device PWA checks | all | AC-NFR-* | M |
| 6.6 | Launch checklist execution (DEPLOYMENT_GUIDE.md) + docs consistency sweep | all | — | S |

**Exit criteria (M6):** Lighthouse PWA checks pass (G9); offline shell works on cached routes; regression suite green; **launch approved by user**.

## 9. Phase 7 — Future

Decisions made per-feature with a mini-doc before build (each has its own verification pass against docs/VERIFIED_FACTS.md):

| # | Item | Gate | Size |
|---|------|------|------|
| 7.1 | Android via Capacitor | Verify Google Play $25 one-time (**UNVERIFIED**) + Play policies | M–L |
| 7.2 | AdMob | Verify 2026 policies; only in Android builds (site stays AdSense/consent-managed) | M |
| 7.3 | Premium subscription | Requires paid-capable hosting state + payment flow decision (new cost) | L |
| 7.4 | Pl@ntNet diseases BETA research | Beta-coverage disclaimer; explore `/v2/diseases` routes; never marketed as diagnosis (canonical #10) | M |
| 7.5 | Google OAuth | Reuse Supabase provider; trivial sized | S |

## 10. First Development Session of Phase 2 (Day-1 guidance)

Ordered checklist for an AI coding agent on the first Phase 2 session (working session 1 of maybe 3–4 for M2):

1. Read docs: ARCHITECTURE.md, API_DOCUMENTATION.md, AI_INTEGRATION_PLAN.md, DATABASE_SCHEMA.md, SECURITY.md, UI_UX_DESIGN.md (identify screens), REQUIREMENTS.md §1.2–1.4 (command/setup instructions live in ENVIRONMENT_SETUP.md — do not invent commands).
2. Verify environment: typecheck + dev server run; confirm env vars present per FR-TEC-005 (values sourced from ENVIRONMENT_SETUP.md).
3. Build in this order (explicit dependencies, each lands as a working vertical slice):
   1. `/identify` static shell + upload widget with **client validation** (FR-UP-001..003) — no API call yet.
   2. Server upload validation path + fake handler returning a fixture so the UI state machine (loading) is testable.
   3. Route Handler `/api/identify` real proxy (FR-ID-001) with strict MIME/size gate first (FR-UP-004) — **this ordering is deliberate: validation before Pl@ntNet call so bad requests never reach/quota-burn the upstream** (`docs/VERIFIED_FACTS.md`: errors consume quota on the free plan).
   4. Typed error mapping + loading/degraded states (FR-ID-004/006) with the AI_INTEGRATION_PLAN.md failure matrix.
   5. Rate-limit counter store + enforcement (FR-ID-002/007) reading `app_settings`.
   6. Dedup cache (FR-ID-003).
   7. Results UI (FR-RES-001..006) + attribution component (FR-ID-008).
   8. Quota-reached UI states for both internal limit and upstream HTTP 429 (FR-ID-005), incl. "resets at midnight UTC" copy.
4. Record first Pl@ntNet live result; log `remainingIdentificationRequests` header handling; note surprises in docs/VERIFIED_FACTS.md research notes (e.g. bump pending #3 to verified if image rules are checked).
5. Update TASKS.md checkboxes + CHANGELOG.md; leave the repo deployable.

## 11. Dependency Graph

```
M0 (docs) ──► M1 (scaffold) ──► M2 (identify) ──► M3 (content/SEO = MVP!)
                                   │                │
                                   ├── 2.3 rate ────┤ (admin abuse view reuse)
                                   └── 2.4 dedup    │
                                                    ▼
                                        M4 (personal mgmt) ──► M5 (production/$$ gate)
                                                                  │
                                                  M6 (PWA launch)─┤
                                                                  ▼
                                                             M7 (future: Android, AdMob,
                                                               premium, diseases beta)

Within M2: 2.2 ──► 2.3/2.4 ──► 2.5 (auth can run parallel) ──► 2.6 ──► 2.7/2.8 ──► 2.11
Within M5: 5.1 ──► 5.2 ──► 5.3 ──► 5.4 ──► (5.5 ──► 5.6) only if ads chosen
Critical path to MVP: 0 → 1 → 2.2 → 2.6 → 3.1 → 3.3 → 3.4 → 3.7 → 3.10
```

## 12. Complexity & Schedule Assumptions

- **Solo developer + AI agents (OpenCode) working evenings/weekends.** Whole-MVP estimate: roughly **25–35 focused sessions** (S tasks ~1 session, M ~2–3, L ~4–6). **No calendar dates are promised** in any doc — only this relative scale.
- Phases stay ordered M0→M7; within-phase tasks may parallelize where the graph allows (e.g. 2.5 auth ∥ 2.2 proxy).
- Every phase ends deployable; long-running content authoring (3.4) is the single largest L and can run across sessions.
- AI-generated content/copy always gets human review before publishing (CONTENT_STRATEGY.md rule), which is why content tasks are sized generously.
- Estimation units signal complexity, not duration guarantees; if reality diverges > 1.5×, TASKS.md and CHANGELOG.md are updated rather than silently slipping.

## 13. Risk Register per Phase

Base risk table: PROJECT_PLAN.md §9 (R1–R8). Phase-specific additions:

| Phase | Dominant risks | Phase-specific mitigation |
|-------|----------------|---------------------------|
| 0 | Doc drift / inconsistency; unverified claims written as fact | Cross-reference pass before approval; every third-party fact cites docs/VERIFIED_FACTS.md or is UNVERIFIED |
| 1 | Node LTS version churn (**UNVERIFIED** until install) | ENVIRONMENT_SETUP.md pinned & recorded in CHANGELOG |
| 2 | Quota burn during testing (R1); API-key leak; image-reuse rules unknown (pending #3) | Test with fixture-then-live ordering (§10); bundle grep (AC-NFR-3); verify rules at 2.9 before shipping images |
| 3 | Content quality → SEO+AdSense risk (R4/R5) | Human review pass; keyword map adherence; a11y/perf audit before MVP acceptance |
| 4 | RLS regression on new user tables | Re-audit task 4.10; SECURITY.md checklist |
| 5 | Accidental commercial use on Hobby (R2) — **highest-stakes phase** | Hard gate 5.2/5.3 before any ad code ships; migration verification 5.1 first |
| 6 | SW caching bugs / stale content | Versioned cache strategy in ARCHITECTURE.md; regression suite 6.5 |
| 7 | Unverified platform fees/policies | Each item re-verifies against docs/VERIFIED_FACTS.md before spend |

## 14. Change Management

1. **Any change to canonical decisions #1–#11** (PROJECT_PLAN.md) requires: user approval + PROJECT_PLAN.md edit + CHANGELOG.md entry.
2. **Any stack change** (framework, DB, host, identification provider) additionally requires updating ARCHITECTURE.md and the affected sibling docs in the same change set, plus explicit user approval — no silent substitutions.
3. **Doc-first:** deviations discovered mid-phase are written into the relevant doc (usually REQUIREMENTS.md or this roadmap) before code moves.
4. Every material change gets a dated CHANGELOG.md entry; docs/VERIFIED_FACTS.md gains a row if a new third-party fact is introduced.
5. Task list living document: TASKS.md mirrors this roadmap's numbering; roadmap edits and TASKS.md edits ship together.
