# PlantAI — Changelog

All notable project changes, decisions, and documentation updates.
Format based on Keep a Changelog; newest entries first.

---

## [0.2.1] — Local Supabase env file configured (placeholder state) — 2026-11-10

### Added
- Phase 1.1 local environment configuration task: `.env.local` confirmed present (created from `.env.example` template where absent; neither overwritten nor modified with real values). Mask-only verification script run — variables `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are **still placeholders at scan time**; owner to paste real values locally. Git safety verified: file git-ignored, absent from `git ls-files`, no commit ever touched it, no key strings in tracked files, no secret references in client code (env.ts doc-comments only). Database connectivity NOT tested (no value pasted, no query run). Full verification method + status note recorded in ENVIRONMENT_SETUP.md §5.3.

---

## [0.2.0] — Phase 1: Environment & Project Scaffold — 2026-11-10

### Application scaffold (first code in the repository)
- **Next.js 16.4.6** (App Router + Turbopack, `create-next-app@latest`; current stable verified live — supersedes planning-era assumption), **React 19.3.0**, **TypeScript 5.x (strict, scaffold default)**, **Tailwind CSS 4.3.3** (CSS-first `@theme` tokens — replaces the JS-config assumption from Phase 0 docs), **ESLint 9 flat config** (`eslint-config-next`), **Prettier 3.9.10**.
- Dependencies added: `@supabase/supabase-js@^2.119.0`, `@supabase/ssr@^0.12.7` (both open-source; no new paid services). Node v24.22.0 (LTS) + npm 12.2.1 + git 2.56 verified live (closes the Node/Tailwind UNVERIFIED items from `docs/VERIFIED_FACTS.md` pending list).
- Canonical folder structure per `ARCHITECTURE.md` §1.3: route groups `(public)` / `(auth)` / `(user)` + `admin/`, `src/components/layout/{site-header,site-footer,route-stub}.tsx`, `src/lib/env.ts`, `src/lib/supabase/{client,server}.ts`.
- All 20 canonical URL routes stubbed (roadmap task 1.6 / FR-TEC-006) with honest phase labels — no fake identification, no fake functionality.
- Design tokens (brand emerald/teal, surfaces, semantic colors) in `src/app/globals.css`; `:focus-visible` a11y baseline; Inter via `next/font` (labels serif font deferred to Phase 3).
- `.env.example` committed (placeholders only); `.env*` gitignored; `.vscode/settings.json` per ENVIRONMENT_SETUP; Prettier config + ignore.

### Supabase foundation
- `supabase/migrations/` — **5 SQL migrations transcribed verbatim from DATABASE_SCHEMA.md**: initial schema (10 tables, 5 enums, all indexes incl. trigram/partial), functions & triggers (`is_admin()`, `touch_updated_at`, `handle_new_user`, role/owner guards, due-date advance), full RLS (enable + FORCE on all 10 tables + every documented policy), storage buckets + object policies (`request-images` private, `plant-images` public), seed (`app_settings` defaults incl. rate limits 5/20 + **10 starter species** + admin promotion instructions).
- `supabase/migrations_main` application requires owner action (dashboard SQL editor or Supabase CLI `db push`) — see `supabase/README.md` with owner verification checklist. **No DB connection has been tested from the app yet.**

### Decisions recorded
1. **ADR-9 — Supabase key naming:** use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (owner's dashboard "Publishable key" naming) instead of the planning-era `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Publishing key remains browser-safe; RLS is the security boundary. Doc references updated.
2. **Migration file order** swapped (functions/triggers before RLS) because every policy depends on `is_admin()`; content otherwise verbatim; noted in `supabase/README.md`.
3. **Next 16 platform notes:** dynamic `[slug]` stubs read `params` inside `<Suspense>` (Cache Components prerender rule); footer year is static (no unstable `new Date()` in prerender); `middleware` is named `proxy.ts` in Next 16 — Phase 2 route protection will use `proxy.ts` + journal recorded in ARCHITECTURE.md.
4. Owner-provided facts recorded: `plantai-dev` created in **ap-south-1 (South Asia/Mumbai)**, status Healthy; target market = entire Asia; jurisdiction still pending (no legal claims shipped).

