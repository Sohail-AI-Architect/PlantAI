# PlantAI — Phase 2 Completion Report

> **Phase:** 2 — MVP Identification (authentication loop + mock-first `/api/identify` + rate limiting + SHA-256 dedup prep)
> **Date:** 2026-11-12 · **Sessions:** 2026-11-11 → 2026-11-12
> **Owner authorization:** Phase 2 implementation only (explicit). Phase 3 NOT started; awaiting owner approval.
> **Scope discipline:** no DB schema/migration/grant/RLS changes, no Dashboard changes, no admin account, no persistent DB records, no deploys, no pushes, no paid services, no live Pl@ntNet calls, no disease AI.

---

## 1. Fully implemented (real working code, verified)

| Area | What ships | Where |
|---|---|---|
| Auth loop | Signup (username 3–24 `[a-zA-Z0-9_]` → metadata → existing `handle_new_user()` trigger; privacy-safe duplicate/exists error), email confirmation callback (`/auth/confirm`, server-side `verifyOtp` with `token_hash`+`type`), password + magic-link sign-in, recovery email → reset-password (`updateUser`), sign-out | `src/app/(auth)/*`, `src/components/auth/*`, `src/app/auth/confirm/route.ts` |
| Session security | Next.js 16 `proxy.ts` (ADR-10) refreshes sessions via **`auth.getClaims()`** (signature-verified; `getSession()` user data never trusted for authorization), copies Supabase cache headers; protected: /dashboard, /my-plants, /saved-plants, /reminders, /account (verified live: 307 → `/login?next=…`); guest-only /login, /signup, /forgot-password; per-page `getClaims()` guards (defense in depth) | `src/proxy.ts`, `src/lib/auth/session.ts` |
| `/api/identify` pipeline | Body guard → multipart parse → zod field validation → **magic-byte image validation** (JPEG `FF D8 FF` / PNG signature; client MIME never trusted) → verified-claims identity → rate limit → SHA-256 dedup → provider → normalize + confidence bands → careSummary from published `plant_library` → persistence via service-role capability → `X-RateLimit-*` + `Cache-Control: no-store` on every response | `src/app/api/identify/route.ts` |
| Rate limiting | anon 5/day, authed 20/day from `app_settings` (1-min TTL cache, clamped fallbacks); keys `user:{id}` (verified claims) or `ip:{SHA-256(ip+salt)}` (raw IP never logged); midnight-UTC reset; `X-RateLimit-Limit/Remaining/Reset(/Remaining-Upstream)` headers; consume only after validation passes; in-process concurrency semaphore (4) → 503 `concurrency_limited` | `src/lib/rate-limit.ts`, `src/lib/settings.ts` |
| Dedup | Server-side SHA-256 per image (client hash never trusted), sorted → combined (permutation-stable), cache keyed `hash::organ` (in-memory, 6h TTL, 500 entries) — same keying scheme as the future `identification_cache` row, drop-in swap | `src/lib/identify/{hash,dedup-cache}.ts` |
| Identify UI | Upload widget (drag&drop + browse + camera capture, thumbnails with remove, client-side type/size/count guards before submit to protect quota), honest "Analyzing your photos…" state (no fake gauge), 429 quota state preserving the draft, mock transparency banner shown **before upload and in results** | `src/components/identify/identify-widget.tsx` |
| Results UI | Top-3 identity cards (italic scientific name, common names, family/genus), color-coded confidence bars, care summary from **PlantAI's library only** (canonical #6 — never claimed as AI output), "Save plant" action with graceful sign-in CTA, educational disclaimer, Pl@ntNet attribution sentence | `src/components/identify/identify-results.tsx`, `attribution.tsx` |
| Plant detail | `/plant/[slug]` published-row renderer (breadcrumb, badges, care table, save CTA, attribution); unknown/unpublished slug → **real 404** via documented blocking route (`export const instant = false`) | `src/app/(public)/plant/[slug]/page.tsx` |
| Saved plants | `savePlant`/`unsavePlant` Server Actions: verified claims + RLS + published-row check; duplicate → friendly "Already in your saved plants" | `src/actions/saved-plants.ts` |
| Navigation | Auth-aware header slot (streams inside `<Suspense>` under Cache Components), mobile 5-item bottom nav with raised 56px Identify button, graceful My Plants/Account auth gating | `site-header.tsx`, `bottom-nav.tsx`, `auth-nav.tsx` |
| Env/config | `PLANTNET_MODE` fail-safe (live without key → mock, loudly logged), `IP_HASH_SALT` optional salt, `.env.example` updated (placeholders only, never real values) | `src/lib/env.ts`, `.env.example` |

