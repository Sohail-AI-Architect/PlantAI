# PlantAI — Requirements

> **Document:** REQUIREMENTS.md · **Phase:** 0 (Planning & Documentation) · **Status:** Draft for user approval
>
> Defines all functional (FR), non-functional (NFR), user, admin, business, and technical requirements for the PlantAI platform, plus acceptance criteria for every MVP requirement group. Requirement IDs are **stable and traceable** into TASKS.md and TESTING_PLAN.md (see §Requirement traceability).
>
> Sibling documents: PROJECT_PLAN.md (plan & phases), DEVELOPMENT_ROADMAP.md (per-phase tasks), ARCHITECTURE.md (system design), DATABASE_SCHEMA.md (tables & RLS), API_DOCUMENTATION.md (routes & Pl@ntNet contract), UI_UX_DESIGN.md (screens & states), SEO_STRATEGY.md, SECURITY.md, TESTING_PLAN.md, MONETIZATION_PLAN.md, LEGAL_AND_COMPLIANCE.md, CONTENT_STRATEGY.md, AI_INTEGRATION_PLAN.md, ENVIRONMENT_SETUP.md (env vars & commands), DEPLOYMENT_GUIDE.md, CHANGELOG.md, docs/VERIFIED_FACTS.md.
>
> **Tiers (canonical):** Tier 1 = MVP identification core · Tier 2 = Content/SEO · Tier 3 = Personal plant management · Tier 4 = Monetization/PWA/production · Tier 5 = Future. Note: because Phase 3 (library/content) is part of the MVP, MVP = Tiers 1–2 through `/library`, `/plant/[slug]`, and static pages, per PROJECT_PLAN.md §5.

---

## Table of Contents