### Verified (this session)
- `npm run lint` → 0 problems · `npm run typecheck` (tsc --noEmit) → 0 errors · `npm run build` → **22/22 static pages generated, 20 routes registered** (2 dynamic routes partial prerender).
- `git` local repository live (branch `master`); initial scaffold commit by create-next-app + this phase committed upon session end.

### Owner actions remaining (blockers for some tasks)
1. Push repo to GitHub (P1-03), fill `.env.local` from dashboard values (P1-07), apply migrations to `plantai-dev` (P1-09–P1-11), create admin account + run promotion UPDATE, verify Data-API table exposure, then Vercel import + env vars (P1-13).
2. Pl@ntNet account + API key (P1-05 — needed by Phase 2, not Phase 1).
3. Jurisdiction confirmation (Q1b) — remains open; no legal content is published before it.

---

## [0.1.1] — Documentation Audit — 2026-11-10

### Added
- `PHASE_1_AUDIT_REPORT.md` — final Phase 0 documentation audit: 19/19 files verified, per-document quality results, factual-accuracy findings (all third-party claims traced to `docs/VERIFIED_FACTS.md`; UNVERIFIED flags preserved), cross-document consistency results, security/SEO/monetization gap review, MVP-scope confirmation (10-item list), MVP readiness assessment, recommended Phase 1/2 tasks.

### Audited
- All 18 core documents + `docs/VERIFIED_FACTS.md` structurally and factually audited; no missing documents; no fabricated pricing/quotas found; no approval/revenue guarantees found anywhere; rate-limit numbers consistent across ARCHITECTURE/DATABASE_SCHEMA/API_DOCUMENTATION/SECURITY (anon 5/day, auth 20/day, tunable via `app_settings`).
- MVP scope formally confirmed as the frozen 10-item identification + content core (Phases 1–3); disease-AI, subscriptions, advanced reminders, Android explicitly out.
- DEVELOPMENT_ROADMAP.md Phase 0: audit task (0.20) added and marked complete; M0 exit criteria updated to include the audit report.
- TASKS.md: P0-23/P0-24 added (audit + report, completed); gate P0-22 remains the only blocked item.

### Decision confirmation
- No architectural decision changed during the audit. The only user-facing blocker remains explicit approval to start Phase 1 (environment & scaffold).

---

## [0.1.0] — Phase 0: Planning & Documentation — 2026-11-10

### Project status
- Phase 0 (Planning & Documentation) in progress — all 18 core documents + internal research log created. **No application code, no scaffolding, no dependencies, not a git repository yet — by design.** STOP after Phase 0; explicit user approval required before Phase 2 (scaffold runs first in Phase 1 after approval, per roadmap).

