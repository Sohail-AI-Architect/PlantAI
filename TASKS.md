# PlantAI — Master Task List

> Single source of truth for project tasks. Update this file whenever tasks change.
> Statuses: ⬜ Pending · ✅ Completed · 🚧 In progress · ⛔ Blocked · ➡️ Deferred to a later phase.
> Reference documents: [PROJECT_PLAN.md](PROJECT_PLAN.md) · [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) · [REQUIREMENTS.md](REQUIREMENTS.md) · [docs/VERIFIED_FACTS.md](docs/VERIFIED_FACTS.md)

**Last updated: 2026-11-15 (imagery + camera session - real species photography across the app + live getUserMedia capture in the identify flow; see CHANGELOG [0.9.1]; prior: Fast MVP completion [0.9.0])**

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
| Current phase | **Fast MVP completion (2026-11-15) — customer-facing app, security, SEO/PWA done; awaiting owner review + owner-gated operations** |
| Completed in phase | Fast MVP completion (2026-11-15), building on the Phase 2 auth/identify base: **Stage C** — completed home (identify CTA + disclaimer), library (real published rows + `?q=` search across all fields incl. `common_names[]`), saved-plants management view (RLS join + remove, honest unavailable-species handling), dashboard (real saved count + truthful persistence state), blog listing + post pages (real `blog_posts` queries, dependency-free `MarkdownLite`, no raw HTML), contact form → `submitContact` Server Action (honeypot fake-success, zod validation, 3/day per-IP-hash rate limit, RLS insert), truthful pending pages (my-plants/reminders/account), root 404 + error boundary, pet-safety notice, nav dedupe. **Stage D** — all 5 security headers (`next.config.ts`), noindex on auth/user routes. **Stage E** — robots.txt, sitemap.xml (real lastmod), PWA manifest + icon, per-species/per-article metadata + breadcrumbs/JSON-LD, image attribution. **Stage G** — `tests/contact-action.test.ts` 14 cases; full suite **150/150**; lint/typecheck clean; build exit 0 (29 routes); headers + robots + noindex verified live. See `CHANGELOG.md` [0.9.0] |
| Exit criteria | Owner review of `CHANGELOG.md` [0.9.0] + the mission final report; then owner-gated operations (migration 005, persistence, live mode, admin account, deploy) |
| Blocked by | Owner actions only: migration 005 execution (runbook v3), persistence activation, live Pl@ntNet key acceptance, admin account creation/promotion, GitHub remote + first deploy, legal jurisdiction decision |

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
| P1-04 | Create Supabase projects: `plantai-dev` + `plantai-prod` (2 = free quota) — region per P1-01 | 🚧 `plantai-dev` (ap-south-1, Healthy) — **all 5 migrations applied & verified (see P1-09–P1-11)**; `plantai-prod` recommended before Vercel deploy | P1-01 |
| P1-05 | Create Pl@ntNet developer account + private API key (recorded in env only) | ⬜ Owner action — only needed by Phase 2 | P1-02 |
| P1-06 | Scaffold Next.js app: App Router + TypeScript strict + Tailwind (verify current Tailwind major version) | ✅ create-next-app@latest → **Next 16.4.6** (App Router, Turbopack), React 19.3, Tailwind **4.3.3** (CSS-first), TS strict from scaffold | P1-02 |
| P1-07 | Create `.env.example` (committed) + local `.env.local` (gitignored) | ✅ `.env.example` committed with placeholders; **owner fills `.env.local`** (never commit; `.env*` ignored) | P1-04, P1-05 |
| P1-08 | Repo structure per ARCHITECTURE.md (`src/app`, `src/components`, `src/lib`, `src/actions`, `supabase/migrations`) | ✅ Structure live: `(public)`/`(auth)`/`(user)`/`admin` route groups, `components/layout`, `lib/env.ts`, `lib/supabase/{client,server}.ts`, `supabase/migrations/*` (`src/actions` arrives with the first Server Action in Phase 2) | P1-06 |
| P1-09 | Supabase migrations: all tables + RLS policies + triggers per DATABASE_SCHEMA.md | ✅ **Applied 2026-11-11** (`db push --remote --yes`, owner-approved, exit 0): 5/5 in remote history, 10/10 tables, RLS enabled+forced 10/10, 6 functions, 9 triggers + auth trigger, 5 enums — verified via read-only script (`POST_MIGRATION_VERIFICATION_REPORT.md`) | P1-04 |
| P1-10 | Storage buckets: `request-images` (private), `plant-images` (public) + storage policies | ✅ Applied with migration 003 — both buckets verified with correct privacy flags | P1-09 |
| P1-11 | Seed data: admin profile + ≥10 starter species into plant_library | ✅ Applied with migration 004 — plant_library 10 rows, app_settings 8 rows verified. **Admin account creation + promotion still pending owner action** (corrected procedure in PRE_MIGRATION_SAFETY_REVIEW.md §5 A4) | P1-09 |
| P1-12 | Base layout shell + design tokens per UI_UX_DESIGN.md | ✅ Root layout (Inter via next/font), Header with canonical links + Sign-in, Footer with honest legal links, brand tokens in `globals.css` (`@theme`), focus-visible a11y baseline; mobile bottom-nav belongs to Phase 2 per header comment | P1-06 |
| P1-13 | Deploy empty shell to Vercel (preview) — env vars configured | ⬜ Blocked by owner (Vercel account + import; per DEPLOYMENT_GUIDE.md §4) ; no paid hosting allowed | P1-07 |
| P1-14 | Update TASKS.md + CHANGELOG.md after scaffold | ✅ This edit + CHANGELOG v0.2.0 | P1-06… |
| P1-15 | Pre-migration schema backup of `plantai-dev` before migrations are applied | ✅ `backups/pre_phase1.sql` — 3,178 bytes, SHA-256 `0BA5F4A5…B62D`, schema-only (no records/roles, no auth/storage schemas), exit 0, Docker tool-container pg_dump; git-ignored, untracked; verified + `PRE_MIGRATION_BACKUP_REPORT.md`. NO migrations applied | P1-04, P1-09 |
| P1-16 | Data API privilege configuration (REVOKE non-API privileges, per-table GRANTs, future-table default lockdown) | ✅ **Executed + fully verified 2026-11-11** (owner-run Steps 1–3, one transaction, committed; Step 4 USAGE skipped — audit confirmed). DB matrix ALL PASS (`api-grant-verify.ps1`): approved DML on 10/10 tables, TRUNCATE/REFERENCES/TRIGGER/MAINTAIN = false ×3 roles, `saved_plants` no UPDATE, `identification_cache` service_role-only, RLS enabled+forced 10/10, future-table defaults restricted. REST: `plant_library` anon → 200/10 rows/10 distinct slugs; `identification_cache` anon → 401/42501. supabase_admin defaults = platform-managed, untouched. Dashboard visually confirmed 2026-11-11: auto-expose **OFF** (counter shows 0 of 10 — reflects the automatic toggle only, not actual grant-based reachability; no settings changed) (`DATA_API_PRIVILEGE_EXECUTION_REPORT.md` §7) | P1-09, P1-15 |