## 2. Implemented in mock mode (clearly labelled, zero external calls)

- **Mock provider** (`src/lib/plantnet/mock-provider.ts`): deterministic fixtures mirroring the 10 seeded `plant_library` species; result seeded from the combined SHA-256 of the image bytes (same input → same result); `sources:["mock"]` on every candidate; `images:[]` — mock never fabricates botanical imagery or CC citations.
- **Transparency:** API `mode:"mock"` + `mockNotice:"Demo result — PlantAI testing mode. This is not a real AI identification."`; UI demo banner on `/identify` and in results. Verified in live responses.
- **Provider seam:** `src/lib/plantnet/provider.ts` — the future `live-provider.ts` implements the same `identify()` signature; live was not activated in Phase 2. *(Historical note: this report previously said `PLANTNET_MODE=live` without owner approval/key "throws instead of silently going live." Phase 1A correction, 2026-11-24: current code fails safely to mock with a generic diagnostic and zero network requests; no key value is logged.)* No live Pl@ntNet call, key use, or quota consumption exists anywhere.
- **Care summary** resolution works identically in both modes (from our library), so the client never needs redesign when live mode activates.

## 3. Tests actually executed — PASSED (live contract tests against `npm run dev`, 2026-11-12)

API (`POST /api/identify`, PowerShell/curl fixtures — tiny valid PNG×5, JPEG, fake-PNG, 11 MB file):

| # | Case | Expected | Result |
|---|---|---|---|
| T1 | Missing images | 400 `invalid_request` | ✅ |
| T2 | Fake PNG (text bytes) | 400 `unsupported_image` | ✅ |
| T3 | 11 MB upload | 413 `image_too_large` | ✅ (after proxy body-cap fix) |
| T4 | 4 images | 400 count error | ✅ |
| T5 | Valid PNG | 200, `mode:"mock"`, `careSummary` (real library row id), `mockNotice`, headers | ✅ |
| T6 | Repeat identical bytes | 200 `cached:true`, same top match, deterministic | ✅ |
| T7–T9 | Distinct valid images | 200, quota decrementing 2→1→0 | ✅ |
| T10 | 6th anonymous request | 429 `daily_limit_reached` + `nextResetUTC` + zeroed headers | ✅ |

Routes: `/dashboard` `/my-plants` `/saved-plants` `/reminders` `/account` anonymous → 307 → `/login?next=…` ✅; `/login` `/signup` `/forgot-password` `/reset-password` `/identify` anonymous → 200 ✅; `/plant/aloe-vera` → 200 with care content + sign-in CTA + attribution ✅; `/plant/not-a-real-slug` → **404** ✅.

Security: no raw IPs in server logs (only salted-hash-keyed counters; verified log scan) ✅; `SUPABASE_SERVICE_ROLE_KEY` referenced only in server-only modules (`requireServerOnly()` guards) ✅; `.env.local` git-ignored (`git check-ignore` exit 0) ✅; invalid service_role key logged **once per instance**, responses unaffected ✅; zero persistent DB records created (all persistence attempts failed by design — see §5) ✅.

Gates: `npm run lint` ✅ (0 errors/warnings) · `npm run typecheck` ✅ · `npm run build` ✅ (26 routes, Cache Components on, proxy registered).

## 4. Tests NOT run (honest gaps)

- **Authenticated 20/day rate limit** — verifying requires creating a real Supabase test user (forbidden without owner approval). The code path is identical to the verified anonymous path except the key prefix; not claimed as tested.
- **Full auth happy-path with real emails** (signup → emailed confirm link → login): the server-side callback, form validation, and route logic are implemented and unit-reasoned, but end-to-end execution needs a real email deliverable test user — same owner-approval constraint. Sign-out/cookie-refresh runtime behavior likewise remains untested with a real user. *(2026-11-24 correction: the temporary one-click anonymous sign-in that previously supplied a session has been removed; no real-user E2E is claimed.)*
- **Vitest unit suite** — no test framework was configured at the time of this Phase 2 report. *(2026-11-24 correction: Vitest is now configured via `npm test`; offline pure-function and source-contract auth tests exist. Real browser E2E is still not performed.)*
- **Client-side image resize/compress + EXIF strip** — deferred (would need a new dependency; server-side validation is authoritative).
- **Load/concurrency smoke** (simulated 20-in-flight) — not run; the semaphore exists but burst behavior is unmeasured.
- **Live Pl@ntNet identification** — intentionally never attempted (mock-only phase; no account, no key generated, no quota consumed).