### Created
- `docs/VERIFIED_FACTS.md` — internal research log: all third-party free-tier terms with source URLs + verification dates (Pl@ntNet API, Supabase, Vercel, Google AdSense, UNVERIFIED-slot table for pending checks).
- 18 core planning documents in project root:
  - PROJECT_PLAN.md — vision, goals, A–Z feature map → tiers/phases, milestones M0–M7, success criteria with honest business caveats, budget & first-cost events, risk register.
  - REQUIREMENTS.md — FR/NFR requirement IDs per tier, personas, admin/business/technical requirements, MVP acceptance criteria (Given/When/Then).
  - ARCHITECTURE.md — system/frontend/backend/API/database/auth/security/deployment architecture, `src/` structure proposal, ADR-style decision record, scalability path.
  - DATABASE_SCHEMA.md — 10 canonical tables (profiles, plant_library, identifications, user_plants, care_reminders, saved_plants, blog_posts, contact_messages, app_settings, identification_cache) with columns, indexes, RLS policy SQL, triggers, storage buckets, migration strategy.
  - API_DOCUMENTATION.md — full `/api/identify` contract (request/response/errors/rate limiting), Pl@ntNet upstream mapping, Server Actions catalog, future disease route section clearly non-MVP.
  - UI_UX_DESIGN.md — design system (green palette, tokens, typography), component inventory, page-by-page specs, mobile bottom-nav, loading/empty/quota/error states, WCAG 2.1 AA plan, future ad-slot zones.
  - SEO_STRATEGY.md — technical + on-page SEO, URL structure, keyword clusters, Schema.org plan, sitemap/robots, Core Web Vitals budgets, Search Console plan.
  - CONTENT_STRATEGY.md — content pillars, quality standards, editorial workflow, plant_library entry template, launch content plan (~20–30 species), AdSense-content alignment.
  - SECURITY.md — threat model, secrets inventory & rotation, Pl@ntNet key protection, auth security, upload validation, rate limiting (with honest serverless limitations), RLS-first DB security, OWASP mapping, headers/CSP, incident basics.
  - TESTING_PLAN.md — Vitest (unit) + Playwright (E2E) free tooling, RLS verification matrix, /api/identify contract tests with recorded fixtures (no live quota burn in CI), manual checklists, Lighthouse budgets, phase test gates.
  - ENVIRONMENT_SETUP.md — Windows/Node/Git/VS Code/OpenCode setup, Supabase (2 projects) & Pl@ntNet account creation, env-variable inventory with exposure rules, Windows-specific gotchas, Phase-0 "do not do" list.
  - DEVELOPMENT_ROADMAP.md — Phases 0–7 detail, dependency graph, complexity estimates (S/M/L), phase exit criteria, first-session guidance for coding agents.
  - TASKS.md — master checklist by phases with IDs (P0-xx…P7-xx), statuses, dependencies, blocked & recurring tasks.
  - CHANGELOG.md — this file.
  - DEPLOYMENT_GUIDE.md — GitHub → Vercel flow, Supabase dev/prod split, env config matrix, production checklist, domain path, rollback/backup/disaster-recovery, cost-drift monitoring with "no paid toggling without approval" rule.
  - MONETIZATION_PLAN.md — AdSense Preconditions & timing, hosting prerequisite (migration vs Pro upgrade before ads), ads.txt/app-ads.txt procedures, AdMob Phase 7 banners-only policy, premium-subscription feature split (no pricing invented), roadmap & KPIs.
  - LEGAL_AND_COMPLIANCE.md — not-legal-advice disclaimer, Privacy/Terms/Cookie/Disclaimer content outlines, third-party data-sharing table, attribution policy, AdSense/Play compliance maps, data-erasure flow, open user questions, quarterly compliance rechecks.
  - AI_INTEGRATION_PLAN.md — AI honesty principle (Pl@ntNet species identification only; no generative AI in MVP), disease route BETA evaluation criteria, future disease-detection options table (no spend without approval), model-evaluation methodology, decision log.

### Decisions made (summary — full ADRs in ARCHITECTURE.md)
1. Stack frozen: Next.js App Router + TypeScript strict + Tailwind (version verified at scaffold) + Supabase Free + Pl@ntNet API v2. No other AI APIs. No paid dependencies.
2. Hosting: Vercel Hobby for non-commercial development; **hard constraint recorded — hosting upgrade or host migration is REQUIRED before any AdSense enablement (Vercel Hobby ToS explicitly forbids ads)**; Netlify/Cloudflare as UNVERIFIED Phase 5 alternatives to verify.
3. Supabase 2-project split (dev/prod) within the free quota; inactivity-pause mitigations documented; no automatic backups on Free → weekly manual dumps post-launch.
4. Pl@ntNet: single free key shared across dev/preview/prod (multiple free accounts forbidden); `PLANTNET_MODE=mock` for dev; per-user/IP rate limits + image-hash dedup cache to protect the 500/day quota; errored requests consume quota → strict validation first.
5. MVP scope = Phases 1–3 (identification experience + auth + library + static pages). Disease detection is EDUCATIONAL content only in MVP; Pl@ntNet disease route is a Phase 7 evaluation item.
6. SEO-first growth with strict content standards; AdSense application only after content threshold + user go-ahead; no approval or revenue guarantees anywhere in project materials.

### Open items (unresolved / pending user input)
- Developer jurisdiction/country + Supabase region choice (affects ToS governing law, latency, data residency) — asked in LEGAL_AND_COMPLIANCE.md.
- Custom domain: defer vs purchase at launch (first optional spend) — recommendation to decide by Phase 5.
- Hosting path validation in Phase 5: read current Netlify/Cloudflare Pages ToS before committing (items marked UNVERIFIED in docs/VERIFIED_FACTS.md).
- Exact Node LTS / Tailwind major version to pin during Phase 1 scaffold.
- Analytics tool choice (deferred to Phase 5; Search Console-only until then).

### UNVERIFIED items carry-over
- See `docs/VERIFIED_FACTS.md` → "Research notes & pending verifications" (10 tracked items with re-check phases).