## Phase 2 — MVP Identification & Auth (implementation session 2026-11-11/12)

| ID | Task | Status | Depends on |
|----|------|--------|------------|
| P2-01 | Client-side image validation + resize/compress (jpeg/png, ≤10MB, 1–3 images, EXIF strip attempt) | ✅ Client-side guards in `/identify` widget (type/size/count, inline errors, camera capture input); **resize/compress + EXIF strip ➡️ deferred** (no dependency added without owner approval; server-side magic-byte validation is authoritative) | P1-08 |
| P2-02 | `POST /api/identify` Route Handler: validation → hash dedup → Pl@ntNet proxy (`PLANTNET_MODE=mock` support) → persist identification → normalized response | ✅ **Implemented in MOCK mode** (live provider intentionally not activated — owner approval + key required). Full pipeline per API_DOCUMENTATION.md §2.4; persistence degrades to skip+log without a *valid* service_role key (see P2-11). `zod 3.25.76 (MIT)` added for the mandated contract schemas | P1-09 |
| P2-03 | Rate limiting: per-IP/per-user counters (5/day anon, 20/day authed; app_settings-driven) | ✅ In-memory per-instance limiter, salted-SHA-256 IP key (no raw IPs logged), midnight-UTC reset, `X-RateLimit-*` headers; **per-instance best-effort semantics documented honestly** (durable store deferred, API docs §5) | P2-02 |
| P2-04 | Identify page UI (upload, camera capture, progress, quota-reached, degraded states) | ✅ Upload widget (dropzone + camera + thumbnails + remove), analyzing state, 429 quota copy, inline errors; mock banner shown BEFORE upload | P2-01, P2-02 |
| P2-05 | Results UI: ranked species + confidence + cc-by-sa credited images + care summary from plant_library | ✅ Top-3 identity cards + color-coded confidence bars, care summary from plant_library only (canonical #6); **cc-by-sa images ➡️ n/a in mock mode** (mock never fabricates imagery/attribution); Pl@ntNet attribution component shipped | P2-02, P1-11 |
| P2-06 | Plant detail page `/plant/[slug]` | ✅ Minimal renderer from published plant_library rows (breadcrumb, badges, care table, save CTA, attribution); unknown/unpublished slug → real 404 (`instant = false` blocking route) | P1-11 |
| P2-07 | Supabase Auth: signup/email-confirm/login/reset/logout + middleware route protection | ✅ Full loop: signup (username metadata → `handle_new_user()` trigger), server-side `/auth/confirm` `verifyOtp`, password + magic-link login, recovery + `updateUser` reset, sign-out; `src/proxy.ts` (Next 16 proxy, ADR-10) refreshes via `getClaims()` + protects 5 user routes; per-page `getClaims()` guards as defense in depth | P1-09 |
| P2-08 | Saved plants (basic) on results + plant pages | ✅ `savePlant`/`unsavePlant` Server Actions (verified claims + RLS + published-row check); graceful sign-in CTA when anonymous | P2-07 |
| P2-09 | Unit + API tests (Vitest) for pipeline; first recorded Pl@ntNet fixture set | ✅ Completed (Stage D, 2026-11-13) — Vitest **is** configured and in use: `vitest ^3.2.7` + `test: vitest run` (`package.json`), five offline test suites in `tests/` covering the full identify pipeline, normalization, provider wiring, persistence control and mock/live parity (last recorded runs: 113/113 on 2026-11-13, 136/136 on 2026-11-14 — the 2026-11-15 audit discrepancy is RESOLVED by a fresh run, see `CHANGELOG.md` §0.8.0 audit note; **current verified count after the fresh 2026-11-15 full run: 150/150 passed, 6 files, incl. 14 new contact-action cases**). Fixture set: synthetic, documentation-derived, clearly labelled (`tests/fixtures/plantnet/upstream-fixtures.ts`) — recorded-from-live fixtures remain ➡️ n/a until live mode is approved. Live API contract tests against the dev server also passed earlier (13 cases incl. 429/413/dedup/headers) | P2-02 |
| P2-10 | Launch documentation: ONE manual live identification & record result | ➡️ Deferred — requires live Pl@ntNet approval + valid key (owner prerequisite) | P2-04 |
| P2-11 | Phase 2 completion report + honest mock/persistence capability documentation | ✅ `PHASE_2_COMPLETION_REPORT.md` created; documented finding: `SUPABASE_SERVICE_ROLE_KEY` **present in `.env.local` but rejected by Supabase ("Invalid API key")** — persistence attempts fail safely (no rows written, response unaffected, logged once per instance) | P2-02 |
| P2-12 | Supabase server-side secret-key configuration fix (Phase 2.5, owner-approved) | ✅ Modern **`SUPABASE_SECRET_KEY`** (`sb_secret_...`, canonical per official 2026 API-key docs; legacy `service_role` JWT deprecated end-2026) adopted as the privileged-key name with legacy fallback (`getServerSupabaseSecretKey()`, env.ts); persistence.ts uses it; `.env.example`/ENVIRONMENT_SETUP.md/SECURITY.md updated; client-bundle zero-leak scan + git-ignore check verified; **owner action pending: enter the current `sb_secret_...` key into `.env.local`** (`PHASE_2_SUPABASE_SECRET_KEY_REPORT.md` §4) — persistence activates drop-in afterwards | P2-11 |

## Phase 3 (owner-redefined) — Live Pl@ntNet integration, stages A–H

> **Note:** the task numbering in this file calls Phase 3 "Content & SEO" (table below, kept
> unchanged). The owner's stage plan (2026-11-12) redefines **Phase 3** as the live Pl@ntNet
> integration executed in stages A–H; it is tracked here to avoid a second file. Live mode stays
> OFF until the gates below are passed; `PLANTNET_MODE=mock` remains the enforced state.

| Stage | Content | Status | Gate |
|---|---|---|---|
| A1 | Official Pl@ntNet documentation verification (host, endpoint, auth, organs, errors, quota, headers, licensing, retention) | ✅ Done 2026-11-12 — all facts recorded in `docs/VERIFIED_FACTS.md` (verified / example-observed / unresolved separated, official source URLs) | — |
| A2 | Documentation alignment of all Markdown files with A1 findings (documentation only — no code/SQL/env changes) | ✅ Done 2026-11-13 — corrections across `API_DOCUMENTATION.md`, `AI_INTEGRATION_PLAN.md`, `SECURITY.md`, `LEGAL_AND_COMPLIANCE.md`, `DATABASE_SCHEMA.md`, `ARCHITECTURE.md`, `ENVIRONMENT_SETUP.md`, `TESTING_PLAN.md`, `DEVELOPMENT_ROADMAP.md`, `CHANGELOG.md`; schema/code mismatches flagged below, not fixed | — |
| B | Live provider implementation (`live-provider.ts` behind the same `identify()` contract; request builder with repeated `organs`; response normalizer; `upstream_rejected` error path; **no automatic retries**; URL-redacted logging) | ✅ Implemented 2026-11-13 (Stage B) — full HTTP/error/quota layer + wiring + 28 offline tests; the upstream 200 → candidate mapping remains a typed **Stage C boundary** (`UpstreamNormalizerNotReadyError`). **Provider code is unreachable in mock mode; live mode is NOT activated** | — |
| C | Zod/UI organ enum + request-builder/normalizer corrections (future-work table below) | ✅ Implemented 2026-11-13 (Stage C) — canonical shared organ enum (`src/lib/plantnet/organs.ts`: `leaf`/`flower`/`fruit`/`bark`/`auto`; invalid `lateral`/`root` → HTTP 400 before any upstream call) used by both the Zod schema and a new optional UI organ selector; upstream 200 → candidate normalizer implemented per the official identify output example (`species`-nested `commonNames`/`genus`/`family`, top-level `gbif`/`powo` siblings, string id forms) with conservative per-image CC BY-SA license + attribution enforcement (`license?: string` + `attribution: string` replace `cc_by_sa: boolean`); safe `X-RateLimit-Remaining-Upstream` header wired (body field first, then `RateLimit` `r=`; nothing sensitive exposed); 29-case offline test suite added (`tests/upstream-normalize.test.ts`), Stage B boundary tests updated → **80/80 tests, lint 0 errors, typecheck clean, build exit 0**; FW-1/FW-5/FW-6 resolved. **Mock mode unchanged; live mode NOT activated; persistence stays OFF** | With B |
| D | Mock-parity tests (Vitest) against recorded fixtures mirroring the verified upstream contract | ✅ Implemented 2026-11-13 (Stage D) — 35 new offline tests: shared mock/live parity contract checker (`tests/mock-live-parity.test.ts`, 12 cases: both providers satisfy the same normalized SpeciesCandidate contract; deterministic mock regression pin; frozen response key sets), real-route regression suite (`tests/identify-route.test.ts`, 16 cases: stable envelope, dedup, organ/413/429 paths, full Stage B/C error taxonomy end-to-end with no URL/key/pk leaks, persistence-OFF fallback UUID, mockNotice parity), and a shared synthetic/documentation-derived fixture module (`tests/fixtures/plantnet/upstream-fixtures.ts`, clearly labelled — never claimed to be real recorded responses). Mock parity note: `powoId: null` added to mock candidates (one line) so both providers carry the identical optional-identifier contract. **113/113 tests, lint 0 errors, typecheck clean, build exit 0. Mock mode unchanged; live mode NOT activated; persistence stays OFF** | After B |
| F1/F2 | Persistence application-code alignment (per `SCHEMA_RECONCILIATION_PROPOSAL_F1_F2_F3.md`): cache upsert → `p_hash` + conflict target `(p_hash, project, organ)`; hit-count lookup filters the full unique key; `identifications` insert carries `organ`/`hash`/`project` explicitly | ✅ **Code implemented 2026-11-14 (application code ONLY — no SQL/migration/settings touched):** `persistence.ts` upserts `p_hash`/`project`/`organ`/`normalized_result`/`top_score`/`hit_count`/`last_hit_at` with `onConflict: "p_hash,project,organ"` (the former `image_hash` + `"image_hash,organ"` payload targeted a nonexistent column and no matching index — 100% upsert failure on first activation); `p_hash_variants` deliberately left at the schema default `'{}'` (the implemented hash identity is the single request-level `combinedImageHash`; no variant hashes exist to store — none invented); `top_score` mirrors `best_match_score` (same rounding, null when no best match); project is the verified canonical `"all"` (`PERSISTED_PROJECT` = live-provider `DEFAULT_PROJECT`, single source of truth). `dedup-cache.ts` identity documented as compatible (durable key = (combined hash, constant project, organ) ≡ in-memory key while project is constant). 14 new offline contract tests (payload column sets, conflict target, organ mapping, hash/project identity, GPS-never-in-payload, single-writer consistency, OFF-guard) → **136/136 tests, lint 0 errors, typecheck clean, build exit 0**. **Persistence remains OFF; PLANTNET_MODE=mock; known residual dependency: organ `fruit`/`bark` inserts will fail the CURRENT organ CHECK until the owner-approved F-3 migration (best-effort failure: logged, response unaffected)** | After D |
| E | Staging deploy with live provider code present but `PLANTNET_MODE=mock` | ⬜ | — |
| F | Database persistence + Supabase Storage activation (`PLANTAI_PERSISTENCE_ENABLED=true`) | ⬜ **Separately gated — owner approval required**; write guard stays in place until then. Write payloads are now schema-aligned (Stage F1/F2, 2026-11-14) — activation additionally requires the F-3 migration decision (organ CHECK / project defaults) | Owner only |
| G | ONE authorized live smoke identification (valid server-only key; result + quota headers recorded) | ⬜ | Owner only |
| H | Production activation (`PLANTNET_MODE=live` in prod env) | ⬜ | Owner only |

## Future work — flagged code/schema mismatches (NOT fixed in Stage A2)

> Documentation-only stage: none of the items below were changed in app code, SQL, or `.env.local`.
> Each requires implementation work under owner approval (stages B–D above; DB items are
> owner-authorized migrations).

| # | Mismatch | Where | Required work |
|---|---|---|---|
| FW-1 | ~~Zod/UI organ enum contains invalid `lateral`/`root` and lacks `fruit`/`bark` (verified upstream values: `leaf`/`flower`/`fruit`/`bark` + `auto`)~~ | zod schema + upload UI organ selector | ✅ **Resolved in Stage C (2026-11-13):** canonical dependency-free enum `src/lib/plantnet/organs.ts` shared by the Zod schema (`validation/identify.ts`, V6) and the new optional UI organ selector; `lateral`/`root` rejected with HTTP 400 before any upstream call; auto-detection remains the default (optional hint exposed in UI, per ARCHITECTURE.md §8.3) |
| FW-2 | `identifications.organ` CHECK constraint allows `lateral`/`root`, rejects `fruit`/`bark` | `DATABASE_SCHEMA.md` §3.3 (existing deployed schema unchanged) | Owner-authorized migration to align CHECK with verified values. **Stage F1/F2 note (2026-11-14):** the application insert now writes `organ` EXPLICITLY (Stage F2) — `fruit`/`bark` inserts therefore fail the current CHECK (best-effort: logged, response unaffected) until this migration runs; `lateral`/`root` remain unreachable through validation |
| FW-3 | `allplants` defaults + seed values in schema (`identifications.project`, `identification_cache.project`) while verified upstream default is `all` | `DATABASE_SCHEMA.md` §3.3/§3.10 | Owner-authorized migration or explicit data-mapping decision (e.g. normalize `allplants` → `all` on read). **Stage F1/F2 note (2026-11-14):** the application now writes `project = "all"` EXPLICITLY on every identification write (`PERSISTED_PROJECT`) — rows are provenance-correct regardless of the column default; only the DB default itself remains misaligned (cosmetic once no write relies on it) |
| FW-4 | Migration/data-mapping decision for FW-2/FW-3 | SQL migrations (none written yet) | Decide migration vs. mapping; document rollback |
| FW-5 | ~~Upstream image metadata/license normalization: images **usually** CC BY-SA but per-image `author`/`license`/`citation` must be read from the actual response; unknown/missing license must prevent image display~~ | `src/lib/plantnet/normalize.ts` | ✅ **Resolved in Stage C (2026-11-13):** `mapImage` renders ONLY when the license is the documented reusable CC BY-SA (conservative, case-insensitive, separator-normalized) AND the contributor author is present; `license?: string` + `attribution: string` preserve the actual returned metadata (citation verbatim when provided); missing/unknown/unsupported license or missing author ⇒ image hidden, candidate stays visible; attribution never fabricated. Note: results images[] remain optional upstream data (official identify example omits them); UI needed no rendering change (mock returns no images) |
| FW-6 | Request builder & response normalizer for live provider (repeated `organs` per image in image order; `api-key` query param; never log URL; map upstream 404 "Species not found" → `no_match_found`, other unexpected 4xx → `upstream_rejected`; read `remainingIdentificationRequests` + `RateLimit-Policy`/`RateLimit`/`Retry-After`) | `src/lib/plantnet/` | ✅ **Fully resolved (Stage B + Stage C, 2026-11-13):** request builder + error/quota layer done in Stage B; the Stage C normalizer (`normalizeUpstreamResponse` in `normalize.ts`, default `UpstreamNormalizer` boundary) now maps verified upstream 200s into candidates — official-shape fields only, malformed entries/images skipped defensively, empty results → route 404 `no_match_found`, candidate cap/ranking via `normalizeSpecies`; `UpstreamNormalizerNotReadyError` removed. Safe `X-RateLimit-Remaining-Upstream` header wired on success + error paths (`remainingIdentificationRequests` first, then `RateLimit` `r=` via `parseRateLimitRemaining`) |

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
