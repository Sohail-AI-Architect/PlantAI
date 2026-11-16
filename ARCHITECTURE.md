# PlantAI — Technical Architecture

> Status: Phase 0 (Planning) · Last updated: 2026-11-10
> Owner: Technical Architect
> Third-party facts (quotas, prices, ToS clauses) are sourced from [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) unless explicitly marked **UNVERIFIED**.
> Related documents: [`PROJECT_PLAN.md`](PROJECT_PLAN.md), [`REQUIREMENTS.md`](REQUIREMENTS.md), [`UI_UX_DESIGN.md`](UI_UX_DESIGN.md), [`SEO_STRATEGY.md`](SEO_STRATEGY.md), [`SECURITY.md`](SECURITY.md), [`MONETIZATION_PLAN.md`](MONETIZATION_PLAN.md), [`TESTING_PLAN.md`](TESTING_PLAN.md), [`TASKS.md`](TASKS.md), [`CHANGELOG.md`](CHANGELOG.md), [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md), [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md), [`LEGAL_AND_COMPLIANCE.md`](LEGAL_AND_COMPLIANCE.md), [`AI_INTEGRATION_PLAN.md`](AI_INTEGRATION_PLAN.md), [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md), [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md).

---

## Table of Contents

1. [Architecture principles](#1-architecture-principles)
2. [System architecture diagram](#2-system-architecture-diagram)
3. [Frontend architecture](#3-frontend-architecture)
4. [Backend architecture](#4-backend-architecture)
5. [API architecture](#5-api-architecture)
6. [Database architecture](#6-database-architecture)
7. [Authentication architecture](#7-authentication-architecture)
8. [Pl@ntNet integration architecture](#8-plantnet-integration-architecture)
9. [Security architecture summary](#9-security-architecture-summary)
10. [Deployment architecture](#10-deployment-architecture)
11. [Scalability path](#11-scalability-path)
12. [Key architectural decisions record (ADR)](#12-key-architectural-decisions-record-adr)
13. [Risks & limitations](#13-risks--limitations)

---

## 1. Architecture principles

These principles govern every implementation decision in Phases 1–7. Deviations must be recorded in `CHANGELOG.md` and justified.

### 1.1 Next.js App Router, server-first

- **Rendering model:** React Server Components (RSC) by default. Every route is a Server Component unless it demonstrably needs interactivity.
- **Client Components are earned, not default** (see §3.2 boundary inventory). This keeps shipped JavaScript low — important for SEO scores (`SEO_STRATEGY.md`) and for the Vercel Hobby 100 GB transfer cap ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Vercel).
- **TypeScript strict** (`tsconfig.json`: `"strict": true`, `noUncheckedIndexedAccess: true`). No `any` in `src/` except with an explicit `eslint-disable` comment and justification.
- **Layout composition:** one root layout (`src/app/layout.tsx`) carrying fonts, global CSS, and SEO metadata; route-group layouts per section (e.g. authenticated areas) where useful.

### 1.2 Minimal client JavaScript

- Interactivity is localized: a page is server-rendered with small client "islands" (upload widget, search box, mobile nav toggle).
- No global client data-store (no Redux/Zustand in MVP). Client state stays component-local or lives in the URL (query params are the search state).
- Forms submit via Server Actions where practical — progressive enhancement, no client-side fetching layers in MVP.

### 1.3 Modular `src/` structure

```
plantai/
├── src/
│   ├── app/                        # App Router routes (see canonical URL list, REQUIREMENTS.md)
│   │   ├── (public)/               #   /, /identify, /library, /plant/[slug], /blog, static pages
│   │   ├── (auth)/                 #   /login, /signup
│   │   ├── (user)/                 #   /my-plants, /saved-plants, /dashboard, /reminders, /account
│   │   ├── admin/                  #   /admin (role-gated)
│   │   └── api/                    #   Route Handlers: /api/identify (+ future /api/*)
│   ├── components/
│   │   ├── ui/                     #   generic primitives: Button, Card, Input, Badge, Dialog...
│   │   ├── plant/                  #   domain components: IdentificationResult, PlantCard, CareSummary,
│   │   │                           #   UploadWidget, ReminderForm, AdUnit (phase 5)
│   │   └── layout/                 #   Header, Footer, MobileNav, Breadcrumbs
│   ├── lib/
│   │   ├── supabase/               #   server client (cookies), client factory, admin (service-role) client
│   │   ├── plantnet/               #   Pl@ntNet proxy client: normalize.ts, client.ts, quota.ts
│   │   ├── validation/             #   zod schemas shared by Server Actions & Route Handlers
│   │   ├── rate-limit.ts           #   per-IP/per-user limiter (in-memory MVP; see API_DOCUMENTATION.md §Rate limiting)
│   │   ├── cache.ts                #   perceptual-hash lookup + invalidation helpers
│   │   └── config.ts               #   env-based config (typed)
│   ├── actions/                    #   "use server" modules: auth-adjacent CRUD, contact, admin (API_DOCUMENTATION.md §Server Actions)
│   ├── middleware.ts               #   session refresh + protected-route redirects
│   └── types/                      #   shared TS types (Pl@ntNet normalized types, DB row types)
├── supabase/
│   ├── migrations/                 #   SQL migrations, applied with Supabase CLI (DATABASE_SCHEMA.md §Migration strategy)
│   └── seed.sql                    #   admin profile + sample plant_library rows
├── public/
│   ├── manifest.webmanifest        #   PWA (Phase 6)
│   ├── sw.js                       #   minimal hand-written service worker (Phase 6)
│   └── icons/                      #   PWA icons + favicon
└── docs/                           #   VERIFIED_FACTS.md + planning documents
```

### 1.4 Environment-based config

- All secrets live in Vercel/`.env.local` env vars; **no secrets are imported outside server-only modules**. `src/lib/config.ts` exports a typed, validated (zod-parsed at boot) config object.
- Server-only modules (`server-only` package) guard every file that touches `PLANTNET_API_KEY` or the Supabase service-role key — a client import becomes a build error.
- Application tunables (rate limits, per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) Pl@ntNet 500/day cap) live in the `app_settings` table so limits can change without redeploy; env vars only for keys/URLs (see `ENVIRONMENT_SETUP.md` for the full variable list).

Canonical decisions reflected here: Vercel Hobby hosting (non-commercial only), Server Actions for mutations, `/api/identify` as the single MVP Route Handler, server-side Pl@ntNet proxy, RLS-first database. Rationale for each is in §12.

---

## 2. System architecture diagram

```text
                       ┌──────────────────────────┐
                       │         Browser          │
                       │  (mobile-first web/PWA)  │
                       │  RSC payload + client    │
                       │  islands, service worker │
                       └────────────┬─────────────┘
                                    │ HTTPS
                       ┌────────────▼─────────────┐
                       │      Next.js (Vercel)     │
                       │      App Router           │
                       │                           │
                       │  ┌─────────┐  ┌─────────┐ │
                       │  │   RSC   │  │ Route   │ │
                       │  │ routes  │  │ Handler │ │
                       │  │ (data   │  │ /api/   │ │
                       │  │ fetch + │  │ identify│ │
                       │  │ render) │  └────┬────┘ │
                       │  └────┬────┘       │      │
                       │       │  Server    │      │
                       │       │  Actions   │      │
                       │       │ (mutations)│      │
                       │       └────┬───────┘      │
                       └───────┬────┴──────────┬───┘
                               │               │
              Supabase client  │               │  server-side HTTP
              (anon key + RLS) │               │  (API key, private)
                     ┌─────────▼───────────────▼───┐
                     │        Supabase (Free)       │
                     │  ┌─────────┐  ┌──────────┐  │
                     │  │ Postgres│  │   Auth   │  │
                     │  │ 10 tables│ │ email/OAuth│ │
                     │  │   + RLS  │ └──────────┘  │
                     │  └────┬────┘  ┌──────────┐  │
                     │       │       │ Storage  │  │
                     │       │       │ buckets  │  │
                     │       │       └──────────┘  │
                     └─────────┴─────────────────────┘
                                     │
                                     │ (identify flow only)
                     ┌───────────────▼───────────────┐
                     │  Pl@ntNet API v2  (server-side)│
                     │  POST /v2/identify/{project}  │
                     │  host my-api · project all    │
                     │  500 idents/day · 20 conc.    │
                     │  (docs/VERIFIED_FACTS.md)     │
                     └───────────────────────────────┘
```

Key structural facts:

- **The browser never talks to Pl@ntNet or Supabase Postgres directly** (except Supabase Auth via the client SDK, and Storage via RLS-authorized signed URLs/uploads). All Pl@ntNet traffic goes through the server so the API key stays private — Pl@ntNet's CORS whitelisting model is bypassed entirely ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Pl@ntNet account rules).
- Data reads on public content (plant library, blog) happen in RSCs via the Supabase **server** client with the anon key; RLS enforces the same rules that would apply in the browser, so there is no "extra" trust layer to maintain.
- Writes go through Server Actions or `/api/identify`, both of which validate with zod and rely on RLS as defense-in-depth.

---

## 3. Frontend architecture

### 3.1 Rendering & data fetching

| Concern | Pattern |
|---|---|
| Public pages (`/`, `/library?q=`, `/plant/[slug]`, `/blog`, static pages) | RSC; data fetched server-side with Supabase anon client; cached where safe (`revalidate` per route) |
| Authenticated pages (`/my-plants`, `/dashboard`, `/reminders`, `/saved-plants`, `/account`) | RSC; session from cookies via `@supabase/ssr` server client; `middleware.ts` refreshes/validates session before render |
| Client-side interactivity | Minimal islands, see §3.2 |
| Mutations | Server Actions (`src/actions/*`) calling Supabase with the user's server-session client → RLS applies (API_DOCUMENTATION.md §Server Actions catalog) |
| Search state | URL query params (`/library?q=&category=`) — server-rendered results, no client store |

### 3.2 Client Component boundary inventory (complete list for MVP)

Only these components are `"use client"`; everything else stays a Server Component.

| # | Component (in `src/components/`) | Why it must be client | Notes |
|---|---|---|---|
| 1 | `plant/UploadWidget` | File input, image preview/resizing (canvas), progress, drag-drop; submits `FormData` to `/api/identify` | Client-side pre-resize to ≤10 MB (task: PlantAI enforces ≤10 MB per image even though the Pl@ntNet limit is 50 MB total POST; server passes originals through — no server resize in MVP, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Pl@ntNet request format) |
| 2 | `layout/MobileNav` | Hamburger toggle Drawer — menu is server-fetched links, only the open/close state is client | Hydration-safe; respects `prefers-reduced-motion` (UI_UX_DESIGN.md) |
| 3 | Search box (library quick-search) | Debounced input updating URL (`router.replace`) → triggers server re-render of results | Works without JS via GET form fallback |
| 4 | Reminder form (Phase 4) | Interval/editor interactions, optimistic "mark as done" | Server Action submit; client state only for optimistic UI |
| 5 | Ad unit wrapper (Phase 5) | AdSense script tag is client-context; wrapper module chosen so it loads nothing in dev/MVP | Non-commercial on Hobby: **no ads before Phase 5 host decision** ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Vercel) |

Auth forms (`/login`, `/signup`) use the Supabase JS client directly in small client components (documented split — see §7 and API_DOCUMENTATION.md §Server Actions catalog).

### 3.3 Data-fetch & UX error/loading patterns

- **Suspense-first:** route segments wrap slow data in `<Suspense>` with skeleton fallbacks (`SearchResults` skeleton, `PlantDetail` hero skeleton). No per-component spinners inside static shells.
- **Streaming:** `loading.tsx` per route group; instant shell then streamed results.
- **Error boundaries:** `error.tsx` at session/`identify`/library levels with a retry action; global `not-found.tsx` and `error.tsx` root fallbacks. All error copy is user-facing-safe (no stack traces; details to console/logs only — `SECURITY.md`).
- **Quota grace:** the "quota reached" and "no match" empty states are designed states (not errors) in the UI per `UI_UX_DESIGN.md`, driven by typed API responses (API_DOCUMENTATION.md §Errors).

---

## 4. Backend architecture

**No Express, no custom server, no separate API backend.** Next.js on Vercel *is* the backend: Route Handlers + Server Actions + middleware. This keeps the deployment single-artifact, cheap, and portable.

### 4.1 Route Handler catalog (MVP = 1)

| Endpoint | Method | Phase | Purpose | Auth |
|---|---|---|---|---|
| `/api/identify` | POST | 2 (MVP) | Binary image upload → validation → rate limit → hash-cache check → server-side Pl@ntNet proxy → persist `identifications` row → normalized JSON | Anonymous allowed (tighter limits), session optional |
| `/api/health` | GET | 1 (ops) | Liveness check (also useful for keep-warm anti-pause traffic) | Public |

Future Route Handlers (explicitly **non-MVP**): `/api/diseases/identify` (Phase 7 BETA), `/api/cron/*` (Phase 5+ upkeep, or Vercel Cron instead — decide then). Everything else is Server Actions (API_DOCUMENTATION.md).

### 4.2 Server Actions catalog (summary)

Full signatures/zod contracts live in `API_DOCUMENTATION.md` §Server Actions catalog. Summary:

| Area | Actions | Phase |
|---|---|---|
| Saved plants | `savePlant`, `unsavePlant` | 2 (MVP: save from identification / library) |
| Contact | `submitContact` | 3 |
| My plants | `createUserPlant`, `updateUserPlant`, `deleteUserPlant` | 4 |
| Reminders | `createReminder`, `completeReminder`, `updateReminder`, `deleteReminder` | 4 |
| Admin | `adminUpsertPlantLibraryEntry`, `adminUpsertBlogPost` | 3–4 |

Auth signup/login/reset: **not** Server Actions — Supabase JS client on small client components + middleware (rationale in §7 and API_DOCUMENTATION.md).

### 4.3 Route → data/actions mapping

| URL (canonical) | Data read | Mutations |
|---|---|---|
| `/` | Hero content, N featured `plant_library` rows | — |
| `/identify` | — | via `/api/identify` (client submits) |
| `/plant/[slug]` | Single published `plant_library` row + attribution strings | `savePlant`/`unsavePlant` (when logged in) |
| `/library?q=&category=` | Filtered `plant_library` (trigram/GIN search — DATABASE_SCHEMA.md §plant_library) | — |
| `/my-plants` | Own `user_plants` (+ upcoming reminders) | `createUserPlant`, `deleteUserPlant` (Phase 4) |
| `/saved-plants` | Own `saved_plants` ⋈ `plant_library` | `savePlant`, `unsavePlant` |
| `/dashboard` | Aggregates over own tables (counts, upcoming care) | — |
| `/reminders` | Own `care_reminders` ⋈ `user_plants` | `createReminder`, `completeReminder`, `updateReminder`, `deleteReminder` |
| `/account` | Own `profiles` row | profile update actions |
| `/blog`, `/blog/[slug]` | Published `blog_posts` | — |
| `/about`, `/contact`, `/privacy`, `/terms`, `/cookie-policy` | Static content | `submitContact` |
| `/login`, `/signup` | — | Supabase auth (client) |
| `/admin` | All tables via service-role/is_admin path | admin upsert actions |

---

## 5. API architecture

- **Principle:** the *page* is the API for reads (RSC); Server Actions are the API for mutations; exactly **one REST Route Handler in the MVP**: `POST /api/identify`.
- Rationale: the identify call needs binary multipart input, streaming-friendly size, upstream-proxy semantics, and explicit HTTP status/quota headers — a Route Handler is the right fit; everything else fits Actions better (no client fetch layer to test/maintain). Full rationale and spec: `API_DOCUMENTATION.md`.
- **Public contract of `/api/identify` (summary):** `multipart/form-data` with 1–3 images (`image/jpeg`|`image/png`, ≤10 MB each after client pre-resize), optional `latitude`/`longitude` and `organ`; response is a normalized JSON envelope containing `success`, `cached`, `remainingQuota`, a ranked `topResult.species[]` list (scientific name, common names, family, genus, GBIF id, score, confidence band, **sources**, **images with CC-BY-SA citations**) and `careSummary` resolved from `plant_library` (or `null`). Errors consume Pl@ntNet credits ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)), so validation is duplicated client+server and invalid requests never reach Pl@ntNet.
- Attribution obligations surface here and propagate to the UI: Pl@ntNet attribution text is displayed on results; API images carry `citation` strings (CC-BY-SA style) per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Pl@ntNet (image-reuse details to verify in Phase 2, item #3 of the research log).
- Versioning: internal API is versioned implicitly with the app; the JSON envelope has a stable top-level shape (`success`, `error`?) so clients can evolve. Any breaking change gets a Changelog row in `API_DOCUMENTATION.md` + `CHANGELOG.md`.

---

## 6. Database architecture

- **Supabase Postgres (Free tier), RLS-first.** Every table gets RLS policies; the anon/authenticated keys used by the app cannot bypass them. Admin operations run through a `is_admin()` security-definer helper assigned from `auth.users` ids (canonical decision #5) — see `DATABASE_SCHEMA.md` §RLS for full SQL.
- **Ten canonical tables:** `profiles`, `plant_library`, `identifications`, `user_plants`, `care_reminders`, `saved_plants`, `blog_posts`, `contact_messages`, `app_settings`, plus optional `identification_cache`.
- **Public read surface:** *only* published `plant_library` rows and published `blog_posts`. Everything user-scoped is owner-only CRUD. `contact_messages` is insert-anyone (app-level rate limit) + admin-read.
- **Schema is not in this document.** Column definitions, enums, indexes (incl. trigram/GIN search indexes, uniques), triggers (updated_at touch, reminder `next_due_date` advance, profile-on-signup), storage buckets, migration strategy, seed data, and retention decisions are specified in [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md).
- **No ORM in MVP** — Supabase client + typed SQL migrations. Rationale in §12 (ADR-5).
- **Free-tier realities:** 500 MB DB / 1 GB storage / 50k MAU; **project pauses after ~1 week of low activity** (mitigation: `GET /api/health` pings or accept pause + manual resume in dev) and **no automatic backups** (manual dumps before each migration) — all per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Supabase.

---

## 7. Authentication architecture

### 7.1 Flows (Supabase Auth, email/password first)

| Flow | Mechanism | Notes |
|---|---|---|
| Signup | `signUp({ email, password })` on a small client component | Email-confirmation redirect → `/?confirmed=1` toast |
| Email confirm | Supabase-hosted email template → `auth/v1/verify` callback → `auth/callback` route handler | Handler exchanges code → session cookie |
| Login | same client form, session stored in cookies | Sets `sb-*` cookies for the SSR client |
| Logout | client `signOut()` + router refresh | Clears server cookie via hidden Server Action in the same step |
| Password reset | `resetPasswordForEmail` → `/auth/callback` → update form at `/account` | Rare flow; simple UI |
| Session refresh | `middleware.ts` uses `@supabase/ssr` `updateSession()` on every request | Single source of session truth for RSC |
| (Future) OAuth | Supabase Google provider (available on Free, [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Supabase) | Non-MVP; same callback route reused |

Magic links are a fallback option if email-confirm friction needs lowering — decision deferred to Phase 2 implementation.

### 7.2 Route protection

`src/middleware.ts` maintains a static set of protected URL prefixes:

```ts
const PROTECTED = ["/my-plants", "/dashboard", "/reminders", "/account", "/saved-plants", "/admin"];
```

- Unauthenticated request to any of these → redirect `/login?next=<path>`.
- `/admin` additionally requires `profiles.role = 'admin'`: the role is checked in the RSC via the session + profiles lookup, keeping middleware simple — **defense in depth**: middleware redirect is UX, RLS + `is_admin()` is security; an attacker cannot read admin data by tampering with cookies because RLS/deny-by-default blocks it at Supabase).
- `profiles` row auto-created on signup by a DB trigger (`handle_new_user()` — DATABASE_SCHEMA.md §Triggers), so role always exists for new sessions.

### 7.3 Role check pattern

```sql
-- public.is_admin() SECURITY DEFINER helper (canonical decision #5)
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;
```

Everything admin-scoped (blog/plant-library writes, admin screens, storage private-object cleanup) grants via `is_admin()` rather than raw `auth.users` superusers, and the service-role key is used **only** in trusted server modules that must bypass RLS (e.g. appending to `identification_cache`, cron-ish maintenance). `SECURITY.md` holds the full threat model.

---

## 8. Pl@ntNet integration architecture

### 8.1 Facts pinned to the research record

Quotas and rules below are cited from [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Pl@ntNet (verified 2026-11-10):

- Free plan = **500 identifications/day → HTTP 429 from midnight UTC reset**; never billed.
- **Errors also consume 1 credit** (since 2026-02-13) → validate aggressively, never forward garbage.
- **Max 20 simultaneous requests** per client → server-side semaphore (see below).
- 1–5 images per request, **same individual plant**, `image/jpeg`|`image/png`, total POST ≤ **50 MB**, Pl@ntNet auto-resizes to 1280 px on the smaller side.
- Scores are 0–1 (v2). Confidence bands (exact/likely/possible) are PlantAI-derived labels over those scores.
- API key private; PlantAI never whitelists CORS for the API (all calls proxied server-side).

### 8.2 Sequence — `POST /api/identify`

```text
 Browser                Next.js (Vercel)                    Supabase            Pl@ntNet v2
   │                          │                                │                    │
   │ 1 upload 1–3 imgs        │                                │                    │
   │ (client pre-resize ≤10MB)│                                │                    │
   ├─────────────────────────►│                                │                    │
   │                          │ 2 validation (zod, mime, size, │                    │
   │                          │   count, organ enum) — 400 fast│                    │
   │                          │ 3 rate limit (per-IP/per-user) │                    │
   │                          │ 4 perceptual hash (img-magick- │                    │
   │                          │   free JS; see ADR-7)          │                    │
   │                          ├── hash lookup ─────────────────► identification_cache │
   │                          │◄── cached normalized? ──────────┤                    │
   │                          │   [hit → skip to step 9]       │                    │
   │                          │ 5 concurrency semaphore gate   │                    │
   │                          ├── POST /v2/identify/{project} ─────────────────────► │
   │                          │    (host my-api.plantnet.org;  │                    │
   │                          │     project = all (no lat/lon)                     │
   │                          │◄─── scores, sources, images ───┼────────────────────┤
   │                          │ 6 normalize + band labels      │                    │
   │                          │   (429 upstream → 503 ours,    │                    │
   │                          │    quota-reached UI state)     │                    │
   │                          │ 7 store identification row ────►                     │
   │                          │ 8 cache put (hash → result) ───► identification_cache │
   │ 9 normalized JSON        │                                │                    │
   │◄─── + rate-limit hdrs ───┤                                │                    │
   │                          │ 10 UI renders matches; care    │                    │
   │                          │    summary resolved from       │                    │
   │                          │    plant_library match         │                    │
```

Steps 4, 7, 8 are the **quota-protection trio** (canonical decision #4): dedup cache, persistence, and graceful 503/“quota reached” states. A small in-process semaphore (≈4 concurrent upstream calls per instance) keeps total instances under Pl@ntNet's 20-concurrent ceiling; exact sizing recorded in `AI_INTEGRATION_PLAN.md`.

### 8.3 Image-selection guidance surfaced in the UI

The upload UI instructs (Phase 2): 1–3 photos of the **same** individual plant, ideally (a) a whole-plant shot, (b) a leaf top-side closeup, (c) a flower/fruit if present. Fewer-but-sharp beats more-but-ambiguous. The optional organ hint's **verified upstream enum is `leaf`/`flower`/`fruit`/`bark` (+`auto`; omitted = automatic detection)** — the current code/UI enum containing `lateral`/`root` is a **flagged mismatch** (future-work item in `TASKS.md`, to be fixed at the zod/UI + request-builder layer, not a doc fix).

### 8.4 Cache, fallbacks & regional flora

- **Project choice (corrected 2026-11-12, Stage A1):** upstream default project is **`all`** (official docs; `allplants` was a stale assumption and is NOT the documented default). **Regional flora lookup is DEFERRED and NOT in MVP:** `/v2/projects` accepts `lat`/`lon`, but calling it per-request would transmit the user's location to Pl@ntNet — PlantAI sends **no GPS coordinates upstream**; regional selection is a documented future option requiring explicit consent + privacy disclosure (`AI_INTEGRATION_PLAN.md` §2.1, `LEGAL_AND_COMPLIANCE.md` §2.6). `/v2/projects` and `/v2/languages` are documented as quota-free routes ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Pl@ntNet).
- **Cached hit:** skips upstream entirely; `remainingQuota` reports the last-known upstream figure (or cached sentinel) — exact behavior in `API_DOCUMENTATION.md`.
- **Fallback ladder:** (1) validation rejects early; (2) cache returns known results; (3) upstream 429 → our 503 + “quota reached” page state; (4) no match → 404-style user state + retry suggestions. None of these consume user-facing errors and only (3,4) consume upstream credits.
- **Non-MVP note:** the disease route `/v2/diseases/identify` is **BETA, small species/pathogen coverage, same quota** ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) — stays Phase 7 per canonical decision #8. MVP delivers **educational disease guides** (library content), not diagnosis.

---

## 9. Security architecture summary

This section is a summary; the detailed threat model, incident response, and checklist live in [`SECURITY.md`](SECURITY.md).

Key invariants:

1. **Secrets server-only:** `PLANTNET_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` never enter the client bundle (enforced by `server-only` imports + Vercel env scoping).
2. **RLS on every table** (deny by default) + `is_admin()` helper; service-role use is narrow and audited.
3. **Validate at every trust boundary:** zod on Server Actions and Route Handlers; MIME/size/count checks before any image leaves the platform (blocked upload never touch Pl@ntNet).
4. **Rate limiting at the edge-ish layer:** per-IP/per-user on `/api/identify` and `contact_messages` inserts (MVP: per-instance in-memory; documented limitation → `API_DOCUMENTATION.md` §Rate limiting strategy).
5. **No PII sprawl:** profiles hold only email/username/avatar (from Supabase auth); IPs are never stored raw — only a salted hash (DATABASE_SCHEMA.md §retention).
6. **Privacy & consent:** cookie policy + analytics choices documented in `LEGAL_AND_COMPLIANCE.md` (AdSense-related consent deferred to Phase 5 with host decision).

---

## 10. Deployment architecture

### 10.1 Hosting lifecycle (canonical decision #1)

```text
Phase 1→5 (now)          Phase 5 decision point                later
─────────────────        ───────────────────────               ───────────────────────────
Vercel Hobby ($0)        enables monetization?                 If staying on Vercel → Pro
NON-COMMERCIAL ONLY      ┌─ No → stay Hobby (keep $0)          ($20/mo; first project cost)
  • no AdSense           └─ Yes → (a) move to Netlify/         Or one-time migration to
  • no premium subs       Cloudflare free IF verified          Netlify/Cloudflare Pages
  • Contact/blog OK       commercial-eligible on their         (verify Netlify/Cf terms in
                          free tiers → migrate; OR            Phase 5, docs/VERIFIED_FACTS.md
                          (b) Vercel Pro                      research table items #1,#2)
```

- The Hobby plan's fair-use guidelines explicitly list AdSense inclusion as commercial usage; running ads on Hobby would violate Vercel's ToS ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) §Vercel, verified 2026-11-10). This is the project's **most important hosting constraint** and gates Phase 5.
- Hobby caps at a glance (100 GB transfer, 1M function invocations, 5k image transformations) are ample for MVP scale; overage just pauses features until the next day/30-day window, no bill ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).
- **Migration story:** standard Next.js App Router project; no Vercel-specific APIs in `src/` (no `@vercel/*` packages beyond optional Image config). Migration = point domain at new host, adjust Node runtime notes (`migrate` from `DEPLOYMENT_GUIDE.md`). Netlify/Cloudflare OpenNext compatibility is listed **UNVERIFIED** in the research log ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) items #1–2) — re-verify if that path is chosen.

### 10.2 Environments & env vars

| Environment | Where | Notes |
|---|---|---|
| local dev | `.env.local` (never committed) | Supabase project used for dev |
| preview | Vercel preview per PR | same Supabase or a staging project if affordable (Free allows 2 active projects — plenty) |
| production | Vercel deploy from `main` | Canaries: rate-limit/health checks first |

Full list of variables & rotation procedure: `ENVIRONMENT_SETUP.md`. Migration/deployment runbooks: `DEPLOYMENT_GUIDE.md`.

---

## 11. Scalability path

| Pressure point | MVP state | Trigger to act | Action |
|---|---|---|---|
| Pl@ntNet identify quota | 500/day free ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) | repeated 503s + cache hit-rates high but demand >supply | (a) raise cache aggressiveness (2–d image variants), (b) paid Pl@ntNet plan (Pro pricing **UNVERIFIED** — research item #4), (c) surface “quota reached” messaging patterns |
| Supabase DB size / stress | Free 500 MB, no backups; identification rows + cache grow | >60% DB usage or pause-risk | Purge policy (DATABASE_SCHEMA.md §retention), then Supabase Pro from $25/mo (verified in [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) |
| Storage size | 1 GB total | >80% | Retention pruning, then Pro; move eligible images to plant-images CDN-backed bucket |
| Traffic / function load | Hobby serverless thresholds | sustained peaks near caps | Vercel-then-upgrade-or-migrate as in §10.1 |
| Search performance | trigram/GIN indexes within Postgres | p95 page latency regression | Postgres full-text tsvector indexes (still free) before any external search service |
| Concurrency (upstream 20 max) | in-instance semaphore | multi-instance throttling entropy | Durable counter (Supabase table or Redis) — see ADR-8 |

Scale is not a risk at MVP levels: the free tiers comfortably cover MVP-scale traffic; planned upgrades (retention, then Pro) are cheaper than premature optimization from day 1.

---

## 12. Key architectural decisions record (ADR)

| # | Decision | Status | Alternatives considered | Rationale |
|---|---|---|---|---|
| ADR-1 | **Server-side proxy for all Pl@ntNet calls** | Approved | Browser-direct with CORS whitelisting; edge function; separate backend | Key privacy (server-side only, no CORS whitelisting per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)); central rate-limit/dedup/quota control; no extra infra |
| ADR-2 | **Vercel Hobby → upgrade to Pro OR migrate at monetization** | Approved | Start on dedicated VPS; start on Netlify | $0 path meets cost goal; ToS forbids ads on Hobby (verified); Next.js portability keeps option open; migration risk is low deliberately (ADR-4 supports it) |
| ADR-3 | **Server Actions over REST for mutations** | Approved | REST Route Handlers; tRPC | Fewer files, zod-validated, no client fetch layer, RSC-native refresh; identity/CSRF ergonomic via `@supabase/ssr` cookies; binary identify is the one handler that truly needs HTTP semantics |
| ADR-4 | **No Next.js API-layer beyond `/api/identify` in MVP** | Approved | Full REST API | There is no second client (no other consumer); an API nobody calls is a maintenance cost. Route Handlers catalog re-opened in Phase 5/7 as needed |
| ADR-5 | **No ORM in MVP** (Supabase client + SQL migrations) | Approved | Prisma/Drizzle ORM | Migrations in repo = portable & cheap; row types generated via TS or Supabase codegen; keeps schema authority idiomatic Postgres; Prisma adds a migration pipeline + runtime cost, can be adopted later without data model change |
| ADR-6 | **RLS-first, single `is_admin()` helper** | Approved | App-layer-only permissions; per-service roles | Data-level guarantee; the app client and the admin back-office share the same rules; less code to forget |
| ADR-7 | **Manual minimal service worker for PWA (Phase 6)** | Approved | next-pwa / Workbox | Slim surface, no dependency (zero-budget), well-documented hand-written precache; Room for Workbox later if offline needs grow (mark `sw.js` timestamps in CHANGELOG) |
| ADR-8 | **In-memory rate limiter MVP → durable counter Phase 5 (optional)** | Approved | Supabase `app_settings`-like counter table now; Redis now | Zero new infra to start; serverless instances share state poorly — documented honestly (UNVERIFIED for exact Vercel instance-churn behavior) with a dedicated migration trigger; counter table version = current recommendation if/when needed |
| ADR-9 | **Supabase publishable-key env naming** — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not the legacy anon-key name) | Approved (owner decision, 2026-11-10) | Keep legacy name | Matches the owner's actual dashboard credential and current Supabase docs; browser-safe pair unchanged in nature; ADR later renames nothing else |
| ADR-10 | **Next.js 16 + Tailwind 4 chosen at scaffold** (verified current stable 2026-11-10) | Approved | Pin Next 15 / Tailwind 3 | `create-next-app@latest` gave Next 16.4.6 / Tailwind 4.3.3 CSS-first tokens; incorporates Next-16 facts: `proxy.ts` replaces `middleware.ts` (Phase 2 route protection uses `proxy.ts`), dynamic `params` is a Promise, Cache Components prerender rules (static footer year; `params` reads inside `<Suspense>` for `[slug]` stubs); recorded in CHANGELOG 0.2.0 |
| ADR-9 | **Tailwind CSS only (no UI kit)** | Approved | shadcn/ui; Chakra; antd | Bundle-fit with server-first; full control for mobile-first, green-nature tokens (UI_UX_DESIGN.md); zero-cost, zero-lock-in |
| ADR-10 | **Disease AI deferred to Phase 7 BETA** | Approved | Ship disease identification in MVP | Pl@ntNet disease route is BETA with limited species/pathology coverage (verified); misrepresentation risk + quota pressure; MVP faithfully delivers educational guides instead |

Decisions marked *Approved* may be revisited with a new row and a `CHANGELOG.md` entry; never silently changed.

---

## 13. Risks & limitations

| Risk | Severity | Mitigation | Owner/phase |
|---|---|---|---|
| **Vercel commercial clause** — ads/premium on Hobby breach ToS (verified) | High (deployment could be disabled without notice) | Strict gate: monetization only after Phase 5 host decision (Pro or migration); CI guard: no AdSense script in any hobby deploy | Architect — Phase 5 hard gate |
| **Supabase free project pause** (~1 week of low DB activity; verified) | Medium | `GET /api/health` cron-ish pings during dev OR accept pause + manual resume (data preserved); attention on production from Phase 5 | Dev — phases 1–4 |
| **No Supabase backups on Free** (verified) | Medium | Manual `pg_dump`/SQL dump before every migration + scheduled docs later (DATABASE_SCHEMA.md §Backups) | Dev — every migration |
| **Pl@ntNet quota nature** — 500/day hard free cap; **errors consume credits** too (verified) | High for MVP UX | Pre-validation, hash cache, rate limits (5/day anon, 20/day auth, adjustable in `app_settings`), graceful quota states; monitor from day 1 | Dev — Phase 2 |
| **Beta disease route** — limited coverage, same quota pool (verified) | Low (deferred) | Clearly out of MVP; UI copy never implies diagnosis; revisit Phase 7 with coverage data | Product — Phase 7 |
| **In-memory rate limiter across serverless instances** may be ineffective (concurrency sharing not guaranteed) | Medium | Honest ADR-8; durable-counter escalation path prepared; affects abuse-resistance not core function | Architect — monitor Phase 2–5 |
| **Vercel Hobby usage caps** (transfer/invocations) | Low for MVP | Usage triage in dashboards; overage pause not billing (verified); escalate host plan at Phase 5 | Dev — continuous |
| **Netlify/Cloudflare migration unknowns (commercial-use terms + Next.js compat)** | Medium if pursued | Research items #1–2 in [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) pending verification; OpenNext adapter known pattern but **UNVERIFIED** for our stack | Architect — Phase 5 |
| **Image licensing complexities** (CC-BY-SA attribution obligations on API images) | Medium | Attribution text + citation strings everywhere results/images render; image-reuse detail flagged as research item #3 for Phase 2 | Dev — Phase 2 |
| **Single-maintainer bus factor** | Medium | All knowledge in docs (`TASKS.md`, `CHANGELOG.md`), zero-budget stack, migrations in repo | Whole project — continuous |

---

*End of ARCHITECTURE.md.*
