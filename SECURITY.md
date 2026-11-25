# PlantAI — Security Plan

> Scope: MVP security posture for PlantAI (Next.js App Router + Supabase + Pl@ntNet API v2, zero budget; Netlify Free is the current production host). This document defines what we protect, how, and which risks we consciously accept. Existing Netlify hosting is separate from the pending auth cutover: commit `0b17682` contains local Google OAuth changes, is local-only (not pushed to GitHub and not deployed to Netlify), and production OAuth cutover plus real authentication remain unverified. Do not describe local authentication code as deployed production behavior. Non-auth host deployment details, logging, and platform-level controls require owner verification; Vercel references below are historical planning context only.
> Facts about Pl@ntNet, Supabase, and the stack (quotas, plans, terms) are cited from [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md). Anything stated here without a source below is **UNVERIFIED** until checked at implementation time.
> Related: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) · [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) · [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md) · [`LEGAL_AND_COMPLIANCE.md`](LEGAL_AND_COMPLIANCE.md) · [`TESTING_PLAN.md`](TESTING_PLAN.md)
>
> **Auth status (2026-11-25):** the current local repository implements direct Supabase Google OAuth with PKCE and SSR cookies; session identity is verified server-side via `auth.getClaims()` (`src/lib/auth/session.ts`, `src/proxy.ts`) — `getSession()` user data is never trusted for authorization. `/login` and `/signup` show only Google; `/reset-password` is a redirect-only form and existing recovery links cannot complete a password reset. Legacy `/auth/confirm` and `/auth/link` callbacks remain in source for rollback/outstanding email links, but source presence is not proof that email-link completion works. Commit `0b17682` is local-only (not pushed to GitHub, not deployed to Netlify); existing Netlify hosting is separate from this pending OAuth cutover, and production OAuth cutover plus real authentication remain unverified. Supabase automatic verified-email identity linking (including access to an existing UUID) is expected provider behavior but is **owner E2E unverified**; PlantAI does not promise or implement an existing-user lookup (`docs/GOOGLE_OAUTH_SETUP.md`). Auth error messages are privacy-safe and never echo provider details. `.env.local` verified git-ignored and source review found no client-side secret reads, but no automated CI/build or `.next` bundle secret scan proves bundle safety (§2.2). PlantAI application code reads raw IPs only from request headers, does not log raw IPs, and uses salted SHA-256 hashes both for in-memory rate-limit counters and for persisted `contact_messages.ip_hash`; Netlify platform logging/access-log behavior remains owner-unverified. Mock identification responses are transparently labelled (`mode:"mock"` + `mockNotice`) and never presented as real AI output.

---

## Table of Contents

