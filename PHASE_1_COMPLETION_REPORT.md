# PlantAI — Phase 1 Completion Report

**Date:** 2026-11-10
**Phase:** 1 — Environment & Project Scaffold (mapping to `DEVELOPMENT_ROADMAP.md` §3 / `TASKS.md` P1-01…P1-14)
**Status:** **Implemented to the boundary of owner-side actions. STOP after Phase 1.**

---

## Table of Contents

1. [What was executed (task IDs)](#1-what-was-executed-task-ids)
2. [Files created / modified](#2-files-created--modified)
3. [Dependencies & versions](#3-dependencies--versions)
4. [Commands executed](#4-commands-executed)
5. [Verification results](#5-verification-results)
6. [What was intentionally NOT done](#6-what-was-intentionally-not-done)
7. [Owner actions required (the only remaining blockers)](#7-owner-actions-required-the-only-remaining-blockers)
8. [Task board status after Phase 1](#8-task-board-status-after-phase-1)
9. [Deviations from the approved architecture](#9-deviations-from-the-approved-architecture)
10. [Run the project locally](#10-run-the-project-locally)

---

## 1. What was executed (task IDs)

| Task | Result |
|---|---|
| P1-01 | 🚧 Region confirmed by owner (`plantai-dev`, **ap-south-1**, Healthy). Jurisdiction + custom-domain remain open; no legal content shipped. |
| P1-02 | ✅ Node **v24.22.0** (LTS), npm **12.2.1**, git **2.56** verified live — closes the Node LTS UNVERIFIED item in `docs/VERIFIED_FACTS.md`. |
| P1-03 | 🚧 Local git repo live (branch `master`, Phase 1 committed). **GitHub push = owner action.** |
| P1-04 | ✅ (owner side done: project exists) / 🚧 (my side: migrations prepared, **not yet applied**). |
| P1-05 | ⬜ Pl@ntNet key — owner action, required by Phase 2 only. |
| P1-06 | ✅ Next.js **16.4.6** App Router + Turbopack, React 19.3, TypeScript **strict**, Tailwind **4.3.3** (CSS-first tokens). |
| P1-07 | ✅ `.env.example` committed (placeholders only); `.env.local` left for owner (`.env*` git-ignored). |
| P1-08 | ✅ Canonical structure per ARCHITECTURE.md: `(public)` / `(auth)` / `(user)` / `admin` route groups, `components/layout`, `lib/env.ts`, `lib/supabase/{client,server}.ts`, `supabase/migrations/`. (`src/actions` will appear with the first Server Action in Phase 2.) |
| P1-09 | 🚧 **5 verbatim-from-DATABASE_SCHEMA migrations written** — schema (10 tables/5 enums/indexes), functions & triggers (`is_admin()`, `handle_new_user`, `touch_updated_at`, guards), full RLS (enable + FORCE + every policy), storage buckets + policies, seed (`app_settings` defaults, **10 starter species**, admin-promotion instructions). **Not applied to any Supabase project — no connection tested.** |
| P1-10 | 🚧 Bucket SQL in migration `003` — applies together with P1-09. |
| P1-11 | 🚧 Seed SQL in migration `004` — applies together with P1-09. |
| P1-12 | ✅ Root layout (Inter via `next/font`), SiteHeader (canonical nav + Sign in), SiteFooter (honest legal links; **no premature Pl@ntNet attribution**), brand tokens, `:focus-visible` baseline, honest route-stub component. Mobile bottom-nav deliberately deferred to Phase 2 (recorded in header component comment). |
| P1-13 | ⬜ **Owner action:** Vercel account + import + env vars (free Hobby, no ads). |
| P1-14 | ✅ TASKS.md, CHANGELOG.md (v0.2.0), DEVELOPMENT_ROADMAP.md, ENVIRONMENT_SETUP.md, SECURITY.md, DEPLOYMENT_GUIDE.md, ARCHITECTURE.md (ADR-9/ADR-10) updated. |

## 2. Files created / modified

**Created (code/config):**
- `src/app/globals.css` (tokens), `src/app/layout.tsx`, `src/app/(public)/page.tsx`
- Route stubs: `(public)` → `identify`, `plant/[slug]`, `library`, `blog`, `blog/[slug]`, `about`, `contact`, `privacy`, `terms`, `cookie-policy`; `(auth)` → `login`, `signup`; `(user)` → `my-plants`, `saved-plants`, `dashboard`, `reminders`, `account`; `admin/page.tsx`
- `src/components/layout/{site-header,site-footer,route-stub}.tsx`
- `src/lib/env.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
- `supabase/migrations/2026010100000{0…4}_*.sql`, `supabase/README.md` (+ owner checklist)
- `.env.example`, `.prettierrc.json`, `.prettierignore`, `.gitattributes`, `.vscode/settings.json`, root `README.md`

**Deleted:** `src/app/page.tsx` (superseded by `(public)/page.tsx` — route conflict avoidance).

**Modified:** `package.json` (name → `plantai`; added `typecheck`, `format` scripts), `.gitignore` (+`backups`), and the documentation files listed in §1 P1-14. **Every planning document was preserved**; nothing was overwritten except the surgically-updated sections.

## 3. Dependencies & versions (production build verified)

| Package | Version | Paid? |
|---|---|---|
| next | 16.4.6 | no |
| react / react-dom | 19.3.0 | no |
| @supabase/supabase-js | ^2.119.0 | no |
| @supabase/ssr | ^0.12.7 | no |
| tailwindcss + @tailwindcss/turbopack | 4.3.3 | no |
| typescript | ^5 | no |
| eslint + eslint-config-next | ^9 / 16.4.6 | no |
| prettier (dev) | ^3.9.10 | no |

No other dependencies — zero-cost compliance maintained (no paid service activated).

## 4. Commands executed

```powershell
npx --yes create-next-app@latest scaffold-tmp --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --skip-install --yes
# contents moved into the workspace root, preserving every existing doc; temp dir deleted
npm install
npm install @supabase/supabase-js @supabase/ssr
npm install -D prettier
npm pkg set name=plantai scripts.typecheck="tsc --noEmit" scripts.format="prettier --write ."
npm run lint
npm run typecheck
npm run build
git add -A   (commit follows this report)
```

## 5. Verification results

- `npm run lint` → **0 problems** (one pre-existing react/no-unescaped-entities error in the default page was fixed during development, then re-verified clean).
- `npm run typecheck` (`tsc --noEmit`) → **0 errors**.
- `npm run build` → **✓ Compiled successfully**, **22/22 static pages generated**, 20 routes registered: 18 static + 2 dynamic (`/plant/[slug]`, `/blog/[slug]`) as **partial prerender** per Next 16 Cache Components.
- Env safety: `.env.local` does **not** exist yet (owner creates); `.env*` is git-ignored (`.gitignore` line `.env*`); no real credentials exist anywhere in the repo; `.env.example` holds placeholders only.
- `git status` reviewed; initial scaffold commit + Phase 1 commit staged/local.

## 6. What was intentionally NOT done (STOP boundary)

- No migrations applied (owner applies via `supabase/README.md`); **no database connectivity claim is made or tested**.
- No Vercel deploy (owner account action) — P1-13 pending; no paid hosting ever.
- No identification logic, no `/api/identify` Route Handler, no auth flows, no ads, no PWA, no Android — all later phases.
- No paid services added or upgraded (Supabase stays Free; no Pl@ntNet calls made).

## 7. Owner actions required (the only remaining blockers)

1. **GitHub:** create the public repo `PlantAI` and push this repo
   (`git remote add origin <url> && git push -u origin master`).
2. **`.env.local`:** `Copy-Item .env.example .env.local` and paste your saved
   Project URL + **Publishable** key (exact steps: ENVIRONMENT_SETUP.md §5.3 —
   never paste keys into chat; `git status` must not list the file).
3. **Apply migrations** to `plantai-dev` (Option A CLI or Option B SQL editor)
   then verify with the checklist in `supabase/README.md` — including the
   **Data-API table exposure** item (auto-expose is disabled on your project,
   so the 10 `public` tables must be exposed manually or supabase-js gets 404s)
   and the **admin-account promotion UPDATE** from `004_seed.sql` comments.
4. **Vercel deploy (P1-13):** Hobby plan import from GitHub + env vars per
   DEPLOYMENT_GUIDE.md §4/§6 (`NEXT_PUBLIC_*` only until Phase 2 needs
   `PLANTNET_MODE`, and Phase 2 only uses mock upstream calls).
5. (Phase 2 prerequisite) Pl@ntNet account + API key generation — safe to do now; recorded server-side only.
6. Jurisdiction answer remains open for the ToS governing-law placeholder (no rush; blocks legal-page content in Phase 3, not code).

## 8. Task board status after Phase 1

- Phase 0: 24/24 ✅ (including audit tasks).
- Phase 1: **8 complete, 4 🚧 prepared-awaiting-owner (P1-03 push, P1-04/P1-09–P1-11 apply), 2 owner-blocked (P1-05 Pl@ntNet key by Phase 2 need; P1-13 Vercel deploy)**.
- Phases 2–7: ⬜ pending; **STOP per authorization** — Phase 2 will not start without explicit owner approval.

## 9. Deviations from the approved architecture (all recorded)

1. **ADF-9 record:** env var `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` replaces the planning-era `NEXT_PUBLIC_SUPABASE_ANON_KEY` naming everywhere (owner decision; ADR-9 in ARCHITECTURE.md; doc tables updated).
2. **ADR-10:** Next 16 + Tailwind 4 confirmed as scaffold result (Next-16 facts captured: `proxy.ts` replaces `middleware.ts` for future route protection; `params` is a Promise; Cache Components prerender rules — `[slug]` reads params inside `<Suspense>`; static footer year instead of `new Date()`).
3. Migration file order swapped (functions/triggers before RLS) because policies reference `is_admin()` — content otherwise verbatim; noted in `supabase/README.md` and CHANGELOG.
4. Route-group layout replaces flat routes precisely per ARCHITECTURE.md §1.3 (`(public)`/`(auth)`/`(user)`/`admin`) — matches the doc; "what belongs to which phase" stub copy includes honest phase labels instead of marketing.

## 10. Run the project locally

```powershell
# after owner fills .env.local (values from Supabase dashboard):
npm install        # already done once on this machine
npm run dev        # → http://localhost:3000 (all 20 stub routes respond)
npm run lint && npm run typecheck && npm run build   # full verification set
```

Note: `npm run dev`/`build` work even before `.env.local` exists because the
Supabase clients fail lazily at call time (first real Supabase call happens in
Phase 2) — but fill it before any auth/database work.

---

**STOP recorded:** Phase 2 (identification core) awaits your explicit approval,
your GitHub push, migration application, and the Vercel deploy — in that order.
