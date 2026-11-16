# PlantAI — Changelog

All notable project changes, decisions, and documentation updates.
Format based on Keep a Changelog; newest entries first.

---

## [0.9.1] - Real plant imagery + live camera capture - 2026-11-15

### Added — imagery (species-matched, license-verified, no fabricated species photos)
- **`public/plants/*.jpg` (10 files):** lead photographs of each species' English Wikipedia article, downloaded at 960px from Wikimedia Commons. Every file's license + author verified via the MediaWiki `imageinfo`/`extmetadata` API before download (2026-11-15); all are CC BY-SA 3.0/4.0 or CC BY 3.0. Full record: **`docs/IMAGE_CREDITS.md`** (new). All magic-byte verified as real JPEGs.
- **`src/lib/plant-images.ts`:** registry `PLANT_LIBRARY_IMAGES` (slug → asset with `src`/`alt`/`credit`/`creditUrl`/`license`), `getPlantImageAsset(slug)`, `HERO_IMAGE`, `FALLBACK_PLANT_IMAGE`. Honest rules encoded: DB `plant_library.image_url` ALWAYS wins; registry imagery is display-fallback only, never written to the DB; the fallback is an original illustration, never a fake species photo.
- **`public/plants/placeholder.svg`:** original PlantAI botanical illustration (no third-party license) — deliberately an illustration so it can never be mistaken for a species photograph.
- **`src/components/plants/plant-image.tsx`:** `PlantImage` client component — `next/image` `fill` + `object-cover` inside a fixed-aspect frame (never stretched), runtime `onError` fallback to the placeholder illustration, optional attribution caption.
- **Imagery integrated:** home hero (Monstera photo, `priority`, credit line under it) + 3 feature cards (aloe/peace lily/pothos); library cards get a species-matched photo per slug; plant detail pages render DB image > registry photo (with CC attribution rendered) > placeholder with an honest "illustration, not a photo" caption; saved-plant cards get the same species-matched treatment; dashboard CTA shows a jade-plant photo; my-plants/reminders pending panels carry the decorative illustration; blog listing renders cover thumbnails ONLY when the post actually has `cover_image_url` in the DB (query extended) — never fabricated covers.

### Added — camera (real getUserMedia capture, single pipeline)
- **`src/components/identify/camera/plant-camera.tsx`:** new `PlantCamera` client component — full lifecycle: camera requested ONLY after the user explicitly selects "Take a photo"; rear camera preferred (`facingMode: environment`, device switching via `enumerateDevices` when >1 camera); live preview (`object-cover`, `playsInline`); capture via canvas `toBlob('image/jpeg', 0.92)` → `File` (matches the server JPEG/PNG magic-byte contract); preview → Retake / Use-this-photo; confirm hands the File to the SAME draft list (`addFiles`) — no second identification pipeline. Mandatory §6 guarantees: every `MediaStream` track stopped on close/confirm/error/unmount (+ `track.onended` recovery), object URLs revoked, no audio, never background capture, no upload before confirmation, no image/device logging.
- **Error taxonomy (§5):** permission denied, no camera, camera busy, overconstrained, unsupported browser, insecure HTTP context, unexpected stream stop, invalid/empty capture — each maps to an honest user-facing message that always preserves the upload route; zero technical dumps.
- **`src/components/identify/identify-widget.tsx`:** two clear primary options — "📷 Take a photo" (opens PlantCamera) and "Upload from device" (file picker; `accept` stays `image/jpeg,image/png` to match the server contract rather than a broad `image/*` hint — documented decision); captured photo enters the existing draft previews immediately, replaceable/retakeable, submitted through the existing identify pipeline.
- **`tests/camera-errors.test.ts` (7 offline tests):** error-message mapping contract — every taxonomy branch states the truth, keeps the upload alternative, and leaks no technical detail. **Scope honesty:** simulated tests only; real-device verification (permission grant/deny, rear camera, capture, track stop, responsive checks at 320–1920px) was NOT performed in this environment and remains owner/user work.

### Fixed
- **Lint:** `react-hooks/set-state-in-effect` at plant-camera.tsx — camera kickoff deferred one tick (`setTimeout 0` in the open effect; cleanup clears the timer AND stops the stream).
- **Home page:** the imagery rewrite initially duplicated `HomePage`; the stale copy was removed.

### Validation (all green, honestly reported)
- `npm test` → **157/157, 7 files** (150 prior + 7 camera)
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0 (1 pre-existing warning at tests/persistence-control.test.ts:313, untouched)
- `npm run build` → exit 0 (all 29 routes compile)
- Flags unchanged: `PLANTNET_MODE=mock`, `PLANTAI_PERSISTENCE_ENABLED=OFF`; no migrations, no commits, nothing staged.

---

## [0.9.0] - Fast MVP completion: Stage C (customer-facing app) + Stage D (security headers) + Stage E (SEO/PWA) + Stage G (contact tests) - 2026-11-15

### Added — Stage C: customer-facing application (all honest-state, no fake success)
- **Home (`src/app/(public)/page.tsx`):** rewritten from the Phase 1 skeleton — primary `/identify` CTA, secondary library CTA, what-you-can-do cards, and the disclaimer "AI-assisted and may be incorrect. It is not a plant-disease diagnosis." WebSite JSON-LD added.
- **Library (`src/app/(public)/library/page.tsx`):** real listing of published `plant_library` rows (session client, cap 200), `?q=` search filtered server-side across all catalog text fields INCLUDING the `common_names` array (PostgREST cannot ilike across `text[]`), static canonical so `?q=` variants canonicalize to `/library`, honest empty/search-miss/error states.
- **Saved plants (`src/app/(user)/saved-plants/page.tsx`):** full management view — `requireAuthRedirect` + Suspense, RLS-bounded join `saved_plants → plant_library`, unpublished-species rows rendered honestly as "no longer available" (never hidden), and a new `RemoveSavedPlantButton` client component (`unsavePlant` + `router.refresh()`, inline error text).
- **Dashboard (`src/app/(user)/dashboard/page.tsx`):** real saved-count (live RLS `count/head:true` query) and a TRUTHFUL identification-history card: when `PLANTAI_PERSISTENCE_ENABLED` is off it states exactly that instead of fabricating history; Phase 4 personal-plant cards are honest pending states.
- **Blog (`src/app/(public)/blog/page.tsx` + `blog/[slug]/page.tsx`):** real `blog_posts` queries (`status='published'`, RLS public-read), blocking `instant = false` so unknown slugs return a real 404, `generateMetadata` from each post's `seo_title`/`seo_description`, cover image via `next/image` with the credit caption, and a dependency-free `MarkdownLite` renderer (`src/components/blog/markdown-lite.tsx`) — headings/paragraphs/lists/quotes only, parsed into React elements, NO `dangerouslySetInnerHTML`, no raw HTML passthrough (inline markdown renders as plain text — documented conscious limitation).
- **Contact (`src/actions/contact.ts`, `src/components/contact/contact-form.tsx`, `src/app/(public)/contact/page.tsx`):** `submitContact` Server Action — honeypot `website` field returns a fake success to bots and inserts nothing; server-side zod validation mirroring the DB CHECKs (name 2–80, subject ≤120, message 10–4000; failed validation does NOT consume the rate budget); 3/day per-IP `RateLimiter` keyed by `contact:{sha256(ip+salt)}` (matches the seeded `contact.rate_limit.per_day = 3`; in-memory per-instance limiter is the documented honest limitation); insert via the RLS `p_contact_messages_insert_anyone` policy with only the salted hash stored; generic error mapping (raw DB errors never surface). Form uses `useActionState`.
- **My Plants / Reminders / Account:** truthful pending states (Phase 4 scope) — schema-ready features described as not-yet-built, auth-guarded, noindex; Account shows the real session + sign-out; no fake reminders, no fake plant collections.
- **Pet-safety notice (`src/components/identify/identify-results.tsx`, FR-RES-005):** results disclaimer now warns that many common houseplants are toxic to pets and to keep new plants out of reach until safety is known — no invented per-species toxicity facts.
- **Root `not-found.tsx` + `error.tsx`:** real 404 page (unknown `/plant/[slug]`, `/blog/[slug]` land here with 404 status) and a privacy-safe error boundary (retry + bug-report link; digest shown only in dev).
- **Navigation dedupe:** header main links `hidden md:block` (mobile covered by the single bottom nav); footer gained Identify/Library/Blog internal links.