1. [Threat model summary (STRIDE-lite)](#1-threat-model-summary-stride-lite)
2. [Secrets & environment variables](#2-secrets--environment-variables)
3. [Pl@ntNet API protection](#3-plantnet-api-protection)
4. [Authentication security](#4-authentication-security)
5. [Input validation](#5-input-validation)
6. [File upload security](#6-file-upload-security)
7. [Rate limiting & abuse protection](#7-rate-limiting--abuse-protection)
8. [Database security (RLS-first)](#8-database-security-rls-first)
9. [Privacy protection](#9-privacy-protection)
10. [OWASP Top 10 mapping](#10-owasp-top-10-mapping)
11. [Security headers & CSP](#11-security-headers--csp)
12. [Dependency security](#12-dependency-security)
13. [Incident response basics](#13-incident-response-basics)
14. [Non-goals & consciously accepted risks](#14-non-goals--consciously-accepted-risks)

---

## 1. Threat model summary (STRIDE-lite)

MVP-level threat model: we identify actor types, the main abuse per actor, and the mitigation that ships in the MVP. This is deliberately "lite" — a full STRIDE data-flow diagram is a Phase 5 refinement.

| Actor / asset | Spoofing | Tampering | Repudiation | Information disclosure | Denial of service | Elevation of privilege |
|---|---|---|---|---|---|---|
| **Anonymous visitor** | Can't fake server-side rate-limit counters (counters are server state, keyed by IP + user) | Upload tampered/hostile images → server-side re-validation before upstream use | Upstream Pl@ntNet errors consume authenticated-server credits, not visitor's | Only public content served to visitors; no Supabase rows without auth | Enumeration of `/api/identify` → per-IP+per-user rate limit, 5/day anon (configurable) | None meaningful — no role, no DB rows without an account |
| **Authenticated user** | Supabase Auth issues real sessions; no custom session roll-your-own | Cannot override validation client-side (Route Handlers validate server-side) | `identifications` rows record user_id + created_at | Migration-defined RLS on ALL tables — intended user-row isolation (deployed policy state owner-unverified; see §8 and [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md)) | 20/day authenticated identify limit; storage quota 1 GB total (Supabase Free, per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) so abuse harms abuser too | `profiles.role` is set by the auth trigger and any `role` change during an UPDATE is rejected by `trg_guard_profile_role`; admin status is changed only by a deliberate SQL migration, not by an app RLS path |
| **Admin** | Admin policies use `is_admin()` from a real authenticated session; audit review is manual in MVP | `/admin` is currently a route stub; risk = admin account compromise → owner-controlled provider security (e.g. Google/Supabase MFA where available) remains owner-verified | Admin content changes visible via created_at/updated_at | Migration-defined RLS `is_admin()` is intended to let admins see contact_messages (deployed state owner-unverified), but that must not leak to public surfaces | n/a | Worst case = defacement through an implemented future admin panel; mitigation: least number of admins (ideally 1) |
| **Pl@ntNet dependency** (upstream) | Upstream outage is not spoofable by attacker, but quota numbers returned could be misread — they are opaque response/header data, never trusted for gating beyond local counters and not written to PlantAI application logs | Upstream result normalization: never render raw API fields into HTML (XSS via malicious species names?) — normalize + validate shape | n/a | We do not add account identifiers to Pl@ntNet; images may still contain visual or embedded metadata PII (see §3) | Upstream 429 (quota, resets midnight UTC — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) or upstream outage → served as 503 with cached/graceful fallback | None — upstream has no credentials into our system beyond our API key |
| **Photo abuse** (anyone) | — | Crafted images meant to exhaust our 500/day quota (errors ALSO consume 1 credit — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) | — | Canvas re-encoding may drop metadata as a side effect; no dedicated EXIF strip is implemented, and GPS is not extracted or stored server-side | Image-bomb uploads (≤10 MB, ≤3 images) | — |

Key insight: the scarcest asset is the **shared Pl@ntNet quota (500/day)** — a single abuser can starve the whole free tier for everyone. Rate limiting + strict pre-validation is therefore our highest-value control.

---

## 2. Secrets & environment variables

### 2.1 Inventory

Canonical names are fixed in CANONICAL PROJECT DECISIONS #6. No name may be renamed without updating [`ENVIRONMENT_SETUP.md`](ENVIRONMENT_SETUP.md) and [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md).

| Name | Where set | Exposure | Rotation notes |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `.env.local`, host environment settings (currently Netlify site env; historical Vercel project env) | Client (public by design) | No rotation needed (site URL, not a secret) |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, host environment settings, Supabase dashboard → Project settings → API | Client (public by design; docs say anon key + URL are safe to expose *when RLS is on*) | Rotate only if project keys/scoped JWT settings change |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, host environment settings, Supabase dashboard | Client (public; intended safety depends on migration-defined RLS being deployed and correct — owner-unverified) — **name updated 2026-11-10 per ADR-9 (new Supabase "Publishable key" naming; formerly `NEXT_PUBLIC_SUPABASE_ANON_KEY` in this doc's earlier versions)** | Rotate via Supabase "Regenerate key" if leaked; triggers brief client downtime until redeploy |
| `SUPABASE_SECRET_KEY` | `.env.local`, host environment settings (server-only), **never** in `NEXT_PUBLIC_*` | Server-only — bypasses RLS (`service_role` role); treat as root credential. **Canonical key per current Supabase docs: format `sb_secret_`**, name updated in Phase 2.5 (2026-11-12); a secret key is additionally rejected by Supabase when sent from a browser (`User-Agent` match → HTTP 401) | Rotate immediately on any suspected leak (Dashboard → API Keys); use one secret key per backend component to limit leak blast radius (official guidance) |
| `SUPABASE_SERVICE_ROLE_KEY` (legacy fallback) | `.env.local`, host environment settings (server-only), **never** in `NEXT_PUBLIC_*` | Server-only legacy JWT — **deprecated by Supabase by end of 2026**; accepted by this codebase only as a fallback via `getServerSupabaseSecretKey()` (`src/lib/env.ts`) when `SUPABASE_SECRET_KEY` is unset. **Historical Phase 2 finding:** a legacy value was rejected by Supabase ("Invalid API key") — use `SUPABASE_SECRET_KEY` and treat the fallback as owner-revalidated only | Same rotation policy; consider disabling legacy keys in Dashboard → API Keys after migration (official migration guide) |
| `PLANTNET_API_KEY` | `.env.local`, host environment settings (server-only), from my.plantnet.org → settings → API key | Server-only | Rotate in Pl@ntNet account settings; on leak, rotate + re-deploy; abusive usage of a leaked key is attributed to OUR account |
| `SUPABASE_DB_URL` (optional) | `.env.local` (dev only), Supabase dashboard | Server-only (local tooling) | Rotate password from dashboard if shared |

### 2.2 Rules (non-negotiable)

1. **Never commit real keys.** `.env.local` is gitignored; only `.env.example` with placeholder values is committed. Secret-key grepping exists only as a manual checklist item ([`TESTING_PLAN.md`](TESTING_PLAN.md) §8); no CI workflow or automated pre-commit secret scan is present in the repository.
2. **Keep `SUPABASE_SECRET_KEY` (modern) / legacy `SUPABASE_SERVICE_ROLE_KEY` and `PLANTNET_API_KEY` out of client bundles.** Source-level safeguards are described below; absence of secrets in built bundles is **not automatically verified** by CI or a build script.
   - In **Server Components / Route Handlers / Server Actions**, read via `process.env.X`. Next.js only exposes `NEXT_PUBLIC_*` replacements to client code; source review found no client-side reads of these secrets, and the modules that read them are server-side/guarded as below. Treat this as a source-level control, not an automated bundle-scan result.
   - Current safeguard: `server-only` is **not installed** (`package.json`/`node_modules`) and no source module imports `import "server-only"`. Instead, `requireServerOnly()` in `src/lib/env.ts` throws when `window` is defined; it is called by `src/app/api/identify/route.ts`, `src/lib/settings.ts`, `src/lib/identify/dedup-cache.ts`, `src/lib/plantnet/persistence.ts` and `src/lib/plantnet/live-provider.ts`. `tests/live-provider.test.ts` simulates a browser and verifies the live-provider import throws. This is a runtime guard plus a unit test, **not** a build-time import failure. `src/lib/plantnet/provider.ts` reads the Pl@ntNet key through env helpers without a direct guard.
   - Build-secret scanning is **not automated**: `TESTING_PLAN.md` §8 asks the owner to grep the built `.next` output for secret names and suspicious blobs, but there is no `package.json` script or CI workflow doing it. Client-bundle secret safety is therefore a source-reviewed control and manual checklist item, not an automatically verified property of the current build.
   - No CORS domain whitelisting exists on the Pl@ntNet free plan to make client-side calls "allowed" safely — the key is simply private, period ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).
3. **`.env.example` (committed) contains placeholders/empty values only** — e.g. `PLANTNET_MODE=mock` and an empty `PLANTNET_API_KEY=` (owner-managed value documented in comments, never checked in) — plus comments on where to obtain each key. **`.env.local` (gitignored)** holds real values locally; production secrets live in the current host's environment settings (Netlify site env; historical Vercel project env), never in the repo.
4. **Rotation procedure** (any key):
   1. Generate/obtain a new key at the provider (Supabase dashboard / my.plantnet.org).
   2. Update `.env.local` locally and the host environment variables (currently Netlify site env; historical Vercel env UI).
   3. Redeploy and verify the new value on the current host; exact env-injection and redeploy behavior requires owner verification.
   4. Invalidate/revoke the old key at the provider.
   5. Verify the app smoke-tests identify + login.
   6. If the leak reached a public git history: treat as burned; rotate immediately AND consider history rewrite for secrets (`git filter-repo` or fresh repo) — secrets in git history remain discoverable after commit deletion.

---

## 3. Pl@ntNet API protection

The API key is treated as the most abusable secret (its abuse directly consumes our shared free quota). Rules:

- **Server-only proxy.** All Pl@ntNet calls go through one server-side module (called from the `/api/identify` Route Handler and/or a Server Action). No client component may construct a Pl@ntNet URL. Rationale: free plan allows client-side CORS-whitelisted use, but PlantAI refuses that mode — key exposure + quota burn risk (per [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)).
- **Secret-in-query-parameter risk (verified 2026-11-12):** Pl@ntNet v2 authentication is the **`api-key` query parameter**, so the key is embedded in every request URL. Consequences:
  - **The full request URL must NEVER appear in application logs, diagnostics, error reports, analytics, or user-facing output.** Log the route (`POST /v2/identify/{project}`) and a redacted form (`…/v2/identify/all?key=REDACTED`) only.
  - Every error-reporting path (upstream 4xx/5xx handling, network-failure logging, dev-server output) must redact or strip query parameters before persisting anything.
  - The key stays server-only: read exclusively inside `src/lib/plantnet/`, never serialized to the client, never included in fetch responses, never stored in cookies or localStorage.
- **No CORS whitelisting** is performed on the Pl@ntNet side; we never enable browser-side calls.
- **Remaining quota is returned, not logged.** The response **body** field `remainingIdentificationRequests` and the documented upstream headers `RateLimit-Policy` / `RateLimit` / `Retry-After` ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md), verified 2026-11-12) are treated as opaque data; the route can surface a safe `X-RateLimit-Remaining-Upstream` header, while local counters are returned as `remainingQuota` / `X-RateLimit-Remaining`. Source contains no console/logger call that records upstream quota, remaining quota or rate-limit decisions. These values are not a security control (attacker-controlled input can't spoof them to us, providing them as "truth" would invite spoofing), and the full request URL must never be logged.
- **Upstream errors map to 503, never 429 pass-through confusion.** Upstream HTTP 429 (quota exceeded, resets midnight UTC — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)) is returned to clients as **HTTP 503 Service Unavailable** with a user-friendly message ("Our daily plant-recognition budget is exhausted; try again tomorrow"). Upstream 500s/998s also → 503. Rationale: a genuine 429 envelope means *quota exhausted*, not "you personally are over your limit"; exposing upstream semantics invites probing.
- PlantAI does not intentionally send account identifiers, email addresses, IP addresses or session tokens to Pl@ntNet. User-provided images are sent to the upstream identification provider and may contain personal visual content or embedded metadata. Canvas re-encoding may remove metadata when successful, but no dedicated EXIF stripping is guaranteed; compression failure may return the original image.
  - ✅ The 1–3 user images (required by the API), as multipart.
  - ✅ The Pl@ntNet project/flora slug (e.g. `world`) — application constant, not user input.
  - ❌ No account identifiers, email addresses, IP addresses, session tokens, timezone, browser fingerprint or other structured account/request data are added to the upstream request. The identify API accepts optional `latitude`/`longitude`, but current live-provider code does not forward them upstream (see §9).
- **Pre-validation before calling upstream** (strict): jpg/png only, ≤10 MB each per project decision (stricter than Pl@ntNet's 50 MB total), 1–3 images — because upstream *errors also consume 1 credit* ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)). Every rejected upload saves a shared credit.
- **One concurrency ceiling client-side is not enough**; the server holds a small in-flight counter and sheds extra requests with 503 rather than risking Pl@ntNet's 20-concurrent cap ([`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)). MVP implementation: simple counter, best-effort across serverless instances (documented limitation).

---

## 4. Authentication security

- **Provider: Supabase Auth only (local implementation).** The current repository implements Google OAuth with PKCE, but commit `0b17682` is local-only and has not been pushed to GitHub or deployed to Netlify; production OAuth cutover and real authentication remain unverified. Legacy email callback routes remain in source, while actual Email provider enablement in the Supabase Dashboard is owner-unverified. **No Firebase, custom password hashing, custom session tokens, custom JWT handling or custom identity merge** — the browser starts Supabase's Google flow and `/auth/callback` exchanges the PKCE code with the server client. Supabase Auth owns account creation, canonical UUIDs and sessions. Project-specific automatic identity linking, including whether a returning Google sign-in reaches an existing PlantAI UUID, is expected provider behavior but is **owner E2E unverified**; PlantAI code neither performs nor promises an existing-UUID lookup (`docs/GOOGLE_OAUTH_SETUP.md`).
- **Verified provider email / callback scope (owner E2E unverified).** Supabase is expected to link a Google identity to an existing account only when its verified email matches, and different verified Google emails should remain independent UUID accounts. This project has no source-level or completed E2E proof of that behavior; do not assume access to an existing UUID. The callback only fails closed on missing `code`, a provider `error`, an exchange error, or a result without a session and non-empty user id; it does not itself evaluate email matching or linking.
- **No functional password or recovery form.** `/login` and `/signup` expose only Google. `/reset-password` currently renders `ResetPasswordForm`, which immediately redirects to `/login?notice=password-obsolete`; existing legacy recovery links cannot complete a password reset. Restoration of a real password-recovery form is pending, so recovery links still cannot complete a password reset. Legacy `/auth/confirm` (email `token_hash`) and `/auth/link` (email PKCE) routes/helpers remain in source for verification/rollback and outstanding links; `/auth/confirm` forwards `type=recovery` links to the redirect-only `/reset-password` page. Source presence does not prove successful email-link completion. `/auth/link` renders `AuthLinkHandler`, which explicitly calls `exchangeCodeForSession(code)`, while the installed `@supabase/ssr` `createBrowserClient` sets `detectSessionInUrl` to `true` in a browser when no override is passed; this creates a potential automatic-versus-explicit PKCE exchange conflict over the same one-time code. Successful legacy PKCE email-link behavior is **unverified until SDK hardening and E2E verification** are completed.
- **Provider throttling.** Supabase Auth and Google enforce their own rate limits (exact values **UNVERIFIED** and owner-observable); PlantAI does not implement a local password endpoint. App-side identify/contact rate limits are unchanged (§7).
- **Session handling.**
  - Sessions are Supabase-issued JWTs with default refresh-token behavior and are persisted in SSR-compatible cookies. The browser client is `createBrowserClient(url, publishableKey)` with no custom `cookies` option (`src/lib/supabase/client.ts`), so `@supabase/ssr` uses its default browser cookie handling through `document.cookie`; browser JavaScript can read and write those cookies. Do not assume HttpOnly protection, and server-side authorization still relies on verified `getClaims()` rather than browser-readable session/user data.
  - Logout attempts global refresh-token revocation first, then always falls back to `signOut({ scope: "local" })` if the auth endpoint is unreachable, so this browser's cookies are cleared even offline. Server-side revocation is best-effort; already-issued access JWTs cannot be recalled before expiry.
  - The Next.js 16 proxy (`src/proxy.ts`) performs lightweight session refresh and route protection; protected Server Components also call `requireAuthRedirect()` and data protection is intended to be enforced by migration-defined RLS (deployed state owner-unverified; §8; defense in depth).
- **Route protection implementation:** `src/proxy.ts` (Next.js 16 replaces `middleware.ts`) verifies/refreshes claims once per request, protects `/dashboard`, `/my-plants`, `/saved-plants`, `/reminders` and `/account`, and bounces signed-in users from guest-only `/login`, `/signup` and `/forgot-password`; `/reset-password` is not in that guest-only list so a legacy link can always reach its redirect-only page. Query flags such as `?confirmed=1` are preserved through that bounce so success messages remain visible. Protected pages additionally call `requireAuthRedirect()` server-side.
- **Admin authorization.**
  - `profiles.role` values `'user' | 'admin'` only; migration 001's `trg_guard_profile_role` rejects any UPDATE that changes `role`, so app-side escalation (including by an admin session) is blocked. Role changes are a deliberate SQL-migration operation.
  - A Postgres `SECURITY DEFINER` helper `is_admin()` (`supabase/migrations/20260101000001_001_functions_triggers.sql`) provides the migration-defined RLS gate for admin policies on `profiles`, `plant_library`, `identifications`, owner tables, `blog_posts`, `contact_messages`, `app_settings` and `identification_cache` (deployed state owner-unverified; §8).
  - `/admin` is currently a route stub; no admin panel or admin Server Action exists in source. Admin authorization intent is expressed by migration-defined RLS, not by an implemented application surface; deployed policy state remains owner-unverified (§8).
- **OAuth `next` redirects** are re-validated with `safeAuthPath()` at both the button and callback; protocol-relative, backslash-normalized, absolute and control-character values fall back to `/dashboard`. Legacy email-link expiry still uses Supabase defaults.

---

## 5. Input validation

- **Zod schemas server-side everywhere.** Every Server Action and Route Handler validates an input object against an explicit Zod schema before touching Supabase or Pl@ntNet. Client-side schemas exist for UX feedback only and are treated as untrusted mirror copies.
- **Never trust the client.** Session/user IDs come from the Supabase session (server-derived), never from request bodies. Any `user_id` in a payload is ignored/overwritten server-side.
- **Multipart limits for `/api/identify`:**
  - Exactly 1–3 files; JPEG/PNG only; per-file byte length is checked against the configured limit (fallback 10 MB), and the total request body is guarded at 33 MB before parsing. `next.config.ts` sets `proxyClientMaxBodySize` to 34 mb so the Route Handler can return its own 413 instead of a proxy parse error.
  - The Route Handler reads `Content-Length` first, parses `formData()`, validates the three known form fields with Zod, rejects non-file/empty/oversized/wrong-magic-byte entries, and returns 413/400 before any Pl@ntNet call. Unknown form fields are ignored.
- **`next.config` protections** (implemented baseline in the installed Next.js version):
  - `reactStrictMode` remains enabled.
  - No custom webpack hacks that weaken the sandbox.
  - Security headers implemented under `headers()` — see §11.
  - Image handling (`next/image`) restricted to allowed remote patterns (`*.supabase.co` and `*.supabase.com`) — no arbitrary remote image loading.

---

## 6. File upload security

Follows CANONICAL DECISION #5 (jpg/png, ≤10 MB, 1–3 images). Client-side canvas compression is implemented in `src/lib/identify/image-compression.ts` (files above 1.5 MB, longest edge ≤2048, quality ladder 0.85 → 0.72 → 0.60, with honest fallback to the original). The authoritative checks are server-side `/api/identify` guards: total-body guard, multipart parse, Zod fields, magic-byte sniff and byte-length check. These run before the Pl@ntNet call; no request-image Storage upload exists today, so no "before Storage upload" validation is exercised. No separate dedicated EXIF-strip module is claimed.

| Control | How |
|---|---|
| **Magic-byte sniff, not extension-only** | `validateUploadedImage()` checks non-empty bytes and the actual signatures: JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`; the declared MIME type is never trusted. Renamed non-images are rejected before the upstream call. |
| **Server-side size check** | `Content-Length > 33 MB` is rejected with 413 before parsing; each parsed file's byte length is then checked against the configured per-image limit (fallback 10 MB) and rejected with 413 if too large. There is no current Storage upload step. |
| **Bucket layout (policy only; no upload path)** | Migration 003 defines private `request-images` and public `plant-images`. Policies exist, but source has no call to `storage.from(...)`, no upload path and no signed-URL generation. |
| **Path namespacing (policy design; not exercised)** | `request-images` policies expect `{user_id}/...`, and the private bucket is non-public. Current persistence writes `image_paths: []`; no request images are stored. |
| **RLS storage policies** | Migration 003 grants authenticated owners INSERT/SELECT on their own `request-images` folder and admins full access; `plant-images` is public-read with authenticated owner INSERT/UPDATE and admin full access. Service-role bypass is available to trusted server modules, but no storage client call exists in `src`. |
| **Serving** | Public plant-library imagery (`plant_library.image_url` / `plant-images`) uses public URLs and the `next/image` remote patterns. No signed URLs are generated for user identification images because those uploads are not implemented; migration comments describing short-lived signed URLs are a plan, not source behavior. |
| **No SVG uploads** | The identify route accepts only JPEG/PNG signatures; SVG cannot enter the current identify upload path. |
| **EXIF / GPS metadata** | Canvas re-encoding may drop metadata as a side effect; there is no dedicated strip module and no server-side EXIF extraction/storage. Optional GPS inputs are accepted by the API but are not forwarded by `live-provider.ts` or written by `persistence.ts` (see §9). |
| **Filenames** | No persistent user-image filename is stored. The live provider appends generated `image-N.jpg/png` fields to the upstream request, and `identifications.image_paths` is written as `[]`. |

---

## 7. Rate limiting & abuse protection

Per CANONICAL DECISION #4: per-IP + per-user counters; anonymous 5/day, authenticated 20/day; configurable in `app_settings`; simple server-side counters in MVP.

- **Enforcement point:** the `/api/identify` Route Handler — counted before the Pl@ntNet call. There is no separate identify Server Action in source.
- **Counters:** in-memory Map keyed by verified user id or salted SHA-256 IP hash. Honest limitation: serverless hosts can run multiple instances — counters are per-instance and best-effort; they may under-count across instances. Current Netlify instance behavior requires owner verification; the Vercel note here is historical. A Supabase-backed per-user count and a durable `rate_limits`/Redis store are future options, not implemented. **UNVERIFIED**: which durable option is available within zero budget at that time.
- **Contact form:** hidden `website` honeypot (filled submissions return a fake success), server-side Zod validation, and an in-memory 3/day limit per salted IP hash. On an allowed submission, `submitContact()` persists that same hash as `contact_messages.ip_hash`; it is not memory-only. There is no time-to-submit heuristic and no CAPTCHA in MVP.
- **Concurrent request ceiling:** in-process semaphore with 4 slots and a 64-waiter backstop, best-effort per instance; it is designed to stay under Pl@ntNet's 20-concurrent cap.

### Abuse scenarios & mitigations

| Scenario | Vector | Mitigation in MVP | Residual risk |
|---|---|---|---|
| **Enumerable uploads** (flood files to eat global quota) | `/api/identify` from many IPs | Per-IP daily cap; server-side validation rejects junk *before* upstream (junk still costs 0 because it never reaches Pl@ntNet) | Distributed attack across many IPs still flattens quota; accepted (see §14) |
| **Storage stuffing** (future risk if uploads are added) | valid-but-useless images to `request-images` | **Future design targets only:** no current request-image upload path, per-user object cap or automated cleanup/retention is implemented. The per-IP identify cap limits requests, but is not a storage control | If uploads are added, anonymous paths and quota exhaustion would need separate controls; per-IP limiting alone is not proof of storage safety |
| **Contact spam** | contact form | Honeypot + server-side Zod validation + per-IP-hash daily cap | Targeted spam can pass; no admin UI or bulk delete exists; migration 002 has no contact DELETE policy |
| **ID guessing** (enumerate other users' identifications/data) | GET endpoints / storage paths | RLS on database tables and UUID primary keys; no signed-URL implementation for user images because no user-image uploads exist | Low for current DB reads; future image serving would need its own controls |
| **OAuth abuse / session theft** | Google or Supabase auth endpoints | Locally implemented Google OAuth + PKCE + JavaScript-readable SSR cookies (no HttpOnly guarantee) + `getClaims()` route guards; owner-controlled provider/redirect configuration and production behavior remain unverified; no PlantAI password endpoint | Provider-level account/link correctness depends on owner configuration; real E2E pending |

---

## 8. Database security (RLS-first)

Principle (migration-defined; deployed Supabase state owner-unverified): **enable and force RLS for every table, with deny-by-default intent; service-role key usage is rare and co-located in dedicated server modules.**

Reference table matrix — **migration-defined policy expectations, not a verified snapshot of the deployed Supabase project**. Policy facts below are transcribed from migration 002, which enables and forces RLS for all listed tables. The currently deployed Supabase policy state remains **owner-unverified**; no dashboard or SQL inspection was performed for this pass. Full DDL in [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md):

| Table | Who can SELECT | Who can INSERT | Who can UPDATE | Who can DELETE |
|---|---|---|---|---|
| `profiles` | Owner (self) or `admin` | No client policy; auth trigger creates rows via `SECURITY DEFINER` | Owner (self), except `role` changes are rejected by `trg_guard_profile_role` | No policy; deletion follows `auth.users` cascade; service role bypasses RLS |
| `plant_library` | Published rows or `admin` | `admin` (`for all`) | `admin` (`for all`) | `admin` (`for all`) |
| `identifications` | Owner (`user_id = auth.uid()`) or `admin` | No policy; service-role client only | No policy (immutable under RLS) | No policy; no self-delete or retention job |
| `user_plants` | Owner or `admin` | Owner or `admin` | Owner or `admin` | Owner or `admin` |
| `care_reminders` | Owner or `admin` | Owner or `admin` | Owner or `admin` | Owner or `admin` |
| `saved_plants` | Owner or `admin` | Owner or `admin` | Owner or `admin` | Owner or `admin` |
| `blog_posts` | Published rows, author (`author_id = auth.uid()`), or `admin` | `admin` (`for all`) | `admin` (`for all`) | `admin` (`for all`) |
| `contact_messages` | `admin` | `anon`/`authenticated` (`with check (true)`) | `admin` | No policy (no implemented admin delete control) |
| `app_settings` | Everyone (`for select using (true)`) | `admin` (`for all`) | `admin` (`for all`) | `admin` (`for all`) |
| `identification_cache` (optional) | `admin` policy; service-role lookups bypass RLS | No user-facing policy; service-role upserts only | No user-facing policy; service-role hit-count updates only | No user-facing policy; service-role only |

- **Least privilege:** the anon key (client) can only reach rows a policy exposes; every client call must satisfy RLS directly. There is **no server-side "rails pattern" that lets the anon key bypass policy.**
- **Service-role usage policy:** allowed ONLY inside trusted server modules (currently `/api/identify` persistence via `src/lib/plantnet/persistence.ts`, gated by `PLANTAI_PERSISTENCE_ENABLED`; no retention cron or admin batch module exists). Each usage requires a code comment referencing which table policy intentionally bypasses and why. Service-role code lives next to the custom `requireServerOnly()` runtime guard.
- **No direct SQL from client.** All DB access goes through typed supabase-js modules; no dynamic SQL string building anywhere (see §10).
- **Identifications immutability:** the identification history cannot be edited by users (counts as honest usage records and prevents forged audit trails).
- **No direct table grants for `app_settings` secrets** — the table stores MVP knobs (rate limits), not credentials; credentials live in env vars only (§2).
- **Reconciled 2026-11-15 documentation note:** this table previously described an `is_public_key`-narrowed read policy; repository records (`PRE_MIGRATION_SAFETY_REVIEW.md` §1.3 and `POST_MIGRATION_VERIFICATION_REPORT.md` §6 item 5) describe the verbatim `p_app_settings_read_all for select using (true)` from `DATABASE_SCHEMA.md` §3.9 / migration 002. This is migration/documentation evidence, not independent verification of the currently deployed policy; the secrets rule above is unchanged and remains binding.

---

## 9. Privacy protection

Minimum is the maximum security here — we simply don't collect what we don't need.

> **Implementation status:** deletion, retention, request-image Storage uploads, signed URL generation and automated cleanup are planned targets, not implemented controls. `/account` currently exposes sign-out and pending-state copy; there is no account deletion flow, no storage upload path, no signed-URL generator and no cleanup job in source.

> **IP-hash storage detail (source-verified):** raw client IPs are read from request headers (`x-forwarded-for` / `x-real-ip`) only in request scope and are not written to application logs or database columns by PlantAI code. `/api/identify` derives `SHA-256(ip|IP_HASH_SALT)` for its in-memory counter only; `submitContact()` derives `SHA-256(rawIp:IP_HASH_SALT)` and uses that value both as the in-memory contact limiter key and as the persisted `contact_messages.ip_hash`. With `IP_HASH_SALT` configured, persisted hashes are stable; without it, `getIpHashSalt()` uses a per-process ephemeral salt, so hashes vary across instances/restarts. Migration 000 defines `ip_hash text` plus an index, and migration 002 has INSERT/SELECT/UPDATE policies but no DELETE policy. No application cleanup or retention job exists, so persisted contact hashes have no implemented retention period and remain until manual/service-role deletion. Netlify platform logging may still capture raw client IPs outside application code; that behavior remains owner-unverified.

### Data minimization list (MVP)

| Data | Collected? | Purpose | Removed/anonymized |
|---|---|---|---|
| Verified email / Google identity (Supabase Auth) | Yes, from Google at sign-in | Account creation and returning sign-in; automatic verified-email linking is expected but owner E2E unverified, with no promise of existing-UUID access | Planned on account deletion (not implemented) |
| Password hash | Legacy rollback accounts only; no PlantAI password UI | Not used by normal-use Google flow; `/reset-password` cannot set a new password | Planned on account deletion (not implemented); recovery-form restoration pending |
| Photo(s) (identification images) | Yes, transient multipart bytes for Pl@ntNet identify; no request-image Storage upload | Pl@ntNet identify | **90-day retention target — not implemented.** `persistence.ts` writes `image_paths: []`; no cleanup job exists. Canvas re-encoding may drop metadata as a side effect; PlantAI does not extract, store, or expose EXIF/GPS server-side |
| Species result / confidence | Yes in API response; DB persistence is gated by `PLANTAI_PERSISTENCE_ENABLED` and disabled by default | Show results, save to plant library | Planned on account deletion (not implemented) |
| Coarse location | Optional `latitude`/`longitude` are accepted by `/api/identify` when both are supplied and range-validated | No current upstream or persistence use: `live-provider.ts` does not forward them and `persistence.ts` does not store them | No stored location to remove |
| IP address (rate limiting / contact spam) | Raw IP read transiently from platform headers; never logged or persisted by PlantAI application code | Salted SHA-256 hashes for in-memory rate-limit counters; the contact hash is also persisted as `contact_messages.ip_hash` | Raw IP: request scope only. In-memory hashes: per-instance counters reset at the next 00:00 UTC and pruned. Persisted pseudonymous hash: stored in the nullable, indexed `contact_messages.ip_hash` with no automated retention/cleanup found; stable only when `IP_HASH_SALT` is configured. Netlify platform logging/access-log behavior remains owner-unverified; hashes are not sent to Pl@ntNet |
| User-submitted plant names/notes | Yes | My Plants feature | Planned on account deletion (not implemented) |
| Contact message | Yes (form), including a pseudonymous salted IP hash | Support / feedback | No implemented deletion control: migration 002 has no DELETE policy, `/admin` is a stub, and status updates have no application UI; deletion after resolution is a planned manual/admin action |

- **Delete-my-data (Phase 4 target — not implemented):** a planned account deletion action would remove the Supabase Auth user (cascading to `profiles`), then delete `identifications`, `user_plants`, `saved_plants`, `care_reminders`, and any future `request-images/{user_id}/*` storage objects. The current `/account` page exposes sign-out and pending-state copy; no deletion flow, storage cleanup or signed-URL generation exists in the source. Blog comments (if any ever exist) are planned to be pseudonymized rather than deleted when comments exist on others' posts (policy to spell out in [`LEGAL_AND_COMPLIANCE.md`](LEGAL_AND_COMPLIANCE.md)).
- **Public imagery is distinct from user uploads:** public plant-library/blog images use public URLs (including the public `plant-images` bucket and `image_url` fields). No user identification images are uploaded or served today; the private `request-images` bucket has policies, but there is no application upload path and no signed-URL implementation.

---

## 10. OWASP Top 10 mapping

| OWASP category (2021) | PlantAI exposure | Mitigation | Status |
|---|---|---|---|
| A01 Broken Access Control | Users reading others' data; admin reach | Migration-defined RLS on ALL tables + `is_admin()` (deployed state owner-unverified); middleware as UX guard only; Server Actions re-check auth server-side | Core control |
| A02 Cryptographic Failures | OAuth tokens, sessions, legacy password hashes | Handled by Supabase/Google over HTTPS; PKCE + SSR cookies; no client-side crypto rollup and no custom JWT handling | Inherited, don't break |
| A03 Injection | SQL, XSS | supabase-js parameterized queries; PostgREST operator filters; no string-concatenated SQL. XSS: React escapes by default, and blog `content_md` is rendered by `MarkdownLite` into React elements with no raw-HTML passthrough or `dangerouslySetInnerHTML`; inline Markdown renders as plain text. The only `dangerouslySetInnerHTML` use is `JsonLd`, which writes `JSON.stringify(data)` directly into a `<script type="application/ld+json">` element without escaping `<` as `\u003c` or applying an equivalent HTML-safe serializer. Blog and plant pages pass database-sourced `post.title` / `p.scientific_name` into that data, so a value containing `</script>` can terminate the script element; plain `JSON.stringify` is not sufficient protection in this HTML context. No HTML sanitizer is installed, and no sanitization occurs before blog rendering; `isomorphic-dompurify` remains a planned/deferred Phase 4 candidate for raw HTML. HTML-safe JSON-LD serialization is pending. No SVG file uploads (§6) | Raw-HTML blog path avoids untrusted HTML; JSON-LD script-context escaping not implemented — remediation pending |
| A04 Insecure Design | Quota starvation; planned storage stuffing | §7 abuse table; graceful 503 with user-facing message; no request-image upload/cleanup exists today | Quota control implemented; storage controls planned |
| A05 Security Misconfiguration | Loose headers, bucket exposure, storage policies; security headers §11; public `plant-images`, private `request-images` policies | Config review gate in [`TESTING_PLAN.md`](TESTING_PLAN.md) | Control defined |
| A06 Vulnerable Components | npm supply chain | Lockfile committed; `npm audit` in CI from Phase 5 (optional); "no random small deps" rule; fix-on-alert | Documented |
| A07 Identification & Authentication Failures | Brute force, session theft, unsafe redirects | Local Google OAuth + PKCE implementation + safe `next` re-validation + JavaScript-readable SSR cookies (no HttpOnly guarantee) + `getClaims()` guards; production cutover/real authentication unverified; automatic verified-email linking expected but owner E2E unverified; legacy email callbacks only, with password recovery redirect-only/pending | §4; provider/linking E2E owner-owned |
| A08 Software & Data Integrity | Supply chain, tampered deploys | Confirmed hosting fact: Netlify production is connected to `main`; that does not establish branch protection. No `netlify.toml` or GitHub Actions workflow is committed, so GitHub branch protection, deploy-preview behavior, and any required preview review or approval are not evidenced in-repo. Netlify dashboard deploy controls are owner-only and unverified; do not assume production deploys require preview review or approval. Vercel wording in older docs is historical | Documented; host gates owner-unverified |
| A09 Logging & Monitoring Failures | Silent abuse | Source-verified PlantAI logging is limited to `console.*` diagnostics: identify provider errors (code and upstream HTTP status), unexpected identify errors (message), missing/blank live-provider configuration, persistence skip/failure diagnostics (including a 12-character image-hash prefix), `app_settings` warnings, and a generic `[auth]` cookie-write warning. No source logging exists for normal identify requests/results, remaining or upstream quota values, rate-limit allow/deny decisions, or authentication attempts/failures. Console output may be captured by the current host, but Netlify runtime/access logs are a separate platform concern; their fields, retention and possible raw-IP capture are owner-unverified. Not a full SIEM | Best-effort, accepted (§14) |
| A10 SSRF | Our server fetching attacker URLs | We never fetch arbitrary URLs; outbound calls only to Pl@ntNet (fixed host) and Supabase | Not applicable by design |

---

## 11. Security headers & CSP

The MVP baseline is implemented in `next.config.ts` and applied to `/:path*`,
not merely proposed. The source sets:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains` — **without** `preload`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `X-Frame-Options: DENY`.
- An enforcing `Content-Security-Policy`: `default-src 'self'`; `script-src`
  with `'self' 'unsafe-inline'` plus explicitly allow-listed AdSense script
  origins (`'unsafe-eval'` is added only in development for HMR/Turbopack);
  `style-src 'self' 'unsafe-inline'`; `img-src 'self' data:` plus the
  validated HTTPS Supabase origin (when `NEXT_PUBLIC_SUPABASE_URL` is a
  `*.supabase.co`/`*.supabase.com` URL) and explicit AdSense image origins;
  `connect-src 'self'` plus that Supabase origin, `wss://<supabase-host>` for
  realtime, and explicit AdSense connect origins; `frame-src` for AdSense;
  `font-src 'self'`; `frame-ancestors 'none'`; `base-uri 'self'`;
  `form-action 'self'`; and `object-src 'none'`.
- `images.remotePatterns` restricts `next/image` to `https://*.supabase.co` and
  `https://*.supabase.com`.

The CSP remains deliberately loose for script/style (`unsafe-inline`) and is a
documented trade-off; nonce/strict-dynamic is a future evolution to verify with
the installed Next.js version. `Permissions-Policy` (camera for a future PWA,
geolocation off in MVP) is not part of the implemented baseline. No
`report-uri` or `report-to` directive is configured in `next.config.ts`; any
browser console reporting is incidental, not a configured endpoint or external
logging service.

**Implementation vs production verification:** these values are verified from
source code only. They do not independently prove the response headers returned
by the deployed Netlify site; the owner must verify live headers (for example
with `curl -I`) on Netlify before claiming production-verified behavior.
`docs/SECURITY_HEADERS_PROPOSAL.md` is the historical design record.

---

## 12. Dependency security

- **Lockfile (`package-lock.json`) is committed** and CI installs with `npm ci` (when CI exists).
- **"No random small deps"** rule: every new dependency needs a one-line reason in its PR/commit; prefer first-party (`@supabase/*`, `next`, `react`, `tailwindcss`) + zod. No HTML sanitizer is installed; `isomorphic-dompurify` is only a deferred Phase 4 candidate, not a current control. `JsonLd` also uses plain `JSON.stringify()` with no HTML-safe serializer; remediation is pending (§10).
- **`npm audit` in CI** is optional Phase 5 (deprioritized on zero budget — most audit noise is unpatchable low-severity; we don't let noise stop builds in MVP).
- **Known-risky lib pattern is used for JSON-LD, not blog HTML:** the sole `dangerouslySetInnerHTML` call is `JsonLd`; it writes `JSON.stringify(data)` into a `<script>` without escaping `<` as `\u003c`, and DB-sourced blog/plant titles reach that data. Blog bodies use `MarkdownLite` React elements instead (§10). The current blog path avoids raw HTML, but JSON-LD is not safe against a dynamic value containing `</script>` until an HTML-safe serializer is added. Adding raw HTML would additionally require an installed, applied sanitizer first.
- Scheduled dependency bumps (Renovay/Dependabot free tier) proposed for Phase 5, not MVP.

---

## 13. Incident response basics

No pager, no on-call — just a calm runbook.

**If a secret key leaks (committed to git, shared in a chat, scraped):**

1. **Rotate immediately** per §2.4 rotation procedure (provider dashboard → revoke old → set new in the current host's environment settings → redeploy).
2. Assess exposure window: was it in a public git history or just in private dev files?
3. If public git history: rotate is mandatory; rewrite history only if the repo is public and secrets are in recent commits (`git filter-repo`) or push a fresh repo (simpler on zero budget).
4. Check provider dashboards for anomalous usage during exposure (Pl@ntNet quota, Supabase audit logs).
5. Add a `docs/RETRO-<date>.md` note — what leaked, when, what changed.

**If Supabase Storage is abused (conditional: no request-image upload path exists today):**

1. If objects exist, identify offending `user_id`/object paths manually via the Supabase SQL editor and storage listing; no application admin tool exists.
2. Purge manually: delete objects and any related `identifications` rows. `contact_messages` has no DELETE policy, so deletion there is a manual/service-role action, not an implemented admin control.
3. Tighten the knob in `app_settings` (lower daily cap) — proves the configurability requirement.
4. If public bucket `plant-images` is defaced with hostile images: `service_role` delete of offending objects, tighten the write policy, restore known-good objects from a manual snapshot (Supabase Free has NO automatic backups — [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md) — so we do manual SQL/db dumps during development; storage objects need ad-hoc export if valuable).

**If the Pl@ntNet key is throttled/used abusively upstream:** rotate key + tighten per-IP cap + add per-user cap if anonymous flood is the vector.

Escalation path is trivial (solo dev): owner = responsible for all steps above.

---

## 14. Non-goals & consciously accepted risks

**Explicit non-goals for MVP (and beyond unless re-scoped):**

- No WAF or paid DDoS service (zero budget; host platform-level protection is what we get — currently Netlify, with exact controls requiring owner verification; Vercel wording is historical).
- No paid security scanners / pentests. Not affordable; basic checklist coverage in [`TESTING_PLAN.md`](TESTING_PLAN.md) instead.
- No full SSI/SOC2-style logging pipeline or real-time alerting.
- No hard bot CAPTCHA; honeypot only (§7).

**Residual risks consciously accepted (documented so we know we chose them):**

| Risk | Why accepted | Revisit when |
|---|---|---|
| Rate-limit counters are multi-instance best-effort (serverless) | Zero budget; MVP traffic; no durable per-user backstop is implemented | Any real abuse observed → Phase 5 durable rate_limits table / Redis (availability UNVERIFIED) |
| Hashed junk uploads could still theoretically starve global quota via many-IP attack | Would need meaningful attacker investment for a 500/day API; graceful 503 UX exists | First sign of real abuse |
| Canvas re-encoding may drop metadata; no dedicated EXIF strip exists and the server does not re-strip | We do not extract or store EXIF/GPS server-side; Pl@ntNet receives image bytes only | If image metadata becomes a stored feature |
| CSP has `unsafe-inline` in MVP | Nonce-based CSP needs middleware plumbing; deferred to Phase 5 | Phase 5 |
| Anonymous free uploads mean obuser can spoof with many IPs | Product decision: keep anonymous 5/day as core UX | Phase 4 accounts / Phase 5 abuse data |
| `/admin` is a route stub (no moderation UI, 2FA UI or audit log UI) | MVP admin = owner; RLS is the only app-facing authorization today; dashboard/provider-level 2FA remains owner-verified | Phase 4 admin panel |

---

*Last updated: 2026-11-25 (source-verified accuracy pass; unimplemented items are marked as targets). Cross-references: [`PROJECT_PLAN.md`](PROJECT_PLAN.md) · [`REQUIREMENTS.md`](REQUIREMENTS.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) · [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) · [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) · [`TESTING_PLAN.md`](TESTING_PLAN.md) · [`docs/VERIFIED_FACTS.md`](docs/VERIFIED_FACTS.md)*
