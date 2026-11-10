# PlantAI — Master Task List

> Single source of truth for project tasks. Update this file whenever tasks change.
> Statuses: ⬜ Pending · ✅ Completed · 🚧 In progress · ⛔ Blocked · ➡️ Deferred to a later phase.
> Reference documents: [PROJECT_PLAN.md](PROJECT_PLAN.md) · [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) · [REQUIREMENTS.md](REQUIREMENTS.md) · [docs/VERIFIED_FACTS.md](docs/VERIFIED_FACTS.md)

**Last updated: 2026-11-10 (Phase 0 documentation session + final documentation audit)**

---

## Table of Contents

1. [Current phase summary](#current-phase-summary)
2. [Phase 0 — Planning & Documentation (CURRENT)](#phase-0--planning--documentation-current)
3. [Phase 1 — Environment & Project Scaffold](#phase-1--environment--project-scaffold)
4. [Phase 2 — MVP Identification & Auth](#phase-2--mvp-identification--auth)
5. [Phase 3 — Content & SEO](#phase-3--content--seo)
6. [Phase 4 — Personal Plant Management](#phase-4--personal-plant-management)
7. [Phase 5 — Production Deployment & Monetization Prep](#phase-5--production-deployment--monetization-prep)
8. [Phase 6 — PWA & Launch Hardening](#phase-6--pwa--launch-hardening)
9. [Phase 7 — Future](#phase-7--future)
10. [Blocked tasks](#blocked-tasks)
11. [Recurring tasks](#recurring-tasks)

---

## Current phase summary

| | |
|---|---|
| Current phase | **Phase 0 — Planning & Documentation** |
| Completed in phase | Workspace inspection, free-tier research (Pl@ntNet / Supabase / Vercel / AdSense verified 2026-11-10), all planning documents created |
| Exit criteria | All 18 planning docs exist & consistent → user reviews → **explicit user approval required to start Phase 2** (Phase 1 scaffold follows approval) |
| Blocked by | Nothing |

---

## Phase 0 — Planning & Documentation (CURRENT)

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| P0-01 | Inspect working directory (empty — no existing app found) | ✅ | — |
| P0-02 | Research & verify free-tier terms: Pl@ntNet, Supabase, Vercel, AdSense | ✅ | P0-01 |
| P0-03 | Record verified facts in `docs/VERIFIED_FACTS.md` with source URLs + dates | ✅ | P0-02 |
| P0-04 | Create PROJECT_PLAN.md | ✅ | P0-03 |
| P0-05 | Create REQUIREMENTS.md | ✅ | P0-03 |
| P0-06 | Create ARCHITECTURE.md | ✅ | P0-03 |
| P0-07 | Create DATABASE_SCHEMA.md | ✅ | P0-03 |
| P0-08 | Create API_DOCUMENTATION.md | ✅ | P0-03 |
| P0-09 | Create UI_UX_DESIGN.md | ✅ | P0-03 |
| P0-10 | Create SEO_STRATEGY.md | ✅ | P0-03 |
| P0-11 | Create CONTENT_STRATEGY.md | ✅ | P0-03 |
| P0-12 | Create SECURITY.md | ✅ | P0-03 |
| P0-13 | Create TESTING_PLAN.md | ✅ | P0-03 |
| P0-14 | Create ENVIRONMENT_SETUP.md | ✅ | P0-03 |
| P0-15 | Create MONETIZATION_PLAN.md | ✅ | P0-03 |
| P0-16 | Create LEGAL_AND_COMPLIANCE.md | ✅ | P0-03 |
| P0-17 | Create AI_INTEGRATION_PLAN.md | ✅ | P0-03 |
| P0-18 | Create DEVELOPMENT_ROADMAP.md | ✅ | P0-03 |
| P0-19 | Create DEPLOYMENT_GUIDE.md | ✅ | P0-03 |
| P0-20 | Create TASKS.md and CHANGELOG.md | ✅ | P0-04…P0-19 |
| P0-21 | Cross-document consistency check + final planning report to user | ✅ | P0-20 |
| P0-22 | **USER APPROVAL — gate to Phase 1** | ⬜ Blocked by user | P0-21 |
| P0-23 | Documentation audit: file verification (19/19), structure, factual accuracy, cross-awareness consistency, MVP-scope check | ✅ | P0-21 |
| P0-24 | Final audit report `PHASE_1_AUDIT_REPORT.md` | ✅ | P0-23 |

## Phase 1 — Environment & Project Scaffold (implementation session 2026-11-10)

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| P1-01 | User answers open questions (see legals doc: country/jurisdiction, preferred Supabase region, custom-domain plan) | 🚧 Region answered: **ap-south-1 (South Asia/Mumbai)** — jurisdiction + custom domain still pending | P0-22 |
| P1-02 | Install/verify Node.js LTS, npm, Git on Windows (per ENVIRONMENT_SETUP.md) | ✅ Node v24.22.0 (LTS), npm 12.2.1, git 2.56 — verified live | P1-01 |
| P1-03 | Create GitHub repository `PlantAI` (public, Node .gitignore) + first commit | 🚧 Local git repo initialized (branch `master`, initial scaffold commit) — **owner pushes to GitHub** | P1-02 |
| P1-04 | Create Supabase projects: `plantai-dev` + `plantai-prod` (2 = free quota) — region per P1-01 | 🚧 Owner created `plantai-dev` (ap-south-1, status Healthy) — migrations application pending (P1-09–P1-11); `plantai-prod` recommended before Vercel deploy | P1-01 |
| P1-05 | Create Pl@ntNet developer account + private API key (recorded in env only) | ⬜ Owner action — only needed by Phase 2 | P1-02 |
| P1-06 | Scaffold Next.js app: App Router + TypeScript strict + Tailwind (verify current Tailwind major version) | ✅ create-next-app@latest → **Next 16.4.6** (App Router, Turbopack), React 19.3, Tailwind **4.3.3** (CSS-first), TS strict from scaffold | P1-02 |
| P1-07 | Create `.env.example` (committed) + local `.env.local` (gitignored) | ✅ `.env.example` committed with placeholders; **owner fills `.env.local`** (never commit; `.env*` ignored) | P1-04, P1-05 |
| P1-08 | Repo structure per ARCHITECTURE.md (`src/app`, `src/components`, `src/lib`, `src/actions`, `supabase/migrations`) | ✅ Structure live: `(public)`/`(auth)`/`(user)`/`admin` route groups, `components/layout`, `lib/env.ts`, `lib/supabase/{client,server}.ts`, `supabase/migrations/*` (`src/actions` arrives with the first Server Action in Phase 2) | P1-06 |
| P1-09 | Supabase migrations: all tables + RLS policies + triggers per DATABASE_SCHEMA.md | 🚧 SQL written & verified against schema doc (`supabase/migrations/2026010100000{0..2}…`) — **owner applies to `plantai-dev`** via `supabase/README.md` Option A/B | P1-04 |
| P1-10 | Storage buckets: `request-images` (private), `plant-images` (public) + storage policies | 🚧 Bucket SQL included in migration `003_storage_buckets.sql` — owner applies alongside P1-09 | P1-09 |
| P1-11 | Seed data: admin profile + ≥10 starter species into plant_library | 🚧 `004_seed.sql` has 8 `app_settings` defaults + **10 starter species** + admin-promotion instructions (admin account must be created first in dashboard) — owner runs | P1-09 |
| P1-12 | Base layout shell + design tokens per UI_UX_DESIGN.md | ✅ Root layout (Inter via next/font), Header with canonical links + Sign-in, Footer with honest legal links, brand tokens in `globals.css` (`@theme`), focus-visible a11y baseline; mobile bottom-nav belongs to Phase 2 per header comment | P1-06 |
| P1-13 | Deploy empty shell to Vercel (preview) — env vars configured | ⬜ Blocked by owner (Vercel account + import; per DEPLOYMENT_GUIDE.md §4) ; no paid hosting allowed | P1-07 |
| P1-14 | Update TASKS.md + CHANGELOG.md after scaffold | ✅ This edit + CHANGELOG v0.2.0 | P1-06… |

## Phase 2 — MVP Identification & Auth

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| P2-01 | Client-side image validation + resize/compress (jpeg/png, ≤10MB, 1–3 images, EXIF strip attempt) | ⬜ | P1-08 |
| P2-02 | `POST /api/identify` Route Handler: validation → hash dedup → Pl@ntNet proxy (`PLANTNET_MODE=mock` support) → persist identification → normalized response | ⬜ | P1-09 |
| P2-03 | Rate limiting: per-IP/per-user counters (5/day anon, 20/day authed; app_settings-driven) | ⬜ | P2-02 |
| P2-04 | Identify page UI (upload, camera capture, progress, quota-reached, degraded states) | ⬜ | P2-01, P2-02 |
| P2-05 | Results UI: ranked species + confidence + cc-by-sa credited images + care summary from plant_library | ⬜ | P2-02, P1-11 |
| P2-06 | Plant detail page `/plant/[slug]` | ⬜ | P1-11 |
| P2-07 | Supabase Auth: signup/email-confirm/login/reset/logout + middleware route protection | ⬜ | P1-09 |
| P2-08 | Saved plants (basic) on results + plant pages | ⬜ | P2-07 |
| P2-09 | Unit + API tests (Vitest) for pipeline; first recorded Pl@ntNet fixture set | ⬜ | P2-02 |
| P2-10 | Launch documentation: ONE manual live identification & record result | ⬜ | P2-04 |

## Phase 3 — Content & SEO

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| P3-01 | Library page + search (`/library?q=`) with trigram index | ⬜ | P1-09 |
| P3-02 | Metadata system (title/description/OG patterns per page template) | ⬜ | P2-06 |
| P3-03 | JSON-LD: WebSite, BreadcrumbList, FAQPage on guides | ⬜ | P3-02 |
| P3-04 | `sitemap.ts` + `robots.ts` (disallow /admin, /account, /my-plants, /dashboard, /reminders, /api/) | ⬜ | P3-01 |
| P3-05 | Static pages: /about, /contact (+ form → contact_messages), /privacy, /terms, /cookie-policy | ⬜ | P1-12 |
| P3-06 | Author 20–30 species library entries per CONTENT_STRATEGY template (care fields complete) | ⬜ | P1-11 |
| P3-07 | Disease-education guide template + 5 starter symptom guides (educational only, no diagnosis claim) | ⬜ | P3-06 |
| P3-08 | Attribution surface: "Powered by Pl@ntNet" + attribution sentence + image citation UI | ⬜ | P2-05 |
| P3-09 | Google Search Console setup (when public URL live) + sitemap submit | ⬜ | P3-04 |
| P3-10 | Lighthouse pass: SEO >90, A11y >90 on key pages | ⬜ | P3-02 |

## Phase 4 — Personal Plant Management

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| P4-01 | My Plants CRUD + photos | ⬜ | P2-07 |
| P4-02 | Saved plants full view + management | ⬜ | P2-08 |
| P4-03 | Care reminders engine (types, intervals, next_due_date trigger + advance) | ⬜ | P4-01 |
| P4-04 | Dashboard summary (plants count, upcoming care) | ⬜ | P4-03 |
| P4-05 | Account page: profile edit, display-name, **Delete my data** (erasure flow) | ⬜ | P2-07 |
| P4-06 | Identification-history view with 90-day retention policy note | ⬜ | P5-06 decision |
| P4-07 | E2E Playwright suite: identify→save→reminders loop | ⬜ | P4-01 |

## Phase 5 — Production Deployment & Monetization Prep

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| P5-01 | **Hosting decision:** read Netlify & Cloudflare Pages current ToS (dated notes) → migrate or upgrade Vercel Pro ($20/mo) — REQUIRED before any ads | ⬜ | P0-22 |
| P5-02 | Custom domain purchase + DNS + SSL + NEXT_PUBLIC_SITE_URL update | ⬜ | P5-01 |
| P5-03 | Production checklist per DEPLOYMENT_GUIDE.md (RLS probes, headers, backups cadence) | ⬜ | P1-13 |
| P5-04 | AdSense preconditions satisfied (content threshold ≥25 quality pages; About/Contact/Privacy/Terms live; NOT applying in MVP) | ⬜ | P3-06 |
| P5-05 | AdSense application (only on explicit user go-ahead) — no approval/revenue guarantees anywhere | ⬜ | P5-04, user |
| P5-06 | Retention policy finalized (identifications/image cleanup) + manual weekly Supabase dumps | ⬜ | P5-03 |
| P5-07 | Quota monitoring: log remainingIdentificationRequests; alert threshold in-app | ⬜ | P2-02 |

## Phase 6 — PWA & Launch Hardening

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| P6-01 | Web manifest + icons + theme colors | ⬜ | P1-12 |
| P6-02 | Minimal service worker (offline shell for library reads; never cache identify) | ⬜ | P6-01 |
| P6-03 | Install prompt UX + iOS guidance | ⬜ | P6-01 |
| P6-04 | Perf budget enforcement (LCP <2s, INP <200ms, CLS <0.1) + CWV re-audit | ⬜ | P3-10 |
| P6-05 | Full TEST passing (unit/integration/E2E) + manual responsive/keyboard/a11y pass | ⬜ | P2-09, P4-07 |
| P6-06 | Public launch (announce, begin steady content cadence 2/mo) | ⬜ | P6-05 |

## Phase 7 — Future

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| P7-01 | Verify Google Play Console one-time fee + AdMob 2026 terms (facts file pending items) | ⬜ | Launch |
| P7-02 | Capacitor Android build of PWA | ⬜ | P6-03 |
| P7-03 | AdMob integration (banners only, no interstitials) + app-ads.txt on domain root | ⬜ | P7-01, P7-02 |
| P7-04 | Premium subscription: user-demand review → payment processor research (no pricing invented) | ⬜ | Launch |
| P7-05 | Pl@ntNet diseases BETA coverage evaluation (quarterly watch task) | ⬜ | — |
| P7-06 | Independent disease-detection research gate (per AI_INTEGRATION_PLAN.md; no spend without approval) | ⬜ | P7-05 |

## Blocked tasks

| Task | Blocked by | Note |
|------|-----------|------|
| P0-22 Approval to start Phase 1/2 | **User** | STOP — awaiting explicit approval per Phase 0 contract |
| P5-05 AdSense application | User + content threshold + hosting decision | Cannot coexist with Vercel Hobby ToS |
| P7-03 AdMob | Play Console verification (P7-01) | First known cost event if pursued |

## Recurring tasks

| Task | Frequency | Owner |
|------|-----------|-------|
| Pl@ntNet changelog / disease-coverage check | Quarterly | User + agent |
| AdSense & host ToS policy recheck (dates logged in VERIFIED_FACTS.md) | Quarterly | User + agent |
| Supabase manual DB dump (dev before migrations; prod weekly after launch) | Weekly (post-launch) | User |
| Dependencies audit (`npm audit`) | Per release | Agent |
| TASKS.md & CHANGELOG.md sync | Every session | Agent |