1. [Functional Requirements — Tier 1 (MVP identification core)](#1-functional-requirements--tier-1-mvp-identification-core)
2. [Functional Requirements — Tier 2 (Content & SEO, part of MVP)](#2-functional-requirements--tier-2-content--seo-part-of-mvp)
3. [Functional Requirements — Tier 3 (Personal plant management)](#3-functional-requirements--tier-3-personal-plant-management)
4. [Functional Requirements — Tier 4 (Monetization, PWA, production)](#4-functional-requirements--tier-4-monetization-pwa-production)
5. [Functional Requirements — Tier 5 (Future)](#5-functional-requirements--tier-5-future)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [User Requirements (Personas)](#7-user-requirements-personas)
8. [Admin Requirements](#8-admin-requirements)
9. [Business Requirements](#9-business-requirements)
10. [Technical Requirements](#10-technical-requirements)
11. [Acceptance Criteria — MVP Groups](#11-acceptance-criteria--mvp-groups)
12. [Requirement Traceability](#12-requirement-traceability)

---

## 1. Functional Requirements — Tier 1 (MVP identification core)

### 1.1 Homepage (route `/`)

| ID | Requirement |
|----|-------------|
| FR-HOME-001 | Homepage presents the app identity, a primary CTA "Identify a plant" linking to `/identify`, and a secondary CTA to `/library`. |
| FR-HOME-002 | Homepage renders with no JS required for core content (server component); interactive parts progressively enhance. |
| FR-HOME-003 | Homepage explains honestly what identification does and does not do (confidence estimates; no disease diagnosis in MVP — canonical decision #10 wording from CONTENT_STRATEGY.md). |

### 1.2 Upload experience (route `/identify`)

| ID | Requirement |
|----|-------------|
| FR-UP-001 | `/identify` provides image selection via file picker **and** mobile camera capture (`accept="image/jpeg,image/png"` + `capture` hint). |
| FR-UP-002 | Drag & drop zone with visible dashed target, per UI_UX_DESIGN.md. |
| FR-UP-003 | **Client validation:** JPEG or PNG only; max **10 MB**; wrong type/size → inline error before any upload. |
| FR-UP-004 | **Server validation:** `/api/identify` re-validates MIME type and ≤ 10 MB size; invalid requests return a typed error body without calling Pl@ntNet (quota protection — errors also consume Pl@ntNet quota per `docs/VERIFIED_FACTS.md`). |
| FR-UP-005 | Optional client-side downscale/compress before upload, so a 12-MP phone photo ships smaller than the hard limit (server limit remains the authoritative gate). |
| FR-UP-006 | Upload shows a progress/loading state with tips ("photograph the whole leaf…"), per UI_UX_DESIGN.md loading state. |

### 1.3 Identification flow (Route Handler `/api/identify`)

| ID | Requirement |
|----|-------------|
| FR-ID-001 | Identification POSTs to **server-side Pl@ntNet v2 proxy** (Route Handler `/api/identify`); the API key never reaches the browser (canonical decision #3). |
| FR-ID-002 | **Rate limits:** anonymous IPs ≤ **5 identifications/day**, authenticated users ≤ **20/day** (both defaults stored in/adjustable via `app_settings`); over-limit → typed 429 response (canonical decision #4). |
| FR-ID-003 | **Image-hash dedup:** identical image (content hash) within the dedup window returns the cached Pl@ntNet result without a new API call; cache access recorded in `identification_cache` (optional table, DATABASE_SCHEMA.md). |
| FR-ID-004 | Loading state during identification; network timeouts produce a friendly retry error, never a raw stack trace. |
| FR-ID-005 | **Quota-reached state:** when the internal per-user/IP limit or the upstream Pl@ntNet daily quota (HTTP 429 until midnight UTC reset, `docs/VERIFIED_FACTS.md`) is hit, UI shows a dedicated "quota reached" state with next steps (sign in for a higher limit / come back later), per UI_UX_DESIGN.md. |
| FR-ID-006 | **Degraded state:** if Pl@ntNet is unreachable or returns unexpected errors, UI shows a "service temporarily unavailable" state and the identity of the failure is logged server-side (AI_INTEGRATION_PLAN.md failure matrix). |
| FR-ID-007 | Each unauthenticated identification attempt increments the IP counter; authenticated attempts the user counter; both are recorded for abuse view (§Admin). |
| FR-ID-008 | Pl@ntNet attribution text + "Powered by Pl@ntNet" is displayed with every result set (canonical decision #9; recommended sentence in `docs/VERIFIED_FACTS.md`). |

### 1.4 Results display (part of `/identify`)

| ID | Requirement |
|----|-------------|
| FR-RES-001 | Results show **top matches** (top 3 by default) with: image(s) with caption/credit, scientific name, common name(s), and a **confidence score** rendered as a labeled bar (0–1 scale per `docs/VERIFIED_FACTS.md`). |
| FR-RES-002 | Each result links to `/plant/[slug]` when the species exists in `plant_library` (published only); otherwise shows a subtle "not in our library yet" state. |
| FR-RES-003 | Results include a **care summary card** for the matched species when library data exists (watering/sunlight snippet + link for details). |
| FR-RES-004 | Third-party images carry **CC-BY-SA-style citation** text (canonical decision #9; detailed reuse rules — Phase 2 verification per `docs/VERIFIED_FACTS.md` pending item 3). |
| FR-RES-005 | If identified plant is pet-toxic and that flag exists in library data, a clear pet-safety notice renders (source: human-curated flag, never AI-invented). |
| FR-RES-006 | User can save an identified plant to /saved-plants **after signing in** with a non-destructive sign-in nudge. |

### 1.5 Auth (canonical decision #2 — Supabase Auth; owner-approved direct Google OAuth)

| ID | Requirement |
|----|-------------|
| FR-AUTH-001 | `/login` and `/signup` each render one accessible **Continue with Google** action backed by Supabase Auth; no credential form is shown. |
| FR-AUTH-002 | Sign-in uses `signInWithOAuth({ provider: "google" })` with PKCE and a `safeAuthPath()`-validated `next`; `/auth/callback` exchanges the code with the server client and writes SSR cookies. |
| FR-AUTH-003 | The first verified Google sign-in creates the canonical `auth.users.id` UUID and `profiles` row via the existing trigger; returning sign-in resolves the same account through Supabase automatic identity linking. Different verified Google emails remain separate accounts. |
| FR-AUTH-004 | Normal-use UI has no email/password, magic-link, resend-confirmation, forgot-password or reset-password control. Legacy `/auth/confirm` and `/auth/link` verification/forwarding remain for rollback; completing an old recovery link requires restoring the retired reset form from version control. |
| FR-AUTH-005 | **Logout** clears the session with a guaranteed local fallback, refreshes the client, and redirects to `/login`; protected pages re-check claims. |
| FR-AUTH-006 | On first sign-in, a `profiles` row is created (trigger per DATABASE_SCHEMA.md) with `role = 'user'`; no client-supplied id, email, role or Google profile field is trusted. |
| FR-AUTH-007 | Header auth state (login link vs avatar menu) updates after every auth transition — no hard refresh required. |
| FR-AUTH-008 | Google provider configuration is owner-only (`docs/GOOGLE_OAUTH_SETUP.md`); Email stays enabled for rollback; no Firebase, custom JWT, or custom identity-merge integration. |

### 1.6 Plant detail page (Tier 1 preview, Tier 2 fullness)

| ID | Requirement |
|----|-------------|
| FR-PLANT-001 | `/plant/[slug]` renders a published plant page: image gallery, scientific + common names, family, care summary, attribution, internal links. |
| FR-PLANT-002 | Unpublished/nonexistent slug ⇒ 404 page (not empty page), with SEO-friendly 404 behavior per SEO_STRATEGY.md. |
| FR-PLANT-003 | Page content is served statically/ISR where possible for search performance (ARCHITECTURE.md rendering strategy). |

## 2. Functional Requirements — Tier 2 (Content & SEO, part of MVP)

| ID | Requirement |
|----|-------------|
| FR-LIB-001 | `/library` lists published plants with pagination and tidy cards; only `published` rows appear (canonical decision #5). |
| FR-LIB-002 | `/library?q=` filters by scientific/common name (case-insensitive, server-side filtering per API_DOCUMENTATION.md). |
| FR-LIB-003 | Plant pages include care guide sections: **Watering, Sunlight, Soil, Fertilizer** (structure per CONTENT_STRATEGY.md). |
| FR-LIB-004 | **Disease education content:** human-written guides about common plant diseases/symptoms, clearly framed as education, never as AI diagnosis (canonical decision #10). |
| FR-SEO-001 | Static pages exist at `/about`, `/contact`, `/privacy`, `/terms` (+ `/cookie-policy` content requirement tied to Phase 5 consent per LEGAL_AND_COMPLIANCE.md — page itself ships in Phase 3 per canonical route set). |
| FR-SEO-002 | Sitemap.xml, robots.txt, canonical URLs, and structured data per SEO_STRATEGY.md. |
| FR-SEO-003 | Blog shell at `/blog` + `/blog/[slug]` publishing human-edited posts (`blog_posts` published rows visible, per canonical decision #5). |
| FR-CNT-001 | Contact form posts (via Server Action) to `contact_messages` with spam-protection honeypot (SECURITY.md); visible success + failure states per UI_UX_DESIGN.md. |
| FR-SEO-LP-001 | SEO landing-page pattern (keyword → content page) supported by `/plant/[slug]` + `/blog/[slug]` per SEO_STRATEGY.md keyword map. |

## 3. Functional Requirements — Tier 3 (Personal plant management — post-MVP)

| ID | Requirement |
|----|-------------|
| FR-MP-001 | `/my-plants`: add identified or library plants to personal collection with nickname + notes (`user_plants`). |
| FR-SP-001 | `/saved-plants`: bookmark/unbookmark plants from results & library (`saved_plants`); reachable by visitors-who-signed-in only. |
| FR-REM-001 | `/reminders`: full **CRUD** for care reminders (`care_reminders`: type watering/fertilizing, cadence, next due). |
| FR-REM-002 | Reminders surfaced on `/dashboard` as "due/overdue" list; no push notifications in MVP tiers (email later, optional). |
| FR-DASH-001 | `/dashboard`: personal stats — plants owned, reminders due this week, total identifications, saved count. |
| FR-ACC-001 | `/account`: view/edit profile fields; logout; delete-account request path (LEGAL_AND_COMPLIANCE.md GDPR posture). |
| FR-ADMIN-001 | `/admin` (role `admin` only): moderate plant library (create/edit/publish), moderate blog posts, view contact inbox, view identifications abuse stats (§8). |
| FR-DASH-002 | Nav structure adds signed-in personal routes `/my-plants`, `/saved-plants`, `/dashboard`, `/reminders`, `/account` (canonical decision #7). |

## 4. Functional Requirements — Tier 4 (Monetization, PWA, production — post-MVP)

| ID | Requirement |
|----|-------------|
| FR-MON-001 | Ad slot components exist but render empty (no ad JS) until Phase 5 gates pass (MONETIZATION_PLAN.md; never on Vercel Hobby — canonical decision #1). |
| FR-MON-002 | Cookie-consent banner + `/cookie-policy` activate only when ad/analytics scripts enable (LEGAL_AND_COMPLIANCE.md). |
| FR-MON-003 | `ads.txt` published only after AdSense approval, with provided publisher ID (`docs/VERIFIED_FACTS.md`). |
| FR-PWA-001 | Installable PWA: manifest, icons, maskable art, offline shell for cached routes (Phase 6). |
| FR-PWA-002 | Install prompt UX per UI_UX_DESIGN.md; never nagging (dismissal respected ≥ n days). |
| FR-PROD-001 | Production deployment config (pipeline, previews, env hygiene) per DEPLOYMENT_GUIDE.md; hosting decision (Vercel Pro vs migration) documented before any monetization flag flips. |

## 5. Functional Requirements — Tier 5 (Future)

| ID | Requirement |
|----|-------------|
| FR-FUT-001 | Android app via Capacitor wrapping the same web app; gated on Google Play $25 one-time fee verification (**UNVERIFIED** until Phase 7 — `docs/VERIFIED_FACTS.md`). |
| FR-FUT-002 | AdMob integration (UNVERIFIED policies until Phase 7). |
| FR-FUT-003 | Premium subscription (e.g. ad-free); requires paid-capable hosting state first. |
| FR-FUT-004 | Pl@ntNet **diseases BETA** exploration: separate research spike with explicit "beta-quality" disclaimers; never marketed as full disease diagnosis (canonical decision #10). |
| FR-FUT-005 | Google OAuth sign-in — **superseded by FR-AUTH-001..008** and implemented in normal-use UI; owner provider configuration and real E2E remain pending. |

## 6. Non-Functional Requirements

### Performance

| ID | Requirement |
|----|-------------|
| NFR-P-001 | LCP < 2.5 s on 4G-throttled mobile for `/`, `/identify`, `/library`, `/plant/[slug]` (G4 target: < 2 s stretch). |
| NFR-P-002 | Lightweight client JS: server components by default; identify page client JS budget reviewed at Phase 3 code-freeze. |
| NFR-P-003 | Images served via Next Image optimization (Vercel Hobby includes 5,000 transformations/mo, `docs/VERIFIED_FACTS.md`); explicit width/height to prevent CLS > 0.1. |
| NFR-P-004 | Identification round-trip end-to-end **< 15 s** typical (G1) excluding user upload time. |

### Accessibility

| ID | Requirement |
|----|-------------|
| NFR-A-001 | **WCAG 2.1 AA** target for all MVP routes; keyboard operability & visible focus everywhere. |
| NFR-A-002 | Form inputs have visible, programmatically associated labels and error messages (aria-live for async errors). |
| NFR-A-003 | Color contrast ≥ 4.5:1 text; confidence bars carry a text label (not color-only). |

### Security

| ID | Requirement |
|----|-------------|
| NFR-S-001 | All secrets server-side only; **no API key in client bundle**; no `NEXT_PUBLIC_` secret variables (canonical decision #3; SECURITY.md). |
| NFR-S-002 | **RLS on every table**; only published `plant_library` + `blog_posts` rows public; `profiles.role` checked for admin routes (canonical decision #5). |
| NFR-S-003 | Rate limiting + dedup as implemented per FR-ID-002/003; abuse observable in admin (`FR-ADMIN-004`). |
| NFR-S-004 | Uploads validated twice (client + server) with strict MIME/size checks; server never trusts client claims (canonical decision #4 rationale). |
| NFR-S-005 | Server Actions validate auth/role server-side; no privileged action trusts client metadata. |

### Privacy

| ID | Requirement |
|----|-------------|
| NFR-PR-001 | Minimal data: store only what features need (identification metadata, hashed image for dedup/workspace hygiene — no permanent bulk photo storage in MVP). |
| NFR-PR-002 | GDPR-aware posture: privacy policy, account deletion path, data inventory table in LEGAL_AND_COMPLIANCE.md; consent UX only where tracking requires it. |
| NFR-PR-003 | No selling data; no third-party trackers in MVP (analytics deferred to Phase 5 decision). |

### Reliability

| ID | Requirement |
|----|-------------|
| NFR-R-001 | **Graceful degradation** when Pl@ntNet quota hit or upstream down: specific designed UI states (FR-ID-005/006), never blank screens. |
| NFR-R-002 | All external calls have timeouts + typed error handling (AI_INTEGRATION_PLAN.md matrix). |
| NFR-R-003 | Supabase pause scenario documented + dev-start health check (R3 mitigation, PROJECT_PLAN.md §9). |

### Compatibility & responsiveness

| ID | Requirement |
|----|-------------|
| NFR-B-001 | Support **last 2 versions** of Chrome, Firefox, Safari, Edge (desktop) + **Android Chrome**; iOS Safari best-effort (no native app promise). |
| NFR-B-002 | Responsive breakpoints per UI_UX_DESIGN.md (mobile-first); usable at 360 px width; no horizontal scrolling on core pages. |
| NFR-B-003 | TypeScript **strict** mode; no `any` escapes in committed product code. |

## 7. User Requirements (Personas)

Source persona detail lives in UI_UX_DESIGN.md; the requirement-relevant summary:

| Persona | Story | Must-have MVP capabilities | Tier |
|---------|-------|----------------------------|------|
| **Casual plant owner** ("Maya") | Found a mystery plant; worried about her cat | Fast identify (G1), results with confidence + pet-safety flag (FR-RES-001/005), care summary (FR-RES-003), no signup wall before first result | 1–2 |
| **Plant hobbyist** ("Deniz") | 30+ plants; wants a routine | Account, My Plants, reminders, dashboard (Tier 3 FRs) | 3 |
| **Content researcher / SEO visitor** ("Priya") | Lands from Google on "how often to water monstera" | Fast readable `/plant/[slug]`, structured headings, internal links to `/identify`, credible sources/attribution | 2 |

Derived rule: **a signed-out visitor must reach results without signup** (soft signup only for saving), so the MVP funnel stays short.

## 8. Admin Requirements

| ID | Requirement |
|----|-------------|
| FR-ADMIN-001 | Role model: `profiles.role ∈ {'user','admin'}`; admin bootstrap uses a manually flipped role in SQL (SECURITY.md procedure) — never self-service signup to admin. |
| FR-ADMIN-002 | Moderation of **plant library**: create, edit, publish/unpublish; draft preview. |
| FR-ADMIN-003 | Moderation of **blog posts**: create, edit, publish/unpublish; editing by slug. |
| FR-ADMIN-004 | **Identifications abuse view:** recent attempts, per-IP/user counters, dedup hit-rate, quota consumption — enough to retune `app_settings` limits. |
| FR-ADMIN-005 | **Contact inbox:** list, mark handled, archive `contact_messages`. |
| FR-ADMIN-006 | All admin routes server-guarded; role check server-side on every request (NFR-S-002/005). |

## 9. Business Requirements

| ID | Requirement |
|----|-------------|
| FR-BIZ-001 | Site is AdSense-**ready** by Phase 5: policy pages complete, navigable live site, original content threshold met, reasonable ad density plan (MONETIZATION_PLAN.md) — **approval is not guaranteed; revenue is not guaranteed; never claim otherwise** (`docs/VERIFIED_FACTS.md` §Google AdSense). |
| FR-BIZ-002 | License/attribution display: Pl@ntNet attribution sentence + "Powered by Pl@ntNet" in UI & on plant pages; CC-BY-SA citations wherever third-party images render. |
| FR-BIZ-003 | Privacy policy links from footer on all pages; advertising-cookie disclosure exists in copy/structure before any ad-enabling (legal page ships Phase 3, disclosure activation Phase 5 per LEGAL_AND_COMPLIANCE.md). |
| FR-BIZ-004 | SEO: per SEO_STRATEGY.md (sitemap, robots, structured data, internal linking, keyword-mapped content). |
| FR-BIZ-005 | Cost ledger in MONETIZATION_PLAN.md stays truthful: all documented first-cost events (Supabase Pro from $25/mo; Vercel Pro $20/mo; Google Play $25 one-time — sources `docs/VERIFIED_FACTS.md`, Play fee UNVERIFIED until Phase 7). |

## 10. Technical Requirements

| ID | Requirement |
|----|-------------|
| FR-TEC-001 | **Stack:** Next.js App Router + TypeScript (strict) + Tailwind CSS + Supabase + Pl@ntNet API v2; canonical decisions #1–#11 in PROJECT_PLAN.md govern where specifics live (details in ARCHITECTURE.md & doc set). |
| FR-TEC-002 | Dev platform: **Windows + VS Code + OpenCode**; Node.js + npm + Git required locally (see ENVIRONMENT_SETUP.md for versions/setup — Node LTS target **UNVERIFIED**, confirm at Phase 1). |
| FR-TEC-003 | Mutations via **Next.js Server Actions** where practical; **Route Handlers** for `/api/identify` and future integrations; Pl@ntNet key server-side only (canonical decision #3). |
| FR-TEC-004 | **Canonical tables:** profiles, plant_library, identifications, user_plants, care_reminders, saved_plants, blog_posts, contact_messages, app_settings (+ identification_cache) — full shapes in DATABASE_SCHEMA.md; RLS everywhere. |
| FR-TEC-005 | **Env vars placeholder list** (values only in ENVIRONMENT_SETUP.md): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `PLANTNET_API_KEY` (server-only), `NEXT_PUBLIC_SITE_URL`. |
| FR-TEC-006 | URL set exactly per canonical decision #7 (`/`, `/identify`, `/plant/[slug]`, `/library`, `/my-plants`, `/saved-plants`, `/dashboard`, `/reminders`, `/account`, `/blog`, `/blog/[slug]`, `/about`, `/contact`, `/privacy`, `/terms`, `/cookie-policy`, `/login`, `/signup`, `/admin`). |
| FR-TEC-007 | Deploy target: Vercel Hobby while non-commercial; Phase 5 gate governs PaaS escalation/migration (canonical decision #1). |

## 11. Acceptance Criteria — MVP Groups

Format: Given / When / Then. IDs reference the requirement groups above.

### 11.1 Group: Capture; Groups: Upload, Auth, Flow, Results, Access, Learn, Contact (MVP)

| Group | AC ID | Given | When | Then |
|-------|-------|-------|------|------|
| Capture | AC-UP-1 | User is on `/identify` with a valid < 10 MB JPEG of a clear plant photo | They select the file and submit | Identification begins; loading state shows practical photo tips |
| Upload | AC-UP-2 | User selects a 12 MB JPEG | Upload is attempted | Inline client-side error stops submission; **no network call is made** |
| Upload | AC-UP-3 | User selects a 2 MB GIF | Upload is attempted | "JPEG/PNG only" error; no network call |
| Upload | AC-UP-4 | Attacker POSTs an oversized/bad-MIME body straight to `/api/identify` | Server validates | Typed error returned; **no Pl@ntNet call** consumed (quota protected) |
| Upload | AC-UP-5 | Anonymous user already used 5 successful identifications today | They attempt a 6th | Dedicated quota-reached state with sign-in suggestion & daily-limit copy |
| Auth | AC-AU-1 | New visitor with a verified Google account | Clicks Continue with Google on `/login` or `/signup` | Supabase creates a canonical UUID user + `profiles` row with `role='user'`; header shows account menu |
| Auth | AC-AU-2 | Returning Google user | Clicks Continue with Google again | Same UUID and data are restored through Supabase automatic identity linking |
| Auth | AC-AU-3 | Existing local account with the same verified email | Owner enables Google and the user signs in | Supabase links the identity to the original UUID if permitted; a different verified Google email remains a separate account |
| Auth | AC-AU-4 | Signed-out user | Clicks logout | SSR cookies cleared; protected routes redirect to `/login?next=…`; auth-gated nav entries disappear without reload |
| Flow | AC-FL-1 | Anonymous user on first identification | Upload completes | Results render top-3 matches + confidence bars + attribution text ("< 15 s" typical per NFR-P-004) |
| Flow | AC-FL-2 | Pl@ntNet unreachable (simulated) | Upload completes | Degraded "temporarily unavailable" state with retry; no raw errors |
| Flow | AC-FL-3 | Upstream daily quota exhausted (HTTP 429 from Pl@ntNet) | Upload completes | Quota-reached state explains reset at midnight UTC; no crash |
| Flow | AC-FL-4 | Same image re-uploaded within dedup window | Second identification | Cached result returned; server logs show no second Pl@ntNet call |
| Results | AC-RE-1 | Identification matches a species present in published `plant_library` | Result card shown | Care summary + link to `/plant/[slug]` present; images carry CC-BY-SA citation |
| Results | AC-RE-2 | Identification returns only species not in the library | Result card shown | Friendly "not in our library yet" state; still names the species |
| Access | AC-LIB-1 | Visitor | Opens `/library` | Only published plants listed; `?q=monstera` filters correctly server-side |
| Access | AC-LIB-2 | Visitor opens unpublished slug | — | Proper 404; no draft leak |
| Access | AC-LIB-3 | Visitor | Opens `/plant/[slug]` | Gallery, names, care sections (watering/sunlight/soil/fertilizer), attribution, internal links |
| Learn | AC-CT-1 | Visitor | Submits contact form successfully via Server Action | `contact_messages` row created; success state shown |
| Learn | AC-CT-2 | Bot fills hidden honeypot field | Form submits | Silently rejected; no row created |
| Contact | AC-STATIC-1 | Visitor | Opens `/about`, `/privacy`, `/terms` | Fully rendered server-rendered pages, footer receives links from all routes |

### 11.2 Non-functional spot-checks (linked ACs)

| AC ID | Given | When | Then |
|-------|-------|------|------|
| AC-NFR-1 | Any MVP route audited in Lighthouse (mobile) | Audit runs | SEO > 90; LCP < 2.5 s; no CLS regression (G3/G4) |
| AC-NFR-2 | Keyboard-only user | Traverses `/identify` flow | All controls reachable/operable; focus visible (NFR-A-001) |
| AC-NFR-3 | `grep` over built client bundle | Build output inspected | No `PLANTNET_API_KEY` / service-role secret present (NFR-S-001) |
| AC-NFR-4 | Direct DB query as anon role | Attempts writes to protected tables | RLS denies all but allowed paths (NFR-S-002) |

## 12. Requirement Traceability

- **TASKS.md** reuses FR-*/NFR-* IDs next to each task so any task maps to requirement(s); a task without a requirement link must state why.
- **TESTING_PLAN.md** maps every AC-* (and AC-UP/…/AC-NFR blocks above) to test cases; every MVP FR requires ≥ 1 test entry or a documented reason (manual-only, e.g. some UX copy checks).
- **Change discipline:** adding/removing features here requires a PROJECT_PLAN.md §Scope note + CHANGELOG.md entry, and TASKS.md/TESTING_PLAN.md updates in the same change set.