## 5. Missing owner-side prerequisite (discovered, not worked around)

- **`SUPABASE_SERVICE_ROLE_KEY` is present in `.env.local` but invalid.** Live diagnosis: the persistence layer created the service-role client and attempted the `identifications` INSERT; Supabase answered **"Invalid API key"** (`hint: Double check your Supabase anon or service_role API key`). Consequence while the key is rejected:
  - `identifications` rows: **not persisted** — no DB records exist from any Phase 2 test (verified intent + failure path).
  - `identification_cache` upserts / `hit_count` bumps: skipped (the table remains service_role-only by deliberate design; **never weakened**).
  - Dedup stays in-memory per instance (keyed exactly like the future cache row — drop-in swap).
  - User responses are unaffected (best-effort persistence; failure logged, 200 returned).
  - Owner action: copy the current valid key from Supabase → Project Settings → API keys into `.env.local` (never paste it into chat) and restart `npm run dev`. **No code changes needed** — `getPersistenceCapability()` activates automatically.
- The earlier project assumption that the credential was entirely absent was corrected to the above after live evidence.

## 6. Known security limitations (documented, consciously accepted for MVP)

1. **In-memory limiter is best-effort per instance** (documented in API §5.2 and code): cold starts / multiple instances can under-count; anonymous daily budget is approximate. Upstream pool protection comes from validation + dedup; the durable-store decision is deliberately deferred to Phase 5 with a measurement.
2. **In-memory dedup cache is per instance** — wiped on restart; cross-instance duplicate upstream calls remain possible until the service_role-backed `identification_cache` activates.
3. **`IP_HASH_SALT` unset** ⇒ per-process fallback salt; per-IP counters are instance-consistent but differ across instances. Set the env var for stable behavior.
4. **Server Actions identify-route gap:** `/api/identify` accepts anonymous uploads by design (spec) — abuse resistance rests on the rate limiter + validation (limitation 1).
5. **Mock results are NOT AI output** and are always labelled as such; no confidence inflation (bands derive deterministically from the score).
6. **No CSP/security-headers pass yet** (SECURITY.md §11 is a Phase 3+ task); proxy cache-header copying implemented per official Supabase SSR guidance.

## 7. Future Pl@ntNet integration requirements (prepared, not activated)

1. Owner provides a valid server-only `PLANTNET_API_KEY` + sets `PLANTNET_MODE=live` **and grants explicit approval** (canonical decision 5).
2. Implement `src/lib/plantnet/live-provider.ts` with the same `identify()` signature; upstream mapping per API_DOCUMENTATION.md §2.8 (normalize.ts already shared). No client redesign needed — response shape is unchanged except `mode:"live"` and real `images[]` with CC citations.
3. Then: record first live result + `remainingIdentificationRequests` header handling (roadmap §10 item 4), image-reuse/citation rules check (VERIFIED_FACTS pending #3), and P2-10 "one manual live identification" documentation.
4. Before production: durable rate-limit/dedup decision (Phase 5 §5.3), `IP_HASH_SALT` on the host, valid `SUPABASE_SERVICE_ROLE_KEY`, Security-headers pass.

## 8. Fixed during this phase (Next.js 16 specifics)

- Proxy default 10 MB client-body cap truncated oversized uploads (contract 413 unreachable) → `experimental.proxyClientMaxBodySize: "34mb"` per bundled Next docs.
- `notFound()` inside `<Suspense>` streamed after the 200 shell → `/plant/[slug]` made a documented blocking route (`instant = false`) for real 404s.
- `NEXT_PUBLIC_SITE_URL=""` (empty string) broke `new URL()` at build → `||` localhost fallback.
- Next.js 16 Cache Components constraints honored: cookie/searchParams reads inside `<Suspense>`; no blocking runtime data outside them.

## 9. Stop status

Phase 2 scope complete. **Stopped here by the owner's instruction.** Phase 3 (content & SEO) requires explicit owner approval. Nothing was committed or pushed; `.env.local` untouched; no existing owner documents overwritten — only the documentation updates listed in `CHANGELOG.md` [0.4.0].