### Added — Stage D: security headers + noindex (per docs/SECURITY_HEADERS_PROPOSAL.md baseline)
- **`next.config.ts`:** all five headers on every route — HSTS (`max-age=63072000; includeSubDomains`, deliberately WITHOUT `preload`), CSP (`default-src 'self'`, `script-src 'self' 'unsafe-inline'` (+`unsafe-eval` dev-only), `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: + Supabase origin`, `connect-src 'self' + Supabase origin + wss`, `font-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Supabase origins are derived from `NEXT_PUBLIC_SUPABASE_URL` at config load and accepted ONLY for https `*.supabase.co`/`*.supabase.com` — Pl@ntNet deliberately NOT in `connect-src` (upstream is server-side only). `images.remotePatterns` restricted to the same two Supabase wildcard hosts.
- **noindex:** `robots: { index: false, follow: false }` added to login, signup, forgot-password, reset-password, saved-plants, dashboard, my-plants, reminders, account (admin already had it).

### Added — Stage E: SEO + PWA foundations
- **`src/app/robots.ts`:** Allow `/`, Disallow `/admin`, `/account`, `/my-plants`, `/saved-plants`, `/dashboard`, `/reminders`, `/api/`, `/auth/`.
- **`src/app/sitemap.ts`:** static public routes + every published plant slug with its real `updated_at` lastmod (build time never fabricated); session client → runtime generation; DB failure degrades gracefully to static routes.
- **`src/app/manifest.ts` + `public/icon.svg`:** PWA manifest (name/short_name/theme `#059669`, SVG icon; PNG exports deferred to Phase 6 polish).
- **`src/components/seo/json-ld.tsx`:** single JSON-LD injector fed only from server-controlled data.
- **`/plant/[slug]` upgraded:** per-species `generateMetadata` (title ≤60 chars from common + scientific name; description from the record or derived watering/sunlight — never invented), canonical, OpenGraph, mandatory image-credit rendering with any image (`next/image`, DATABASE_SCHEMA.md §3.2 rule), visible breadcrumb + matching BreadcrumbList JSON-LD, structured care `<dl>` (watering/sunlight/soil/fertilizer with honest "Care guide coming soon" cells).
- **`/blog/[slug]`:** per-article metadata + canonical + OG (above). Root layout: "(In development)" removed from the site description; `viewport.themeColor` added. `/identify` metadata description + canonical added.

### Added — Stage G: tests
- **`tests/contact-action.test.ts` (14 offline contract tests):** valid submission inserts the exact payload (64-hex `ip_hash`, raw IP never stored); null-subject handling; validation rejection matrix (5 cases) with zero inserts; input trimming; honeypot → fake success + no insert; failed validation does not consume the daily budget; 3/day then honest rejection without a 4th insert; per-IP budget isolation; DB failure → generic safe message (no error code/text leakage) with server-side logging. Module-level `RateLimiter` state is isolated per test via `vi.resetModules()` + dynamic import (production singleton preserved).

### Fixed
- **Cache Components build violations:** `/blog` and `/library` read cookies/`searchParams` during prerender — build failed with "uncached or runtime data". Fixed by declaring both routes BLOCKING (`export const instant = false`, the repo's documented option) — DB results and error states always render for real, never from a stale shell.
- **Type error in saved-plants join:** supabase-js infers embedded relations as arrays — cast via `as unknown as JoinedRow[]` (same pattern as existing code).

### Verification (all commands real, 2026-11-15)
- `npx vitest run tests/contact-action.test.ts` → **14/14 passed** (after fixing the test-state-leak failure described above — 5 initially failed; fixed by fresh module per test, no assertions weakened).
- `npm test` → **150/150 passed, 6 files** (identify-route 20 · upstream-normalize 39 · persistence-control 37 · parity 12 · live-provider 28 · contact-action 14).
- `npm run typecheck` → exit 0.
- `npm run lint` → 0 errors, 1 pre-existing warning (`tests/persistence-control.test.ts:313` unused `client`).
- `npm run build` → exit 0, **29 routes** (now incl. `robots.txt`, `sitemap.xml`, `manifest.webmanifest`).
- **Runtime header verification (production server, `next start`):** `/` returned 200 with all five headers present and exact expected values; `/robots.txt` correct; `/login` served `<meta name="robots" content="noindex, nofollow"/>`; `/sitemap.xml` generated.

### Unchanged (safety state preserved)
- `PLANTNET_MODE=mock` · `PLANTAI_PERSISTENCE_ENABLED=OFF` · no `.env.local` access · no SQL/migrations/db push · no Supabase settings/deploy/Git push · nothing staged · migration 005 NOT executed · no admin account created · no legal claims published.

### Owner actions still required (unchanged gates)
Migration 005 (runbook v3), persistence activation, live Pl@ntNet activation, admin account creation/promotion, GitHub remote + first deploy, legal page content (jurisdiction UNDECIDED), real species-page authoring for the AdSense content gate.

---

## [0.8.1] — Stage 1: documentation finalization & F4 Runbook v3 — 2026-11-15

### Added (documentation only — no code, SQL, migration, config, or env changes)
- **`docs/STAGE_F4_EXECUTION_RUNBOOK_V3.md`** — first durable F4 runbook for the pending migration 005 (the corrected v2 was conversation-only). Carries all preserved findings (000 dependency; db push applies ALL pending; empty-window preference; NULL = STOP; NOT NULL organ columns 000:73/199; missing backup script `backups/run-pre-migration-backup.ps1` — documented with two owner decisions, script NOT recreated; non-durable F3 rollback SQL — preservation + independent verification required before execution; three-file export ≠ complete recovery backup) plus new safeguards: NULL-predicate blind-spot explanation, mandatory `is_nullable = 'NO'` preflight, data-file row-count reconciliation, [A2] unguarded constraint-name lookup + concurrent-modification prohibition, dry-run section, stop conditions, evidence plan, owner checklist, audit history.
- **`docs/SECURITY_HEADERS_PROPOSAL.md`** — documentation-only plan for HSTS/CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy per SECURITY.md §11 (CSP compatibility analysis for Supabase auth/storage/script origins; Report-Only rollout; verification procedure). **No header implemented in this stage.**
- **`PROJECT_MASTER_CONTEXT.md`** — central continuity record (created by the 2026-11-15 master audit) updated for Stage 1 consistency.

### Changed (documentation corrections, all cross-checked against source)
- **K1 `README.md`** — stale "Phase 1" status replaced with the verified state (Phase 2 complete in mock mode; 000–004 applied, 005 pending; protected mode states; owner-side steps still outstanding). No deployment/migration completion claimed.
- **K2 `SEO_STRATEGY.md:188`** — `plant_library.published` → canonical `is_published` (verified against migration 000 and `/plant/[slug]`).
- **K3 `SECURITY.md` §8** — `app_settings` read-policy row aligned to the verbatim `p_app_settings_read_all for select using (true)` (DATABASE_SCHEMA.md §3.9 / migration 002), dated reconciliation note added; the "app_settings must never hold secrets" rule preserved unchanged. No database policy touched.
- **K4 `CHANGELOG.md` §0.8.0** — dated audit note added beneath the preserved historical 136/136 claim: (a) the section's own breakdown sums to 127, not 136; (b) the 2026-11-15 audit counted ~107 cases file-level (**not a fresh run**); (c) a fresh owner-authorized `npm test` run is required to establish the current count.
- **K6 `CONTENT_STRATEGY.md` §5** — `category` values corrected to the canonical 11-value `plant_category` enum (migration 000 lines 9–13); adjacent same-class drift fixed: `difficulty` → `easy/moderate/hard` (000:52), `published` → `is_published`. **No application or database value changed** (seed data and DB were already canonical).
- **K7 `TASKS.md` P2-09** — outdated "No Vitest configured" status replaced with ✅ Completed (Stage D 2026-11-13), evidenced by `package.json` (`vitest ^3.2.7`, `test: vitest run`) and the five `tests/` suites; current-count UNVERIFIED caveat per the K4 note; synthetic (not recorded) fixture set honestly labeled.

### Unchanged (safety state preserved)
- `PLANTNET_MODE=mock` · `PLANTAI_PERSISTENCE_ENABLED=OFF` · no `.env.local` access · no SQL/migrations/db push · no Supabase/deploy/Git actions · nothing staged · migration 005 NOT executed.

---

## [0.8.0] — Stage F1/F2: persistence application-code alignment — 2026-11-14

### Changed (application code ONLY — no SQL, no migrations, no Supabase settings)
- **`src/lib/plantnet/persistence.ts` (Stage F1):** `identification_cache` upsert now writes the ACTUAL schema columns — `p_hash`, `project`, `organ`, `normalized_result`, `top_score`, `hit_count`, `last_hit_at` — with conflict target `onConflict: "p_hash,project,organ"` (the deployed unique index). The former payload wrote a nonexistent `image_hash` column with `onConflict: "image_hash,organ"` (no matching index): every upsert would have failed with PGRST204 on first persistence activation; tests mocked the client and could not catch it. Evidence-based mappings, nothing invented: `p_hash` = the request-level `combinedImageHash` (the ONLY implemented hash identity — exact-byte SHA-256; the perceptual-pHash decision remains deferred), keeping the durable key identical to the in-memory dedup key; `p_hash_variants` deliberately left at its `'{}'` schema default (its documented meaning is "hashes of OTHER images"; the combined-hash identity leaves no separate variant hashes to store); `top_score` mirrors `identifications.best_match_score` (same rounding; null without a best match).
- **`bumpCacheHitCount` (Stage F1):** the hit-count read now filters the FULL unique key `(p_hash, project, organ)` (was: `.eq("image_hash", …)` — a nonexistent column).
- **`identifications` INSERT (Stage F2):** `organ`, `hash`, `project` are now written explicitly (previously omitted → rows silently defaulted: organ `'auto'` regardless of the user's hint, `hash` NULL, `project` column default). Column names verified against migration 000 (`hash` here, `p_hash` in the cache table). latitude/longitude remain deliberately absent from EVERY write payload (GPS is a request hint only — never upstream, never persisted).
- **Project constant:** `PERSISTED_PROJECT` = `"all"` imported from `live-provider.ts` `DEFAULT_PROJECT` (single source of truth; verified Stage A1 upstream contract) and written explicitly on every write so the cache key never depends on DB defaults. The `'allplants'` column DEFAULTS remain misaligned — that is proposal item F-3, an owner-approved migration, explicitly NOT part of this change.
- **`src/lib/identify/dedup-cache.ts` (comment only):** documents the durable-key compatibility — `(p_hash, project, organ)` with p_hash = `combinedImageHash` and a single constant project is semantically identical to the in-memory `hash::organ` key; if multi-project support ever ships, both keyings must gain the project field in the same change.
- **Known residual dependency (documented, not worked around):** the CURRENT `identifications.organ` CHECK still lacks `fruit`/`bark` (proposal F-3 / FW-2), so explicit `fruit`/`bark` inserts are rejected by Postgres until the owner-approved migration runs; persistence is best-effort (failure logged, response unaffected, fallback UUID id). No SQL was modified to mask this.

### Added (tests — `tests/persistence-control.test.ts`, spy client extended to capture payloads/filters)
- **14 new offline contract tests:** exact upsert column set + conflict target; no `image_hash` anywhere; `p_hash_variants` not fabricated; `PERSISTED_PROJECT === DEFAULT_PROJECT === "all"` (drift pin); `top_score` rounding/null cases; verbatim organ pass-through for all canonical organs (no `lateral`/`root` synthesized); hit-count lookup filtered by the full unique key + correct `hit_count` increment; F2 insert column set (organ/hash/project + unchanged pre-existing fields); `identifications.hash ≡ identification_cache.p_hash`; GPS-never-in-payload; normalized candidates carried unchanged; single-writer consistency (exactly one INSERT + one UPSERT per identification, one SELECT + one UPDATE per hit bump).

### Unchanged (safety state preserved)
- `PLANTAI_PERSISTENCE_ENABLED` still defaults OFF (write guard untouched, double-enforced); all OFF-path tests re-verified (no client constructed, zero writes, fallback UUID). `PLANTNET_MODE=mock` unchanged; no Supabase connection, queries, or writes (spy clients only); no env changes; no dependencies added; no commit/push.

### Verification
- `npm test` **136/136 passed** (28 persistence-control incl. 14 new · 28 live-provider · 39 upstream-normalize (incl. Stage-C organ + GPS both-or-neither suites) · 12 parity · 20 route) · `npm run lint` 0 errors (1 pre-existing warning) · `npm run typecheck` clean · `npm run build` exit 0.

> **Audit note (2026-11-15, documentation-only — original results preserved above in their
> original context):** (a) the 136 headline and the per-suite breakdown in this section do not
> agree arithmetically (28+28+39+12+20 = 127); (b) an independent 2026-11-15 audit counted
> **approximately 107** test cases across the five test files (17 route · 31 upstream-normalize ·
> 25 persistence-control · 12 parity · 22 live-provider — file-level counts, NOT a fresh run).
> Nothing above has been altered.
>
> **RESOLVED (fresh owner-authorized run, 2026-11-15, MVP-completion session):** `npm test` →
> **136/136 passed, 5 files**; per-file: identify-route 20 ·
> upstream-normalize 39 · persistence-control **37** (the section's "28" was the undercount —
> 20+39+37+12+28 = 136 exactly) · parity 12 · live-provider 28. The historical 136 headline was
> CORRECT; the arithmetic gap came solely from the persistence-suite count. The ~107 audit
> estimate was a file-level undercount. The suite has since grown to **150** tests (14 new
> contact-action cases — see [0.9.0]).

---

## [0.7.1] — Pre-GitHub documentation/validation cleanup (F-6→F-11) — 2026-11-14

- **F-6:** `CHANGELOG.md` §0.2.2 dangling reference to the nonexistent `SUPABASE_IPV6_TROUBLESHOOTING_REPORT.md` corrected (no report file was ever created; findings recorded here only). Not fabricated.
- **F-7:** `supabase/README.md` rewritten for the verified grant-based Data API access model (auto-expose OFF; `plant_library` anon REST 200 / `identification_cache` 401+42501; "0 of 10" counter meaning); publishable vs secret key separation with current `SUPABASE_SECRET_KEY` (`sb_secret_...`) terminology; persistence-activation prerequisites (`PLANTAI_PERSISTENCE_ENABLED` exact `"true"` + valid accepted secret key + migrations). No SQL or settings changed.
- **F-8/F-9:** `TESTING_PLAN.md` function names aligned with source (`combinedImageHash`, `normalizeUpstreamResponse`); fixture policy rewritten to document Stage D synthetic/documentation-derived fixtures with provenance labels — never real recorded responses; real recordings require the separately authorized Stage G live smoke; kinds must never be misrepresented.
- **F-10:** the documented V7 both-or-neither GPS rule is now ENFORCED in `identifyRequestSchema` (`src/lib/validation/identify.ts`, shared predicate with the previously unused `geoSchema`): neither → valid, both → valid, latitude-only / longitude-only → HTTP 400 `invalid_request` before any provider call. 9 regression tests added (schema + route level); GPS still never sent upstream and never persisted; no geographic identification behavior.
- **F-11:** `API_DOCUMENTATION.md` §2.9/§2.3 corrected: client canvas pre-resize + EXIF strip and server storage-path sanitization are planned/deferred (`TASKS.md` P2-01), no longer claimed as implemented. V7's zod-refine row is now true post-F-10.
- **F-1/F-2/F-3 (read-only):** `SCHEMA_RECONCILIATION_PROPOSAL_F1_F2_F3.md` created — OWNER-APPROVAL-REQUIRED proposal covering the cache column/conflict-target mismatch, the identifications organ/hash omissions, and the organ CHECK + project-default mismatches (F-3 migration executed separately).
- **Verification:** 122/122 tests at cleanup time (9 new GPS tests; baseline was 113), lint 0 errors, typecheck clean, build exit 0.

---

## [0.7.0] — Stage D: mock/live response parity + recorded-fixture hardening — 2026-11-13

### Added
- **Shared fixture module (`tests/fixtures/plantnet/upstream-fixtures.ts`):** deterministic offline fixtures with an explicit provenance label (`FIXTURE_PROVENANCE` = "SYNTHETIC documentation-derived fixture — NOT a real recorded Pl@ntNet response"). Shapes mirror the verified Stage A1 upstream contract only: single-plant result, multiple candidates, missing common names, missing/odd taxonomy-id variants (numeric gbif, non-digit string, numeric powo), empty results, 12 invalid upstream structures, a mixed valid/invalid body, 10 image-metadata cases (valid CC BY-SA with/without citation; missing/blank author; missing/malformed/unsupported license; unusable urls), valid + invalid organ values, and documented-format quota headers with synthetic values (`pk=` present precisely so tests can prove it never leaks). All image URLs point at the RFC 2606 `.invalid` domain — never resolvable.
- **Mock/live parity suite (`tests/mock-live-parity.test.ts`, 12 cases):** one shared contract checker proves BOTH providers satisfy the same normalized `SpeciesCandidate`/`IdentifyProviderResult` contract after the route's `normalizeSpecies` (ranks, bands, score range + descending order, sources, images with complete attribution); mock regression pin (exact deterministic output for a fixed hash, float-exact); determinism + rotation selection; mock never fabricates imagery/ids/labels; live path (stubbed fetch, dummy key) maps names/genus/family/scores/ids identically to mock field-for-field; empty upstream results → empty list (route 404) while mock is always non-empty; quota signals ride along in body-field and header-only forms (nothing invented).
- **Route regression suite (`tests/identify-route.test.ts`, 16 cases):** exercises the REAL `POST /api/identify` handler with real validation/hashing/dedup/rate-limiter/write-guard and mocked seams only (Supabase session client stub, app_settings reader, provider seam). Covers: stable success envelope + frozen key sets (envelope + candidate — additions/removals must be conscious documented changes), route output ≡ provider output (computed independently through the seam), dedup repeat (cached:true, same id, provider runs once), PNG-path acceptance, zero/unsupported/oversized images, 413 body guard, organ lateral/root → 400 with details and NO provider call, failed-validation-does-not-bill + 6th-request 429 with `nextResetUTC`, full Stage B/C error taxonomy end-to-end (429→503 quota_exhausted with safe `X-RateLimit-Remaining-Upstream`, other 4xx→502, 5xx/network→503, upstream 404→404, unexpected crash→500 generic), response/log leak sweep (no `https://`, `api-key`, `pk=`, host), persistence-OFF (write-guard capability unavailable, client null, fallback UUID id, cache-hit bumps write nothing), and mockNotice present in mock mode / absent in live mode.

### Changed
- **`src/lib/plantnet/mock-provider.ts` (one line):** mock candidates now carry `powoId: null` — the identical optional-identifier contract as normalized live results (Stage D parity; no behavioral change).

### Unchanged (safety state preserved)
- `PLANTNET_MODE=mock` remains the enforced state — live mode NOT activated. `PLANTAI_PERSISTENCE_ENABLED` still defaults OFF (the route tests assert the write-guard refuses and no client is constructed). `.env.local` untouched; no Supabase queries/writes (session client stubbed; persistence spies wrap the REAL functions); no Storage uploads; no migrations; no external requests (live provider runs on a stubbed fetch); no dependencies added; no deploy/commit/push. Stage E–H remain pending with their separate owner gates.

### Verification
- `npm test` **113/113 passed** (23 persistence + 28 live-provider + 34 upstream-normalize + 12 parity + 16 route) · `npm run lint` 0 errors (1 pre-existing warning) · `npm run typecheck` clean · `npm run build` exit 0.

---

## [0.6.0] — Stage C: upstream normalization, image licensing, organ validation, quota visibility — 2026-11-13

### Added
- **Normalizer implemented (`src/lib/plantnet/normalize.ts`):** `normalizeUpstreamResponse` maps a parsed, verified upstream 200 response into the PlantAI candidate structure using ONLY the documented Stage A1 field shapes, now confirmed at field level against the official identify output example: `species.{scientificNameWithoutAuthor, scientificNameAuthorship, scientificName, genus, family, commonNames}` (commonNames/genus/family INSIDE the species object) with top-level `gbif: {id}` / `powo: {id}` result siblings (string ids in the official example). Scientific name is read verbatim from `species.scientificName`, else composed from `scientificNameWithoutAuthor` + `scientificNameAuthorship` (both documented); scores are preserved exactly (validated 0–1, never clamped or invented); GBIF ids accept numerics and digit-strings (converted to the same number, value-preserving), POWO ids kept verbatim strings; malformed result entries and malformed optional image fields are skipped defensively (one bad image never invalidates a candidate); empty/fully-malformed results produce an empty list which the route maps to HTTP 404 `no_match_found`; ranking/banding/candidate cap (max 10) still applied by the route's `normalizeSpecies`.
- **Image license + attribution (`types.ts`, normalize.ts):** the `cc_by_sa: boolean` assumption is replaced by `license?: string` (the ACTUAL returned license, verbatim) + `attribution: string` (composed ONLY from returned author/license — never fabricated). Rendering is permitted only for the documented reusable CC BY-SA license, compared conservatively and case-insensitively (`cc-by-sa`, `CC BY-SA`, `CC_BY_SA`, `cc by sa` all normalize to the same identifier), AND when a contributor author is present; missing/unknown/unsupported license or missing/blank author ⇒ image not rendered while the candidate stays visible; `citation` is preserved verbatim when the upstream returns one; url fallback `m → o → s` among the documented sizes. UI components needed no change (results render no species images in mock mode — enforcement lives entirely in the normalizer).
- **Canonical organ enum (`src/lib/plantnet/organs.ts`):** dependency-free shared enum `leaf | flower | fruit | bark | auto` (+ `DEFAULT_ORGAN`, `UPSTREAM_ORGAN_VALUES`, `ORGAN_LABELS`) — re-exported by `validation/identify.ts` for compatibility so the client widget never bundles zod.
- **UI organ selector (`identify-widget.tsx`):** new optional "Which plant part is in the photo?" dropdown built from the shared enum (ARCHITECTURE.md §8.3 planned advanced field); auto-detection remains the default; the previously hardcoded `organ: "auto"` submission now sends the selected hint.
- **Quota visibility (`route.ts`, `live-provider.ts`):** `X-RateLimit-Remaining-Upstream` response header on identify success AND `ProviderError` paths, resolved from verified sources only — `remainingIdentificationRequests` body field first, then the `r=` remaining value of the documented `RateLimit` header via `parseRateLimitRemaining()` (defensive regex; partition keys `pk=…`, API keys, URLs, and reset times are NEVER exposed; no values invented; header omitted when neither source is available, which includes mock mode).
- **Tests (`tests/upstream-normalize.test.ts`):** 29 offline cases — normalization (full/minimal/malformed fixtures mirroring the official schema), multiple candidates, missing common names/taxonomy identifiers, gbif string/numeric/non-digit variants, composed vs. verbatim scientific names, empty results, all-or-nothing malformed responses, exact score preservation, candidate cap/ranks/bands, license matrix (`it.each`: unsupported/missing/malformed license, missing/blank author, unusable urls), size fallback, organ schema accept/reject matrix (all valid values incl. trimming + blanks; `lateral`/`root`/`stem`/case-mutations rejected), quota-header parsing (r= extraction, partition-key non-exposure), RateLimit-header quota propagation through a stubbed fetch, and mock-provider compatibility across the corrected enum.

### Changed
- **`validation/identify.ts` (V6 correction):** `organSchema` now validates against the shared canonical enum; invalid `lateral`/`root` requests receive HTTP 400 BEFORE any upstream call (no credit burn, no upstream request); blank values default to `auto`.
- **`tests/live-provider.test.ts`:** the two superseded Stage-B boundary tests now assert Stage-C mapping success (default normalizer end-to-end, provider-seam delegation with a documented 200 fixture); 200 fixtures updated to the official field nesting.
- **`types.ts`:** `SpeciesImage` updated (`license?`/`attribution` replace `cc_by_sa`; `attribution` required), `SpeciesCandidate.powoId?: string | null` added, `UpstreamNormalizerNotReadyError` removed (superseded by the implemented normalizer).

### Unchanged (safety state preserved)
- `PLANTNET_MODE=mock` remains the enforced state — the live provider is unreachable in mock mode; **no live identification is activated**. `PLANTAI_PERSISTENCE_ENABLED` still defaults OFF with the write guard intact. `.env.local` untouched; no Supabase queries/writes, no Storage uploads, no migrations; no external identification/API calls (all tests run offline against fixtures/stubbed fetch); no new dependencies; no deploy/commit/push. Error taxonomy (429 → 503 `quota_exhausted`, other 4xx → 502 `upstream_rejected`, 5xx/network → 503 `upstream_error`, no automatic retries) unchanged from Stage B. Stage D–H remain pending with their separate owner gates.

### Verification
- `npm test` **80/80 passed** (23 persistence + 28 live-provider + 29 upstream-normalize) · `npm run lint` 0 errors (1 pre-existing warning) · `npm run typecheck` clean · `npm run build` exit 0.

---

## [0.5.0] — Stage B: server-only Pl@ntNet provider implemented (inactive) — 2026-11-13

### Added (code; no env/DB/credential changes, no dependencies)
- **`src/lib/plantnet/live-provider.ts`** — the live Pl@ntNet v2 provider behind the existing `identify()` seam, implementing the verified Stage A1 contract: `POST https://my-api.plantnet.org/v2/identify/{project}` (default project `all`), `api-key` query-parameter auth, repeated `images`/`organs` form fields (one `organs` per image, in image order; omitted = auto-detection; flagged `lateral`/`root` values never transmitted), MIME detection from magic bytes, 20 s `AbortController` timeout, **no automatic retries**, no location/identity fields, and strict never-log rules (URL/key/headers/body; `redactUrlForLogs` strips the query string). Verified error taxonomy: 404 → `no_match_found`, 429 → `quota_exhausted`, other 4xx → `upstream_rejected`, 5xx/network/timeout → `upstream_error`; quota capture (`RateLimit-Policy`/`RateLimit`/`Retry-After`/`remainingIdentificationRequests`) into the new additive `upstreamQuota` result field.
- **Provider wiring (`provider.ts`, `env.ts`):** `PLANTNET_MODE` missing or not exactly `live` → MockProvider immediately; `live` with a missing/blank server-only key fails safe to mock with a safe diagnostic (value never logged); the live module is lazy-imported so mock mode never loads it.
- **Route (`route.ts`):** the existing catch now translates typed `ProviderError`s (404/503/502/503 mapping per SECURITY.md §3 — no 429 pass-through). Mock behavior unchanged (the mock provider never throws `ProviderError`).
- **Types (`types.ts`):** additive `upstream_rejected` error code, `UpstreamQuotaSignals`, `ProviderError`, conservative `UpstreamIdentifyResponse`, and the typed **Stage C boundary** `UpstreamNormalizer` — live 200 responses are parsed and quota-captured but deliberately **not** mapped to candidates until Stage C (typed `UpstreamNormalizerNotReadyError`, no invented mapping).
- **Tests (`tests/live-provider.test.ts`):** 28 offline cases with a stubbed fetch and dummy credentials only (endpoint/project, query-param auth, no Authorization header, repeated organs/ordering, omitted organs, MIME types, forbidden fields, 20 s timeout, no-retry, full error mapping, quota capture, redaction sweep, mock-mode-never-fetch, live fail-safes, Stage C boundary, client-import server-only guard).

### Unchanged (safety state preserved)
- `PLANTNET_MODE=mock` remains the enforced state — the live provider is unreachable in mock mode; **no live identification is activated**. `PLANTAI_PERSISTENCE_ENABLED` still defaults OFF with the write guard intact. `.env.local` untouched; no DB/Storage writes; no external calls (all tests stub fetch); no new dependencies.

---

## [0.4.2] — Stage A1/A2: official Pl@ntNet documentation verification + alignment — 2026-11-12/13

### Added (docs; zero code/SQL/env changes)
- **Stage A1 (2026-11-12):** official Pl@ntNet doc verification from `my.plantnet.org` doc pages + `pricing` + `terms_of_use` — all facts recorded with source URLs and the verified/example-observed/unresolved split in `docs/VERIFIED_FACTS.md` (Pl@ntNet section rewritten; research items #3/#4 resolved; Pro plan verified at €1,000/yr with 200k included).
- **Stage A2 (2026-11-13):** documentation alignment across `API_DOCUMENTATION.md` (§2.1/§2.3/§2.4/§2.5/§2.7/§2.8 + changelog row 0.2.1), `AI_INTEGRATION_PLAN.md` (§2 behavioral table + regional-GPS deferral), `SECURITY.md` (§3 secret-in-query-param risk + URL redaction), `LEGAL_AND_COMPLIANCE.md` (§2.6/§7 retention + licensing rules, GPS row), `DATABASE_SCHEMA.md` (§3.3/§3.10 mismatch flags — SQL unchanged), `ARCHITECTURE.md` (host/project/organ-enum/regional deferral), `ENVIRONMENT_SETUP.md` (§4 API-host clarification), `TESTING_PLAN.md` (fixture shape policy), `DEVELOPMENT_ROADMAP.md` (M2.9 closed via Stage A1; Phase 3 numbering note), `TASKS.md` (owner-redefined Phase 3 stages A–H + future-work mismatch table FW-1..FW-6).

### Corrected (stale upstream facts replaced by verified ones)
- API host `https://my-api.plantnet.org` (not `my.plantnet.org` — that is the portal/docs site); default project **`all`** (not `allplants`); auth = **`api-key` query parameter** with a hard **never-log-the-URL** rule; upstream parameter **`organs` (plural, repeated per image in order)** with valid values `leaf`/`flower`/`fruit`/`bark`+`auto` (invalid `lateral`/`root` removed from docs); upstream 404 "Species not found" (non-plant image) maps to `no_match_found`, other unexpected 4xx ≠ no-match; quota headers `RateLimit-Policy`/`RateLimit`/`Retry-After` + body field `remainingIdentificationRequests` documented; image display rule = only show images whose returned `license` is a documented-reusable value (CC BY-SA is the only documented reusable case), using actual `author`/`license`/`citation`; Pl@ntNet retention disclosed (photos volatile, **query history retained** — distinct from PlantAI's Supabase Storage); MVP sends **no GPS coordinates upstream** (regional-flora lookup deferred).

### Unchanged (safety state preserved)
- `PLANTNET_MODE=mock`, `PLANTAI_PERSISTENCE_ENABLED` default OFF + write guard untouched, `.env.local` untouched and git-ignored, no database/Storage changes, live provider still unimplemented (stages B–H gated per `TASKS.md`).

---

## [0.4.1] — Supabase secret-key migration prep (server-side persistence prerequisite) — 2026-11-12

### Changed (code + docs; no DB/credential changes)
- **Env-name migration prepared per current official Supabase API-key docs** (fetched 2026-11-12): the modern **`SUPABASE_SECRET_KEY`** (`sb_secret_...`) is now the canonical privileged key; the legacy `SUPABASE_SERVICE_ROLE_KEY` JWT (deprecated by Supabase by end of 2026) remains accepted as a fallback via new `getServerSupabaseSecretKey()` in `src/lib/env.ts` (resolution order documented in-code). Both resolve to the same `service_role` Postgres role — no grants/RLS implications.
- `persistence.ts` uses the resolver (capability reason names the resolved var; invalid-key warning covers both names); `.env.example`, `ENVIRONMENT_SETUP.md` §5, `SECURITY.md` §2 updated. Browser-safe publishable pair untouched.

### Verified (live + build scans)
- `lint`/`typecheck`/`build` all exit 0. Live dev run: identify 200 with the legacy-key fallback resolving and degrading safely (updated warning message). **Client-bundle scan:** zero matches for the resolver/key names across all `.next/static` chunks (one false positive: "persistence" inside the bundled Supabase Realtime SDK string). `.env.local` git-ignored re-verified (`git check-ignore` exit 0). Full details + owner instructions: `PHASE_2_SUPABASE_SECRET_KEY_REPORT.md`.

---

## [0.4.0] — Phase 2: authentication loop + mock-first identification API — 2026-11-12

### Implemented (Phase 2, owner-approved)
- **Authentication (P2-07):** complete Supabase Auth loop — signup (username 3–24 `[a-zA-Z0-9_]` as metadata → existing `handle_new_user()` trigger; privacy-safe duplicate error), server-side `/auth/confirm` callback (`verifyOtp` with `token_hash`+`type`), password + magic-link sign-in, recovery → reset-password (`updateUser`), sign-out, guest-only/authenticated redirects. Next.js 16 **`src/proxy.ts`** (ADR-10) refreshes sessions with **`auth.getClaims()`** (never trusting `getSession()` alone) and copies Supabase cache headers; protected: /dashboard, /my-plants, /saved-plants, /reminders, /account; per-page `getClaims()` guards as defense in depth.
- **`/api/identify` (P2-02, mock-first):** full §2 pipeline — body guard 413 → multipart 400 → zod field validation → magic-byte image validation (JPEG FF D8 FF / PNG signature; client MIME never trusted) → verified-claims identity → rate limit → SHA-256 dedup → **mock provider (zero external calls)** → normalize + confidence bands → careSummary from published `plant_library` rows → persistence via service-role capability → `X-RateLimit-*` + `Cache-Control: no-store` on every response.
- **Rate limiting (P2-03):** anon 5/day, authed 20/day from `app_settings` (1-min TTL cache, clamped fallbacks), salted-SHA-256 IP key (`IP_HASH_SALT` env; per-process fallback documented), midnight-UTC reset, `X-RateLimit-Remaining-Upstream` seam. In-memory best-effort semantics documented honestly (API docs §5).
- **Dedup (P2-04/2D):** server-side SHA-256 per image, sorted+combined (permutation-stable), cache keyed `hash::organ`; per-instance in-memory cache (6h TTL, 500 entries) — the durable `identification_cache` store stays service_role-only and was **not** weakened.
- **Frontend (P2-04/05/06/08):** `/identify` upload widget (dropzone + camera capture + thumbnails, client-side quota protection), results view (top-3 cards, confidence bars, care grid from PlantAI library only, "Save plant" action, educational disclaimer), **mock transparency banner** shown before upload AND in results, Pl@ntNet attribution sentence, `/plant/[slug]` published-row renderer with real 404 (`instant = false` blocking route), mobile 5-item bottom nav with raised 56px Identify button, saved-plants Server Actions (verified claims + RLS + published-row check).
- **Dependency:** `zod 3.25.76 (MIT)` — mandated by API_DOCUMENTATION.md §2.4/§3.5 for the canonical contract schemas. No other new dependencies.

### Verified (live contract tests against dev server — all passed)
- Missing images → 400 `invalid_request` · fake-PNG → 400 `unsupported_image` · 11 MB upload → 413 `image_too_large` · 4 images → 400 · valid PNG → 200 `mode:"mock"` + `careSummary` + `mockNotice` · repeat identical bytes → 200 `cached:true` · distinct images → 200 with decrementing quota · 6th anon request → 429 `daily_limit_reached` + `nextResetUTC` · `X-RateLimit-Limit/Remaining/Reset` headers present.
- Route protection: /dashboard, /my-plants, /saved-plants, /reminders, /account anonymous → 307 → `/login?next=…`; guest pages 200 anonymous; `/plant/aloe-vera` 200 / unknown slug **404**.
- Security: no raw IPs in logs (salted hash only) · service_role referenced only in server-only modules · `.env.local` git-ignored (confirmed via `git check-ignore`) · `identification_cache` untouched (Phase 1 REST proof: 401/42501).
- Gates: `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run build` ✅ (26 routes, Cache Components, proxy registered).

### Fixed (Next.js 16 specifics)
- Proxy default 10 MB client-body cap truncated oversized uploads → contract's 413 was unreachable; fixed with `experimental.proxyClientMaxBodySize: "34mb"` (above the route's 33 MB guard) per bundled Next docs.
- `notFound()` inside a `<Suspense>` boundary streamed after the 200 shell → unknown slugs returned 200; fixed by making `/plant/[slug]` a documented **blocking route** (`export const instant = false`).
- `NEXT_PUBLIC_SITE_URL=""` broke `new URL()` at build (`??` misses empty string) → `||` fallback to localhost.

### Important finding (owner action required)
- `SUPABASE_SERVICE_ROLE_KEY` **is present** in `.env.local` but Supabase **rejects it ("Invalid API key")** — identifications persistence + durable `identification_cache` upserts therefore fail safely: attempt → error logged once per instance → response unaffected, **no rows written** (verified: zero persistent records created). Replace the key server-side and persistence becomes drop-in (no code changes).

### Deferred / not run (honest gaps)
- Live Pl@ntNet identification (requires owner approval + valid key), authenticated 20/day limit verification (would require creating a real test user — forbidden without owner approval), Vitest unit suite (not configured), image resize/EXIF strip, cc-by-sa credited images (n/a in mock — never fabricated), deployment. See `PHASE_2_COMPLETION_REPORT.md`.

---

## [0.3.2] — Data API privileges executed + REST verified + smoke-script fix — 2026-11-11

### Executed (owner-approved)
- **Steps 1–3** of `DATA_API_PRIVILEGE_HARDENING_PLAN.md` applied owner-side in one transaction (`BEGIN…COMMIT`, `ON_ERROR_STOP=1`): REVOKE of TRUNCATE/REFERENCES/TRIGGER/MAINTAIN from all three API roles, 15 exact per-table GRANT statements (no `GRANT ALL`, no `saved_plants` UPDATE, `identification_cache` service_role-only), future-table default lockdown for `postgres` in `public`. Step 4 (schema USAGE) skipped — audit already confirmed USAGE=true. Execution evidence: pre-run agent-side safeguards all PASS (incl. backup SHA-256 re-verified).

### Verified (read-only)
- **DB-level matrix ALL PASS (owner-run `api-grant-verify.ps1`):** approved DML on all 10 tables; TRUNCATE/REFERENCES/TRIGGER/MAINTAIN = false for anon, authenticated, service_role; `saved_plants` no UPDATE; `identification_cache` service_role-only; RLS enabled+forced 10/10; schema USAGE true ×3; postgres future-table defaults restricted. **Remaining defaults under `supabase_admin` are platform-managed (tied to the Data API toggle) — deliberately untouched.**
- **REST (agent-run, corrected smoke script v2):** `plant_library` anon GET → **HTTP 200, 10 rows, 10 distinct slugs** · `identification_cache` anon GET → **HTTP 401, PostgreSQL 42501** (server-only table sealed). Full results + per-table ACL end state in `DATA_API_PRIVILEGE_EXECUTION_REPORT.md`.
- **Smoke-script root cause (verified by minimal repro):** Windows PowerShell 5.1 `ConvertFrom-Json` emits a JSON array as a single pipeline object — wrapping the call directly in `@()` yields count 1; v1's count was therefore wrong (reported 1 for 10 rows). v2 assigns to a variable first, then `@()`, and counts distinct slugs explicitly. No application/DB changes involved.

### Pending (owner)
- ~~Visual confirmation that "Automatically expose new tables" remains OFF~~ ✅ **Confirmed 2026-11-11** (Integrations → Data API → Settings): auto-expose **OFF**, exposed schemas 2 of 2, dashboard exposed-tables counter **0 of 10** (counter reflects the automatic toggle only — not actual grant-based reachability, proven by REST: `plant_library` 200/10 rows, `identification_cache` 401/42501). No Dashboard settings changed; explicit PostgreSQL grants unchanged.
- Admin account + promotion (separate approval); SECURITY.md reconciliation; prod-plan reuse; anonymous `contact_messages` INSERT smoke test (separate approval — persistent record).



### Audited (owner-run, read-only)
- **All 10 public tables:** anon / authenticated / service_role have **zero DML privileges** (auto-expose OFF behaves per official docs) — but each ACL grants `Dxtm` (**TRUNCATE, REFERENCES, TRIGGER, MAINTAIN**) to all three API roles, and the future-table defaults grant the same four. `DATA_API_ACCESS_PLAN.md` §1 filled with actual results.

### Documented (plan only — nothing executed)
- `DATA_API_PRIVILEGE_HARDENING_PLAN.md`: schema-wide REVOKE of the four non-DML privileges (TRUNCATE bypasses RLS; the rest are migration-time-only), exact per-table GRANT matrix, `ALTER DEFAULT PRIVILEGES` locking future tables to zero API-role privileges, RLS compatibility checks, post-change verification script `scripts/api-grant-verify.ps1` (SELECT-only, scanned).
- **Discrepancy on record (§8.1):** migration 001's `revoke execute … from anon` on `is_admin()` did not persist — live state is the pure PUBLIC default (anon EXECUTE = true), which is the required state for anon RLS policy evaluation. No action; migration files untouched.
- `plantai-prod` will reuse the same plan (§8.4).

## [0.3.1] — Data API privilege audit complete + hardening plan — 2026-11-11

### Applied (owner-approved)
- All **5 migrations** applied to `plantai-dev` (`qdcirgpzuwnarwqehtmo`) via `npx supabase db push --remote --yes` (owner-run, exit 0), after the `READY` verdict in `PRE_MIGRATION_SAFETY_REVIEW.md` and an owner-run dry-run review. Pre-migration backup `backups/pre_phase1.sql` enforced intact (exact SHA-256) by the helper before execution.

### Verified (read-only, owner-run script `scripts/supabase-verify.ps1` v2)
- Remote history 5/5 · 10/10 public tables · RLS enabled **and forced** 10/10 · 6/6 functions · 9 triggers + `trg_on_auth_user_created` on `auth.users` · buckets `request-images` (private) + `plant-images` (public) · seed counts 10 species / 8 settings · 5 enums · no unexpected objects.
- **FORCE-RLS question resolved:** `postgres` = `rolsuper false, rolbypassrls true` → dashboard SQL editor bypasses RLS even on forced tables; the corrected admin-promotion procedure will work as documented.
- Full results: `POST_MIGRATION_VERIFICATION_REPORT.md`.

### Fixed
- Verification helper v1 failed auth (`user "postgres"`): root cause was an empty `PGPASSWORD` passthrough (host var named `SUPABASE_DB_PASSWORD`), not the username; v2 pins the scoped pooler username `postgres.<ref>`, requires TLS, and gates everything behind a read-only connection test. Deviation documented in the report §3.

### Pending owner actions (each needs separate approval/execution)
1. Manually expose the 10 public tables in Data API settings; verify public REST access.
2. Create the real admin account; run the corrected promotion procedure (guard-trigger disable → UPDATE → re-enable) only on explicit approval.
3. ~~`is_admin()` anon-EXECUTE read-only ACL check~~ **✅ DONE 2026-11-11:** anon EXECUTE = **true** (PUBLIC grant intact) + **live anon simulation verified** (`current_user=anon`, `is_admin()=false`, rolled back cleanly, no permission changes) — **no GRANT required, R1 fully closed**.
4. Reconcile SECURITY.md `app_settings` read-policy wording vs DATABASE_SCHEMA.md §3.9 (doc task).

---

## [0.2.2] — IPv4 pooler fix + Docker readiness + pre-migration backup — 2026-11-11

### Supabase connectivity (P1-04 support)
- **IPv6 blocker diagnosed and fixed** (no separate troubleshooting report file was ever created in the repository — the findings are recorded here only): network is IPv4-only; direct DB host has zero A records (Free plan); root cause = project-scoped read-only PAT lacks `database_pooling_config_read`, so CLI 3.1.0 never saved `supabase/.temp/pooler-url`. Fixed by writing the file locally with the owner-supplied session-pooler URL (no password inside; git-ignored). Read-only `migration list --remote` verified end-to-end (owner-side masked-password run): all 5 migrations pending remotely.

### Docker Desktop enablement (see `DOCKER_READINESS_REPORT.md`)
- Readiness check: Win 10 Pro 22H2 build 19045.6466 compatible; WSL 2 prerequisite identified and completed by owner (WSL 3.0.5, kernel 6.18.58.1); Docker Desktop **4.99.0** installed per-user (Personal/free tier), Engine 29.9.3, OSType `linux`, Linux container test passed. Zero paid services.

### Pre-migration backup (P1-15) ✅
- `backups/pre_phase1.sql` created via `npx supabase db dump --remote -f backups/pre_phase1.sql` (CLI 3.1.0, pg_dump tool container `public.ecr.aws/supabase/postgres:17.11.0.018`, exit 0): **3,178 bytes**, SHA-256 `0BA5F4A5C40876DC90AE031D28EC5148767C20900D1C741100B2583D2157B62D`.
- Content verified structurally: 4 default extensions + Supabase default `rls_auto_enable` helper; **zero user tables/policies/data** — correct pre-migration state. **Schema-only**: no records, no custom roles, no `auth`/`storage` schemas — NOT a full database backup.
- Git safety: `backups/` directory created (was missing — root cause of first failed run); entire dir git-ignored (`git check-ignore` verified), 0 tracked files. Helper script `backups/run-pre-migration-backup.ps1` (no credentials, git-ignored) runs all pre-checks + masked-password try/finally (`SecureStringToBSTR` → temporary env var → dump → env removed, BSTR zeroed, SecureString disposed).
- Two earlier attempts honestly documented as blocked in `PRE_MIGRATION_BACKUP_REPORT.md` §7 (Docker absent; Docker Engine not running). Password never printed/logged/shared. Full details: `PRE_MIGRATION_BACKUP_REPORT.md`.
- **No migrations were applied** — `db push` and all remote SQL remain unauthorized until explicit owner approval.

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
